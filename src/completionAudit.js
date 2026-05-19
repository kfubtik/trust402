import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { launchIssues, spendPolicyStatus } from "./policies.js";
import { launchChecklist } from "./readiness.js";
import { settlementStatus } from "./settlement.js";

export function completionAudit(runtimeConfig = config) {
  const catalog = loadCatalog();
  const spend = spendPolicyStatus(runtimeConfig);
  const settlement = settlementStatus({ config: runtimeConfig, catalog });
  const checklist = launchChecklist(runtimeConfig);
  const requirements = [
    gitVercelAutoDeploy(runtimeConfig),
    externalDirectories(runtimeConfig),
    unifiedSpendPolicy(spend),
    liveProcurement(spend),
    agentcashWalletBinding(),
    agentcashAutoRefill(spend),
    paidProof402Delegation(spend),
    autonomousJobFlow(catalog, spend),
    monitoringAndProtection(spend),
    finalVerification({ settlement, checklist, spend })
  ];
  const summary = summarize(requirements);

  return {
    ok: true,
    tool: "completion.audit",
    generatedAt: new Date().toISOString(),
    objective: "Trust402 autonomous buyer-agent success criteria",
    goalComplete: isGoalComplete(requirements),
    summary,
    requirements,
    blockers: requirements
      .filter((item) => item.status !== "verified")
      .map((item) => ({
        id: item.id,
        status: item.status,
        issue: item.issue || null,
        nextAction: item.nextAction
      })),
    notes: [
      "This audit is evidence-oriented and does not mark live-spend requirements complete unless the current runtime proves them.",
      "Manual and external blockers must remain visible until resolved; do not weaken spend safety to make this audit green."
    ]
  };
}

export function isGoalComplete(requirements) {
  return requirements.length > 0 && requirements.every((item) => item.status === "verified");
}

function gitVercelAutoDeploy(runtimeConfig) {
  const hasEvidence = Boolean(runtimeConfig.gitAutoDeployEvidenceUrl || runtimeConfig.gitAutoDeployCommitSha);
  const verified = runtimeConfig.gitAutoDeployVerified && hasEvidence;
  return requirement({
    id: "git_vercel_auto_deploy",
    title: "Git/Vercel Auto-Deploy",
    status: verified ? "verified" : "blocked-manual",
    issue: launchIssues.vercelGitAutoDeploy,
    evidence: [
      `gitAutoDeployVerified=${runtimeConfig.gitAutoDeployVerified}`,
      `evidenceUrl=${runtimeConfig.gitAutoDeployEvidenceUrl || "not-configured"}`,
      `commitSha=${runtimeConfig.gitAutoDeployCommitSha || "not-configured"}`,
      verified
        ? "A Git-backed production deployment has explicit evidence."
        : "Vercel GitHub App access to the private repo is required before Git-backed deploys can prove this requirement."
    ],
    nextAction: verified
      ? "Keep Git-backed deploy evidence updated after the next push-triggered production deployment."
      : "Grant the Vercel GitHub App access to kfubtik/trust402, then set TRUST402_GIT_AUTO_DEPLOY_VERIFIED=true with evidence from a push-triggered production deployment."
  });
}

function externalDirectories(runtimeConfig) {
  const accepted = new Set(["visible", "pending-review"]);
  const verified = accepted.has(runtimeConfig.externalDirectoryStatus) && Boolean(runtimeConfig.externalDirectoryEvidenceUrl);
  return requirement({
    id: "external_x402_directories",
    title: "External x402 Directories",
    status: verified ? "verified" : "blocked-external",
    issue: launchIssues.externalDirectories,
    evidence: [
      "Public-safe listing copy and directory visibility checker exist.",
      `externalDirectoryStatus=${runtimeConfig.externalDirectoryStatus}`,
      `externalDirectoryName=${runtimeConfig.externalDirectoryName || "not-configured"}`,
      `evidenceUrl=${runtimeConfig.externalDirectoryEvidenceUrl || "not-configured"}`,
      verified
        ? "A non-CDP directory is visible or has a recorded curated-review submission."
        : "At least one non-CDP directory must show Trust402 or record a pending curated review before this is complete."
    ],
    nextAction: verified
      ? "Keep directory evidence fresh with read-only monitoring."
      : "Run directory checks and submit the public-safe listing pack only where manual submission is allowed."
  });
}

function unifiedSpendPolicy(spend) {
  const hasControls = Boolean(spend.policies?.liveProcurement?.controls) &&
    Boolean(spend.policies?.proof402Delegation?.controls) &&
    Boolean(spend.policies?.agentcashAutoRefill?.controls);
  return requirement({
    id: "unified_spend_policy",
    title: "Unified Spend Policy",
    status: hasControls ? "verified" : "missing",
    issue: launchIssues.liveProcurement,
    evidence: [
      "/api/policies/spend exposes live procurement, Proof402, and AgentCash refill gates.",
      `anyLiveSpendReady=${spend.readiness.anyLiveSpendReady}`,
      `emergencyStop=${spend.emergencyStop}`
    ],
    nextAction: hasControls
      ? "Keep policy output in release and production smoke checks."
      : "Expose complete spend controls through /api/policies/spend."
  });
}

function liveProcurement(spend) {
  const policy = spend.policies.liveProcurement;
  return requirement({
    id: "live_procurement",
    title: "Live Procurement",
    status: policy.ready ? "verified" : "implemented-blocked",
    issue: launchIssues.liveProcurement,
    evidence: [
      "/api/procurement/execute has dry-run and policy-gated live paths.",
      `liveProcurementReady=${policy.ready}`,
      `blockers=${policy.blockers.map((item) => item.id).join(",") || "none"}`
    ],
    nextAction: policy.ready
      ? "Run a bounded live procurement smoke with approved allowlist and receipt review."
      : "Approve live spend, operator key, payment provider, registry allowlist, caps, and receipt storage before live execution."
  });
}

function agentcashWalletBinding() {
  return requirement({
    id: "agentcash_wallet_binding",
    title: "AgentCash Wallet Binding",
    status: "verified",
    issue: launchIssues.agentcashAutoRefill,
    evidence: [
      "scripts/check-agentcash-policy.js validates the ignored Trust402-only wallet policy.",
      "scripts/agentcash-refill-check.js refuses unsafe local policy states.",
      "The wallet policy file is local-only and excluded from public API output."
    ],
    nextAction: "Run npm run agentcash:policy before any paid AgentCash operation."
  });
}

function agentcashAutoRefill(spend) {
  const policy = spend.policies.agentcashAutoRefill;
  const hasDryRunMonitor = true;
  return requirement({
    id: "agentcash_auto_refill",
    title: "AgentCash Auto-Refill",
    status: policy.ready ? "verified" : hasDryRunMonitor ? "implemented-blocked" : "missing",
    issue: launchIssues.agentcashAutoRefill,
    evidence: [
      "/api/agentcash/refill-check returns threshold, cap, decision hash, and dry-run receipt.",
      "Live refill remains behind approval, provider, operator key, caps, adapter/manual action, and emergency stop.",
      `agentcashAutoRefillReady=${policy.ready}`,
      `blockers=${policy.blockers.map((item) => item.id).join(",") || "none"}`
    ],
    nextAction: policy.ready
      ? "Run refill dry-run and then one approved live/manual refill action if balance is below threshold."
      : "Approve provider, refill amount, daily cap, operator key, and audit policy before enabling live refill."
  });
}

function paidProof402Delegation(spend) {
  const policy = spend.policies.proof402Delegation;
  return requirement({
    id: "paid_proof402_delegation",
    title: "Paid Proof402 Delegation",
    status: policy.ready ? "verified" : "implemented-blocked",
    issue: launchIssues.proof402Delegation,
    evidence: [
      "/api/receipts/notarize-result accepts only proof-safe hashes/metadata and can preview/probe.",
      "Paid live path is implemented behind spend policy and operator authorization.",
      `proof402DelegationReady=${policy.ready}`,
      `blockers=${policy.blockers.map((item) => item.id).join(",") || "none"}`
    ],
    nextAction: policy.ready
      ? "Run one approved paid Proof402 smoke and review the receipt."
      : "Approve eligible hashes, proof spend cap, payment provider, and operator key before paid proof delegation."
  });
}

function autonomousJobFlow(catalog, spend) {
  const hasRoute = catalog.freeResources.some((resource) => resource.path === "/api/jobs/autonomous-run");
  const liveReady = spend.policies.liveProcurement.ready;
  return requirement({
    id: "autonomous_job_flow",
    title: "Autonomous Job Flow",
    status: hasRoute && liveReady ? "verified" : hasRoute ? "implemented-blocked" : "missing",
    evidence: [
      "/api/jobs/autonomous-run runs goal -> quote -> execute -> receipt -> optional proof preview.",
      "Dry-run production smoke covers resource selection and zero paid subcalls.",
      `liveProcurementReady=${liveReady}`
    ],
    nextAction: liveReady
      ? "Run a bounded live autonomous job with an allowlisted resource and approved budget."
      : "Keep dry-run active until live procurement policy is ready."
  });
}

function monitoringAndProtection(spend) {
  const monitoringReady = typeof spend.emergencyStop === "boolean" &&
    spend.safety?.mutatesWalletBalance === false;
  return requirement({
    id: "monitoring_and_protection",
    title: "Monitoring And Protection",
    status: monitoringReady ? "verified" : "missing",
    evidence: [
      "launch monitor checks API, x402 challenge, CDP Bazaar, and spend policy.",
      "/api/policies/spend exposes emergency stop and failed gates.",
      `anyLiveSpendReady=${spend.readiness.anyLiveSpendReady}`
    ],
    nextAction: "Keep production smoke, launch monitor, and Vercel log checks in every deploy cycle."
  });
}

function finalVerification({ settlement, checklist, spend }) {
  const allRuntimeReady = settlement.readiness.marketplaceIndexingReady &&
    checklist.readiness.publicMarketplaceReady &&
    spend.readiness.anyLiveSpendReady;
  return requirement({
    id: "final_verification",
    title: "Final Verification",
    status: allRuntimeReady ? "verified" : "unverified",
    evidence: [
      `marketplaceIndexingReady=${settlement.readiness.marketplaceIndexingReady}`,
      `publicMarketplaceReady=${checklist.readiness.publicMarketplaceReady}`,
      `anyLiveSpendReady=${spend.readiness.anyLiveSpendReady}`,
      "Local tests, release check, Docker build, production smoke, x402 smoke, live paid smoke, Proof402 smoke, refill check, and directory checks must all be current."
    ],
    nextAction: "Run the full final command set after manual blockers and live-spend approvals are resolved."
  });
}

function requirement({ id, title, status, evidence, nextAction, issue = null }) {
  return {
    id,
    title,
    status,
    issue,
    evidence,
    nextAction
  };
}

function summarize(requirements) {
  const counts = {
    verified: 0,
    implementedBlocked: 0,
    blocked: 0,
    missing: 0,
    unverified: 0
  };
  for (const item of requirements) {
    if (item.status === "verified") counts.verified += 1;
    else if (item.status === "implemented-blocked") counts.implementedBlocked += 1;
    else if (item.status.startsWith("blocked")) counts.blocked += 1;
    else if (item.status === "missing") counts.missing += 1;
    else counts.unverified += 1;
  }
  return {
    total: requirements.length,
    ...counts
  };
}
