import { config } from "./config.js";
import { paymentProviderReadiness } from "./paymentAdapters.js";

export const launchIssues = {
  vercelGitAutoDeploy: "https://github.com/kfubtik/trust402/issues/5",
  externalDirectories: "https://github.com/kfubtik/trust402/issues/6",
  agentcashAutoRefill: "https://github.com/kfubtik/trust402/issues/7",
  liveProcurement: "https://github.com/kfubtik/trust402/issues/8",
  proof402Delegation: "https://github.com/kfubtik/trust402/issues/9"
};

export function spendPolicyStatus(runtimeConfig = config) {
  const liveProcurement = liveProcurementPolicy(runtimeConfig);
  const proof402Delegation = proof402DelegationPolicy(runtimeConfig);
  const agentcashAutoRefill = agentcashAutoRefillPolicy(runtimeConfig);

  return {
    ok: true,
    tool: "policies.spend_status",
    generatedAt: new Date().toISOString(),
    mode: "dry-run-first",
    emergencyStop: runtimeConfig.emergencyStop,
    readiness: {
      liveProcurementReady: liveProcurement.ready,
      proof402DelegationReady: proof402Delegation.ready,
      agentcashAutoRefillReady: agentcashAutoRefill.ready,
      anyLiveSpendReady: liveProcurement.ready || proof402Delegation.ready || agentcashAutoRefill.ready
    },
    policies: {
      liveProcurement,
      proof402Delegation,
      agentcashAutoRefill
    },
    issues: launchIssues,
    safety: {
      paidSubcallsMadeByThisEndpoint: 0,
      sendsPaymentHeaders: false,
      readsPrivateKeys: false,
      storesPrivateKeys: false,
      mutatesWalletBalance: false,
      operatorApiKeyConfigured: Boolean(runtimeConfig.operatorApiKey)
    },
    nextActions: nextPolicyActions({ liveProcurement, proof402Delegation, agentcashAutoRefill })
  };
}

export function liveProcurementPolicy(runtimeConfig) {
  const blockers = [];
  const dailyRemainingUsd = dailyRemaining(runtimeConfig);
  if (runtimeConfig.emergencyStop) blockers.push(blocker("emergency_stop", "TRUST402_EMERGENCY_STOP or LIVE_EMERGENCY_STOP is true."));
  if (!runtimeConfig.liveSpendEnabled) blockers.push(blocker("live_spend_disabled", "LIVE_SPEND_ENABLED is false."));
  if (!runtimeConfig.operatorApiKey) blockers.push(blocker("missing_operator_key", "TRUST402_OPERATOR_API_KEY is not configured."));
  if (!isSupportedPaymentProvider(runtimeConfig.livePaymentProvider)) blockers.push(blocker("missing_payment_provider", "LIVE_PAYMENT_PROVIDER must be agentcash-mcp, cdp-x402, x402-fetch, or external-adapter."));
  const paymentAdapter = paymentProviderReadiness(runtimeConfig);
  if (isSupportedPaymentProvider(runtimeConfig.livePaymentProvider)) {
    blockers.push(...paymentAdapter.blockers);
  }
  if (!(runtimeConfig.liveMaxPerCallUsd > 0)) blockers.push(blocker("missing_per_call_cap", "LIVE_MAX_PER_CALL_USD must be greater than zero."));
  if (!(runtimeConfig.liveMaxPerJobUsd > 0)) blockers.push(blocker("missing_per_job_cap", "LIVE_MAX_PER_JOB_USD must be greater than zero."));
  if (!(runtimeConfig.liveDailyLimitUsd > 0)) blockers.push(blocker("missing_daily_cap", "LIVE_DAILY_LIMIT_USD must be greater than zero."));
  if (runtimeConfig.liveSpentTodayUsd < 0) blockers.push(blocker("invalid_spent_today", "LIVE_SPENT_TODAY_USD cannot be negative."));
  if (runtimeConfig.liveAllowedRegistries.length === 0) blockers.push(blocker("missing_registry_allowlist", "LIVE_ALLOWED_REGISTRIES must contain at least one approved registry."));
  if (runtimeConfig.liveMaxPerCallUsd > runtimeConfig.liveMaxPerJobUsd && runtimeConfig.liveMaxPerJobUsd > 0) {
    blockers.push(blocker("per_call_exceeds_job_cap", "LIVE_MAX_PER_CALL_USD cannot exceed LIVE_MAX_PER_JOB_USD."));
  }
  if (runtimeConfig.liveMaxPerJobUsd > runtimeConfig.liveDailyLimitUsd && runtimeConfig.liveDailyLimitUsd > 0) {
    blockers.push(blocker("job_cap_exceeds_daily_cap", "LIVE_MAX_PER_JOB_USD cannot exceed LIVE_DAILY_LIMIT_USD."));
  }
  if (runtimeConfig.liveDailyLimitUsd > 0 && runtimeConfig.liveSpentTodayUsd >= runtimeConfig.liveDailyLimitUsd) {
    blockers.push(blocker("daily_cap_exhausted", "LIVE_SPENT_TODAY_USD has reached LIVE_DAILY_LIMIT_USD."));
  }
  if (runtimeConfig.liveDailyLimitUsd > 0 && runtimeConfig.liveMaxPerJobUsd > dailyRemainingUsd) {
    blockers.push(blocker("job_cap_exceeds_daily_remaining", "LIVE_MAX_PER_JOB_USD cannot exceed remaining daily spend capacity."));
  }

  return {
    enabled: runtimeConfig.liveSpendEnabled,
    ready: blockers.length === 0,
    issue: launchIssues.liveProcurement,
    controls: {
      maxPerCallUsd: runtimeConfig.liveMaxPerCallUsd,
      maxPerJobUsd: runtimeConfig.liveMaxPerJobUsd,
      dailyLimitUsd: runtimeConfig.liveDailyLimitUsd,
      spentTodayUsd: runtimeConfig.liveSpentTodayUsd,
      dailyRemainingUsd,
      approvalThresholdUsd: runtimeConfig.liveApprovalThresholdUsd,
      allowedRegistriesCount: runtimeConfig.liveAllowedRegistries.length,
      endpointDenylistCount: runtimeConfig.liveEndpointDenylist.length,
      receiptLogMode: runtimeConfig.liveReceiptLogMode,
      paymentProvider: publicProvider(runtimeConfig.livePaymentProvider),
      paymentAdapter,
      operatorApiKeyConfigured: Boolean(runtimeConfig.operatorApiKey),
      emergencyStop: runtimeConfig.emergencyStop
    },
    blockers
  };
}

export function proof402DelegationPolicy(runtimeConfig) {
  const blockers = [];
  if (runtimeConfig.emergencyStop) blockers.push(blocker("emergency_stop", "TRUST402_EMERGENCY_STOP or LIVE_EMERGENCY_STOP is true."));
  if (runtimeConfig.proof402DelegationMode !== "live") {
    blockers.push(blocker("proof402_delegation_not_live", "PROOF402_DELEGATION_MODE is not live."));
  }
  if (!runtimeConfig.liveSpendEnabled) blockers.push(blocker("live_spend_disabled", "LIVE_SPEND_ENABLED is false."));
  if (!runtimeConfig.operatorApiKey) blockers.push(blocker("missing_operator_key", "TRUST402_OPERATOR_API_KEY is not configured."));
  if (!isSupportedPaymentProvider(runtimeConfig.livePaymentProvider)) blockers.push(blocker("missing_payment_provider", "LIVE_PAYMENT_PROVIDER must be agentcash-mcp, cdp-x402, x402-fetch, or external-adapter."));
  const paymentAdapter = paymentProviderReadiness(runtimeConfig);
  if (isSupportedPaymentProvider(runtimeConfig.livePaymentProvider)) {
    blockers.push(...paymentAdapter.blockers);
  }
  if (!runtimeConfig.proof402BaseUrl) blockers.push(blocker("missing_proof402_base_url", "PROOF402_BASE_URL is not configured."));
  if (!(runtimeConfig.proof402MaxSpendUsd > 0)) blockers.push(blocker("missing_proof402_spend_cap", "PROOF402_MAX_SPEND_USD must be greater than zero."));

  return {
    mode: runtimeConfig.proof402DelegationMode,
    ready: blockers.length === 0,
    issue: launchIssues.proof402Delegation,
    controls: {
      proof402BaseUrlConfigured: Boolean(runtimeConfig.proof402BaseUrl),
      maxSpendUsd: runtimeConfig.proof402MaxSpendUsd,
      paymentProvider: publicProvider(runtimeConfig.livePaymentProvider),
      paymentAdapter,
      operatorApiKeyConfigured: Boolean(runtimeConfig.operatorApiKey),
      emergencyStop: runtimeConfig.emergencyStop
    },
    blockers
  };
}

export function agentcashAutoRefillPolicy(runtimeConfig) {
  const blockers = [];
  if (runtimeConfig.emergencyStop) blockers.push(blocker("emergency_stop", "TRUST402_EMERGENCY_STOP or LIVE_EMERGENCY_STOP is true."));
  if (!runtimeConfig.agentcashAutoRefillApproved) blockers.push(blocker("agentcash_refill_not_approved", "AGENTCASH_AUTO_REFILL_APPROVED is false."));
  if (!runtimeConfig.agentcashAutoRefillEnabled) blockers.push(blocker("agentcash_refill_disabled", "AGENTCASH_AUTO_REFILL_ENABLED is false."));
  if (!runtimeConfig.agentcashAutoRefillProvider) blockers.push(blocker("missing_refill_provider", "AGENTCASH_AUTO_REFILL_PROVIDER is not configured."));
  if (runtimeConfig.agentcashAutoRefillProvider && !isSupportedRefillProvider(runtimeConfig.agentcashAutoRefillProvider)) {
    blockers.push(blocker("unsupported_refill_provider", "AGENTCASH_AUTO_REFILL_PROVIDER must be agentcash-mcp, external-adapter, or manual-action."));
  }
  if (runtimeConfig.agentcashAutoRefillProvider === "external-adapter" && !runtimeConfig.agentcashAutoRefillAdapterUrl) {
    blockers.push(blocker("missing_refill_adapter_url", "AGENTCASH_AUTO_REFILL_ADAPTER_URL is required for external-adapter refill."));
  }
  if (!runtimeConfig.operatorApiKey) blockers.push(blocker("missing_operator_key", "TRUST402_OPERATOR_API_KEY is not configured."));
  if (!(runtimeConfig.agentcashAutoRefillThresholdUsd > 0)) blockers.push(blocker("missing_refill_threshold", "AGENTCASH_AUTO_REFILL_THRESHOLD_USD must be greater than zero."));
  if (!(runtimeConfig.agentcashAutoRefillAmountUsd > 0)) blockers.push(blocker("missing_refill_amount", "AGENTCASH_AUTO_REFILL_AMOUNT_USD must be greater than zero."));
  if (!(runtimeConfig.agentcashAutoRefillDailyCapUsd > 0)) blockers.push(blocker("missing_refill_daily_cap", "AGENTCASH_AUTO_REFILL_DAILY_CAP_USD must be greater than zero."));
  if (
    runtimeConfig.agentcashAutoRefillAmountUsd > runtimeConfig.agentcashAutoRefillDailyCapUsd &&
    runtimeConfig.agentcashAutoRefillDailyCapUsd > 0
  ) {
    blockers.push(blocker("refill_amount_exceeds_daily_cap", "AGENTCASH_AUTO_REFILL_AMOUNT_USD cannot exceed AGENTCASH_AUTO_REFILL_DAILY_CAP_USD."));
  }

  return {
    approved: runtimeConfig.agentcashAutoRefillApproved,
    enabled: runtimeConfig.agentcashAutoRefillEnabled,
    ready: blockers.length === 0,
    issue: launchIssues.agentcashAutoRefill,
    controls: {
      thresholdUsd: runtimeConfig.agentcashAutoRefillThresholdUsd,
      refillAmountUsd: runtimeConfig.agentcashAutoRefillAmountUsd,
      dailyCapUsd: runtimeConfig.agentcashAutoRefillDailyCapUsd,
      provider: runtimeConfig.agentcashAutoRefillProvider || "not-configured",
      providerConfigured: Boolean(runtimeConfig.agentcashAutoRefillProvider),
      adapterConfigured: Boolean(runtimeConfig.agentcashAutoRefillAdapterUrl),
      walletBindingRequired: runtimeConfig.agentcashWalletBindingRequired,
      network: runtimeConfig.agentcashNetwork,
      operatorApiKeyConfigured: Boolean(runtimeConfig.operatorApiKey),
      emergencyStop: runtimeConfig.emergencyStop
    },
    blockers
  };
}

function nextPolicyActions({ liveProcurement, proof402Delegation, agentcashAutoRefill }) {
  const actions = [];
  if (!liveProcurement.ready) actions.push("Approve live procurement caps, registry allowlist, and receipt storage before setting LIVE_SPEND_ENABLED=true.");
  if (!proof402Delegation.ready) actions.push("Keep Proof402 delegation disabled until eligible hashes, proof caps, and receipt fields are approved.");
  if (!agentcashAutoRefill.ready) actions.push("Keep AgentCash auto-refill disabled until provider, threshold, amount, daily cap, and audit log are approved.");
  if (actions.length === 0) actions.push("Run a dry-run simulation and release check before any live spend action.");
  return actions;
}

function blocker(id, message) {
  return { id, message };
}

function isSupportedPaymentProvider(provider) {
  return ["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"].includes(provider);
}

function isSupportedRefillProvider(provider) {
  return ["agentcash-mcp", "external-adapter", "manual-action"].includes(provider);
}

function publicProvider(provider) {
  return provider && provider !== "disabled" ? provider : "not-configured";
}

function dailyRemaining(runtimeConfig) {
  if (!(runtimeConfig.liveDailyLimitUsd > 0)) return 0;
  return roundUsd(Math.max(0, runtimeConfig.liveDailyLimitUsd - Math.max(0, runtimeConfig.liveSpentTodayUsd || 0)));
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
