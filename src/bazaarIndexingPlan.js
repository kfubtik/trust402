import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_ROUTE_CAP_USD = 0.05;

export function bazaarIndexingPlan(input = {}, options = {}) {
  const cfg = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl);
  const indexedIds = new Set(list(input.indexedResourceIds || input.indexedResources || input.indexed));
  const explicitMissing = list(input.missingResourceIds || input.missingResources || input.missing);
  const maxPerRouteUsd = numberOr(input.maxPerRouteUsd, DEFAULT_ROUTE_CAP_USD);
  const paidRoutes = (catalog.paidLaunchResources || []).map((resource) => routePlan(resource, baseUrl, maxPerRouteUsd));
  const missingRoutes = explicitMissing.length
    ? paidRoutes.filter((route) => explicitMissing.includes(route.id))
    : paidRoutes.filter((route) => !indexedIds.has(route.id));
  const indexedRoutes = paidRoutes.filter((route) => indexedIds.has(route.id));
  const starterRoutes = missingRoutes.filter((route) => route.price.maxUsd <= maxPerRouteUsd);
  const highCostRoutes = missingRoutes.filter((route) => route.price.maxUsd > maxPerRouteUsd);
  const planCore = {
    baseUrl,
    indexed: indexedRoutes.map((route) => route.id),
    missing: missingRoutes.map((route) => route.id),
    maxPerRouteUsd,
    starterTotalUsd: sumUsd(starterRoutes),
    highCostTotalUsd: sumUsd(highCostRoutes)
  };

  return {
    ok: true,
    tool: "bazaar.indexing_plan",
    generatedAt: new Date().toISOString(),
    planHash: sha256Json(planCore),
    target: {
      baseUrl,
      paidRouteCount: paidRoutes.length,
      indexedCount: indexedRoutes.length,
      missingCount: missingRoutes.length
    },
    currentEvidence: {
      indexedResourceIds: indexedRoutes.map((route) => route.id),
      missingResourceIds: missingRoutes.map((route) => route.id)
    },
    budget: {
      maxPerRouteUsd,
      starterBatchUsd: sumUsd(starterRoutes),
      highCostBatchUsd: sumUsd(highCostRoutes),
      remainingAllRoutesUsd: sumUsd(missingRoutes)
    },
    batches: {
      starter: {
        purpose: "Route-by-route CDP Bazaar indexing smokes that stay at or below the small per-route cap.",
        routeCount: starterRoutes.length,
        maxSpendUsd: sumUsd(starterRoutes),
        routes: starterRoutes
      },
      highCost: {
        purpose: "Routes above the small per-route cap. Keep these behind separate approval.",
        routeCount: highCostRoutes.length,
        maxSpendUsd: sumUsd(highCostRoutes),
        routes: highCostRoutes
      }
    },
    nextActions: nextActions({ starterRoutes, highCostRoutes, baseUrl }),
    safety: {
      readOnly: true,
      executesPayment: false,
      callsAgentcashMcp: false,
      writesLocalPolicy: false,
      requiresExactPerRouteApprovalBeforeAnyPaidFetch: true,
      closeLocalPolicyWindowAfterEveryRoute: true,
      doesNotProveRuntimePaymentAdapter: true
    }
  };
}

function routePlan(resource, baseUrl, maxPerRouteUsd) {
  const maxUsd = priceMaxUsd(resource.priceUsd);
  const endpoint = `${baseUrl}${resource.path}`;
  return {
    id: resource.id,
    method: resource.method,
    path: resource.path,
    endpoint,
    purpose: resource.purpose,
    price: {
      advertised: resource.priceUsd,
      maxUsd,
      aboveSmallRouteCap: maxUsd > maxPerRouteUsd
    },
    planCommand: `npm run agentcash:direct-smoke-plan -- ${baseUrl} --candidate-endpoint=${endpoint} --candidate-price-usd=${usd(maxUsd)} --max-amount-usd=${usd(maxUsd)}`,
    windowCommandTemplate: `npm run agentcash:direct-smoke-window -- ${baseUrl} --open --candidate-endpoint=${endpoint} --candidate-price-usd=${usd(maxUsd)} --max-amount-usd=${usd(maxUsd)} --approval "<exact approval text from planCommand>"`,
    evidenceCommand: `npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20 --concurrency=8`
  };
}

function nextActions({ starterRoutes, highCostRoutes, baseUrl }) {
  const actions = [
    `Run npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20 --concurrency=8 before any new paid route smoke.`,
    "For each still-missing route, run its planCommand and use only the exact approval text printed by that plan.",
    "Open the local policy window for one route at a time, perform the AgentCash schema check and paid fetch, then close the window immediately."
  ];
  if (starterRoutes.length > 0) {
    actions.push(`Starter batch has ${starterRoutes.length} routes with max combined spend $${usd(sumUsd(starterRoutes))}, but approval must still be route-by-route.`);
  }
  if (highCostRoutes.length > 0) {
    actions.push(`High-cost batch has ${highCostRoutes.length} route(s), max combined spend $${usd(sumUsd(highCostRoutes))}; require separate explicit approval.`);
  }
  return actions;
}

function priceMaxUsd(price) {
  if (typeof price === "number") return roundUsd(price);
  if (price && typeof price === "object") return roundUsd(Number.parseFloat(price.max ?? price.maxUsd ?? price.min ?? 0));
  return roundUsd(Number.parseFloat(price || 0));
}

function sumUsd(routes) {
  return roundUsd(routes.reduce((sum, route) => sum + route.price.maxUsd, 0));
}

function list(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function usd(value) {
  return String(roundUsd(value));
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
