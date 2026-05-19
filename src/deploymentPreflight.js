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
  const autoDeployEvidence = {
    verified: Boolean(cfg.gitAutoDeployVerified || input.gitAutoDeployVerified),
    evidenceUrl: cfg.gitAutoDeployEvidenceUrl || input.gitAutoDeployEvidenceUrl || "",
    commitSha: cfg.gitAutoDeployCommitSha || input.gitAutoDeployCommitSha || ""
  };
  const fallback = {
    readyToConfigure: productionWorkflow.present &&
      productionWorkflow.runsOnMainPush &&
      productionWorkflow.usesRequiredVercelSecrets &&
      productionWorkflow.deploysPrebuiltProd &&
      vercelProject.linked &&
      git.remoteLooksLikeTrust402,
    secretsConfigured: input.githubActionsSecretsConfigured ?? null,
    requiredSecretNames: REQUIRED_VERCEL_SECRETS,
    manualReason:
      "GitHub Actions secret values cannot be read from the repo; configure them in GitHub Settings -> Secrets and variables -> Actions."
  };
  const gitHubApp = {
    connected: input.vercelGitConnected === true,
    lastConnectError: input.vercelGitConnectError || "",
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
    vercelProject
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
      customDomainReady: domain.ready,
      blockers: blockers.length
    },
    git,
    vercelProject,
    productionWorkflow,
    launchWorkflow,
    gitHubApp,
    fallback,
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
  if (!gitHubApp.connected) actions.push(gitHubApp.requiredAccess);
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

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}
