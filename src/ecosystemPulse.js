import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { spendPolicyStatus } from "./policies.js";

const SOURCE_SNAPSHOT_DATE = "2026-06-21";

const SOURCES = [
  {
    id: "cdp-bazaar-docs",
    name: "Coinbase CDP x402 Bazaar docs",
    url: "https://docs.cdp.coinbase.com/x402/bazaar",
    use: "Discovery, indexing, semantic search, quality ranking, and recency rules."
  },
  {
    id: "x402-ecosystem",
    name: "x402 ecosystem",
    url: "https://www.x402.org/ecosystem",
    use: "Base settlement infrastructure, directories, tooling, and risk-control members."
  },
  {
    id: "agentic-market",
    name: "Agentic.Market",
    url: "https://agentic.market/",
    use: "Visible service categories and public price examples for paid agent resources."
  },
  {
    id: "x402-attacks",
    name: "Five Attacks on x402 Agentic Payment Protocol",
    url: "https://arxiv.org/abs/2605.11781",
    use: "Current authorization, binding, replay, and web-layer risk themes."
  },
  {
    id: "x402-pii-hardening",
    name: "Hardening x402 metadata",
    url: "https://arxiv.org/abs/2604.11430",
    use: "PII-safe metadata filtering, spend policy enforcement, and duplicate replay blocking."
  }
];

export function ecosystemPulse(input = {}, options = {}) {
  const cfg = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl);
  const now = dateOr(input.now || options.now, new Date());
  const paidResources = catalog.paidLaunchResources || [];
  const policy = spendPolicyStatus(cfg);
  const marketSignals = buildMarketSignals();
  const opportunityMap = buildOpportunityMap(paidResources);
  const recommendations = buildRecommendations({ cfg, paidResources, policy });
  const core = {
    baseUrl,
    sourceSnapshotDate: SOURCE_SNAPSHOT_DATE,
    signalIds: marketSignals.map((signal) => signal.id),
    opportunityIds: opportunityMap.map((item) => item.id),
    recommendationIds: recommendations.map((item) => item.id),
    liveSpendEnabled: cfg.liveSpendEnabled === true,
    paidLaunchResources: paidResources.length
  };

  return {
    ok: true,
    tool: "radar.ecosystem_pulse",
    schema: "trust402.ecosystem_pulse.v1",
    generatedAt: now.toISOString(),
    sourceSnapshotDate: SOURCE_SNAPSHOT_DATE,
    pulseHash: sha256Json(core),
    title: "Trust402 Ecosystem Pulse",
    summary:
      "Public-safe x402/Base market pulse for agents that need to choose paid resources, harden sellers, and keep Bazaar-visible evidence fresh.",
    currentState: {
      canonicalOrigin: baseUrl,
      paidLaunchResources: paidResources.length,
      primaryTrust402Jobs: [
        "score a paid x402 resource before an agent spends",
        "compare candidate endpoints by price, schema, discovery, and receipt readiness",
        "produce proof-ready diligence reports for sellers and buyers"
      ],
      liveSpendEnabled: cfg.liveSpendEnabled === true,
      liveProcurementReady: policy.readiness.liveProcurementReady,
      proof402DelegationReady: policy.readiness.proof402DelegationReady,
      externalDirectoryStatus: cfg.externalDirectoryStatus || "not-visible-yet"
    },
    marketSignals,
    opportunityMap,
    recommendations,
    buyerFacingOfferFocus: [
      {
        route: "/api/trust/check-x402",
        price: "$0.005",
        job: "quick paid-flow triage"
      },
      {
        route: "/api/trust/score-resource",
        price: "$0.01",
        job: "single-resource use/review/avoid decision"
      },
      {
        route: "/api/reports/x402-diligence",
        price: "$0.08-$0.15",
        job: "deeper marketplace and seller diligence"
      }
    ],
    evidence: {
      radarDigest: `${baseUrl}/api/radar/digest`,
      resources: `${baseUrl}/api/resources`,
      spendPolicy: `${baseUrl}/api/policies/spend`,
      completionAudit: `${baseUrl}/api/completion/audit`,
      x402Discovery: `${baseUrl}/.well-known/x402`,
      openapi: `${baseUrl}/openapi.json`
    },
    sources: SOURCES,
    safety: {
      publicSafe: true,
      fetchesExternalSourcesAtRuntime: false,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      includesSecrets: false,
      mutatesWallet: false,
      liveSpendDefault: false
    }
  };
}

export function ecosystemPulseSummary(input = {}, options = {}) {
  const pulse = ecosystemPulse(input, options);
  return {
    url: `${normalizeBaseUrl(input.baseUrl || options.config?.publicBaseUrl || config.publicBaseUrl)}/api/radar/ecosystem-pulse`,
    sourceSnapshotDate: pulse.sourceSnapshotDate,
    pulseHash: pulse.pulseHash,
    signalIds: pulse.marketSignals.map((signal) => signal.id),
    topRecommendationIds: pulse.recommendations.slice(0, 3).map((item) => item.id),
    primaryOfferFocus: pulse.buyerFacingOfferFocus,
    safety: pulse.safety
  };
}

function buildMarketSignals() {
  return [
    {
      id: "bazaar-quality-ranking",
      trend: "Bazaar visibility is increasingly ranking-driven.",
      implication:
        "Clear descriptions, input/output schemas, examples, buyer reach, transaction volume, and recency matter more than a generic agent claim.",
      trust402Move:
        "Keep all paid routes indexed, evidence-linked, and focused on measurable buyer decisions."
    },
    {
      id: "settlement-recency-window",
      trend: "x402 discovery favors resources with recent settled activity.",
      implication:
        "A paid endpoint can become less visible if it has no recent successful activity through the facilitator.",
      trust402Move:
        "Use bounded, low-cost evidence windows and daily public Radar artifacts instead of noisy random spending."
    },
    {
      id: "specific-paid-products-win",
      trend: "Marketplaces surface concrete products such as briefs, market research, IPO analysis, and scanners.",
      implication:
        "Buyers need a job, price, schema, and expected output in seconds.",
      trust402Move:
        "Lead with quick check, resource score, and diligence report; keep broader procurement behind policy gates."
    },
    {
      id: "x402-security-hardening",
      trend: "Current research is focused on request binding, replay, overpayment, race conditions, and metadata privacy.",
      implication:
        "Trust agents should not only compare price; they should flag unsafe payment metadata and weak replay controls.",
      trust402Move:
        "Expose seller hardening guidance through score-resource, seller readiness, and diligence reports."
    },
    {
      id: "agent-budget-permission-layer",
      trend: "Budget, permission, and stablecoin settlement layers are becoming first-class agent infrastructure.",
      implication:
        "Autonomous buyers will prefer services that prove spend bounds before payment.",
      trust402Move:
        "Keep policy evidence, receipts, and live-spend gates machine-readable."
    }
  ];
}

function buildOpportunityMap(paidResources) {
  const resourceIds = new Set(paidResources.map((resource) => resource.id));
  return [
    {
      id: "seller-hardening-check",
      status: resourceIds.has("seller.readiness") ? "covered-by-existing-paid-resource" : "recommended-new-resource",
      suggestedPriceUsd: "$0.02-$0.05",
      mapsTo: ["/api/seller/readiness", "/api/reports/x402-diligence"],
      why:
        "Sellers need a fast way to learn whether discovery metadata, request binding assumptions, replay safety, and receipts are buyer-ready."
    },
    {
      id: "bazaar-visibility-monitor",
      status: resourceIds.has("monitor.snapshot") ? "covered-by-existing-paid-resource" : "recommended-new-resource",
      suggestedPriceUsd: "$0.015-$0.03",
      mapsTo: ["/api/monitor/snapshot", "/api/monitor/badge"],
      why:
        "Recent settlement activity, metadata quality, and searchable descriptions now affect whether agents find a resource."
    },
    {
      id: "resource-score-and-compare",
      status: "covered-by-existing-paid-resources",
      suggestedPriceUsd: "$0.01-$0.03",
      mapsTo: ["/api/trust/score-resource", "/api/trust/compare-resources"],
      why:
        "This is the clearest buyer-side job: choose a safe paid endpoint before sending money."
    },
    {
      id: "proof-ready-diligence",
      status: "covered-by-existing-paid-resource",
      suggestedPriceUsd: "$0.08-$0.15",
      mapsTo: ["/api/reports/x402-diligence"],
      why:
        "Higher-priced reports need hash-ready evidence, receipts, and clear recommendation output."
    }
  ];
}

function buildRecommendations({ cfg, paidResources, policy }) {
  const paidCount = paidResources.length;
  return [
    {
      id: "publish-ecosystem-pulse",
      priority: "high",
      status: "implemented",
      action: "Expose this public pulse through Radar, OpenAPI, sitemap, and llms.txt.",
      successSignal: "Other agents can fetch one JSON document and understand current x402 market fit."
    },
    {
      id: "tighten-three-offer-focus",
      priority: "high",
      status: paidCount >= 10 ? "ready" : "needs-catalog",
      action: "Lead listings with quick check, resource score, and diligence report instead of all 10 routes.",
      successSignal: "A buyer can understand what to buy in under 10 seconds."
    },
    {
      id: "add-hardening-language-to-seller-readiness",
      priority: "medium",
      status: "next",
      action: "Make seller readiness explicitly call out request binding, replay controls, price consistency, and PII-safe metadata.",
      successSignal: "Seller reports map to current x402 security concerns, not only generic discovery metadata."
    },
    {
      id: "keep-recency-evidence-fresh",
      priority: "medium",
      status: cfg.liveSpendEnabled ? "policy-window-required" : "dry-run-public-evidence",
      action: "Refresh production smoke, x402 smoke, Bazaar 10/10, x402scan evidence, and Radar after deploys.",
      successSignal: "Trust402 remains visible without broad autonomous spend."
    },
    {
      id: "guard-live-spend",
      priority: "high",
      status: policy.readiness.anyLiveSpendReady ? "policy-gated-ready" : "safe-default-disabled",
      action: "Keep live spend disabled until a bounded, allowlisted policy window is explicitly approved.",
      successSignal: "Every paid subcall has a cap, allowlist, receipt, and operator-readable reason."
    }
  ];
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.aztecbeacon.uk").replace(/\/+$/, "");
}

function dateOr(value, fallback) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}
