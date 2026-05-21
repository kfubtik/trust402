import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_REPO = "kfubtik/trust402";
const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const EVIDENCE_SCHEMA = "trust402.github_actions_deploy_evidence.v1";
const ARTIFACT_NAME = "trust402-deployment-evidence";

export function githubActionsDeployEvidenceCheck(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const repo = normalizeRepo(input.repo || input.expectedRepo || DEFAULT_REPO);
  const gitHead = String(input.gitHead || "").trim();
  const evidence = normalizeEvidence(input.evidence || input.deploymentEvidence || input);
  const workflowRun = normalizeWorkflowRun(input.workflowRun || input.run || input.githubRun || null);
  const artifactPresent = Boolean(evidence);
  const blockers = blockersFor({
    baseUrl,
    repo,
    gitHead,
    evidence,
    workflowRun
  });
  const verified = blockers.length === 0;
  const evidenceHash = artifactPresent ? sha256Json(evidence) : null;
  const runUrl = evidence?.runUrl || workflowRun?.url || "";
  const headSha = evidence?.headSha || workflowRun?.headSha || "";

  return {
    ok: true,
    tool: "deployments.github_actions_evidence_check",
    generatedAt: new Date().toISOString(),
    status: verified
      ? "verified"
      : artifactPresent
        ? "blocked-evidence"
        : "needs-evidence",
    verified,
    baseUrl,
    repo,
    artifact: {
      name: ARTIFACT_NAME,
      present: artifactPresent,
      schema: evidence?.schema || null,
      schemaValid: evidence?.schema === EVIDENCE_SCHEMA,
      evidenceHash,
      deploymentUrl: evidence?.deploymentUrl || null,
      productionAlias: evidence?.productionAlias || null,
      headSha: evidence?.headSha || null,
      runUrl: evidence?.runUrl || null
    },
    workflowRun: workflowRun ? {
      status: workflowRun.status || null,
      conclusion: workflowRun.conclusion || null,
      event: workflowRun.event || null,
      headSha: workflowRun.headSha || null,
      url: workflowRun.url || null,
      pushTriggered: workflowRun.event === "push",
      successful: workflowRun.status === "completed" && workflowRun.conclusion === "success"
    } : null,
    checks: {
      artifactSchemaValid: evidence?.schema === EVIDENCE_SCHEMA,
      productionAliasMatches: evidence?.productionAlias === baseUrl,
      runUrlMatchesRepo: runUrl ? runUrlMatchesRepo(runUrl, repo) : false,
      evidenceHeadMatchesRun: evidence?.headSha && workflowRun?.headSha
        ? sameCommit(evidence.headSha, workflowRun.headSha)
        : null,
      evidenceHeadMatchesLocalHead: evidence?.headSha && gitHead
        ? sameCommit(evidence.headSha, gitHead)
        : null,
      workflowRunSuccessful: workflowRun
        ? workflowRun.status === "completed" && workflowRun.conclusion === "success"
        : null,
      workflowRunPushTriggered: workflowRun ? workflowRun.event === "push" : null
    },
    blockers,
    evidenceEnv: verified ? {
      TRUST402_GIT_AUTO_DEPLOY_VERIFIED: "true",
      TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL: runUrl,
      TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA: headSha
    } : null,
    verifyCommands: [
      `gh run list --repo ${repo} --workflow vercel-production-deploy.yml --limit 1 --json url,headSha,status,conclusion,event`,
      `gh run download --repo ${repo} --name ${ARTIFACT_NAME} --dir .local/github-actions-evidence`,
      `npm run deployment:github-actions-evidence-check -- ${baseUrl} --run-json=.local/github-actions-evidence/run.json --strict`,
      `npm run deployment:preflight -- ${baseUrl} --probe-github-cli --probe-vercel-api`
    ],
    nextAction: verified
      ? "Record TRUST402_GIT_AUTO_DEPLOY_* from evidenceEnv only after production smoke remains green."
      : nextActionFor(blockers),
    safety: {
      readOnly: true,
      mutatesGitHub: false,
      mutatesVercel: false,
      readsSecretValues: false,
      printsSecretValues: false,
      includesSecretValues: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false
    }
  };
}

function blockersFor({ baseUrl, repo, gitHead, evidence, workflowRun }) {
  const blockers = [];
  if (!evidence) {
    blockers.push(blocker("missing_deployment_evidence", "Provide deployment-evidence.json from the trust402-deployment-evidence artifact."));
    return blockers;
  }
  if (evidence.schema !== EVIDENCE_SCHEMA) {
    blockers.push(blocker("invalid_deployment_evidence_schema", `deployment-evidence.json schema must be ${EVIDENCE_SCHEMA}.`));
  }
  if (!evidence.runUrl || !runUrlMatchesRepo(evidence.runUrl, repo)) {
    blockers.push(blocker("invalid_run_url", "Evidence runUrl must point to the expected GitHub repository actions run."));
  }
  if (!evidence.headSha) {
    blockers.push(blocker("missing_head_sha", "Evidence headSha is required."));
  }
  if (gitHead && evidence.headSha && !sameCommit(evidence.headSha, gitHead)) {
    blockers.push(blocker("evidence_head_mismatch", "Evidence headSha does not match the current local HEAD."));
  }
  if (!evidence.deploymentUrl || !isHttpsUrl(evidence.deploymentUrl)) {
    blockers.push(blocker("invalid_deployment_url", "Evidence deploymentUrl must be an HTTPS deployment URL."));
  }
  if (evidence.productionAlias !== baseUrl) {
    blockers.push(blocker("production_alias_mismatch", "Evidence productionAlias must match the checked base URL."));
  }
  if (!workflowRun) {
    blockers.push(blocker("missing_workflow_run_metadata", "Provide GitHub workflow run metadata from gh run list to prove push-triggered success."));
  } else {
    if (workflowRun.status !== "completed" || workflowRun.conclusion !== "success") {
      blockers.push(blocker("workflow_run_not_successful", "GitHub Actions run must be completed successfully."));
    }
    if (workflowRun.event !== "push") {
      blockers.push(blocker("workflow_run_not_push_triggered", "Git/Vercel auto-deploy evidence must come from a push-triggered run."));
    }
    if (workflowRun.headSha && evidence.headSha && !sameCommit(workflowRun.headSha, evidence.headSha)) {
      blockers.push(blocker("workflow_head_mismatch", "Workflow run headSha does not match deployment evidence headSha."));
    }
    if (workflowRun.url && evidence.runUrl && workflowRun.url !== evidence.runUrl) {
      blockers.push(blocker("workflow_run_url_mismatch", "Workflow run URL does not match deployment evidence runUrl."));
    }
  }
  return blockers;
}

function normalizeEvidence(value) {
  if (!value || typeof value !== "object") return null;
  if (value.schema === EVIDENCE_SCHEMA || value.deploymentUrl || value.productionAlias || value.runUrl) {
    return {
      schema: String(value.schema || ""),
      repository: String(value.repository || ""),
      workflow: String(value.workflow || ""),
      runId: String(value.runId || ""),
      runAttempt: String(value.runAttempt || ""),
      runUrl: String(value.runUrl || ""),
      event: String(value.event || ""),
      ref: String(value.ref || ""),
      headSha: String(value.headSha || ""),
      deploymentUrl: String(value.deploymentUrl || ""),
      productionAlias: normalizeBaseUrl(value.productionAlias || ""),
      generatedAt: String(value.generatedAt || "")
    };
  }
  return null;
}

function normalizeWorkflowRun(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return null;
  return {
    status: String(raw.status || ""),
    conclusion: String(raw.conclusion || ""),
    event: String(raw.event || ""),
    headSha: String(raw.headSha || raw.head_sha || ""),
    url: String(raw.url || raw.html_url || "")
  };
}

function nextActionFor(blockers) {
  if (blockers.some((item) => item.id === "missing_deployment_evidence")) {
    return `Download the ${ARTIFACT_NAME} artifact from a successful push-triggered workflow run.`;
  }
  if (blockers.some((item) => item.id === "missing_workflow_run_metadata")) {
    return "Capture gh run list JSON for the same workflow run, then rerun this evidence check.";
  }
  return "Fix the deployment evidence blockers, then rerun the evidence check before recording TRUST402_GIT_AUTO_DEPLOY_*.";
}

function blocker(id, message) {
  return { id, message };
}

function normalizeRepo(value) {
  return String(value || DEFAULT_REPO).replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function runUrlMatchesRepo(runUrl, repo) {
  const expected = `https://github.com/${normalizeRepo(repo)}/actions/runs/`;
  return String(runUrl || "").startsWith(expected);
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || "")).protocol === "https:";
  } catch {
    return false;
  }
}

function sameCommit(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a && b && (a === b || a.startsWith(b) || b.startsWith(a)));
}
