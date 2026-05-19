import { resolve } from "node:path";

const APPROVED_LIVE_VALUES = new Set(["approved", "approved-for-manual-smoke"]);

export function evaluateAgentcashPolicyGuard(policy, options = {}) {
  const mode = normalizeMode(options.mode);
  const cwd = options.cwd || process.cwd();
  const expectedRoot = resolve(cwd);
  const allowedRoot = resolve(policy?.restrictions?.allowedProjectRoot || "");
  const expectedNetwork = options.network || "base";
  const expectedOrigins = options.expectedOrigins || [
    "https://trust402.vercel.app",
    "https://proof402.vercel.app"
  ];
  const includeProof = options.includeProof === true;
  const includeRefillLive = options.includeRefillLive === true || mode === "auto-refill";
  const estimatedMaxSpendUsd = numberOrNull(options.estimatedMaxSpendUsd) ?? 0;
  const failures = [];
  const warnings = [];

  if (!policy) {
    return {
      ok: false,
      mode,
      status: "not-configured",
      liveSpendAllowed: false,
      autoRefillAllowed: false,
      paidProofDelegationAllowed: false,
      failures: ["No local AgentCash policy file exists; live operator spend remains blocked."],
      warnings,
      approvals: {}
    };
  }

  if (policy.service !== "Trust402") failures.push("service must be Trust402");
  if (policy.status !== "dedicated-for-trust402-operator-spend") {
    failures.push("wallet status must reserve this wallet for Trust402");
  }
  if (allowedRoot.toLowerCase() !== expectedRoot.toLowerCase()) {
    failures.push("allowedProjectRoot must match current Trust402 root");
  }
  if (policy.wallet?.provider !== "AgentCash") failures.push("wallet provider must be AgentCash");
  if (policy.wallet?.network !== expectedNetwork) failures.push(`wallet network must be ${expectedNetwork}`);

  for (const origin of expectedOrigins) {
    if (!includes(policy.restrictions?.allowedOrigins, origin)) failures.push(`allowedOrigins must include ${origin}`);
  }

  const liveApproved = APPROVED_LIVE_VALUES.has(policy.restrictions?.trust402LiveProcurement);
  const proofApproved = APPROVED_LIVE_VALUES.has(policy.restrictions?.proof402Delegation);
  const autoRefillEnabled = policy.limits?.autoRefill?.enabled === true;
  const manualBudgetUsd = numberOrNull(policy.limits?.manualSmokeRemainingBudgetUsd);
  const globalMaxUsd = numberOrNull(policy.limits?.agentcashGlobalMaxAmountUsd);
  const lastVerifiedBalanceUsd = numberOrNull(policy.limits?.lastVerifiedBalanceUsd);
  const minimumReserveUsd = numberOrNull(policy.limits?.minimumReserveUsd);

  if (mode === "locked") {
    if (policy.restrictions?.trust402LiveProcurement !== "disabled-until-separate-approval") {
      failures.push("Trust402 live procurement must remain disabled until approval");
    }
    if (policy.restrictions?.proof402Delegation !== "disabled-until-separate-approval") {
      failures.push("Proof402 delegation must remain disabled until approval");
    }
    if (autoRefillEnabled) failures.push("auto-refill must remain disabled unless checking an approved refill window");
    if ((manualBudgetUsd || 0) > 0) failures.push("manual smoke budget must be separately approved before paid calls");
  }

  if (mode === "live-window") {
    if (!liveApproved) failures.push("Trust402 live procurement must be approved for the live window");
    if (includeProof && !proofApproved) failures.push("Proof402 delegation must be approved when proof is included");
    if (!(manualBudgetUsd > 0)) failures.push("manual smoke budget must be greater than zero for a live window");
    if (estimatedMaxSpendUsd > 0 && manualBudgetUsd !== null && estimatedMaxSpendUsd > manualBudgetUsd) {
      failures.push(`estimated spend ${estimatedMaxSpendUsd} exceeds manual smoke budget ${manualBudgetUsd}`);
    }
    if (estimatedMaxSpendUsd > 0 && globalMaxUsd !== null && estimatedMaxSpendUsd > globalMaxUsd) {
      failures.push(`estimated spend ${estimatedMaxSpendUsd} exceeds AgentCash global cap ${globalMaxUsd}`);
    }
    if (
      estimatedMaxSpendUsd > 0 &&
      lastVerifiedBalanceUsd !== null &&
      minimumReserveUsd !== null &&
      lastVerifiedBalanceUsd - estimatedMaxSpendUsd < minimumReserveUsd
    ) {
      failures.push("estimated spend would break the AgentCash minimum reserve");
    }
    if (autoRefillEnabled && !includeRefillLive) {
      warnings.push("auto-refill is enabled in local policy but this check did not request a refill-live window");
    }
  }

  if (mode === "auto-refill") {
    if (!autoRefillEnabled) failures.push("auto-refill must be enabled for an approved refill policy check");
    if (!(numberOrNull(policy.limits?.autoRefill?.futureThresholdUsd) > 0)) {
      failures.push("auto-refill futureThresholdUsd must be greater than zero");
    }
    if (manualBudgetUsd !== null && manualBudgetUsd < 0) failures.push("manual smoke budget cannot be negative");
  }

  return {
    ok: failures.length === 0,
    mode,
    status: failures.length === 0 ? "bound-to-trust402" : "blocked",
    liveSpendAllowed: mode === "live-window" && liveApproved && failures.length === 0,
    autoRefillAllowed: includeRefillLive && autoRefillEnabled && failures.length === 0,
    paidProofDelegationAllowed: includeProof && proofApproved && failures.length === 0,
    failures,
    warnings,
    approvals: {
      liveProcurement: policy.restrictions?.trust402LiveProcurement || null,
      proof402Delegation: policy.restrictions?.proof402Delegation || null,
      autoRefillEnabled,
      manualSmokeRemainingBudgetUsd: policy.limits?.manualSmokeRemainingBudgetUsd ?? null,
      agentcashGlobalMaxAmountUsd: policy.limits?.agentcashGlobalMaxAmountUsd ?? null,
      lastVerifiedBalanceUsd: policy.limits?.lastVerifiedBalanceUsd ?? null,
      minimumReserveUsd: policy.limits?.minimumReserveUsd ?? null
    }
  };
}

function normalizeMode(value) {
  if (value === "live-window" || value === "auto-refill") return value;
  return "locked";
}

function includes(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function numberOrNull(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
