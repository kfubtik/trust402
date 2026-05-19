import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

export function settlementStatus(options = {}) {
  const runtimeConfig = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const paidResources = catalog.paidLaunchResources || [];
  const checks = settlementChecks(runtimeConfig, paidResources);
  const blockers = checks.filter((item) => !item.passed);
  const routeConfigDraft = Object.fromEntries(
    paidResources.map((resource) => [`${resource.method} ${resource.path}`, routeConfigFor(resource, runtimeConfig)])
  );

  return {
    ok: true,
    tool: "settlement.status",
    generatedAt: new Date().toISOString(),
    mode: {
      defaultMode: runtimeConfig.defaultMode,
      paywallMode: runtimeConfig.paywallMode,
      realSettlementEnabled: runtimeConfig.realSettlementEnabled,
      successfulSettlementObserved: runtimeConfig.successfulSettlementObserved
    },
    readiness: {
      unpaidChallengeReady: unpaidChallengeReady(runtimeConfig),
      realSettlementReady: blockers.length === 0,
      marketplaceIndexingReady: blockers.length === 0 && runtimeConfig.successfulSettlementObserved
    },
    payment: {
      x402Version: 2,
      network: runtimeConfig.x402Network,
      asset: runtimeConfig.x402Asset,
      payToConfigured: isNonZeroPayTo(runtimeConfig.payTo),
      payToPreview: previewAddress(runtimeConfig.payTo)
    },
    facilitator: {
      urlConfigured: Boolean(runtimeConfig.facilitatorUrl),
      host: facilitatorHost(runtimeConfig.facilitatorUrl),
      cdp: {
        selected: isCdpFacilitator(runtimeConfig.facilitatorUrl),
        apiKeyIdConfigured: runtimeConfig.cdpApiKeyIdConfigured,
        apiKeySecretConfigured: runtimeConfig.cdpApiKeySecretConfigured
      }
    },
    resources: {
      paidLaunch: paidResources.length,
      protectedRoutes: paidResources.map((resource) => ({
        id: resource.id,
        method: resource.method,
        path: resource.path,
        priceUsd: resource.priceUsd
      }))
    },
    x402Flow: [
      "Return 402 with PAYMENT-REQUIRED for unpaid protected routes.",
      "Accept PAYMENT-SIGNATURE on retry.",
      "Verify payment through facilitator /verify.",
      "Run the Trust402 handler only after verification succeeds.",
      "Settle through facilitator /settle.",
      "Return PAYMENT-RESPONSE with settlement details."
    ],
    sdkPlan: {
      packages: ["@x402/express", "@x402/core", "@x402/evm", "@coinbase/x402"],
      resourceServer: "Register ExactEvmScheme for eip155:8453 and protect every paid launch POST route.",
      facilitator: isCdpFacilitator(runtimeConfig.facilitatorUrl)
        ? "Use Coinbase CDP facilitator client with CDP_API_KEY_ID and CDP_API_KEY_SECRET."
        : "Use HTTPFacilitatorClient with X402_FACILITATOR_URL."
    },
    routeConfigDraft,
    checks,
    blockers: blockers.map(({ id, scope, message }) => ({ id, scope, message })),
    nextActions: nextActions(blockers, runtimeConfig)
  };
}

export function settlementPreflight(options = {}) {
  const runtimeConfig = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const paidResources = catalog.paidLaunchResources || [];
  const status = settlementStatus({ config: runtimeConfig, catalog });
  const smokeResource = paidResources.find((resource) => resource.id === runtimeConfig.paidSmokeResourceId) ||
    paidResources.find((resource) => resource.id === "trust.score_resource") ||
    paidResources[0];
  const smokePriceUsd = smokeResource ? maxPriceUsd(smokeResource.priceUsd) : 0;
  const checks = [
    ...status.checks,
    check({
      id: "paid_smoke_approved",
      scope: "paid-smoke",
      passed: runtimeConfig.paidSmokeApproved === true,
      pass: "Paid smoke is explicitly approved.",
      fail: "Set TRUST402_PAID_SMOKE_APPROVED=true only for the one approved paid smoke window."
    }),
    check({
      id: "paid_smoke_limit_present",
      scope: "paid-smoke",
      passed: Number.isFinite(runtimeConfig.paidSmokeMaxUsd) && runtimeConfig.paidSmokeMaxUsd > 0,
      pass: "Paid smoke max spend is configured.",
      fail: "Set TRUST402_PAID_SMOKE_MAX_USD to the approved maximum spend."
    }),
    check({
      id: "paid_smoke_limit_covers_route",
      scope: "paid-smoke",
      passed: smokePriceUsd > 0 && runtimeConfig.paidSmokeMaxUsd >= smokePriceUsd,
      pass: "Paid smoke max spend covers the selected route price.",
      fail: "Paid smoke max spend must be at least the selected route price."
    }),
    check({
      id: "paid_smoke_limit_small",
      scope: "paid-smoke",
      passed: runtimeConfig.paidSmokeMaxUsd > 0 && runtimeConfig.paidSmokeMaxUsd <= 0.05,
      pass: "Paid smoke max spend is capped at or below $0.05.",
      fail: "Keep TRUST402_PAID_SMOKE_MAX_USD at or below $0.05 for the first smoke."
    })
  ];
  const blockers = checks.filter((item) => !item.passed);

  return {
    ok: true,
    tool: "settlement.preflight",
    generatedAt: new Date().toISOString(),
    readiness: {
      realSettlementReady: status.readiness.realSettlementReady,
      paidSmokeReady: blockers.length === 0,
      marketplaceIndexingReady: status.readiness.marketplaceIndexingReady
    },
    selectedSmokeResource: smokeResource ? {
      id: smokeResource.id,
      method: smokeResource.method,
      path: smokeResource.path,
      priceUsd: smokeResource.priceUsd,
      resource: `${runtimeConfig.publicBaseUrl}${smokeResource.path}`
    } : null,
    policy: {
      paidSmokeApproved: runtimeConfig.paidSmokeApproved,
      maxSpendUsd: runtimeConfig.paidSmokeMaxUsd,
      maxAllowedFirstSmokeUsd: 0.05,
      liveSpendEnabled: runtimeConfig.liveSpendEnabled === true,
      note: "This preflight does not send payment or make paid subcalls."
    },
    operatorEnv: {
      requiredProduction: [
        "PUBLIC_BASE_URL",
        "PAY_TO",
        "X402_FACILITATOR_URL",
        "CDP_API_KEY_ID",
        "CDP_API_KEY_SECRET",
        "TRUST402_PAYWALL_MODE=real",
        "TRUST402_REAL_SETTLEMENT_ENABLED=true",
        "TRUST402_PAID_SMOKE_APPROVED=true",
        "TRUST402_PAID_SMOKE_MAX_USD"
      ],
      keepFalseUntilReceiptReviewed: ["TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=false"]
    },
    checks,
    blockers: blockers.map(({ id, scope, message }) => ({ id, scope, message })),
    nextActions: preflightNextActions(blockers, runtimeConfig)
  };
}

export function routeConfigFor(resource, runtimeConfig = config) {
  return {
    accepts: [
      {
        scheme: "exact",
        price: priceString(resource.priceUsd),
        network: runtimeConfig.x402Network,
        asset: runtimeConfig.x402Asset,
        payTo: isNonZeroPayTo(runtimeConfig.payTo) ? runtimeConfig.payTo : "0xYourReceivingWallet"
      }
    ],
    description: resource.purpose,
    mimeType: "application/json",
    serviceName: runtimeConfig.serviceName,
    extensions: {
      ...bazaarDiscoveryFor(resource)
    }
  };
}

export function paymentChallengeFor(resource, runtimeConfig = config) {
  const routeConfig = routeConfigFor(resource, runtimeConfig);
  const accept = routeConfig.accepts[0];
  return {
    x402Version: 2,
    accepts: [
      {
        ...accept,
        amount: priceToBaseUnits(resource.priceUsd),
        resource: `${runtimeConfig.publicBaseUrl}${resource.path}`,
        maxTimeoutSeconds: 300
      }
    ]
  };
}

function settlementChecks(runtimeConfig, paidResources) {
  const publicBase = parseUrl(runtimeConfig.publicBaseUrl);
  return [
    check({
      id: "explicit_real_settlement_enabled",
      scope: "real-settlement",
      passed: runtimeConfig.realSettlementEnabled === true,
      pass: "Real x402 settlement has been explicitly enabled.",
      fail: "Set TRUST402_REAL_SETTLEMENT_ENABLED=true only after operator approval."
    }),
    check({
      id: "paywall_mode_real",
      scope: "real-settlement",
      passed: runtimeConfig.paywallMode === "real",
      pass: "TRUST402_PAYWALL_MODE=real.",
      fail: "Set TRUST402_PAYWALL_MODE=real for facilitator-backed settlement."
    }),
    check({
      id: "public_https_origin",
      scope: "real-settlement",
      passed: publicBase?.protocol === "https:" && !isLocalHost(publicBase.hostname),
      pass: "PUBLIC_BASE_URL is a public HTTPS origin.",
      fail: "PUBLIC_BASE_URL must be a public HTTPS origin before real settlement."
    }),
    check({
      id: "pay_to_configured",
      scope: "real-settlement",
      passed: isNonZeroPayTo(runtimeConfig.payTo),
      pass: "PAY_TO is a valid non-zero EVM receiving address.",
      fail: "Set PAY_TO to a reviewed non-zero EVM receiving address."
    }),
    check({
      id: "facilitator_configured",
      scope: "real-settlement",
      passed: isHttpUrl(runtimeConfig.facilitatorUrl),
      pass: "X402_FACILITATOR_URL is configured.",
      fail: "Set X402_FACILITATOR_URL to the approved facilitator."
    }),
    check({
      id: "cdp_credentials_configured",
      scope: "real-settlement",
      passed: !isCdpFacilitator(runtimeConfig.facilitatorUrl) ||
        (runtimeConfig.cdpApiKeyIdConfigured && runtimeConfig.cdpApiKeySecretConfigured),
      pass: "CDP facilitator credentials are configured.",
      fail: "CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET."
    }),
    check({
      id: "paid_routes_present",
      scope: "real-settlement",
      passed: paidResources.length >= 10,
      pass: "Paid launch routes are present.",
      fail: "Paid launch routes must be present before settlement."
    }),
    check({
      id: "bazaar_metadata_present",
      scope: "marketplace-indexing",
      passed: paidResources.length > 0 &&
        paidResources.every((resource) => Boolean(routeConfigFor(resource, runtimeConfig).extensions?.bazaar)),
      pass: "Paid launch routes declare Bazaar discovery metadata.",
      fail: "Paid routes must declare Bazaar discovery metadata before marketplace indexing."
    })
  ];
}

function bazaarDiscoveryFor(resource) {
  return declareDiscoveryExtension({
    input: bazaarInputExample(resource.id),
    inputSchema: bazaarInputSchema(resource.id),
    bodyType: "json",
    output: {
      example: bazaarOutputExample(resource.id),
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          tool: { type: "string" },
          recommendation: { type: "string" }
        },
        required: ["ok", "tool"]
      }
    }
  });
}

function bazaarInputSchema(id) {
  if (id === "trust.check_x402") {
    return {
      type: "object",
      required: ["endpoint"],
      properties: {
        endpoint: { type: "string", format: "uri", description: "x402 endpoint to probe without paying." },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default: "GET" },
        expectedPriceUsd: { type: "number", description: "Expected maximum price in USD." }
      }
    };
  }

  if (id === "procurement.plan" || id === "procurement.quote") {
    return {
      type: "object",
      required: ["goal", "budgetUsd"],
      properties: {
        goal: { type: "string", description: "Buyer goal for selecting x402 resources." },
        budgetUsd: { type: "number", description: "Maximum spend budget for the plan or quote." },
        maxPaidCalls: { type: "integer", default: 3 },
        riskTolerance: { type: "string", enum: ["low", "medium", "high"], default: "low" },
        candidates: { type: "array", minItems: 2, maxItems: 10, items: candidateResourceSchema() }
      }
    };
  }

  if (id === "trust.compare_resources") {
    return {
      type: "object",
      required: ["candidates"],
      properties: {
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        candidates: { type: "array", minItems: 2, maxItems: 10, items: candidateResourceSchema() }
      }
    };
  }

  if (id === "monitor.snapshot" || id === "monitor.badge") {
    return {
      type: "object",
      properties: {
        endpoint: { type: "string", format: "uri" },
        origin: { type: "string", format: "uri" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default: "GET" }
      },
      anyOf: [{ required: ["endpoint"] }, { required: ["origin"] }]
    };
  }

  return {
    type: "object",
    properties: {
      endpoint: { type: "string", format: "uri", description: "Resource endpoint URL." },
      origin: { type: "string", format: "uri", description: "Resource origin URL." },
      priceUsd: { type: "number" },
      has402: { type: "boolean" },
      hasInputSchema: { type: "boolean" },
      hasOpenApi: { type: "boolean" },
      hasWellKnown: { type: "boolean" },
      description: { type: "string" },
      receiptReady: { type: "boolean" }
    }
  };
}

function bazaarInputExample(id) {
  if (id === "trust.check_x402") {
    return { endpoint: "https://api.example.com/paid", method: "GET", expectedPriceUsd: 0.01 };
  }
  if (id === "procurement.plan" || id === "procurement.quote") {
    return {
      goal: "Choose a safe x402 endpoint for a bounded buyer workflow.",
      budgetUsd: 0.05,
      maxPaidCalls: 2,
      riskTolerance: "low",
      candidates: [
        {
          endpoint: "https://api.example.com/a",
          priceUsd: 0.01,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          receiptReady: true
        },
        {
          endpoint: "https://api.example.com/b",
          priceUsd: 0.03,
          has402: true,
          hasInputSchema: false
        }
      ]
    };
  }
  if (id === "trust.compare_resources") {
    return {
      goal: "Rank candidate x402 resources by trust and budget fit.",
      budgetUsd: 0.05,
      candidates: [
        {
          endpoint: "https://api.example.com/a",
          priceUsd: 0.01,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          receiptReady: true
        },
        {
          endpoint: "https://api.example.com/b",
          priceUsd: 0.03,
          has402: true,
          hasInputSchema: false
        }
      ]
    };
  }
  if (id === "monitor.snapshot" || id === "monitor.badge") {
    return { endpoint: "https://api.example.com/paid", method: "GET", expectedPriceUsd: 0.01 };
  }
  return {
    endpoint: "https://api.example.com/paid",
    priceUsd: 0.01,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    description: "Candidate x402 resource with public schemas and receipt support.",
    receiptReady: true
  };
}

function bazaarOutputExample(id) {
  return {
    ok: true,
    tool: id,
    recommendation: id.includes("procurement") ? "approve-after-review" : "test-first"
  };
}

function candidateResourceSchema() {
  return {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { type: "string", description: "Stable candidate identifier used in rankings and receipts." },
      name: { type: "string", description: "Human-readable resource name." },
      endpoint: { type: "string", format: "uri", description: "HTTPS x402 resource endpoint." },
      url: { type: "string", format: "uri", description: "Alternate field for the x402 resource endpoint." },
      priceUsd: {
        oneOf: [{ type: "number", minimum: 0 }, { type: "string" }],
        description: "Advertised resource price in USD."
      },
      price: {
        oneOf: [{ type: "number", minimum: 0 }, { type: "string" }],
        description: "Alternate price field accepted by Trust402."
      },
      has402: { type: "boolean", description: "Whether the endpoint is known to return an x402 challenge." },
      hasInputSchema: { type: "boolean", description: "Whether structured input schema metadata is available." },
      hasOpenApi: { type: "boolean", description: "Whether the origin publishes OpenAPI metadata." },
      hasWellKnown: { type: "boolean", description: "Whether the origin publishes /.well-known/x402 discovery." },
      inputSchema: { type: "object", description: "Optional embedded input schema for the candidate." },
      openapiUrl: { type: "string", format: "uri" },
      wellKnownUrl: { type: "string", format: "uri" },
      payTo: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      network: { type: "string", description: "x402 payment network, for example eip155:8453." },
      asset: { type: "string", description: "Payment asset address or symbol." },
      description: { type: "string", description: "Buyer-facing explanation of the resource." },
      receiptReady: { type: "boolean", description: "Whether the candidate can return receipt/proof-ready output." },
      proofReady: { type: "boolean", description: "Alternate receipt/proof readiness signal." },
      observed: { type: "object", description: "Optional probe observations such as status or latency." },
      x402: { type: "object", description: "Optional parsed x402 challenge metadata." },
      accept: { type: "object", description: "Optional single x402 accept object." },
      metadata: { type: "object", description: "Additional public-safe metadata used during scoring." }
    },
    anyOf: [
      { required: ["endpoint"] },
      { required: ["url"] }
    ]
  };
}

function unpaidChallengeReady(runtimeConfig) {
  return runtimeConfig.paywallMode === "mock" && isNonZeroPayTo(runtimeConfig.payTo);
}

function nextActions(blockers, runtimeConfig) {
  const ids = new Set(blockers.map((item) => item.id));
  const actions = [];
  if (ids.has("explicit_real_settlement_enabled")) {
    actions.push("Keep TRUST402_REAL_SETTLEMENT_ENABLED=false until a paid smoke budget is approved.");
  }
  if (ids.has("paywall_mode_real")) {
    actions.push("Use TRUST402_PAYWALL_MODE=mock for unpaid challenge tests; switch to real only for facilitator-backed settlement.");
  }
  if (ids.has("facilitator_configured")) {
    actions.push(`Set X402_FACILITATOR_URL=${CDP_FACILITATOR_URL} for Base mainnet CDP settlement.`);
  }
  if (isCdpFacilitator(runtimeConfig.facilitatorUrl) && ids.has("cdp_credentials_configured")) {
    actions.push("Add CDP_API_KEY_ID and CDP_API_KEY_SECRET as environment variables, never in tracked files.");
  }
  if (actions.length === 0 && !runtimeConfig.successfulSettlementObserved) {
    actions.push("Run one explicit paid smoke with a strict max spend, then set TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=true after verification.");
  }
  return actions;
}

function check({ id, scope, passed, pass, fail }) {
  return {
    id,
    scope,
    passed: Boolean(passed),
    message: passed ? pass : fail
  };
}

function isNonZeroPayTo(payTo) {
  return /^0x[a-fA-F0-9]{40}$/.test(payTo || "") && payTo.toLowerCase() !== ZERO_ADDRESS;
}

function isCdpFacilitator(value) {
  return String(value || "").includes("api.cdp.coinbase.com");
}

function isHttpUrl(value) {
  return Boolean(parseUrl(value));
}

function parseUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function facilitatorHost(value) {
  const url = parseUrl(value);
  return url ? url.host : null;
}

function priceString(priceUsd) {
  const price = typeof priceUsd === "object" ? priceUsd.max : priceUsd;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return "$0";
  return `$${parsed}`;
}

function priceToBaseUnits(priceUsd) {
  const price = typeof priceUsd === "object" ? priceUsd.max : priceUsd;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return "0";
  return String(Math.round(parsed * 1_000_000));
}

function previewAddress(value) {
  if (!isNonZeroPayTo(value)) return null;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function maxPriceUsd(priceUsd) {
  const price = typeof priceUsd === "object" ? priceUsd.max : priceUsd;
  const parsed = Number(price);
  return Number.isFinite(parsed) ? parsed : 0;
}

function preflightNextActions(blockers, runtimeConfig) {
  const ids = new Set(blockers.map((item) => item.id));
  const actions = nextActions(blockers, runtimeConfig);
  if (ids.has("paid_smoke_approved")) {
    actions.push("For the approved smoke window only, set TRUST402_PAID_SMOKE_APPROVED=true.");
  }
  if (ids.has("paid_smoke_limit_present") || ids.has("paid_smoke_limit_covers_route") || ids.has("paid_smoke_limit_small")) {
    actions.push("Set TRUST402_PAID_SMOKE_MAX_USD to a small approved value, for example 0.01 or 0.02.");
  }
  if (actions.length === 0) {
    actions.push("Run unpaid smoke:x402 first, then perform exactly one paid request and review PAYMENT-RESPONSE before marking settlement observed.");
  }
  return actions;
}
