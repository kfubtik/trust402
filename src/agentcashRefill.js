import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json, sha256Text } from "./hash.js";
import { agentcashAutoRefillPolicy } from "./policies.js";
import { receiptBundle } from "./receipts.js";

export async function agentcashRefillCheck(input = {}, options = {}) {
  const cfg = options.config || config;
  const mode = normalizeMode(input.mode);
  const operatorAuthorized = options.operatorAuthorized === true;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const currentBalanceUsd = numberOrNull(input.currentBalanceUsd ?? input.balanceUsd ?? input.wallet?.balanceUsd);
  const amountRefilledTodayUsd = Math.max(numberOrNull(input.amountRefilledTodayUsd) ?? 0, 0);
  const policy = agentcashAutoRefillPolicy(cfg);
  const thresholdUsd = cfg.agentcashAutoRefillThresholdUsd;
  const refillAmountUsd = cfg.agentcashAutoRefillAmountUsd;
  const remainingDailyCapUsd = roundUsd(Math.max(cfg.agentcashAutoRefillDailyCapUsd - amountRefilledTodayUsd, 0));
  const hasBalance = currentBalanceUsd !== null;
  const belowThreshold = hasBalance ? currentBalanceUsd < thresholdUsd : null;
  const plannedRefillUsd = belowThreshold ? roundUsd(Math.min(refillAmountUsd, remainingDailyCapUsd)) : 0;
  const blockers = refillBlockers({
    mode,
    policy,
    operatorAuthorized,
    hasBalance,
    belowThreshold,
    plannedRefillUsd
  });
  const decisionHash = sha256Json({
    mode,
    currentBalanceUsd,
    thresholdUsd,
    refillAmountUsd,
    remainingDailyCapUsd,
    plannedRefillUsd,
    blockers
  });
  const decision = refillDecision({
    hasBalance,
    belowThreshold,
    plannedRefillUsd,
    blockers,
    mode
  });
  const auditBundle = buildAgentcashRefillAuditBundle({
    mode,
    cfg,
    currentBalanceUsd,
    amountRefilledTodayUsd,
    thresholdUsd,
    refillAmountUsd,
    remainingDailyCapUsd,
    plannedRefillUsd,
    operatorAuthorized,
    policy,
    blockers,
    decision,
    decisionHash
  });

  const base = {
    ok: true,
    tool: "agentcash.refill_check",
    mode,
    generatedAt: new Date().toISOString(),
    balance: {
      currentBalanceUsd,
      thresholdUsd,
      belowThreshold,
      amountRefilledTodayUsd,
      remainingDailyCapUsd
    },
    policy: {
      approved: cfg.agentcashAutoRefillApproved,
      enabled: cfg.agentcashAutoRefillEnabled,
      provider: cfg.agentcashAutoRefillProvider || "not-configured",
      network: cfg.agentcashNetwork,
      refillAmountUsd,
      dailyCapUsd: cfg.agentcashAutoRefillDailyCapUsd,
      operatorAuthorized,
      emergencyStop: cfg.emergencyStop,
      blockers: policy.blockers
    },
    decision,
    decisionHash,
    auditBundle,
    receiptBundle: receiptBundle({
      subject: "AgentCash auto-refill decision",
      resultHash: decisionHash,
      payloadHash: decisionHash,
      purpose: "AgentCash refill policy audit"
    }),
    safety: {
      paidSubcallsMade: 0,
      readsPrivateKeys: false,
      storesPrivateKeys: false,
      mutatesWalletBalance: false,
      sendsPaymentHeaders: false
    }
  };

  if (mode !== "live") return base;

  if (blockers.length > 0) {
    throw new ApiError(403, "agentcash_refill_policy_blocked", "AgentCash auto-refill is blocked by policy.", {
      decisionHash,
      blockers,
      liveRefillExecuted: false,
      auditBundle
    });
  }

  if (!belowThreshold) {
    const noRefillDecision = {
      ...base.decision,
      status: "no-refill-needed",
      liveRefillExecuted: false
    };
    return {
      ...base,
      decision: noRefillDecision,
      auditBundle: buildAgentcashRefillAuditBundle({
        mode,
        cfg,
        currentBalanceUsd,
        amountRefilledTodayUsd,
        thresholdUsd,
        refillAmountUsd,
        remainingDailyCapUsd,
        plannedRefillUsd,
        operatorAuthorized,
        policy,
        blockers,
        decision: noRefillDecision,
        decisionHash
      })
    };
  }

  if (cfg.agentcashAutoRefillProvider === "external-adapter") {
    const adapterResult = await callRefillAdapter({
      cfg,
      fetchImpl,
      decisionHash,
      currentBalanceUsd,
      plannedRefillUsd,
      thresholdUsd
    });
    const liveDecision = {
      ...base.decision,
      status: "sent-to-refill-adapter",
      liveRefillExecuted: adapterResult.ok,
      adapterResult
    };
    return {
      ...base,
      decision: liveDecision,
      auditBundle: buildAgentcashRefillAuditBundle({
        mode,
        cfg,
        currentBalanceUsd,
        amountRefilledTodayUsd,
        thresholdUsd,
        refillAmountUsd,
        remainingDailyCapUsd,
        plannedRefillUsd,
        operatorAuthorized,
        policy,
        blockers,
        decision: liveDecision,
        decisionHash,
        adapterResult
      }),
      safety: {
        ...base.safety,
        mutatesWalletBalance: adapterResult.ok
      }
    };
  }

  const manualDecision = {
    ...base.decision,
    status: "operator-action-required",
    liveRefillExecuted: false,
    providerAction: {
      provider: cfg.agentcashAutoRefillProvider,
      network: cfg.agentcashNetwork,
      amountUsd: plannedRefillUsd,
      reason: "Provider is approved, but this runtime creates a safe refill action instead of holding refill credentials."
    }
  };

  return {
    ...base,
    decision: manualDecision,
    auditBundle: buildAgentcashRefillAuditBundle({
      mode,
      cfg,
      currentBalanceUsd,
      amountRefilledTodayUsd,
      thresholdUsd,
      refillAmountUsd,
      remainingDailyCapUsd,
      plannedRefillUsd,
      operatorAuthorized,
      policy,
      blockers,
      decision: manualDecision,
      decisionHash
    })
  };
}

function buildAgentcashRefillAuditBundle({
  mode,
  cfg,
  currentBalanceUsd,
  amountRefilledTodayUsd,
  thresholdUsd,
  refillAmountUsd,
  remainingDailyCapUsd,
  plannedRefillUsd,
  operatorAuthorized,
  policy,
  blockers,
  decision,
  decisionHash,
  adapterResult = null
}) {
  const core = {
    schema: "trust402.agentcash_refill_audit.v1",
    tool: "agentcash.refill_audit_bundle",
    mode,
    decisionHash,
    decision: {
      action: decision.action,
      status: decision.status,
      plannedRefillUsd: decision.plannedRefillUsd,
      liveRefillExecuted: decision.liveRefillExecuted === true
    },
    balance: {
      currentBalanceUsd,
      thresholdUsd,
      belowThreshold: currentBalanceUsd === null ? null : currentBalanceUsd < thresholdUsd,
      amountRefilledTodayUsd,
      remainingDailyCapUsd
    },
    policy: {
      approved: cfg.agentcashAutoRefillApproved,
      enabled: cfg.agentcashAutoRefillEnabled,
      provider: cfg.agentcashAutoRefillProvider || "not-configured",
      network: cfg.agentcashNetwork,
      refillAmountUsd,
      dailyCapUsd: cfg.agentcashAutoRefillDailyCapUsd,
      operatorAuthorized,
      emergencyStop: cfg.emergencyStop,
      blockers: blockers.map((item) => ({
        id: item.id,
        message: item.message
      }))
    },
    adapter: refillAdapterAudit({ cfg, adapterResult }),
    localWalletPolicy: {
      required: cfg.agentcashWalletBindingRequired,
      file: ".local/trust402-agentcash-wallet.json",
      publicOutputIncludesWalletSecret: false,
      publicOutputIncludesPrivateKey: false
    },
    safety: {
      publicSafe: true,
      paidSubcallsMade: 0,
      readsPrivateKeys: false,
      storesPrivateKeys: false,
      sendsPaymentHeaders: false,
      includesSecretValues: false,
      includesWalletPrivateKey: false,
      mutatesWalletBalance: adapterResult?.ok === true,
      rawAdapterResponseStored: false,
      adapterResponseStoredAs: adapterResult ? "sha256-only" : "not-observed"
    }
  };

  return {
    ...core,
    generatedAt: new Date().toISOString(),
    auditBundleHash: sha256Json(core),
    nextAction: mode === "live" && adapterResult?.ok === true
      ? "Store this public-safe refill audit bundle before marking AgentCash auto-refill evidence observed."
      : mode === "live"
        ? "Review blockers or manual provider action before retrying an approved refill window."
        : "Review this dry-run refill audit bundle before approving any live auto-refill policy."
  };
}

function refillAdapterAudit({ cfg, adapterResult }) {
  if (cfg.agentcashAutoRefillProvider !== "external-adapter") {
    return {
      provider: cfg.agentcashAutoRefillProvider || "not-configured",
      adapterConfigured: Boolean(cfg.agentcashAutoRefillAdapterUrl),
      urlOrigin: null,
      urlHash: null,
      resultObserved: false
    };
  }

  return {
    provider: "external-adapter",
    adapterConfigured: Boolean(cfg.agentcashAutoRefillAdapterUrl),
    urlOrigin: safeOrigin(cfg.agentcashAutoRefillAdapterUrl),
    urlHash: cfg.agentcashAutoRefillAdapterUrl ? sha256Text(cfg.agentcashAutoRefillAdapterUrl) : null,
    resultObserved: Boolean(adapterResult),
    ok: adapterResult?.ok === true,
    status: adapterResult?.status ?? null,
    bodyHash: adapterResult?.bodyHash || null
  };
}

function refillBlockers({ mode, policy, operatorAuthorized, hasBalance, belowThreshold, plannedRefillUsd }) {
  const blockers = [];
  if (!hasBalance) blockers.push({ id: "missing_current_balance", message: "Provide currentBalanceUsd before evaluating refill." });
  if (belowThreshold && plannedRefillUsd <= 0) blockers.push({ id: "refill_daily_cap_exhausted", message: "No refill can be planned because the daily refill cap is exhausted." });
  if (mode === "live") {
    blockers.push(...policy.blockers);
    if (!operatorAuthorized) blockers.push({ id: "operator_not_authorized", message: "Live refill requires x-trust402-operator-key." });
  }
  return blockers;
}

function refillDecision({ hasBalance, belowThreshold, plannedRefillUsd, blockers, mode }) {
  if (!hasBalance) {
    return {
      action: "collect-balance",
      status: "blocked",
      plannedRefillUsd: 0,
      liveRefillExecuted: false,
      blockers
    };
  }
  if (!belowThreshold) {
    return {
      action: "none",
      status: "balance-above-threshold",
      plannedRefillUsd: 0,
      liveRefillExecuted: false,
      blockers
    };
  }
  return {
    action: "refill",
    status: mode === "live" ? "pending-live-policy" : "dry-run-planned",
    plannedRefillUsd,
    liveRefillExecuted: false,
    blockers
  };
}

async function callRefillAdapter({ cfg, fetchImpl, decisionHash, currentBalanceUsd, plannedRefillUsd, thresholdUsd }) {
  if (!cfg.agentcashAutoRefillAdapterUrl) {
    throw new ApiError(403, "missing_refill_adapter_url", "AGENTCASH_AUTO_REFILL_ADAPTER_URL is required for external-adapter refill.", {
      liveRefillExecuted: false
    });
  }
  const response = await fetchImpl(cfg.agentcashAutoRefillAdapterUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Trust402 AgentCash refill/0.1",
      "idempotency-key": decisionHash
    },
    body: JSON.stringify({
      service: "Trust402",
      network: cfg.agentcashNetwork,
      amountUsd: plannedRefillUsd,
      currentBalanceUsd,
      thresholdUsd,
      reason: "Trust402 AgentCash balance below approved threshold."
    }),
    signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
  });
  const body = await responseJson(response);
  if (!response.ok) {
    throw new ApiError(response.status || 502, "refill_adapter_failed", "AgentCash refill adapter failed.", {
      liveRefillExecuted: false,
      status: response.status,
      bodyHash: sha256Json(body || {})
    });
  }
  return {
    ok: true,
    status: response.status,
    bodyHash: sha256Json(body || {}),
    bodySummary: summarizeBody(body)
  };
}

async function responseJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

function summarizeBody(body) {
  if (!body || typeof body !== "object") return body;
  return {
    ok: body.ok ?? null,
    id: typeof body.id === "string" ? body.id : null,
    keys: Object.keys(body).slice(0, 20)
  };
}

function normalizeMode(value) {
  return value === "live" ? "live" : "dry-run";
}

function numberOrNull(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function safeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
