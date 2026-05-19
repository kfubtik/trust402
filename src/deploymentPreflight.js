import { config } from "./config.js";

const FREE_HOST_SUFFIXES = [
  "vercel.app",
  "workers.dev",
  "trycloudflare.com",
  "ngrok-free.app",
  "ngrok.io",
  "netlify.app",
  "pages.dev"
];

const REQUIRED_VERCEL_SECRETS = [
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID"
];

export function deploymentPreflight(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || "https://trust402.vercel.app");
  const productionWorkflow = workflowEvidence(input.productionDeployWorkflowText || "");
  const launchWorkflow = launchWorkflowEvidence(input.launchMonitorWorkflowText || "");
  const git = gitEvidence(input.gitRemote || "", input.gitHead || "");
  const vercelProject = vercelProjectEvidence(input.vercelProject || null);
  const domain = domainEvidence(baseUrl, input.customDomain || "");
  const githubCli = githubCliEvidence(input.githubCli || null);
  const vercelDeployment = vercelDeploymentEvidence(input.vercelDeployment || null, git.head);
  const autoDeployEvidence = {
    verified: Boolean(cfg.gitAutoDeployVerified || input.gitAutoDeployVerified || githubCli.autoDeployVerified),
    evidenceUrl: cfg.gitAutoDeployEvidenceUrl ||
      input.gitAutoDeployEvidenceUrl ||
      githubCli.autoDeployEvidenceUrl ||
      "",
    commitSha: cfg.gitAutoDeployCommitSha ||
      input.gitAutoDeployCommitSha ||
      githubCli.autoDeployCommitSha ||
      ""
  };
  const fallback = {
    readyToConfigure: productionWorkflow.present &&
      productionWorkflow.runsOnMainPush &&
      productionWorkflow.usesRequiredVercelSecrets &&
      productionWorkflow.deploysPrebuiltProd &&
      vercelProject.linked &&
      git.remoteLooksLikeTrust402,
    secretsConfigured: input.githubActionsSecretsConfigured ?? githubCli.secretsConfigured,
    requiredSecretNames: REQUIRED_VERCEL_SECRETS,
    manualReason:
      "GitHub Actions secret values cannot be read from the repo; configure them in GitHub Settings -> Secrets and variables -> Actions."
  };
  const gitHubApp = {
    connected: input.vercelGitConnected === true,
    connectAttempted: input.vercelGitConnectAttempted === true || Boolean(input.vercelGitConnectError),
    connectUrl: input.vercelGitConnectUrl || "https://github.com/kfubtik/trust402.git",
    connectCommand: "npx vercel@latest git connect https://github.com/kfubtik/trust402.git",
    lastConnectError: input.vercelGitConnectError || "",
    connectFailureKind: classifyGitConnectError(input.vercelGitConnectError || ""),
    requiredAccess:
      "Install or update the Vercel GitHub App so it can access the private kfubtik/trust402 repository."
  };
  const blockers = blockersFor({
    autoDeployEvidence,
    fallback,
    gitHubApp,
    domain,
    productionWorkflow,
    launchWorkflow,
    git,
    vercelProject,
    vercelDeployment
  });
  const status = autoDeployEvidence.verified && blockers.length === 0
    ? "verified"
    : fallback.readyToConfigure || gitHubApp.connected
      ? "blocked-manual-evidence"
      : "blocked-setup";

  return {
    ok: true,
    tool: "deployment.preflight",
    generatedAt: new Date().toISOString(),
    status,
    baseUrl,
    summary: {
      gitAutoDeployVerified: autoDeployEvidence.verified,
      fallbackReadyToConfigure: fallback.readyToConfigure,
      githubActionsSecretsConfigured: fallback.secretsConfigured,
      vercelGitConnected: gitHubApp.connected,
      githubCliAuthenticated: githubCli.authenticated,
      latestVercelDeploymentCommitSha: vercelDeployment.latestProductionDeployment?.commitSha || null,
      customDomainReady: domain.ready,
      blockers: blockers.length
    },
    git,
    vercelProject,
    productionWorkflow,
    launchWorkflow,
    gitHubApp,
    fallback,
    githubCli,
    vercelDeployment,
    domain,
    autoDeployEvidence,
    blockers,
    evidenceEnv: {
      TRUST402_GIT_AUTO_DEPLOY_VERIFIED: "true",
      TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL: "<push-triggered Vercel deployment or GitHub Actions run URL>",
      TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA: git.head || "<commit sha that triggered production deploy>",
      PUBLIC_BASE_URL: domain.ready ? baseUrl : "https://<custom-trust402-domain>"
    },
    nextActions: nextActions({ blockers, fallback, gitHubApp, domain }),
    safety: {
      readOnly: true,
      mutatesVercel: false,
      mutatesGitHub: false,
      readsSecretValues: false,
      printsSecretValues: false
    }
  };
}

function workflowEvidence(text) {
  const source = String(text || "");
  return {
    present: source.length > 0,
    runsOnMainPush: /push:\s*[\s\S]*branches:\s*\[\s*main\s*\]/m.test(source),
    canRunManually: source.includes("workflow_dispatch"),
    usesRequiredVercelSecrets: REQUIRED_VERCEL_SECRETS.every((name) => source.includes(name)),
    runsReleaseCheck: source.includes("npm run release:check"),
    deploysPrebuiltProd: source.includes("vercel@latest build --prod") &&
      source.includes("vercel@latest deploy --prebuilt --prod"),
    deploymentOutputCaptureSafe: !source.includes("| tee") || /set\s+-euo\s+pipefail/.test(source),
    smokesProductionAlias: source.includes("npm run smoke:x402 -- https://trust402.vercel.app"),
    strictLaunchMonitor: source.includes("npm run launch:monitor") && source.includes("--strict")
  };
}

function launchWorkflowEvidence(text) {
  const source = String(text || "");
  return {
    present: source.length > 0,
    canRunManually: source.includes("workflow_dispatch"),
    strictModeAvailable: source.includes("--strict"),
    externalDirectoryToggle: source.includes("include_external_directories")
  };
}

function gitEvidence(remote, head) {
  const normalizedRemote = String(remote || "");
  return {
    remote: normalizedRemote || null,
    head: String(head || "") || null,
    remoteLooksLikeTrust402: /github\.com[/:]kfubtik\/trust402(?:\.git)?$/i.test(normalizedRemote)
  };
}

function vercelProjectEvidence(project) {
  return {
    linked: Boolean(project?.projectId && project?.orgId),
    projectName: project?.projectName || null,
    projectIdConfigured: Boolean(project?.projectId),
    orgIdConfigured: Boolean(project?.orgId)
  };
}

function githubCliEvidence(probe) {
  const value = probe || {};
  const latestRun = value.latestDeployRun || null;
  const autoDeployVerified = Boolean(value.autoDeployVerified || value.latestSuccessfulDeployRunForHead);
  return {
    probed: Boolean(value.probed),
    available: value.available ?? null,
    authenticated: value.authenticated ?? null,
    secretsConfigured: value.secretsConfigured ?? null,
    requiredSecretNames: REQUIRED_VERCEL_SECRETS,
    workflowsVisible: value.workflowsVisible ?? null,
    latestDeployRun: latestRun ? {
      status: latestRun.status || null,
      conclusion: latestRun.conclusion || null,
      event: latestRun.event || null,
      headSha: latestRun.headSha || null,
      url: latestRun.url || null,
      createdAt: latestRun.createdAt || null
    } : null,
    autoDeployVerified,
    autoDeployEvidenceUrl: value.autoDeployEvidenceUrl || latestRun?.url || "",
    autoDeployCommitSha: value.autoDeployCommitSha || latestRun?.headSha || "",
    error: value.error || null,
    safety: {
      readsSecretValues: false,
      printsSecretValues: false,
      mutatesGitHub: false
    }
  };
}

function vercelDeploymentEvidence(probe, gitHead) {
  const value = probe || {};
  const latest = value.latestProductionDeployment || null;
  const commitSha = latest?.commitSha || "";
  return {
    probed: Boolean(value.probed),
    ok: value.ok ?? null,
    projectId: value.projectId || null,
    projectName: value.projectName || null,
    envKeysPresent: Array.isArray(value.envKeysPresent) ? value.envKeysPresent : [],
    latestProductionDeployment: latest ? {
      id: latest.id || null,
      url: latest.url || null,
      readyState: latest.readyState || null,
      target: latest.target || null,
      commitSha,
      commitRepo: latest.commitRepo || null,
      commitOrg: latest.commitOrg || null,
      commitRef: latest.commitRef || null,
      actor: latest.actor || null,
      githubDeployment: latest.githubDeployment ?? null,
      createdAt: latest.createdAt || null,
      readyAt: latest.readyAt || null
    } : null,
    latestCommitMatchesHead: Boolean(commitSha && sameCommit(commitSha, gitHead)),
    error: value.error || null,
    safety: {
      readsSecretValues: false,
      printsSecretValues: false,
      mutatesVercel: false
    }
  };
}

function domainEvidence(baseUrl, customDomain) {
  const host = safeHost(customDomain || baseUrl);
  const suffix = FREE_HOST_SUFFIXES.find((item) => host === item || host.endsWith(`.${item}`)) || null;
  return {
    host,
    ready: Boolean(host) && !suffix,
    freeHostingSuffix: suffix,
    reason: suffix
      ? "Some external directories reject free-hosting or dev-tunnel domains."
      : "Host is not on the known free-hosting/dev-tunnel blocklist."
  };
}

function blockersFor(input) {
  const blockers = [];
  if (!input.autoDeployEvidence.verified) {
    blockers.push(blocker(
      "git_auto_deploy_evidence_missing",
      "Push-triggered production deployment evidence has not been recorded."
    ));
  }
  if (!input.gitHubApp.connected &&
    input.gitHubApp.connectAttempted &&
    input.gitHubApp.connectFailureKind === "private_repo_access_denied") {
    blockers.push(blocker(
      "vercel_git_connect_private_repo_access_denied",
      "Vercel CLI could not connect kfubtik/trust402; the Vercel GitHub App needs access to the private repository."
    ));
  }
  if (input.autoDeployEvidence.verified &&
    input.autoDeployEvidence.commitSha &&
    input.git.head &&
    !sameCommit(input.autoDeployEvidence.commitSha, input.git.head)) {
    blockers.push(blocker(
      "git_auto_deploy_commit_stale",
      "Recorded Git auto-deploy evidence does not match the current HEAD commit."
    ));
  }
  if (input.vercelDeployment.probed &&
    input.vercelDeployment.latestProductionDeployment?.commitSha &&
    input.git.head &&
    !input.vercelDeployment.latestCommitMatchesHead) {
    blockers.push(blocker(
      "latest_vercel_deploy_commit_mismatch",
      "Latest observed Vercel production deployment does not match the current HEAD commit."
    ));
  }
  if (!input.gitHubApp.connected && !input.fallback.readyToConfigure) {
    blockers.push(blocker(
      "no_ready_git_deploy_path",
      "Neither Vercel GitHub App connection nor GitHub Actions fallback is ready to configure."
    ));
  }
  if (input.fallback.readyToConfigure && input.fallback.secretsConfigured !== true) {
    blockers.push(blocker(
      "github_actions_secrets_unverified",
      "GitHub Actions fallback exists, but Vercel secret values are not confirmed."
    ));
  }
  if (!input.productionWorkflow.strictLaunchMonitor) {
    blockers.push(blocker(
      "production_deploy_monitor_not_strict",
      "Production deploy workflow must run the launch monitor in strict mode."
    ));
  }
  if (!input.productionWorkflow.deploymentOutputCaptureSafe) {
    blockers.push(blocker(
      "production_deploy_capture_not_pipefail_safe",
      "Production deploy workflow captures the Vercel URL through a pipeline and must use set -euo pipefail."
    ));
  }
  if (!input.launchWorkflow.present) {
    blockers.push(blocker(
      "launch_monitor_workflow_missing",
      "Manual launch-monitor workflow is missing."
    ));
  }
  if (!input.git.remoteLooksLikeTrust402) {
    blockers.push(blocker(
      "git_remote_not_trust402",
      "origin remote must point to kfubtik/trust402."
    ));
  }
  if (!input.vercelProject.linked) {
    blockers.push(blocker(
      "vercel_project_not_linked",
      ".vercel/project.json must contain projectId and orgId for local deploy tooling."
    ));
  }
  if (!input.domain.ready) {
    blockers.push(blocker(
      "custom_domain_required",
      "Attach a non-free-hosting custom domain before final external directory completion."
    ));
  }
  return blockers;
}

function nextActions({ blockers, fallback, gitHubApp, domain }) {
  if (blockers.length === 0) return ["Push a harmless commit, confirm production deploy evidence, and record TRUST402_GIT_AUTO_DEPLOY_* env values."];
  const actions = [];
  if (!gitHubApp.connected && gitHubApp.connectFailureKind === "private_repo_access_denied") {
    actions.push("Open Vercel project trust402 -> Settings -> Git, then grant the Vercel GitHub App access to the private repo kfubtik/trust402 and rerun vercel git connect.");
  } else if (!gitHubApp.connected) {
    actions.push(gitHubApp.requiredAccess);
  }
  if (fallback.readyToConfigure && fallback.secretsConfigured !== true) {
    actions.push("Add VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID to GitHub Actions secrets.");
  }
  if (!domain.ready) actions.push("Attach a custom production domain and rerun smoke, x402 smoke, launch monitor, and directory checks.");
  actions.push(...blockers.map((item) => item.message));
  return Array.from(new Set(actions));
}

function blocker(id, message) {
  return { id, message };
}

function sameCommit(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a && b && (a === b || a.startsWith(b) || b.startsWith(a)));
}

function classifyGitConnectError(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return null;
  if (text.includes("private") || text.includes("access") || text.includes("not authorized")) {
    return "private_repo_access_denied";
  }
  if (text.includes("not found") || text.includes("typo")) return "repo_not_found_or_typo";
  return "unknown";
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}

function safeHost(value) {
  const raw = String(value || "").trim();
  if (raw && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(raw)) {
    return raw.toLowerCase();
  }
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
}
