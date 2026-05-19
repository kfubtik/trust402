import { config } from "./config.js";
import { evaluateLocalAgentcashPolicyForLive, readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";

const FREE_HOST_SUFFIXES = [
  ".vercel.app",
  ".workers.dev",
  ".trycloudflare.com",
  ".ngrok-free.app"
];

export function operatorUnblockReport(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || "https://trust402.vercel.app");
  const candidatePriceUsd = numberOr(input.candidatePriceUsd, 0.01);
  const proofReserveUsd = numberOr(input.proofReserveUsd, Math.max(cfg.proof402MaxSpendUsd || 0, 0.01));
  const includeProof = input.includeProof !== false;
  const includeAutonomous = input.includeAutonomous === true;
  const estimatedMaxSpendUsd = roundUsd(
    candidatePriceUsd * (includeAutonomous ? 2 : 1) +
    (includeProof ? proofReserveUsd : 0)
  );
  const localAgentcashPolicy = evaluateLocalAgentcashPolicyForLive({
    policyResult: options.localAgentcashPolicyResult || readLocalAgentcashPolicy({ cwd: options.cwd }),
    cwd: options.cwd,
    baseUrl,
    proof402BaseUrl: cfg.proof402BaseUrl || "https://proof402.vercel.app",
    estimatedMaxSpendUsd,
    includeProof,
    includeRefillLive: input.includeRefillLive === true
  });
  const hostPolicy = hostPolicyFor(baseUrl);

  const checks = [
    gitAutoDeployCheck(cfg, input),
    externalDirectoryCheck(cfg, hostPolicy),
    customDomainCheck(hostPolicy),
    liveProcurementCheck(cfg, localAgentcashPolicy),
    proof402DelegationCheck(cfg, localAgentcashPolicy),
    agentcashRefillCheck(cfg, localAgentcashPolicy, input.includeRefillLive === true),
    autonomousJobCheck(cfg),
    finalEvidenceCheck(cfg)
  ];

  const blockers = checks
    .filter((item) => item.required && item.status !== "ready")
    .map((item) => ({
      id: item.id,
      status: item.status,
      nextAction: item.nextAction
    }));

  return {
    ok: true,
    tool: "operator.unblock_report",
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0 ? "ready-for-final-window" : "blocked",
    baseUrl,
    estimatedMaxSpendUsd,
    summary: {
      totalChecks: checks.length,
      ready: checks.filter((item) => item.status === "ready").length,
      blocked: blockers.length,
      hostRequiresCustomDomain: hostPolicy.requiresCustomDomain,
      localAgentcashPolicyReady: localAgentcashPolicy.ok,
      gitAutoDeployVerified: cfg.gitAutoDeployVerified,
      liveSpendEnabled: cfg.liveSpendEnabled,
      proof402DelegationMode: cfg.proof402DelegationMode || "disabled",
      agentcashAutoRefillEnabled: cfg.agentcashAutoRefillEnabled
    },
    checks,
    blockers,
    nextActions: nextActions(blockers),
    safety: {
      readOnly: true,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      printsSecrets: false,
      localWalletAddressMasked: true
    }
  };
}

function gitAutoDeployCheck(cfg, input) {
  const ready = cfg.gitAutoDeployVerified &&
    Boolean(cfg.gitAutoDeployEvidenceUrl) &&
    Boolean(cfg.gitAutoDeployCommitSha);
  return {
    id: "git_vercel_auto_deploy",
    label: "Git/Vercel auto-deploy evidence",
    required: true,
    status: ready ? "ready" : "blocked-manual",
    evidence: {
      gitAutoDeployVerified: cfg.gitAutoDeployVerified,
      evidenceUrlConfigured: Boolean(cfg.gitAutoDeployEvidenceUrl),
      commitShaConfigured: Boolean(cfg.gitAutoDeployCommitSha),
      githubActionsFallbackPresent: input.githubActionsFallbackPresent ?? null,
      githubCliAuthenticated: input.githubCliAuthenticated ?? null,
      vercelProjectLinked: input.vercelProjectLinked ?? null
    },
    nextAction: ready
      ? "No action required."
      : "Connect the Vercel GitHub App or add GitHub Actions Vercel secrets, then record push-triggered deployment evidence."
  };
}

function externalDirectoryCheck(cfg, hostPolicy) {
  const ready = cfg.externalDirectoryStatus === "visible" &&
    Boolean(cfg.externalDirectoryEvidenceUrl) &&
    Boolean(cfg.externalDirectoryName);
  return {
    id: "external_x402_directories",
    label: "External x402 directory evidence",
    required: true,
    status: ready ? "ready" : hostPolicy.requiresCustomDomain ? "blocked-custom-domain" : "blocked-external",
    evidence: {
      status: cfg.externalDirectoryStatus,
      evidenceUrlConfigured: Boolean(cfg.externalDirectoryEvidenceUrl),
      directoryNameConfigured: Boolean(cfg.externalDirectoryName),
      host: hostPolicy.host,
      hostRequiresCustomDomain: hostPolicy.requiresCustomDomain
    },
    nextAction: ready
      ? "No action required."
      : hostPolicy.requiresCustomDomain
        ? "Attach a custom production domain before submitting to directories that reject free-hosting domains."
        : "Submit the public-safe listing pack and record a visible listing evidence URL."
  };
}

function customDomainCheck(hostPolicy) {
  return {
    id: "custom_domain",
    label: "Custom production domain",
    required: true,
    status: hostPolicy.requiresCustomDomain ? "blocked-custom-domain" : "ready",
    evidence: hostPolicy,
    nextAction: hostPolicy.requiresCustomDomain
      ? "Attach a non-free-hosting HTTPS domain to the Vercel project and update PUBLIC_BASE_URL."
      : "No action required."
  };
}

function liveProcurementCheck(cfg, localAgentcashPolicy) {
  const blockers = [];
  const dailyRemainingUsd = dailyRemaining(cfg);
  if (!cfg.liveSpendEnabled) blockers.push("LIVE_SPEND_ENABLED is false.");
  if (!cfg.operatorApiKey) blockers.push("TRUST402_OPERATOR_API_KEY is not configured locally for the evidence runner.");
  if (!["agentcash-mcp", "x402-fetch", "external-adapter"].includes(cfg.livePaymentProvider)) {
    blockers.push("LIVE_PAYMENT_PROVIDER must be agentcash-mcp, x402-fetch, or external-adapter.");
  }
  if (!Array.isArray(cfg.liveAllowedRegistries) || cfg.liveAllowedRegistries.length === 0) {
    blockers.push("LIVE_ALLOWED_REGISTRIES is empty.");
  }
  if (cfg.liveDailyLimitUsd > 0 && cfg.liveSpentTodayUsd >= cfg.liveDailyLimitUsd) {
    blockers.push("LIVE_SPENT_TODAY_USD has reached LIVE_DAILY_LIMIT_USD.");
  }
  blockers.push(...localAgentcashPolicy.blockers.map((item) => `${item.id}: ${item.message}`));
  return {
    id: "live_procurement",
    label: "Live procurement window",
    required: true,
    status: blockers.length === 0 ? "ready" : "blocked-policy",
    evidence: {
      liveSpendEnabled: cfg.liveSpendEnabled,
      paymentProvider: cfg.livePaymentProvider,
      operatorKeyConfigured: Boolean(cfg.operatorApiKey),
      allowedRegistriesCount: Array.isArray(cfg.liveAllowedRegistries) ? cfg.liveAllowedRegistries.length : 0,
      maxPerCallUsd: cfg.liveMaxPerCallUsd,
      maxPerJobUsd: cfg.liveMaxPerJobUsd,
      dailyLimitUsd: cfg.liveDailyLimitUsd,
      spentTodayUsd: cfg.liveSpentTodayUsd,
      dailyRemainingUsd,
      localAgentcashPolicy: localAgentcashPolicy.summary,
      blockers
    },
    nextAction: blockers.length === 0
      ? "Run one bounded live evidence smoke and review receipts."
      : "Approve live spend, operator key, payment provider, registry allowlist, caps, and local AgentCash smoke budget."
  };
}

function proof402DelegationCheck(cfg, localAgentcashPolicy) {
  const blockers = [];
  if (cfg.proof402DelegationMode !== "live") blockers.push("PROOF402_DELEGATION_MODE is not live.");
  if (!cfg.proof402BaseUrl) blockers.push("PROOF402_BASE_URL is not configured.");
  if (!(cfg.proof402MaxSpendUsd > 0)) blockers.push("PROOF402_MAX_SPEND_USD must be greater than zero.");
  if (!cfg.operatorApiKey) blockers.push("TRUST402_OPERATOR_API_KEY is not configured.");
  if (!localAgentcashPolicy.ok) blockers.push("Local AgentCash policy is not approved for paid Proof402 smoke.");
  return {
    id: "paid_proof402_delegation",
    label: "Paid Proof402 delegation window",
    required: true,
    status: blockers.length === 0 ? "ready" : "blocked-policy",
    evidence: {
      proof402BaseUrlConfigured: Boolean(cfg.proof402BaseUrl),
      proof402DelegationMode: cfg.proof402DelegationMode || "disabled",
      proof402MaxSpendUsd: cfg.proof402MaxSpendUsd,
      operatorKeyConfigured: Boolean(cfg.operatorApiKey),
      blockers
    },
    nextAction: blockers.length === 0
      ? "Run one approved paid Proof402 smoke for a public-safe hash."
      : "Approve Proof402 live mode, proof spend cap, operator key, and local proof delegation budget."
  };
}

function agentcashRefillCheck(cfg, localAgentcashPolicy, includeRefillLive) {
  const blockers = [];
  if (!cfg.agentcashAutoRefillApproved) blockers.push("AGENTCASH_AUTO_REFILL_APPROVED is false.");
  if (!cfg.agentcashAutoRefillEnabled) blockers.push("AGENTCASH_AUTO_REFILL_ENABLED is false.");
  if (!cfg.agentcashAutoRefillProvider) blockers.push("AGENTCASH_AUTO_REFILL_PROVIDER is not configured.");
  if (!cfg.operatorApiKey) blockers.push("TRUST402_OPERATOR_API_KEY is not configured.");
  if (includeRefillLive && !localAgentcashPolicy.ok) blockers.push("Local AgentCash policy is not approved for live auto-refill.");
  return {
    id: "agentcash_auto_refill",
    label: "AgentCash auto-refill policy",
    required: true,
    status: blockers.length === 0 ? "ready" : "blocked-policy",
    evidence: {
      approved: cfg.agentcashAutoRefillApproved,
      enabled: cfg.agentcashAutoRefillEnabled,
      provider: cfg.agentcashAutoRefillProvider || "not-configured",
      thresholdUsd: cfg.agentcashAutoRefillThresholdUsd,
      refillAmountUsd: cfg.agentcashAutoRefillAmountUsd,
      dailyCapUsd: cfg.agentcashAutoRefillDailyCapUsd,
      blockers
    },
    nextAction: blockers.length === 0
      ? "Run a refill dry-run/live evidence check under the approved provider policy."
      : "Approve provider, threshold, refill amount, daily cap, operator key, and emergency-stop policy."
  };
}

function autonomousJobCheck(cfg) {
  const ready = cfg.liveProcurementSmokeObserved &&
    Boolean(cfg.liveProcurementEvidenceRef) &&
    cfg.autonomousJobSmokeObserved &&
    Boolean(cfg.autonomousJobEvidenceRef);
  return {
    id: "autonomous_job_flow",
    label: "Autonomous live job evidence",
    required: true,
    status: ready ? "ready" : "blocked-evidence",
    evidence: {
      liveProcurementSmokeObserved: cfg.liveProcurementSmokeObserved,
      liveProcurementEvidenceRefConfigured: Boolean(cfg.liveProcurementEvidenceRef),
      autonomousJobSmokeObserved: cfg.autonomousJobSmokeObserved,
      autonomousJobEvidenceRefConfigured: Boolean(cfg.autonomousJobEvidenceRef)
    },
    nextAction: ready
      ? "No action required."
      : "Run bounded live procurement and autonomous job smokes, then record public-safe evidence refs."
  };
}

function finalEvidenceCheck(cfg) {
  const ready = cfg.finalVerificationObserved && Boolean(cfg.finalVerificationEvidenceRef);
  return {
    id: "final_verification",
    label: "Final verification evidence",
    required: true,
    status: ready ? "ready" : "blocked-evidence",
    evidence: {
      finalVerificationObserved: cfg.finalVerificationObserved,
      finalVerificationEvidenceRefConfigured: Boolean(cfg.finalVerificationEvidenceRef)
    },
    nextAction: ready
      ? "No action required."
      : "Run final verification after all non-final blockers are resolved, then record the public-safe final evidence ref."
  };
}

function hostPolicyFor(baseUrl) {
  let host = "";
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return {
      baseUrl,
      host: null,
      requiresCustomDomain: true,
      reason: "PUBLIC_BASE_URL is not a valid URL."
    };
  }
  const suffix = FREE_HOST_SUFFIXES.find((item) => host.endsWith(item));
  return {
    baseUrl,
    host,
    requiresCustomDomain: Boolean(suffix),
    freeHostingSuffix: suffix || null,
    reason: suffix
      ? "Some external directories reject free-hosting domains for production service listings."
      : "Host does not match the known free-hosting suffix list."
  };
}

function nextActions(blockers) {
  return blockers.length === 0
    ? ["All operator unblock checks are ready; run the final verification command set."]
    : blockers.map((item) => item.nextAction);
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function dailyRemaining(cfg) {
  if (!(cfg.liveDailyLimitUsd > 0)) return 0;
  return roundUsd(Math.max(0, cfg.liveDailyLimitUsd - Math.max(0, cfg.liveSpentTodayUsd || 0)));
}
