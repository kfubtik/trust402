import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { paymentBridgeContract, paymentProviderRequiredSecrets } from "./paymentAdapters.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_PROOF402_BASE_URL = "https://proof402.vercel.app";
const SUPPORTED_PAYMENT_PROVIDERS = new Set(["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"]);

export function liveWindowPlan(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const candidateEndpoint = input.candidateEndpoint || input.endpoint || "";
  const candidateOrigin = originOf(candidateEndpoint);
  const downstreamRequestPolicy = requestPolicyForCandidate(candidateEndpoint, baseUrl);
  const proof402BaseUrl = normalizeBaseUrl(input.proof402BaseUrl || cfg.proof402BaseUrl || DEFAULT_PROOF402_BASE_URL);
  const proof402Origin = originOf(proof402BaseUrl);
  const paymentProvider = choosePaymentProvider(input.paymentProvider, cfg.livePaymentProvider);
  const paymentAdapterContract = paymentBridgeContract(paymentProvider);
  const includeAutonomous = input.includeAutonomous === true;
  const includeProof = input.includeProof !== false;
  const includeAutoRefill = input.includeAutoRefill === true;
  const candidatePriceUsd = numberOr(input.candidatePriceUsd ?? input.priceUsd, 0.01);
  const proofReserveUsd = numberOr(input.proofReserveUsd, 0.01);
  const maxTotalUsd = numberOr(input.maxTotalUsd, Math.max(candidatePriceUsd + proofReserveUsd, 0.02));
  const manualSmokeBudgetUsd = numberOr(input.manualSmokeBudgetUsd, maxTotalUsd);
  const lastVerifiedBalanceUsd = numberOr(input.lastVerifiedBalanceUsd, 1);
  const minimumReserveUsd = numberOr(input.minimumReserveUsd, 0.5);
  const liveMaxPerCallUsd = numberOr(input.liveMaxPerCallUsd, Math.max(candidatePriceUsd, 0.01));
  const liveMaxPerJobUsd = numberOr(input.liveMaxPerJobUsd, maxTotalUsd);
  const liveDailyLimitUsd = numberOr(input.liveDailyLimitUsd, maxTotalUsd);
  const liveSpentTodayUsd = numberOr(input.liveSpentTodayUsd, 0);
  const liveDailyRemainingUsd = roundUsd(Math.max(0, liveDailyLimitUsd - Math.max(0, liveSpentTodayUsd)));
  const estimatedMaxSpendUsd = roundUsd(
    candidatePriceUsd * (includeAutonomous ? 2 : 1) +
    (includeProof ? proofReserveUsd : 0)
  );
  const allowlist = uniqueList([
    ...arrayOrEmpty(input.allowedRegistries),
    ...(candidateOrigin ? [candidateOrigin] : [])
  ]);
  const allowedOrigins = uniqueList([
    baseUrl,
    ...(includeProof && proof402Origin ? [proof402Origin] : []),
    ...(candidateOrigin ? [candidateOrigin] : [])
  ]);
  const blockers = planBlockers({
    candidateEndpoint,
    candidateOrigin,
    paymentProvider,
    estimatedMaxSpendUsd,
    maxTotalUsd,
    manualSmokeBudgetUsd,
    lastVerifiedBalanceUsd,
    minimumReserveUsd,
    allowlist,
    includeProof,
    proof402BaseUrl,
    proofReserveUsd,
    liveDailyRemainingUsd
  });

  const vercelEnvPlan = {
    production: {
      LIVE_SPEND_ENABLED: "true",
      LIVE_PAYMENT_PROVIDER: paymentProvider,
      LIVE_MAX_PER_CALL_USD: usd(liveMaxPerCallUsd),
      LIVE_MAX_PER_JOB_USD: usd(liveMaxPerJobUsd),
      LIVE_DAILY_LIMIT_USD: usd(liveDailyLimitUsd),
      LIVE_SPENT_TODAY_USD: usd(liveSpentTodayUsd),
      LIVE_APPROVAL_THRESHOLD_USD: "0",
      LIVE_ALLOWED_REGISTRIES: allowlist.join(","),
      PROOF402_BASE_URL: proof402BaseUrl,
      PROOF402_DELEGATION_MODE: includeProof ? "live" : "disabled",
      PROOF402_MAX_SPEND_USD: includeProof ? usd(proofReserveUsd) : "0",
      AGENTCASH_AUTO_REFILL_APPROVED: includeAutoRefill ? "true" : "false",
      AGENTCASH_AUTO_REFILL_ENABLED: includeAutoRefill ? "true" : "false",
      AGENTCASH_AUTO_REFILL_PROVIDER: includeAutoRefill ? (input.refillProvider || "manual-action") : "",
      AGENTCASH_AUTO_REFILL_THRESHOLD_USD: "0.50",
      AGENTCASH_AUTO_REFILL_AMOUNT_USD: usd(numberOr(input.refillAmountUsd, 1)),
      AGENTCASH_AUTO_REFILL_DAILY_CAP_USD: usd(numberOr(input.refillDailyCapUsd, 2))
    },
    requiredSecretsAlreadyExistOrMustBeAddedManually: [
      "TRUST402_OPERATOR_API_KEY",
      ...paymentProviderRequiredSecrets(paymentProvider)
    ]
  };

  const localPolicyPatch = {
    restrictions: {
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: includeProof ? "approved-for-manual-smoke" : "disabled-until-separate-approval",
      allowedOrigins
    },
    limits: {
      agentcashGlobalMaxAmountUsd: usd(maxTotalUsd),
      manualSmokeRemainingBudgetUsd: usd(manualSmokeBudgetUsd),
      lastVerifiedBalanceUsd: usd(lastVerifiedBalanceUsd),
      minimumReserveUsd: usd(minimumReserveUsd),
      autoRefill: {
        enabled: includeAutoRefill,
        futureThresholdUsd: 0.5,
        requiresExplicitProviderAndCap: true
      }
    }
  };

  const command = [
    "npm run live:evidence-smoke --",
    baseUrl,
    "--live",
    `--candidate-endpoint=${candidateEndpoint || "<approved-x402-endpoint>"}`,
    `--candidate-price=${usd(candidatePriceUsd)}`,
    `--max-total-usd=${usd(maxTotalUsd)}`,
    includeProof ? `--proof-reserve-usd=${usd(proofReserveUsd)}` : null,
    `--live-spent-today-usd=${usd(liveSpentTodayUsd)}`,
    includeProof ? null : "--skip-proof",
    includeAutonomous ? "--include-autonomous-live" : null
  ].filter(Boolean).join(" ");
  const paymentBridgePreflightCommand = paymentAdapterContract
    ? [
        "npm run payment:bridge-check --",
        "--adapter-url=<LIVE_PAYMENT_ADAPTER_URL>",
        `--provider=${paymentProvider}`,
        `--candidate-endpoint=${candidateEndpoint || "<approved-x402-endpoint>"}`,
        `--max-amount-usd=${usd(liveMaxPerCallUsd)}`,
        "--strict"
      ].join(" ")
    : null;
  const paymentBuyerPreflightCommand = paymentProvider === "cdp-x402"
    ? "npm run payment:buyer-preflight -- --provider=cdp-x402 --strict"
    : null;
  const paymentProviderPreflightCommand = paymentBridgePreflightCommand || paymentBuyerPreflightCommand;
  const proof402PreflightCommand = includeProof
    ? [
        "npm run proof402:preflight --",
        "--result-hash=sha256:<approved-result-hash>",
        "--approved-hash=sha256:<approved-result-hash>",
        `--price-usd=${usd(proofReserveUsd)}`,
        "--strict"
      ].join(" ")
    : null;
  const agentcashDirectSmoke = agentcashDirectSmokePlan({
    baseUrl,
    candidateEndpoint,
    candidatePriceUsd,
    liveMaxPerCallUsd,
    downstreamRequestPolicy
  });

  const planCore = {
    baseUrl,
    candidateEndpoint,
    estimatedMaxSpendUsd,
    maxTotalUsd,
    manualSmokeBudgetUsd,
    liveDailyRemainingUsd,
    paymentProvider,
    includeProof,
    includeAutonomous,
    includeAutoRefill,
    downstreamRequestPolicy,
    paymentAdapterContract,
    paymentProviderAlternatives: paymentProviderAlternatives({
      selectedProvider: paymentProvider,
      candidateEndpoint,
      liveMaxPerCallUsd,
      includeProof
    }),
    blockers,
    vercelEnvPlan,
    localPolicyPatch,
    paymentBridgePreflightCommand,
    paymentBuyerPreflightCommand,
    paymentProviderPreflightCommand,
    proof402PreflightCommand,
    agentcashDirectSmoke,
    command
  };
  const planHash = sha256Json(planCore);

  return {
    ok: true,
    tool: "live.window_plan",
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0 ? "ready-to-stage" : "blocked",
    planHash,
    ...planCore,
    safety: {
      readOnly: true,
      writesLocalPolicy: false,
      setsVercelEnv: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      includesPrivateKeyMaterial: false
    },
    nextActions: blockers.length === 0
      ? [
          "Review this plan hash and local policy patch.",
          "Apply Vercel env values manually or through an approved secret-management flow.",
          ...(paymentBridgePreflightCommand ? ["Run the payment bridge preflight before enabling the live spend window."] : []),
          ...(paymentBuyerPreflightCommand ? ["Run the CDP buyer preflight before enabling the live spend window."] : []),
          ...(proof402PreflightCommand ? ["Run the Proof402 paid-proof preflight for the exact approved result hash."] : []),
          "Update the ignored local AgentCash policy for the approved smoke window.",
          "Run the generated command only after the approval window is active."
        ]
      : blockers
  };
}

export function trust402RouteSmokeBodyForEndpoint(candidateEndpoint, baseUrl = DEFAULT_BASE_URL) {
  const trustOrigin = normalizeBaseUrl(originOf(candidateEndpoint) || baseUrl || DEFAULT_BASE_URL);
  return trust402RouteSmokeBody(pathOf(candidateEndpoint), trustOrigin);
}

function agentcashDirectSmokePlan({
  baseUrl,
  candidateEndpoint,
  candidatePriceUsd,
  liveMaxPerCallUsd,
  downstreamRequestPolicy
}) {
  const requestBody = agentcashDirectSmokeBody(candidateEndpoint, baseUrl);
  const maxAmount = roundUsd(candidatePriceUsd || liveMaxPerCallUsd || 0.01);
  const targetId = downstreamRequestPolicy.schema;

  const common = {
    purpose: "Operator-reviewed AgentCash MCP direct smoke for marketplace indexing evidence when the server-side live payment adapter is not configured yet.",
    targetResource: {
      id: targetId,
      endpoint: candidateEndpoint || "",
      method: "POST",
      expectedPriceUsd: roundUsd(candidatePriceUsd || 0)
    },
    mcpTools: {
      schemaCheck: "mcp__agentcash__check_endpoint_schema",
      paidFetch: "mcp__agentcash__fetch"
    },
    prerequisites: [
      "Read .local/trust402-agentcash-wallet.json and confirm the AgentCash Base wallet is the Trust402-reserved wallet.",
      `Open a one-shot local AgentCash policy window with manualSmokeRemainingBudgetUsd >= ${usd(maxAmount)} and agentcashGlobalMaxAmountUsd >= ${usd(maxAmount)}.`,
      "Get explicit operator approval for this exact paid AgentCash fetch before executing it."
    ],
    safety: {
      readOnlyPlan: true,
      executesPayment: false,
      directFetchPaysIfExecuted: true,
      outOfBandAgentcashMcpCall: true,
      doesNotProveRuntimePaymentAdapter: true,
      privatePayloadAllowed: false,
      includesPrivateKeyMaterial: false,
      network: "base",
      maxAmountUsd: maxAmount
    }
  };

  if (!candidateEndpoint) {
    return {
      ...common,
      status: "missing-candidate-endpoint",
      blocker: "Provide the exact allowlisted x402 endpoint before building an AgentCash direct smoke input."
    };
  }

  if (!requestBody) {
    return {
      ...common,
      status: "unsupported-candidate",
      blocker: "AgentCash direct smoke bodies are only generated for Trust402 paid launch resources and Proof402 notarize candidates.",
      evidenceAfterSuccess: {
        note: "For generic resources, use the runtime live evidence smoke path so the request body can be reviewed for that resource first."
      }
    };
  }

  return {
    ...common,
    status: "operator-approval-required",
    schemaCheck: {
      description: "Safe schema observation. This should not pay because it only asks AgentCash to inspect the endpoint contract.",
      input: {
        url: candidateEndpoint,
        method: "POST",
        body: requestBody
      }
    },
    fetch: {
      description: "Paid AgentCash MCP call. Execute only after the local policy window and explicit operator approval are in place.",
      input: {
        url: candidateEndpoint,
        method: "POST",
        body: requestBody,
        maxAmount,
        paymentNetwork: "base",
        paymentProtocol: "x402",
        timeout: 30000
      }
    },
    evidenceAfterSuccess: {
      commands: [
        `npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20`,
        `npm run completion:audit -- ${baseUrl}`,
        `npm run launch:monitor -- ${baseUrl} --timeout-ms=10000 --strict`
      ],
      vercelEnvIfCdpBazaarReportsAllIndexed: {
        TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED: "true",
        TRUST402_CDP_BAZAAR_CHECK_STATUS: "all-indexed",
        TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES: "10",
        TRUST402_CDP_BAZAAR_INDEXED_RESOURCES: "10",
        TRUST402_CDP_BAZAAR_MISSING_RESOURCES: "",
        TRUST402_CDP_BAZAAR_EVIDENCE_REF: "<public-safe CDP Bazaar 10/10 check hash or run URL>"
      },
      caveat: "This can help marketplace indexing evidence, but final live procurement still requires Trust402 runtime payment-adapter evidence."
    },
    safety: {
      ...common.safety,
      sendsOnly: downstreamRequestPolicy.sendsOnly
    }
  };
}

function agentcashDirectSmokeBody(candidateEndpoint, baseUrl) {
  if (isProof402NotarizeEndpoint(candidateEndpoint)) {
    const contentHash = sha256Json({
      agent: "Trust402",
      stage: "agentcash-direct-smoke",
      goal: "Hash-only Proof402 paid smoke"
    });
    return {
      contentHash,
      label: "Trust402 AgentCash direct Proof402 smoke",
      idempotencyKey: `trust402-agentcash-direct-${contentHash.slice(7, 19)}`,
      metadata: {
        agent: "trust402",
        stage: "agentcash-direct-smoke",
        privatePayload: false
      }
    };
  }

  if (isTrust402CompareResourcesEndpoint(candidateEndpoint, baseUrl)) {
    const trustOrigin = normalizeBaseUrl(originOf(candidateEndpoint) || baseUrl || DEFAULT_BASE_URL);
    return {
      goal: "Rank candidate x402 resources by trust and budget fit.",
      budgetUsd: 0.05,
      candidates: [
        {
          id: "proof402.notarize",
          endpoint: "https://proof402.vercel.app/api/proof/notarize",
          priceUsd: 0.005,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          receiptReady: true,
          description: "Proof402 paid notarization endpoint for hash-only proof receipts."
        },
        {
          id: "trust.check_x402",
          endpoint: `${trustOrigin}/api/trust/check-x402`,
          priceUsd: 0.005,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          receiptReady: true,
          description: "Trust402 x402 challenge probe for payment-flow readiness."
        }
      ]
    };
  }

  const trustOrigin = normalizeBaseUrl(originOf(candidateEndpoint) || baseUrl || DEFAULT_BASE_URL);
  return trust402RouteSmokeBodyForEndpoint(candidateEndpoint, trustOrigin);
}

function planBlockers(input) {
  const blockers = [];
  if (!input.candidateEndpoint) blockers.push("Provide --candidate-endpoint for the approved downstream x402 resource.");
  if (input.candidateEndpoint && !input.candidateOrigin) blockers.push("Candidate endpoint must be a valid HTTPS URL.");
  if (input.candidateOrigin && !input.candidateOrigin.startsWith("https://")) blockers.push("Candidate endpoint must use HTTPS.");
  if (!SUPPORTED_PAYMENT_PROVIDERS.has(input.paymentProvider)) {
    blockers.push("Payment provider must be agentcash-mcp, cdp-x402, x402-fetch, or external-adapter.");
  }
  if (input.estimatedMaxSpendUsd > input.maxTotalUsd) {
    blockers.push(`Estimated max spend ${usd(input.estimatedMaxSpendUsd)} exceeds max total ${usd(input.maxTotalUsd)}.`);
  }
  if (input.estimatedMaxSpendUsd > input.liveDailyRemainingUsd) {
    blockers.push(`Estimated max spend ${usd(input.estimatedMaxSpendUsd)} exceeds remaining daily spend capacity ${usd(input.liveDailyRemainingUsd)}.`);
  }
  if (input.estimatedMaxSpendUsd > input.manualSmokeBudgetUsd) {
    blockers.push(`Estimated max spend ${usd(input.estimatedMaxSpendUsd)} exceeds manual smoke budget ${usd(input.manualSmokeBudgetUsd)}.`);
  }
  if (input.lastVerifiedBalanceUsd - input.estimatedMaxSpendUsd < input.minimumReserveUsd) {
    blockers.push("Estimated spend would break the requested AgentCash minimum reserve.");
  }
  if (input.allowlist.length === 0) blockers.push("LIVE_ALLOWED_REGISTRIES would be empty.");
  if (input.includeProof && !input.proof402BaseUrl) blockers.push("PROOF402_BASE_URL is required when paid Proof402 is included.");
  if (input.includeProof && !(input.proofReserveUsd > 0)) blockers.push("Proof402 reserve must be greater than zero.");
  return blockers;
}

function requestPolicyForCandidate(candidateEndpoint, baseUrl) {
  if (isProof402NotarizeEndpoint(candidateEndpoint)) {
    return {
      schema: "proof402.notarize",
      sendsOnly: ["contentHash", "label", "idempotencyKey", "metadata"],
      privatePayloadAllowed: false,
      generatedBy: "scripts/live-evidence-smoke.js",
      note: "The live evidence runner generates a sha256 contentHash and public-safe metadata for this endpoint."
    };
  }
  if (isTrust402CompareResourcesEndpoint(candidateEndpoint, baseUrl)) {
    return {
      schema: "trust402.compare_resources",
      sendsOnly: ["goal", "budgetUsd", "candidates"],
      privatePayloadAllowed: false,
      generatedBy: "scripts/live-evidence-smoke.js",
      note: "The live evidence runner sends two public-safe candidate resource summaries so compare-resources receives a valid body."
    };
  }
  const schema = trust402RouteSchema(pathOf(candidateEndpoint));
  if (schema) {
    return {
      schema,
      sendsOnly: trust402RouteSmokeFields(schema),
      privatePayloadAllowed: false,
      generatedBy: "scripts/live-evidence-smoke.js",
      note: "The live evidence runner sends a small public-safe sample body for this Trust402 paid launch route."
    };
  }
  return {
    schema: "generic-json",
    sendsOnly: ["goal"],
    privatePayloadAllowed: false,
    generatedBy: "scripts/live-evidence-smoke.js"
  };
}

function paymentProviderAlternatives({ selectedProvider, candidateEndpoint, liveMaxPerCallUsd, includeProof }) {
  return [
    providerAlternative({
      provider: "agentcash-mcp",
      selectedProvider,
      label: "AgentCash MCP bridge",
      useWhen: "Use when a Trust402-specific AgentCash payment bridge URL is available and should keep wallet operations outside the Vercel function.",
      preflightCommand: [
        "npm run payment:bridge-check --",
        "--adapter-url=<LIVE_PAYMENT_ADAPTER_URL>",
        "--provider=agentcash-mcp",
        `--candidate-endpoint=${candidateEndpoint || "<approved-x402-endpoint>"}`,
        `--max-amount-usd=${usd(liveMaxPerCallUsd)}`,
        "--strict"
      ].join(" "),
      requiresBridgePreflight: true
    }),
    providerAlternative({
      provider: "cdp-x402",
      selectedProvider,
      label: "CDP-managed x402 buyer",
      useWhen: "Use when the CDP project has CDP_WALLET_SECRET plus an existing EVM account address or name; no LIVE_PAYMENT_ADAPTER_URL is required.",
      preflightCommand: "npm run payment:buyer-preflight -- --provider=cdp-x402 --strict",
      probeCommand: "npm run payment:buyer-preflight -- --provider=cdp-x402 --probe-cdp --operator-approved --strict",
      requiresCdpAccountRef: true
    }),
    providerAlternative({
      provider: "x402-fetch",
      selectedProvider,
      label: "Local @x402/fetch buyer key",
      useWhen: "Use only when the operator explicitly accepts private-key custody in runtime env; this is the most direct path but has the highest key-management burden.",
      preflightCommand: "npm run completion:unblockers -- <base-url>",
      privateKeyMaterialRequired: true
    }),
    providerAlternative({
      provider: "external-adapter",
      selectedProvider,
      label: "External payment adapter",
      useWhen: "Use when a non-AgentCash bridge implements the Trust402 payment adapter contract and can prove dry-run/no-payment behavior.",
      preflightCommand: [
        "npm run payment:bridge-check --",
        "--adapter-url=<LIVE_PAYMENT_ADAPTER_URL>",
        "--provider=external-adapter",
        `--candidate-endpoint=${candidateEndpoint || "<approved-x402-endpoint>"}`,
        `--max-amount-usd=${usd(liveMaxPerCallUsd)}`,
        "--strict"
      ].join(" "),
      requiresBridgePreflight: true
    })
  ].map((item) => ({
    ...item,
    proof402Compatible: includeProof ? true : "not-required"
  }));
}

function providerAlternative({
  provider,
  selectedProvider,
  label,
  useWhen,
  preflightCommand,
  probeCommand = null,
  requiresBridgePreflight = false,
  requiresCdpAccountRef = false,
  privateKeyMaterialRequired = false
}) {
  return {
    provider,
    selected: provider === selectedProvider,
    label,
    useWhen,
    envPlan: {
      LIVE_PAYMENT_PROVIDER: provider
    },
    requiredSecrets: paymentProviderRequiredSecrets(provider),
    bridgeContract: paymentBridgeContract(provider),
    requiresBridgePreflight,
    requiresCdpAccountRef,
    privateKeyMaterialRequired,
    preflightCommand,
    probeCommand,
    safety: {
      includesSecretValues: false,
      sendsPaymentHeadersDuringPreflight: false,
      mutatesWalletDuringPreflight: false
    }
  };
}

function isProof402NotarizeEndpoint(value) {
  try {
    const url = new URL(value);
    return url.hostname === "proof402.vercel.app" && url.pathname === "/api/proof/notarize";
  } catch {
    return false;
  }
}

function isTrust402CompareResourcesEndpoint(value, baseUrl = DEFAULT_BASE_URL) {
  try {
    const url = new URL(value);
    const allowedOrigins = new Set(["https://trust402.vercel.app"]);
    const baseOrigin = originOf(baseUrl);
    if (baseOrigin) allowedOrigins.add(baseOrigin);
    return allowedOrigins.has(url.origin) && url.pathname === "/api/trust/compare-resources";
  } catch {
    return false;
  }
}

function pathOf(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function trust402RouteSchema(path) {
  return {
    "/api/trust/check-x402": "trust.check_x402",
    "/api/trust/score-resource": "trust.score_resource",
    "/api/trust/evaluate-origin": "trust.evaluate_origin",
    "/api/seller/readiness": "seller.readiness",
    "/api/procurement/plan": "procurement.plan",
    "/api/procurement/quote": "procurement.quote",
    "/api/monitor/snapshot": "monitor.snapshot",
    "/api/monitor/badge": "monitor.badge",
    "/api/reports/x402-diligence": "reports.x402_diligence"
  }[path] || null;
}

function trust402RouteSmokeBody(path, trustOrigin) {
  const candidate = sampleTrust402Candidate(trustOrigin);
  const proofCandidate = sampleProof402Candidate();
  if (path === "/api/trust/check-x402") {
    return {
      endpoint: `${trustOrigin}/api/trust/score-resource`,
      method: "POST",
      expectedPriceUsd: 0.01
    };
  }
  if (path === "/api/trust/score-resource") return candidate;
  if (path === "/api/trust/evaluate-origin") return { origin: trustOrigin };
  if (path === "/api/seller/readiness") {
    return {
      origin: trustOrigin,
      ...candidate
    };
  }
  if (path === "/api/procurement/plan") {
    return {
      goal: "Plan a bounded Trust402 buyer workflow for marketplace indexing evidence.",
      budgetUsd: 0.05,
      maxPaidCalls: 2,
      riskTolerance: "low",
      allowedRegistries: ["https://api.cdp.coinbase.com/platform/v2/x402/discovery"],
      requireProofReceipts: true
    };
  }
  if (path === "/api/procurement/quote") {
    return {
      goal: "Quote a bounded Trust402 buyer workflow for marketplace indexing evidence.",
      budgetUsd: 0.08,
      maxPaidCalls: 2,
      riskTolerance: "low",
      allowedRegistries: ["https://api.cdp.coinbase.com/platform/v2/x402/discovery"],
      requireProofReceipts: true,
      candidates: [proofCandidate, candidate]
    };
  }
  if (path === "/api/monitor/snapshot" || path === "/api/monitor/badge") {
    return {
      endpoint: `${trustOrigin}/api/trust/check-x402`,
      method: "POST",
      expectedPriceUsd: 0.005
    };
  }
  if (path === "/api/reports/x402-diligence") {
    return {
      origin: trustOrigin,
      endpoint: `${trustOrigin}/api/trust/check-x402`,
      method: "POST",
      expectedPriceUsd: 0.005
    };
  }
  return null;
}

function sampleTrust402Candidate(trustOrigin) {
  return {
    id: "trust.check_x402",
    endpoint: `${trustOrigin}/api/trust/check-x402`,
    priceUsd: 0.005,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    receiptReady: true,
    description: "Trust402 x402 challenge probe for payment-flow readiness."
  };
}

function sampleProof402Candidate() {
  return {
    id: "proof402.notarize",
    endpoint: "https://proof402.vercel.app/api/proof/notarize",
    priceUsd: 0.005,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    receiptReady: true,
    description: "Proof402 paid notarization endpoint for hash-only proof receipts."
  };
}

function trust402RouteSmokeFields(schema) {
  return {
    "trust.check_x402": ["endpoint", "method", "expectedPriceUsd"],
    "trust.score_resource": ["id", "endpoint", "priceUsd", "has402", "hasInputSchema", "hasOpenApi", "hasWellKnown", "receiptReady", "description"],
    "trust.evaluate_origin": ["origin"],
    "seller.readiness": ["origin", "id", "endpoint", "priceUsd", "has402", "hasInputSchema", "hasOpenApi", "hasWellKnown", "receiptReady", "description"],
    "procurement.plan": ["goal", "budgetUsd", "maxPaidCalls", "riskTolerance", "allowedRegistries", "requireProofReceipts"],
    "procurement.quote": ["goal", "budgetUsd", "maxPaidCalls", "riskTolerance", "allowedRegistries", "requireProofReceipts", "candidates"],
    "monitor.snapshot": ["endpoint", "method", "expectedPriceUsd"],
    "monitor.badge": ["endpoint", "method", "expectedPriceUsd"],
    "reports.x402_diligence": ["origin", "endpoint", "method", "expectedPriceUsd"]
  }[schema] || ["goal"];
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

function choosePaymentProvider(inputProvider, configuredProvider) {
  if (inputProvider) return inputProvider;
  if (configuredProvider && configuredProvider !== "disabled") return configuredProvider;
  return "agentcash-mcp";
}

function arrayOrEmpty(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function uniqueList(values) {
  return Array.from(new Set(values.filter(Boolean)));
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
