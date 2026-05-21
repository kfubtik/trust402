import { autonomousRun } from "./autonomousJob.js";
import { config } from "./config.js";

const DEFAULT_GOAL = "Run daily buyer-side diligence on allowlisted x402 resources and produce receipts.";

export async function dailyAutonomyRun(input = {}, options = {}) {
  const cfg = options.config || config;
  const enabled = boolOr(input.enabled, cfg.dailyAutonomyEnabled);
  const requestedMode = normalizeMode(input.mode || cfg.dailyAutonomyMode);
  const liveRequested = requestedMode === "live";
  const liveBlockers = liveRequested ? liveModeBlockers({ cfg, options }) : [];
  const effectiveMode = liveRequested && liveBlockers.length === 0 ? "live" : "dry-run";

  if (!enabled) {
    return {
      ok: true,
      tool: "cron.daily_autonomy",
      status: "disabled",
      generatedAt: new Date().toISOString(),
      requestedMode,
      effectiveMode: "none",
      paidSubcallsMade: 0,
      safety: safetySummary({ cfg, effectiveMode: "none", liveBlockers }),
      nextSteps: [
        "Set TRUST402_DAILY_AUTONOMY_ENABLED=true to let the daily cron run a dry-run buyer-agent job.",
        "Set TRUST402_DAILY_AUTONOMY_MODE=live only after caps, allowlists, CRON_SECRET, and live approval are configured."
      ]
    };
  }

  const goal = stringOr(input.goal, cfg.dailyAutonomyGoal, DEFAULT_GOAL);
  const budgetUsd = positiveNumberOr(input.budgetUsd, cfg.dailyAutonomyBudgetUsd, 0.02);
  const maxPaidCalls = positiveIntegerOr(input.maxPaidCalls, cfg.dailyAutonomyMaxPaidCalls, 1);
  const includeProofPreview = boolOr(input.includeProofPreview, cfg.dailyAutonomyIncludeProofPreview);
  const proof402Mode = effectiveMode === "live"
    ? normalizeProofMode(input.proof402Mode || cfg.dailyAutonomyProof402Mode)
    : "preview";
  const jobInput = {
    ...input,
    goal,
    budgetUsd,
    maxPaidCalls,
    mode: effectiveMode,
    includeProofPreview,
    proof402Mode
  };

  const run = await autonomousRun(jobInput, {
    ...options,
    config: cfg,
    operatorAuthorized: effectiveMode === "live",
    autoApproveQuote: effectiveMode === "live"
  });

  return {
    ok: true,
    tool: "cron.daily_autonomy",
    status: "executed",
    generatedAt: new Date().toISOString(),
    requestedMode,
    effectiveMode,
    liveBlockers,
    policyWindow: {
      dailyAutonomyEnabled: enabled,
      dailyAutonomyLiveApproved: cfg.dailyAutonomyLiveApproved,
      liveSpendEnabled: cfg.liveSpendEnabled,
      livePaymentProvider: cfg.livePaymentProvider,
      maxPerCallUsd: cfg.liveMaxPerCallUsd,
      maxPerJobUsd: cfg.liveMaxPerJobUsd,
      dailyLimitUsd: cfg.liveDailyLimitUsd,
      allowedRegistriesCount: Array.isArray(cfg.liveAllowedRegistries) ? cfg.liveAllowedRegistries.length : 0
    },
    paidSubcallsMade: run.execution?.paidSubcallsMade || 0,
    resultHash: run.resultHash,
    run,
    safety: safetySummary({ cfg, effectiveMode, liveBlockers }),
    nextSteps: nextSteps({ requestedMode, effectiveMode, liveBlockers })
  };
}

function liveModeBlockers({ cfg, options }) {
  const blockers = [];
  if (options.cronAuthorized !== true) {
    blockers.push({
      id: "cron_not_authorized",
      message: "Daily live autonomy requires a valid CRON_SECRET Authorization header."
    });
  }
  if (!cfg.dailyAutonomyLiveApproved) {
    blockers.push({
      id: "daily_live_not_approved",
      message: "TRUST402_DAILY_AUTONOMY_LIVE_APPROVED is false."
    });
  }
  if (!cfg.liveSpendEnabled) {
    blockers.push({
      id: "live_spend_disabled",
      message: "LIVE_SPEND_ENABLED is false."
    });
  }
  return blockers;
}

function safetySummary({ cfg, effectiveMode, liveBlockers }) {
  return {
    scheduledAutonomy: true,
    requiresCronSecret: true,
    liveSpendEnabledByDefault: false,
    requestedLiveFallsBackToDryRun: liveBlockers.length > 0,
    mutatesWallet: effectiveMode === "live",
    livePaymentProvider: cfg.livePaymentProvider || "disabled",
    sendsPaymentHeaders: effectiveMode === "live",
    storesPrivatePayload: false
  };
}

function nextSteps({ requestedMode, effectiveMode, liveBlockers }) {
  if (requestedMode === "live" && effectiveMode !== "live") {
    return [
      "Cron ran in dry-run because live blockers remain.",
      ...liveBlockers.map((blocker) => blocker.message)
    ];
  }
  if (effectiveMode === "live") {
    return [
      "Review the daily run receipts, downstream payment responses, and remaining daily budget.",
      "Close or lower live caps if the next daily window should return to dry-run."
    ];
  }
  return [
    "Review the dry-run quote and audit.",
    "Promote daily autonomy to live only after the selected origins, caps, and proof mode are approved."
  ];
}

function boolOr(value, fallback) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return Boolean(fallback);
}

function stringOr(value, fallback, defaultValue) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized) return normalized;
  const fallbackValue = typeof fallback === "string" ? fallback.trim() : "";
  return fallbackValue || defaultValue;
}

function positiveNumberOr(value, fallback, defaultValue) {
  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const parsedFallback = Number.parseFloat(fallback);
  return Number.isFinite(parsedFallback) && parsedFallback > 0 ? parsedFallback : defaultValue;
}

function positiveIntegerOr(value, fallback, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const parsedFallback = Number.parseInt(fallback, 10);
  return Number.isFinite(parsedFallback) && parsedFallback > 0 ? parsedFallback : defaultValue;
}

function normalizeMode(value) {
  return value === "live" ? "live" : "dry-run";
}

function normalizeProofMode(value) {
  return ["disabled", "preview", "probe", "live"].includes(value) ? value : "preview";
}
