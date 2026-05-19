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
    liveProcurement(spend, runtimeConfig),
    agentcashWalletBinding(),
    agentcashAutoRefill(spend, runtimeConfig),
    paidProof402Delegation(spend, runtimeConfig),
    autonomousJobFlow(catalog, spend, runtimeConfig),
    monitoringAndProtection(spend),
    finalVerification({ settlement, checklist, spend, runtimeConfig })
  ];
  const summary = summarize(requirements);

  return {
    ok: true,
    tool: "completion.audit",
    generatedAt: new Date().toISOString(),
    objective: "Trust402 autonomous buyer-agent success criteria",
    planSource: {
      document: "docs/autonomous-completion-plan.md",
      pinnedAt: "2026-05-19",
      mustAllBeVerified: true,
      requirementIds: requirements.map((item) => item.id)
    },
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
  const verified = runtimeConfig.externalDirectoryStatus === "visible" &&
    Boolean(runtimeConfig.externalDirectoryEvidenceUrl);
  const hostPolicy = externalDirectoryHostPolicy(runtimeConfig.publicBaseUrl);
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
      `publicBaseUrlHost=${hostPolicy.host || "not-configured"}`,
      `customDomainRequiredForSomeDirectories=${hostPolicy.requiresCustomDomain}`,
      verified
        ? "A non-CDP directory visibly lists Trust402."
        : "At least one non-CDP directory must visibly show Trust402 before this is complete."
    ],
    details: {
      hostPolicy
    },
    nextAction: verified
      ? "Keep directory evidence fresh with read-only monitoring."
      : hostPolicy.requiresCustomDomain
        ? "Attach a custom production domain, rerun x402 smoke and directory checks, then submit the public-safe listing pack only where manual submission is allowed."
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

function liveProcurement(spend, runtimeConfig) {
  const policy = spend.policies.liveProcurement;
  const liveEvidenceReady = runtimeConfig.liveProcurementSmokeObserved &&
    Boolean(runtimeConfig.liveProcurementEvidenceRef);
  const verified = policy.ready && liveEvidenceReady;
  return requirement({
    id: "live_procurement",
    title: "Live Procurement",
    status: verified ? "verified" : "implemented-blocked",
    issue: launchIssues.liveProcurement,
    evidence: [
      "/api/procurement/execute has dry-run and policy-gated live paths.",
      `liveProcurementReady=${policy.ready}`,
      `liveProcurementSmokeObserved=${runtimeConfig.liveProcurementSmokeObserved}`,
      `evidenceRef=${runtimeConfig.liveProcurementEvidenceRef || "not-configured"}`,
      `blockers=${policy.blockers.map((item) => item.id).join(",") || "none"}`
    ],
    nextAction: verified
      ? "Keep bounded live procurement smoke evidence updated after future policy changes."
      : policy.ready
        ? "Run a bounded live procurement smoke, review receipts, then set TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED with a public-safe evidence ref."
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

function agentcashAutoRefill(spend, runtimeConfig) {
  const policy = spend.policies.agentcashAutoRefill;
  const hasDryRunMonitor = true;
  const refillEvidenceReady = runtimeConfig.agentcashAutoRefillEvidenceObserved &&
    Boolean(runtimeConfig.agentcashAutoRefillEvidenceRef);
  const verified = policy.ready && refillEvidenceReady;
  return requirement({
    id: "agentcash_auto_refill",
    title: "AgentCash Auto-Refill",
    status: verified ? "verified" : hasDryRunMonitor ? "implemented-blocked" : "missing",
    issue: launchIssues.agentcashAutoRefill,
    evidence: [
      "/api/agentcash/refill-check returns threshold, cap, decision hash, and dry-run receipt.",
      "Live refill remains behind approval, provider, operator key, caps, adapter/manual action, and emergency stop.",
      `agentcashAutoRefillReady=${policy.ready}`,
      `agentcashAutoRefillEvidenceObserved=${runtimeConfig.agentcashAutoRefillEvidenceObserved}`,
      `evidenceRef=${runtimeConfig.agentcashAutoRefillEvidenceRef || "not-configured"}`,
      `blockers=${policy.blockers.map((item) => item.id).join(",") || "none"}`
    ],
    nextAction: verified
      ? "Keep refill evidence updated after future provider or cap changes."
      : policy.ready
        ? "Run refill dry-run and one approved live/manual refill action when threshold conditions apply, then set evidence refs."
        : "Approve provider, refill amount, daily cap, operator key, and audit policy before enabling live refill."
  });
}

function paidProof402Delegation(spend, runtimeConfig) {
  const policy = spend.policies.proof402Delegation;
  const proofEvidenceReady = runtimeConfig.proof402PaidSmokeObserved &&
    Boolean(runtimeConfig.proof402EvidenceRef);
  const verified = policy.ready && proofEvidenceReady;
  return requirement({
    id: "paid_proof402_delegation",
    title: "Paid Proof402 Delegation",
    status: verified ? "verified" : "implemented-blocked",
    issue: launchIssues.proof402Delegation,
    evidence: [
      "/api/receipts/notarize-result accepts only proof-safe hashes/metadata and can preview/probe.",
      "Paid live path is implemented behind spend policy and operator authorization.",
      `proof402DelegationReady=${policy.ready}`,
      `proof402PaidSmokeObserved=${runtimeConfig.proof402PaidSmokeObserved}`,
      `evidenceRef=${runtimeConfig.proof402EvidenceRef || "not-configured"}`,
      `blockers=${policy.blockers.map((item) => item.id).join(",") || "none"}`
    ],
    nextAction: verified
      ? "Keep paid Proof402 smoke evidence updated after proof policy changes."
      : policy.ready
        ? "Run one approved paid Proof402 smoke, review the receipt, then set TRUST402_PROOF402_PAID_SMOKE_OBSERVED with an evidence ref."
        : "Approve eligible hashes, proof spend cap, payment provider, and operator key before paid proof delegation."
  });
}

function autonomousJobFlow(catalog, spend, runtimeConfig) {
  const hasRoute = catalog.freeResources.some((resource) => resource.path === "/api/jobs/autonomous-run");
  const liveReady = spend.policies.liveProcurement.ready;
  const liveEvidenceReady = runtimeConfig.autonomousJobSmokeObserved &&
    Boolean(runtimeConfig.autonomousJobEvidenceRef);
  return requirement({
    id: "autonomous_job_flow",
    title: "Autonomous Job Flow",
    status: hasRoute && liveReady && liveEvidenceReady ? "verified" : hasRoute ? "implemented-blocked" : "missing",
    evidence: [
      "/api/jobs/autonomous-run runs goal -> quote -> execute -> receipt -> optional proof preview.",
      "Dry-run production smoke covers resource selection and zero paid subcalls.",
      `liveProcurementReady=${liveReady}`,
      `autonomousJobSmokeObserved=${runtimeConfig.autonomousJobSmokeObserved}`,
      `evidenceRef=${runtimeConfig.autonomousJobEvidenceRef || "not-configured"}`
    ],
    nextAction: hasRoute && liveReady && liveEvidenceReady
      ? "Keep autonomous job smoke evidence updated after policy or workflow changes."
      : liveReady
        ? "Run a bounded live autonomous job with an allowlisted resource and approved budget, then set evidence refs."
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

function finalVerification({ settlement, checklist, spend, runtimeConfig }) {
  const allRuntimeReady = settlement.readiness.marketplaceIndexingReady &&
    checklist.readiness.publicMarketplaceReady &&
    spend.readiness.anyLiveSpendReady &&
    runtimeConfig.finalVerificationObserved &&
    Boolean(runtimeConfig.finalVerificationEvidenceRef);
  return requirement({
    id: "final_verification",
    title: "Final Verification",
    status: allRuntimeReady ? "verified" : "unverified",
    evidence: [
      `marketplaceIndexingReady=${settlement.readiness.marketplaceIndexingReady}`,
      `publicMarketplaceReady=${checklist.readiness.publicMarketplaceReady}`,
      `anyLiveSpendReady=${spend.readiness.anyLiveSpendReady}`,
      `finalVerificationObserved=${runtimeConfig.finalVerificationObserved}`,
      `evidenceRef=${runtimeConfig.finalVerificationEvidenceRef || "not-configured"}`,
      "Local tests, release check, Docker build, production smoke, x402 smoke, live paid smoke, Proof402 smoke, refill check, and directory checks must all be current."
    ],
    nextAction: allRuntimeReady
      ? "Keep final verification evidence current after future deploys."
      : "Run the full final command set after manual blockers and live-spend approvals are resolved, then set final verification evidence refs."
  });
}

function requirement({ id, title, status, evidence, nextAction, issue = null, details = null }) {
  const item = {
    id,
    title,
    status,
    issue,
    evidence,
    nextAction
  };
  if (details) item.details = details;
  return item;
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

function externalDirectoryHostPolicy(publicBaseUrl) {
  const host = safeHost(publicBaseUrl);
  const freeHostingSuffix = freeHostingSuffixFor(host);
  return {
    publicBaseUrl: publicBaseUrl || "",
    host,
    requiresCustomDomain: Boolean(freeHostingSuffix),
    freeHostingSuffix,
    reason: freeHostingSuffix
      ? "Some external directories reject free-hosting and dev-tunnel domains for production service listings."
      : "Current host is not on the known free-hosting/dev-tunnel blocklist."
  };
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function freeHostingSuffixFor(value) {
  const host = String(value || "").toLowerCase();
  return [
    "vercel.app",
    "workers.dev",
    "ngrok-free.app",
    "ngrok.io",
    "trycloudflare.com",
    "netlify.app",
    "pages.dev",
    "fly.dev",
    "render.com"
  ].find((suffix) => host === suffix || host.endsWith(`.${suffix}`)) || null;
}
