import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_REPO = "kfubtik/trust402";
const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_WORKFLOW_PATH = ".github/workflows/vercel-production-deploy.yml";
const REQUIRED_SECRET_NAMES = [
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID"
];
const DEPLOYMENT_EVIDENCE_ARTIFACT = "trust402-deployment-evidence";
const DEPLOYMENT_EVIDENCE_SCHEMA = "trust402.github_actions_deploy_evidence.v1";

export function githubActionsSetupPack(input = {}, options = {}) {
  const cfg = options.config || config;
  const repo = normalizeRepo(input.repo || DEFAULT_REPO);
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const workflowPath = input.workflowPath || DEFAULT_WORKFLOW_PATH;
  const workflowFile = workflowPath.split(/[\\/]/).pop();
  const project = normalizeVercelProject(input.vercelProject || {});
  const gitHead = String(input.gitHead || "").trim();
  const hasProjectIds = Boolean(project.projectId && project.orgId);
  const hasWorkflow = input.workflowPresent !== false;
  const status = hasProjectIds && hasWorkflow ? "ready-to-configure" : "blocked-project-link";

  const commandPlan = {
    setupSecrets: [
      secretSetCommand(repo, "VERCEL_ORG_ID", project.orgId || "<org-id-from-.vercel/project.json>"),
      secretSetCommand(repo, "VERCEL_PROJECT_ID", project.projectId || "<project-id-from-.vercel/project.json>"),
      secretSetCommand(repo, "VERCEL_TOKEN", "<paste-vercel-token-locally>")
    ],
    triggerAndVerify: [
      `gh workflow run ${workflowFile} --repo ${repo} --ref main`,
      `gh run list --repo ${repo} --workflow ${workflowFile} --limit 5`,
      `npm run deployment:preflight -- ${baseUrl} --probe-github-cli --probe-vercel-api`,
      `npm run smoke -- ${baseUrl}`,
      `npm run smoke:x402 -- ${baseUrl}`,
      `npm run launch:monitor -- ${baseUrl} --timeout-ms=10000 --skip-directories --strict`
    ],
    evidenceCapture: [
      `gh run list --repo ${repo} --workflow ${workflowFile} --limit 1 --json url,headSha,status,conclusion,event`,
      `gh run download --repo ${repo} --name ${DEPLOYMENT_EVIDENCE_ARTIFACT} --dir .local/github-actions-evidence`,
      `npm run deployment:preflight -- ${baseUrl} --probe-github-cli --probe-vercel-api`
    ]
  };
  const packCore = {
    repo,
    workflowPath,
    baseUrl,
    status,
    projectKnown: hasProjectIds,
    requiredSecretNames: REQUIRED_SECRET_NAMES,
    deploymentEvidenceArtifact: DEPLOYMENT_EVIDENCE_ARTIFACT,
    deploymentEvidenceSchema: DEPLOYMENT_EVIDENCE_SCHEMA,
    gitHead: gitHead || null
  };

  return {
    ok: true,
    tool: "deployments.github_actions_setup",
    generatedAt: new Date().toISOString(),
    status,
    setupPackHash: sha256Json(packCore),
    repo,
    baseUrl,
    workflow: {
      path: workflowPath,
      file: workflowFile,
      present: hasWorkflow,
      expectedTrigger: "manual workflow_dispatch only",
      productionAlias: baseUrl
    },
    vercelProject: {
      projectName: project.projectName || "trust402",
      projectIdConfigured: Boolean(project.projectId),
      orgIdConfigured: Boolean(project.orgId),
      projectId: project.projectId || null,
      orgId: project.orgId || null,
      source: project.source || "input-or-local-cli"
    },
    githubActions: {
      requiredSecretNames: REQUIRED_SECRET_NAMES,
      deploymentEvidenceArtifact: {
        name: DEPLOYMENT_EVIDENCE_ARTIFACT,
        files: [
          "deployment-url.txt",
          "deployment-evidence.json"
        ],
        schema: DEPLOYMENT_EVIDENCE_SCHEMA,
        requiredFields: [
          "schema",
          "runUrl",
          "headSha",
          "deploymentUrl",
          "productionAlias"
        ],
        evidenceEnvMapping: {
          TRUST402_GIT_AUTO_DEPLOY_VERIFIED: "true after the workflow completes and production smoke passes",
          TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL: "deployment-evidence.json runUrl",
          TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA: "deployment-evidence.json headSha"
        }
      },
      secretValuePolicy: {
        VERCEL_TOKEN: "never print; paste locally into GitHub secret storage",
        VERCEL_ORG_ID: "non-secret project link id from .vercel/project.json",
        VERCEL_PROJECT_ID: "non-secret project link id from .vercel/project.json"
      },
      commandPlan,
      operatorWarning:
        "The commands are instructions only. This API/CLI does not run gh, mutate GitHub, mutate Vercel, or read secret values."
    },
    evidenceEnv: {
      TRUST402_GIT_AUTO_DEPLOY_VERIFIED: "true",
      TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL: "<GitHub Actions run URL or Git-backed Vercel deployment URL>",
      TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA: gitHead || "<commit sha from the successful deployment run>"
    },
    blockers: blockersFor({ hasProjectIds, hasWorkflow }),
    nextAction: hasProjectIds
      ? "Add the three GitHub Actions secrets, trigger the workflow manually from main, then record the run URL and commit SHA after production smoke passes."
      : "Link the project with Vercel first or pass vercelProject.projectId and vercelProject.orgId from .vercel/project.json.",
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

function blockersFor({ hasProjectIds, hasWorkflow }) {
  const blockers = [];
  if (!hasWorkflow) {
    blockers.push({
      id: "github_actions_workflow_missing",
      message: `${DEFAULT_WORKFLOW_PATH} must exist before GitHub Actions auto-deploy can be configured.`
    });
  }
  if (!hasProjectIds) {
    blockers.push({
      id: "vercel_project_ids_missing",
      message: "VERCEL_ORG_ID and VERCEL_PROJECT_ID are required from .vercel/project.json."
    });
  }
  return blockers;
}

function secretSetCommand(repo, name, value) {
  return `gh secret set ${name} --repo ${repo} --body "${escapeForDoubleQuotes(value)}"`;
}

function escapeForDoubleQuotes(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function normalizeVercelProject(value) {
  const project = value || {};
  return {
    projectName: project.projectName || project.name || "",
    projectId: project.projectId || project.id || "",
    orgId: project.orgId || project.teamId || "",
    source: project.source || ""
  };
}

function normalizeRepo(value) {
  return String(value || DEFAULT_REPO).replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}
