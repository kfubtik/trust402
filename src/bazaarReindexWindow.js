import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { liveWindowPlan } from "./liveWindowPlan.js";
import { spendPolicyStatus } from "./policies.js";

export const DEFAULT_BAZAAR_INDEXED_RESOURCE_IDS = [
  "trust.check_x402",
  "trust.compare_resources"
];

export const DEFAULT_BAZAAR_MISSING_RESOURCE_IDS = [
  "trust.score_resource",
  "trust.evaluate_origin",
  "seller.readiness",
  "procurement.plan",
  "procurement.quote",
  "monitor.snapshot",
  "monitor.badge",
  "reports.x402_diligence"
];

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_STARTER_CAP_USD = 0.05;

export function bazaarReindexWindow(input = {}, options = {}) {
  const cfg = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const starterCapUsd = numberOr(input.starterCapUsd, DEFAULT_STARTER_CAP_USD);
  const includeProof = input.includeProof === true;
  const proofReserveUsd = numberOr(input.proofReserveUsd, cfg.proof402MaxSpendUsd || 0.005);
  const paymentProvider = choosePaymentProvider(input.paymentProvider, cfg.livePaymentProvider);
  const indexedResourceIds = listOrDefault(
    input.indexedResourceIds || input.indexed,
    DEFAULT_BAZAAR_INDEXED_RESOURCE_IDS
  );
  const missingResourceIds = listOrDefault(
    input.missingResourceIds || input.missing || cfg.cdpBazaarMissingResources,
    DEFAULT_BAZAAR_MISSING_RESOURCE_IDS
  );
  const selectedRouteIds = new Set(listOrDefault(input.routeIds || input.routes, missingResourceIds));
  const spendPolicy = options.spendPolicy || spendPolicyStatus(cfg);
  const paidResources = catalog.paidLaunchResources || [];
  const routes = paidResources
    .filter((resource) => selectedRouteIds.has(resource.id))
    .map((resource) => reindexRoutePlan({
      resource,
      baseUrl,
      cfg,
      paymentProvider,
      includeProof,
      proofReserveUsd,
      starterCapUsd,
      spendPolicy,
      input
    }));
  const starterRoutes = routes.filter((route) => route.batch === "starter");
  const highCostRoutes = routes.filter((route) => route.batch === "highCost");
  const planCore = {
    baseUrl,
    indexedResourceIds,
    missingResourceIds,
    selectedRouteIds: routes.map((route) => route.id),
    paymentProvider,
    includeProof,
    proofReserveUsd: includeProof ? proofReserveUsd : 0,
    starterCapUsd,
    totalMaxSpendUsd: sumUsd(routes)
  };

  return {
    ok: true,
    tool: "bazaar.reindex_window",
    mode: "plan-only",
    generatedAt: new Date().toISOString(),
    planHash: sha256Json(planCore),
    target: {
      baseUrl,
      expectedPaidRoutes: paidResources.length,
      indexedCount: indexedResourceIds.length,
      missingCount: missingResourceIds.length,
      selectedCount: routes.length,
      defaultEvidenceSource: "2026-06-21 CDP Bazaar route-level check for trust402.aztecbeacon.uk"
    },
    currentEvidence: {
      indexedResourceIds,
      missingResourceIds,
      selectedRouteIds: routes.map((route) => route.id)
    },
    currentPolicy: policySummary(spendPolicy),
    budget: {
      routeByRouteOnly: true,
      starterCapUsd,
      selectedMaxSpendUsd: sumUsd(routes),
      starterBatchUsd: sumUsd(starterRoutes),
      highCostBatchUsd: sumUsd(highCostRoutes),
      proofReserveUsdPerRoute: includeProof ? proofReserveUsd : 0,
      recommendedFirstRouteId: starterRoutes[0]?.id || highCostRoutes[0]?.id || null
    },
    batches: {
      starter: {
        purpose: "Run these first: small route-level settlement/evidence smokes, one route per temporary live window.",
        routeCount: starterRoutes.length,
        maxSpendUsd: sumUsd(starterRoutes),
        routeIds: starterRoutes.map((route) => route.id)
      },
      highCost: {
        purpose: "Run only after separate approval because these routes exceed the small starter cap.",
        routeCount: highCostRoutes.length,
        maxSpendUsd: sumUsd(highCostRoutes),
        routeIds: highCostRoutes.map((route) => route.id)
      }
    },
    routes,
    protocol: protocol({ baseUrl, routes }),
    closeWindowEnv: closeWindowEnv(),
    safety: {
      readOnly: true,
      executesPayment: false,
      mutatesVercelEnv: false,
      mutatesLocalPolicy: false,
      sendsPaymentHeaders: false,
      includesSecrets: false,
      oneRoutePerWindow: true,
      closeWindowAfterEveryRoute: true,
      proofDisabledByDefault: true,
      requiresExplicitApprovalBeforeLiveSpend: true
    },
    nextActions: nextActions({ baseUrl, routes, includeProof })
  };
}

function reindexRoutePlan({
  resource,
  baseUrl,
  cfg,
  paymentProvider,
  includeProof,
  proofReserveUsd,
  starterCapUsd,
  spendPolicy,
  input
}) {
  const priceUsd = priceMaxUsd(resource.priceUsd);
  const endpoint = `${baseUrl}${resource.path}`;
  const routeSpendUsd = roundUsd(priceUsd + (includeProof ? proofReserveUsd : 0));
  const windowPlan = liveWindowPlan({
    baseUrl,
    candidateEndpoint: endpoint,
    candidateId: resource.id,
    candidatePriceUsd: priceUsd,
    maxTotalUsd: routeSpendUsd,
    manualSmokeBudgetUsd: routeSpendUsd,
    proofReserveUsd,
    paymentProvider,
    includeProof,
    includeAutonomous: false,
    includeAutoRefill: false,
    liveMaxPerCallUsd: priceUsd,
    liveMaxPerJobUsd: routeSpendUsd,
    liveDailyLimitUsd: routeSpendUsd,
    liveSpentTodayUsd: 0,
    allowedRegistries: [baseUrl],
    lastVerifiedBalanceUsd: numberOr(input.lastVerifiedBalanceUsd, 1),
    minimumReserveUsd: numberOr(input.minimumReserveUsd, 0.5)
  }, {
    config: {
      ...cfg,
      publicBaseUrl: baseUrl,
      livePaymentProvider: paymentProvider
    }
  });
  const currentFit = currentPolicyFit({
    routeId: resource.id,
    endpoint,
    priceUsd,
    routeSpendUsd,
    spendPolicy,
    includeProof
  });

  return {
    id: resource.id,
    method: resource.method,
    path: resource.path,
    endpoint,
    purpose: resource.purpose,
    batch: priceUsd <= starterCapUsd ? "starter" : "highCost",
    price: {
      advertised: resource.priceUsd,
      maxUsd: priceUsd,
      routeWindowMaxUsd: routeSpendUsd
    },
    currentPolicyFit: currentFit,
    requiredTemporaryPolicyWindow: {
      reason: currentFit.readyNow
        ? "Current policy appears able to run this route, but a one-route temporary window is still recommended for evidence hygiene."
        : "Current policy cannot safely run this route as-is; stage the generated one-route window first.",
      vercelEnv: windowPlan.vercelEnvPlan.production,
      requiredSecrets: windowPlan.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually,
      localPolicyPatch: windowPlan.localPolicyPatch,
      planHash: windowPlan.planHash,
      status: windowPlan.status,
      blockers: windowPlan.blockers
    },
    commands: {
      buyerPreflight: windowPlan.paymentBuyerPreflightCommand,
      bridgePreflight: windowPlan.paymentBridgePreflightCommand,
      providerPreflight: windowPlan.paymentProviderPreflightCommand,
      liveEvidenceSmoke: windowPlan.command,
      postRouteCheck: `npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20 --concurrency=8`
    },
    directAgentcashFallback: windowPlan.agentcashDirectSmoke,
    safety: {
      readOnlyPlan: true,
      directAgentcashFallbackPaysIfExecuted: Boolean(windowPlan.agentcashDirectSmoke?.safety?.directFetchPaysIfExecuted),
      runtimeCommandPaysIfExecuted: true,
      privatePayloadAllowed: false,
      proofIncluded: includeProof
    }
  };
}

function currentPolicyFit({ routeId, endpoint, priceUsd, routeSpendUsd, spendPolicy, includeProof }) {
  const live = spendPolicy?.policies?.liveProcurement || {};
  const controls = live.controls || {};
  const proof = spendPolicy?.policies?.proof402Delegation || {};
  const origin = originOf(endpoint);
  const allowlist = list(spendPolicy?._rawAllowedRegistries || []);
  const readyNow = Boolean(
    live.ready &&
    priceUsd <= numberOr(controls.maxPerCallUsd, 0) &&
    routeSpendUsd <= numberOr(controls.maxPerJobUsd, 0) &&
    routeSpendUsd <= numberOr(controls.dailyRemainingUsd, 0) &&
    (controls.allowedRegistriesCount > 0) &&
    (!includeProof || proof.ready)
  );

  return {
    routeId,
    readyNow,
    liveProcurementReady: Boolean(live.ready),
    proof402ReadyIfNeeded: includeProof ? Boolean(proof.ready) : "not-required",
    currentMaxPerCallUsd: controls.maxPerCallUsd ?? null,
    currentMaxPerJobUsd: controls.maxPerJobUsd ?? null,
    currentDailyRemainingUsd: controls.dailyRemainingUsd ?? null,
    currentPaymentProvider: controls.paymentProvider || null,
    currentAllowlistCount: controls.allowedRegistriesCount ?? null,
    routeOrigin: origin,
    knownAllowlistContainsRouteOrigin: allowlist.length > 0 ? allowlist.includes(origin) : "not-exposed-by-public-policy",
    blockers: live.blockers || []
  };
}

function policySummary(spendPolicy) {
  const live = spendPolicy?.policies?.liveProcurement || {};
  const proof = spendPolicy?.policies?.proof402Delegation || {};
  const refill = spendPolicy?.policies?.agentcashAutoRefill || {};
  return {
    tool: spendPolicy?.tool || "policies.spend_status",
    generatedAt: spendPolicy?.generatedAt || null,
    liveProcurementReady: Boolean(live.ready),
    proof402DelegationReady: Boolean(proof.ready),
    agentcashAutoRefillReady: Boolean(refill.ready),
    liveControls: {
      maxPerCallUsd: live.controls?.maxPerCallUsd ?? null,
      maxPerJobUsd: live.controls?.maxPerJobUsd ?? null,
      dailyLimitUsd: live.controls?.dailyLimitUsd ?? null,
      spentTodayUsd: live.controls?.spentTodayUsd ?? null,
      dailyRemainingUsd: live.controls?.dailyRemainingUsd ?? null,
      allowedRegistriesCount: live.controls?.allowedRegistriesCount ?? null,
      paymentProvider: live.controls?.paymentProvider ?? null,
      operatorApiKeyConfigured: live.controls?.operatorApiKeyConfigured ?? null
    },
    liveBlockerIds: (live.blockers || []).map((blocker) => blocker.id)
  };
}

function protocol({ baseUrl, routes }) {
  return [
    `Run npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20 --concurrency=8 and confirm the route is still missing.`,
    "Pick exactly one route from batches.starter.routeIds unless a separate high-cost approval exists.",
    "Stage only that route's requiredTemporaryPolicyWindow.vercelEnv values in Vercel production.",
    "Run the route's provider preflight command, then run liveEvidenceSmoke only during the approved spend window.",
    "Immediately restore/close the live window using closeWindowEnv or the previous Vercel env snapshot.",
    "Re-run the Bazaar check. CDP indexing can be async, so record the evidence hash and recheck later if still missing.",
    routes.length > 0 ? `Recommended first route: ${routes[0].id}` : "No selected routes."
  ];
}

function nextActions({ baseUrl, routes, includeProof }) {
  if (routes.length === 0) {
    return ["No selected Bazaar routes. Pass --missing=<route ids> or use the default missing-route list."];
  }
  return [
    "Review this read-only plan and choose the first starter route.",
    "Get explicit live spend approval for that exact route id and price before running the generated liveEvidenceSmoke command.",
    `After every route, run npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20 --concurrency=8.`,
    includeProof
      ? "Proof402 is included for every route; keep this only if you explicitly want the extra proof spend."
      : "Proof402 is intentionally skipped for reindex smokes to keep spend focused on Bazaar settlement evidence."
  ];
}

function closeWindowEnv() {
  return {
    LIVE_SPEND_ENABLED: "false",
    LIVE_MAX_PER_CALL_USD: "0",
    LIVE_MAX_PER_JOB_USD: "0",
    LIVE_DAILY_LIMIT_USD: "0",
    LIVE_SPENT_TODAY_USD: "0",
    LIVE_ALLOWED_REGISTRIES: "",
    PROOF402_DELEGATION_MODE: "disabled",
    PROOF402_MAX_SPEND_USD: "0",
    TRUST402_LIVE_EVIDENCE_SMOKE_APPROVED: "false"
  };
}

function priceMaxUsd(price) {
  if (typeof price === "number") return roundUsd(price);
  if (price && typeof price === "object") return roundUsd(Number.parseFloat(price.max ?? price.maxUsd ?? price.min ?? 0));
  return roundUsd(Number.parseFloat(price || 0));
}

function sumUsd(routes) {
  return roundUsd(routes.reduce((sum, route) => sum + route.price.routeWindowMaxUsd, 0));
}

function choosePaymentProvider(inputProvider, configuredProvider) {
  if (inputProvider) return inputProvider;
  if (configuredProvider && configuredProvider !== "disabled") return configuredProvider;
  return "cdp-x402";
}

function listOrDefault(value, fallback) {
  const parsed = list(value);
  return parsed.length ? parsed : fallback;
}

function list(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
