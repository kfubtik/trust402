import { autonomousRun } from "./autonomousJob.js";
import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_GOAL = "Run daily buyer-side diligence on allowlisted x402 resources and produce receipts.";
const DEFAULT_TRUST402_BASE_URL = "https://trust402.aztecbeacon.uk";
const DEFAULT_ACTION402_BASE_URL = "https://action402.vercel.app";
const DEFAULT_PROOF402_BASE_URL = "https://proof402.vercel.app";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TRUST402_PAY_TO = "0x3f4CEE4c6bad04FcCA3138dFFDEE579ddf17049B";
const ACTION402_PAY_TO = "0x75113dcF8Ce34f0338440D40270e420f8C1762b8";
const SLOTS = [
  { id: "morning", schedule: "10 1 * * *", utc: "01:10", krasnoyarsk: "08:10" },
  { id: "evening", schedule: "47 13 * * *", utc: "13:47", krasnoyarsk: "20:47" }
];
const DEFAULT_EXTERNAL_CATALOGS = [
  "https://x402-list.com/api/v1/services",
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search"
];
const DEFAULT_EXTERNAL_CATALOG_ORIGINS = [
  "https://x402-list.com",
  "https://api.cdp.coinbase.com"
];

export async function dailyAutonomyRun(input = {}, options = {}) {
  const cfg = options.config || config;
  const now = dateOr(input.now || options.now, new Date());
  const dateKey = dayKey(now);
  const currentSlot = typeof input.slot === "string" && input.slot.trim() ? input.slot.trim() : null;
  const randomSchedule = randomSchedulePlan({ cfg, dateKey, currentSlot });
  const enabled = boolOr(input.enabled, cfg.dailyAutonomyEnabled);
  const requestedMode = normalizeMode(input.mode || cfg.dailyAutonomyMode);

  if (!enabled) {
    const liveBlockers = requestedMode === "live" ? liveModeBlockers({ cfg, options }) : [];
    return {
      ok: true,
      tool: "cron.daily_autonomy",
      status: "disabled",
      generatedAt: new Date().toISOString(),
      requestedMode,
      effectiveMode: "none",
      randomSchedule,
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
  const interactionProfile = dailyInteractionProfile({ cfg, input, dateKey, budgetUsd });
  const liveRequested = requestedMode === "live";
  const liveBlockers = liveRequested ? liveModeBlockers({ cfg, options, interactionProfile }) : [];
  const effectiveMode = liveRequested && liveBlockers.length === 0 ? "live" : "dry-run";

  if (currentSlot && currentSlot !== randomSchedule.selectedSlot) {
    return {
      ok: true,
      tool: "cron.daily_autonomy",
      status: "skipped",
      reason: "not_today_random_slot",
      generatedAt: new Date().toISOString(),
      requestedMode,
      effectiveMode: "none",
      randomSchedule,
      paidSubcallsMade: 0,
      safety: safetySummary({ cfg, effectiveMode: "none", liveBlockers }),
      nextSteps: [
        `Today's selected slot is ${randomSchedule.selectedSlot}; this ${currentSlot} invocation intentionally skipped.`,
        "Keep both Vercel Cron slots enabled to preserve daily pseudo-random timing on the Hobby plan."
      ]
    };
  }

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
    proof402Mode,
    useSeedRegistry: input.useSeedRegistry ?? false,
    registryCandidates: [
      ...interactionProfile.candidates,
      ...(Array.isArray(input.registryCandidates) ? input.registryCandidates : [])
    ],
    registryUrls: uniqueStrings([
      ...interactionProfile.registryUrls,
      ...(Array.isArray(input.registryUrls) ? input.registryUrls : [])
    ]),
    allowedRegistryOrigins: uniqueStrings([
      ...interactionProfile.allowedRegistryOrigins,
      ...(Array.isArray(input.allowedRegistryOrigins) ? input.allowedRegistryOrigins : [])
    ]),
    randomizeCandidates: true,
    randomSeed: `${dateKey}:${interactionProfile.primaryTarget}:${interactionProfile.randomSearchQuery || "known"}`
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
    randomSchedule,
    interactionProfile,
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

function randomSchedulePlan({ cfg, dateKey, currentSlot }) {
  const selectedSlot = SLOTS[pickIndex(`${dateKey}:slot:${cfg.serviceName || "Trust402"}`, SLOTS.length)].id;
  return {
    strategy: "two-slot-deterministic-jitter",
    dateKey,
    currentSlot,
    selectedSlot,
    slots: SLOTS,
    actualWakeLimitation: "Vercel Hobby cron is fixed-schedule. Trust402 uses two daily cron invocations and executes only the pseudo-randomly selected slot.",
    upgradePath: "Use Vercel Pro hourly cron or an external scheduler when arbitrary minute-level random wakeups are required."
  };
}

function dailyInteractionProfile({ cfg, input, dateKey, budgetUsd }) {
  const targetWeights = parseWeights(cfg.dailyAutonomyTargetWeights);
  const primaryTarget = pickWeighted(`${dateKey}:target:${cfg.serviceName || "Trust402"}`, targetWeights);
  const externalChance = clampNumber(cfg.dailyAutonomyExternalChance, 0, 1, 0.15);
  const externalSelected = primaryTarget === "external" || seededUnit(`${dateKey}:external`) < externalChance;
  const target = primaryTarget === "external" ? fallbackKnownTarget(dateKey) : primaryTarget;
  const candidates = candidatesForTarget(target, { cfg, dateKey, budgetUsd });
  const randomSearchQuery = pickSearchQuery({ cfg, dateKey });
  const externalDiscovery = externalSelected
    ? externalRegistryPlan({ cfg, dateKey, budgetUsd, randomSearchQuery })
    : { registryUrls: [], allowedRegistryOrigins: [] };
  return {
    primaryTarget,
    effectiveKnownTarget: target,
    targetWeights,
    externalSelected,
    randomSearchQuery: externalSelected ? randomSearchQuery : null,
    externalRegistryConfigured: externalDiscovery.registryUrls.length > 0,
    externalRegistryUrlsCount: externalDiscovery.registryUrls.length,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      dailyTarget: candidate.dailyTarget || target
    })),
    registryUrls: externalDiscovery.registryUrls,
    allowedRegistryOrigins: externalDiscovery.allowedRegistryOrigins,
    safety: {
      externalFetchRequiresAllowlist: true,
      externalLiveRequiresSeparateApproval: true,
      sendsPaymentHeadersDuringDiscovery: false,
      preferredKnownTargets: ["proof402", "action402", "trust402"]
    }
  };
}

function externalRegistryPlan({ cfg, budgetUsd, randomSearchQuery }) {
  const configuredUrls = Array.isArray(cfg.dailyAutonomyExternalRegistryUrls) ? cfg.dailyAutonomyExternalRegistryUrls : [];
  const configuredAllowlist = Array.isArray(cfg.dailyAutonomyExternalRegistryAllowlist) ? cfg.dailyAutonomyExternalRegistryAllowlist : [];
  const query = encodeURIComponent(randomSearchQuery || "agent data");
  const maxUsdPrice = encodeURIComponent(String(Math.max(0.001, Math.min(budgetUsd || 0.02, 0.05))));
  const defaultUrls = [
    DEFAULT_EXTERNAL_CATALOGS[0],
    `${DEFAULT_EXTERNAL_CATALOGS[1]}?query=${query}&network=eip155:8453&maxUsdPrice=${maxUsdPrice}&limit=20`
  ];
  return {
    registryUrls: uniqueStrings([...configuredUrls, ...defaultUrls]),
    allowedRegistryOrigins: uniqueStrings([...configuredAllowlist, ...DEFAULT_EXTERNAL_CATALOG_ORIGINS])
  };
}

function pickSearchQuery({ cfg, dateKey }) {
  const queries = Array.isArray(cfg.dailyAutonomyExternalQueries) && cfg.dailyAutonomyExternalQueries.length > 0
    ? cfg.dailyAutonomyExternalQueries
    : ["agent data", "trust score", "market intelligence", "web research", "crypto data"];
  return queries[pickIndex(`${dateKey}:external-query`, queries.length)];
}

function candidatesForTarget(target, { cfg, dateKey, budgetUsd }) {
  if (target === "action402") return [action402Candidate({ dateKey })];
  if (target === "trust402") return [trust402Candidate({ cfg, dateKey, budgetUsd })];
  return [proof402Candidate({ cfg, dateKey })];
}

function proof402Candidate({ cfg, dateKey }) {
  const baseUrl = normalizeBaseUrl(cfg.proof402BaseUrl) || DEFAULT_PROOF402_BASE_URL;
  const proofHash = sha256Json({
    agent: "Trust402",
    stage: "daily-autonomy-proof402",
    dateKey
  });
  return {
    id: "proof402.notarize",
    name: "Proof402 paid hash notarization",
    endpoint: `${baseUrl}/api/proof/notarize`,
    method: "POST",
    priceUsd: 0.005,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    openapiUrl: `${baseUrl}/openapi.json`,
    wellKnownUrl: `${baseUrl}/.well-known/x402`,
    network: cfg.x402Network || "eip155:8453",
    asset: cfg.x402Asset || BASE_USDC,
    accept: {
      network: cfg.x402Network || "eip155:8453",
      asset: cfg.x402Asset || BASE_USDC
    },
    description: "Paid x402 resource that creates a timestamped proof for an approved SHA-256 hash without receiving private payloads.",
    receiptReady: true,
    proofReady: true,
    category: "proof",
    source: "daily-autonomy-known-agent",
    dailyTarget: "proof402",
    requestBody: {
      contentHash: proofHash,
      label: "Trust402 daily autonomy proof seed",
      idempotencyKey: `trust402-daily-${dateKey}-${proofHash.slice(7, 15)}`,
      metadata: {
        agent: "trust402",
        stage: "daily-autonomy",
        privatePayload: false
      }
    }
  };
}

function action402Candidate({ dateKey }) {
  return {
    id: "action402.execute_webhook",
    name: "Action402 paid webhook execution",
    endpoint: `${DEFAULT_ACTION402_BASE_URL}/api/execute/webhook`,
    method: "POST",
    priceUsd: 0.003,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    openapiUrl: `${DEFAULT_ACTION402_BASE_URL}/openapi.json`,
    wellKnownUrl: `${DEFAULT_ACTION402_BASE_URL}/.well-known/x402.json`,
    payTo: ACTION402_PAY_TO,
    network: "eip155:8453",
    asset: BASE_USDC,
    accept: {
      network: "eip155:8453",
      asset: BASE_USDC,
      payTo: ACTION402_PAY_TO
    },
    description: "Paid x402 agent that executes one bounded public HTTPS webhook/API action and returns a receipt.",
    receiptReady: true,
    proofReady: true,
    category: "action-execution",
    source: "daily-autonomy-known-agent",
    dailyTarget: "action402",
    requestBody: {
      url: `${DEFAULT_TRUST402_BASE_URL}/health`,
      method: "GET",
      idempotencyKey: `trust402-daily-action402-${dateKey}`,
      timeoutMs: 6000
    }
  };
}

function trust402Candidate({ cfg, dateKey, budgetUsd }) {
  const baseUrl = normalizeBaseUrl(cfg.publicBaseUrl) || DEFAULT_TRUST402_BASE_URL;
  return {
    id: "trust402.compare_resources",
    name: "Trust402 resource comparison",
    endpoint: `${baseUrl}/api/trust/compare-resources`,
    method: "POST",
    priceUsd: 0.03,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    openapiUrl: `${baseUrl}/openapi.json`,
    wellKnownUrl: `${baseUrl}/.well-known/x402`,
    payTo: TRUST402_PAY_TO,
    network: cfg.x402Network || "eip155:8453",
    asset: cfg.x402Asset || BASE_USDC,
    accept: {
      network: cfg.x402Network || "eip155:8453",
      asset: cfg.x402Asset || BASE_USDC,
      payTo: TRUST402_PAY_TO
    },
    description: "Trust402 paid x402 resource that compares candidate paid resources for a budgeted autonomous buyer.",
    receiptReady: true,
    proofReady: true,
    category: "trust",
    source: "daily-autonomy-known-agent",
    dailyTarget: "trust402",
    requestBody: {
      goal: "Compare known x402 agents for the daily autonomy loop.",
      budgetUsd: Math.max(0.005, Math.min(budgetUsd || 0.02, 0.05)),
      candidates: [
        {
          id: "proof402.notarize",
          endpoint: `${normalizeBaseUrl(cfg.proof402BaseUrl) || DEFAULT_PROOF402_BASE_URL}/api/proof/notarize`,
          priceUsd: 0.005,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          receiptReady: true
        },
        {
          id: "action402.execute_webhook",
          endpoint: `${DEFAULT_ACTION402_BASE_URL}/api/execute/webhook`,
          priceUsd: 0.003,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          payTo: ACTION402_PAY_TO,
          network: "eip155:8453",
          asset: BASE_USDC,
          receiptReady: true
        }
      ],
      idempotencyKey: `trust402-daily-self-${dateKey}`
    }
  };
}

function liveModeBlockers({ cfg, options, interactionProfile = null }) {
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
  if (interactionProfile?.externalSelected && !cfg.dailyAutonomyRandomExternalLiveApproved) {
    blockers.push({
      id: "random_external_live_not_approved",
      message: "TRUST402_DAILY_AUTONOMY_RANDOM_EXTERNAL_LIVE_APPROVED is false."
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

function parseWeights(value) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [id, weight] = item.split("=").map((part) => part.trim());
      return { id, weight: Number.parseFloat(weight) };
    })
    .filter((item) => item.id && Number.isFinite(item.weight) && item.weight > 0);
  return parsed.length > 0 ? parsed : [
    { id: "proof402", weight: 4 },
    { id: "action402", weight: 4 },
    { id: "trust402", weight: 3 },
    { id: "external", weight: 1 }
  ];
}

function pickWeighted(seed, weights) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  const point = seededUnit(seed) * total;
  let cursor = 0;
  for (const item of weights) {
    cursor += item.weight;
    if (point <= cursor) return item.id;
  }
  return weights[weights.length - 1]?.id || "proof402";
}

function fallbackKnownTarget(dateKey) {
  return pickWeighted(`${dateKey}:external-fallback`, [
    { id: "proof402", weight: 4 },
    { id: "action402", weight: 4 },
    { id: "trust402", weight: 3 }
  ]);
}

function pickIndex(seed, length) {
  if (length <= 1) return 0;
  return Math.min(length - 1, Math.floor(seededUnit(seed) * length));
}

function seededUnit(seed) {
  const hash = sha256Json({ seed });
  const hex = hash.slice(7, 19);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
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

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function dateOr(value, fallback) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function normalizeBaseUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.origin;
  } catch {
    return "";
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeMode(value) {
  return value === "live" ? "live" : "dry-run";
}

function normalizeProofMode(value) {
  return ["disabled", "preview", "probe", "live"].includes(value) ? value : "preview";
}
