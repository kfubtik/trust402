import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";
import { config } from "./config.js";

const HTTPS_URL_RE = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
const LOCAL_URL_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/.*)?$/i;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRICE_FRIENDLY_LIMIT = 0.05;

export async function checkX402(input = {}, options = {}) {
  const endpoint = requiredUrl(input.endpoint, "endpoint", { allowLocal: true });
  const method = normalizeMethod(input.method || "GET");
  const timeoutMs = clampNumber(input.timeoutMs, 500, 20000, config.requestTimeoutMs);
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const probeHeaders = safeProbeHeaders(input.headers);

  try {
    const response = await fetchImpl(endpoint, {
      method,
      headers: {
        accept: "application/json",
        ...probeHeaders.headers
      },
      body: methodAllowsBody(method) && input.body !== undefined ? JSON.stringify(input.body) : undefined,
      signal: controller.signal
    });
    const latencyMs = Date.now() - startedAt;
    const body = await safeResponseBody(response);
    const paymentRequiredHeader = response.headers.get("payment-required");
    const challenge = extractX402Challenge({
      status: response.status,
      headers: {
        paymentRequired: paymentRequiredHeader,
        wwwAuthenticate: response.headers.get("www-authenticate")
      },
      body
    });

    const checks = [
      check("reachable", response.status > 0, "Endpoint responded.", "Endpoint did not respond."),
      check("status_402", response.status === 402, "Endpoint returned HTTP 402 before payment.", `Endpoint returned HTTP ${response.status}.`),
      check("challenge_parseable", Boolean(challenge), "x402 challenge was parseable.", "x402 challenge was not parseable."),
      check("accepts_present", Array.isArray(challenge?.accepts) && challenge.accepts.length > 0, "accepts array is present.", "accepts array is missing."),
      check("pay_to_present", Boolean(firstAccept(challenge)?.payTo), "payTo is present.", "payTo is missing."),
      check("amount_present", Boolean(firstAccept(challenge)?.amount || firstAccept(challenge)?.maxAmountRequired), "amount is present.", "amount is missing."),
      check("network_present", Boolean(firstAccept(challenge)?.network), "network is present.", "network is missing.")
    ];

    return {
      ok: true,
      tool: "trust.check_x402",
      endpoint,
      method,
      observed: {
        status: response.status,
        latencyMs,
        contentType: response.headers.get("content-type") || null
      },
      x402: challenge || null,
      checks,
      recommendation: checks.every((item) => item.passed) ? "payment-flow-ready" : "fix-before-use",
      policy: {
        sentPaymentHeader: false,
        droppedSensitiveHeaders: probeHeaders.dropped,
        paidOtherAgents: false,
        mode: "unpaid-probe"
      }
    };
  } catch (error) {
    return {
      ok: true,
      tool: "trust.check_x402",
      endpoint,
      method,
      observed: {
        status: null,
        latencyMs: Date.now() - startedAt,
        error: error.name === "AbortError" ? "timeout" : error.message
      },
      x402: null,
      checks: [
        check("reachable", false, "Endpoint responded.", "Endpoint did not respond."),
        check("status_402", false, "Endpoint returned HTTP 402 before payment.", "Endpoint could not be probed."),
        check("challenge_parseable", false, "x402 challenge was parseable.", "x402 challenge was not parseable.")
      ],
      recommendation: "avoid-until-fixed",
      policy: {
        sentPaymentHeader: false,
        droppedSensitiveHeaders: probeHeaders.dropped,
        paidOtherAgents: false,
        mode: "unpaid-probe"
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

export function scoreResource(input = {}) {
  const endpoint = optionalString(input.endpoint || input.url);
  const priceUsd = numberOrNull(input.priceUsd ?? input.price);
  const observed = input.observed || {};
  const x402 = input.x402 || {};
  const metadata = input.metadata || {};
  const accepts = Array.isArray(x402.accepts) ? x402.accepts : [];
  const accept = accepts[0] || input.accept || {};

  const checks = [];
  weighted(checks, "https_endpoint", 8, isPublicOrLocalUrl(endpoint), "Endpoint URL is usable.", "Endpoint URL is missing or invalid.");
  weighted(checks, "x402_challenge", 12, input.has402 === true || observed.status === 402 || accepts.length > 0, "x402 challenge evidence is present.", "No x402 challenge evidence was supplied.");
  weighted(checks, "accepts", 8, accepts.length > 0 || Boolean(input.accept), "Payment accepts data is present.", "Payment accepts data is missing.");
  weighted(checks, "pay_to", 8, EVM_ADDRESS_RE.test(accept.payTo || input.payTo || ""), "payTo looks valid.", "payTo is missing or invalid.");
  weighted(checks, "network", 7, Boolean(accept.network || input.network), "Network is declared.", "Network is missing.");
  weighted(checks, "asset", 5, Boolean(accept.asset || input.asset), "Payment asset is declared.", "Payment asset is missing.");
  weighted(checks, "price", 10, priceUsd !== null && priceUsd >= 0 && priceUsd <= PRICE_FRIENDLY_LIMIT, "Price is agent-friendly.", "Price is missing or above the starter trust threshold.");
  weighted(checks, "input_schema", 12, input.hasInputSchema === true || Boolean(input.inputSchema || metadata.inputSchema), "Input schema is available.", "Input schema is missing.");
  weighted(checks, "openapi", 8, input.hasOpenApi === true || Boolean(input.openapiUrl), "OpenAPI signal is available.", "OpenAPI signal is missing.");
  weighted(checks, "well_known", 7, input.hasWellKnown === true || Boolean(input.wellKnownUrl), ".well-known or x402 discovery signal is available.", ".well-known/x402 discovery signal is missing.");
  weighted(checks, "description", 5, optionalString(input.description || metadata.description)?.length >= 20, "Description is useful.", "Description is too short or missing.");
  weighted(checks, "latency", 5, observed.latencyMs === undefined || numberOrNull(observed.latencyMs) <= 3000, "Latency is acceptable.", "Latency is above 3000ms.");
  weighted(checks, "receipt_ready", 5, input.receiptReady === true || input.proofReady === true, "Receipt path is declared.", "Receipt/proof path is missing.");

  return buildScoreResult({
    tool: "trust.score_resource",
    subject: endpoint || input.id || "unknown-resource",
    checks,
    context: {
      priceUsd,
      observedStatus: observed.status ?? null
    }
  });
}

export async function evaluateOrigin(input = {}, options = {}) {
  const origin = normalizeOrigin(requiredUrl(input.origin, "origin", { allowLocal: true }));
  const fetchImpl = options.fetchImpl || fetch;
  const [openapi, wellKnown] = await Promise.all([
    fetchJsonIfAvailable(`${origin}/openapi.json`, fetchImpl),
    fetchJsonIfAvailable(`${origin}/.well-known/x402`, fetchImpl)
  ]);

  const openapiPaths = openapi.ok && openapi.body?.paths ? Object.keys(openapi.body.paths) : [];
  const wellKnownResources = wellKnown.ok && Array.isArray(wellKnown.body?.resources) ? wellKnown.body.resources : [];
  const paidPathCount = openapiPaths.filter((path) => hasPaymentInfo(openapi.body.paths[path])).length;
  const schemaPathCount = openapiPaths.filter((path) => pathHasRequestSchema(openapi.body.paths[path])).length;

  const checks = [];
  weighted(checks, "origin_url", 8, isPublicOrLocalUrl(origin), "Origin URL is usable.", "Origin URL is invalid.");
  weighted(checks, "openapi", 14, openapi.ok, "OpenAPI document is reachable.", "OpenAPI document is missing.");
  weighted(checks, "well_known", 14, wellKnown.ok, ".well-known/x402 document is reachable.", ".well-known/x402 document is missing.");
  weighted(checks, "resource_inventory", 12, openapiPaths.length > 0 || wellKnownResources.length > 0, "Resource inventory is visible.", "No resource inventory found.");
  weighted(checks, "paid_resources", 10, paidPathCount > 0 || wellKnownResources.length > 0, "Paid resources are discoverable.", "Paid resources are not discoverable.");
  weighted(checks, "schema_coverage", 10, openapiPaths.length === 0 || schemaPathCount / Math.max(openapiPaths.length, 1) >= 0.4, "Schema coverage is acceptable.", "Schema coverage is weak.");
  weighted(checks, "metadata", 8, Boolean(openapi.body?.info?.title || wellKnown.body?.name), "Service metadata is present.", "Service metadata is missing.");
  weighted(checks, "guidance", 8, Boolean(openapi.body?.info?.description || openapi.body?.info?.guidance || wellKnown.body?.instructions), "Agent guidance is present.", "Agent guidance is missing.");
  weighted(checks, "security", 8, Boolean(openapi.body?.components?.securitySchemes || openapi.body?.security), "Security/auth metadata is present.", "Security/auth metadata is missing.");
  weighted(checks, "pricing", 8, paidPathCount > 0, "Pricing metadata appears in paid paths.", "Pricing metadata is missing.");

  return {
    ...buildScoreResult({
      tool: "trust.evaluate_origin",
      subject: origin,
      checks,
      context: {
        openapiStatus: openapi.status,
        wellKnownStatus: wellKnown.status,
        openapiPathCount: openapiPaths.length,
        paidPathCount,
        schemaPathCount,
        wellKnownResourceCount: wellKnownResources.length
      }
    }),
    discovery: {
      openapi: openapi.ok ? summarizeOpenApi(openapi.body) : null,
      wellKnown: wellKnown.ok ? summarizeWellKnown(wellKnown.body) : null
    }
  };
}

export async function sellerReadiness(input = {}, options = {}) {
  const originReport = input.origin
    ? await evaluateOrigin({ origin: input.origin }, options)
    : null;
  const resourceReport = input.endpoint || input.url
    ? scoreResource(input)
    : null;

  const checks = [
    ...(originReport?.checks || []),
    ...(resourceReport?.checks || [])
  ];
  if (checks.length === 0) {
    throw new ApiError(400, "invalid_input", "seller/readiness requires origin or endpoint.", {
      origin: "Provide origin and/or endpoint."
    });
  }

  const result = buildScoreResult({
    tool: "seller.readiness",
    subject: input.origin || input.endpoint || input.url,
    checks,
    context: {
      originScore: originReport?.score ?? null,
      resourceScore: resourceReport?.score ?? null
    }
  });

  return {
    ...result,
    recommendedTags: recommendTags(input, result),
    launchChecklist: sellerChecklist(result.missing),
    pricingAdvice: priceAdvice(input.priceUsd ?? input.price)
  };
}

export function compareResources(input = {}) {
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  if (candidates.length < 2 || candidates.length > 10) {
    throw new ApiError(400, "invalid_input", "compare-resources requires 2-10 candidates.", {
      candidates: "Provide between 2 and 10 candidate resources."
    });
  }

  const goal = optionalString(input.goal) || "select the best x402 resource";
  const budgetUsd = numberOrNull(input.budgetUsd);
  const ranked = candidates
    .map((candidate, index) => {
      const scored = scoreResource(candidate);
      const priceUsd = numberOrNull(candidate.priceUsd ?? candidate.price);
      const budgetFit = budgetUsd === null || priceUsd === null || priceUsd <= budgetUsd;
      const valueScore = scored.score + (budgetFit ? 5 : -20) - Math.max((priceUsd || 0) * 100, 0);
      return {
        rank: 0,
        id: candidate.id || candidate.name || `candidate-${index + 1}`,
        endpoint: candidate.endpoint || candidate.url || null,
        priceUsd,
        score: scored.score,
        riskLevel: scored.riskLevel,
        recommendation: scored.recommendation,
        budgetFit,
        valueScore: Math.round(valueScore * 100) / 100,
        missing: scored.missing
      };
    })
    .sort((a, b) => b.valueScore - a.valueScore)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return {
    ok: true,
    tool: "trust.compare_resources",
    goal,
    budgetUsd,
    recommendation: ranked[0],
    ranked,
    avoid: ranked.filter((candidate) => candidate.recommendation === "avoid-until-fixed" || !candidate.budgetFit)
  };
}

export function procurementPlan(input = {}) {
  const goal = optionalString(input.goal);
  if (!goal) {
    throw new ApiError(400, "invalid_input", "procurement plan requires a goal.", {
      goal: "Describe the outcome the buyer wants."
    });
  }

  const budgetUsd = numberOrNull(input.budgetUsd);
  if (budgetUsd === null || budgetUsd <= 0 || budgetUsd > 100) {
    throw new ApiError(400, "invalid_input", "budgetUsd must be greater than 0 and at most 100.", {
      budgetUsd: "Use a positive budget <= 100."
    });
  }

  const maxPaidCalls = Math.trunc(clampNumber(input.maxPaidCalls, 1, 50, 5));
  const riskTolerance = ["low", "medium", "high"].includes(input.riskTolerance) ? input.riskTolerance : "low";
  const minimumTrustScore = riskTolerance === "low" ? 82 : riskTolerance === "medium" ? 70 : 60;
  const reserveUsd = roundUsd(Math.min(Math.max(budgetUsd * 0.15, 0.005), budgetUsd * 0.4));
  const workingBudgetUsd = roundUsd(budgetUsd - reserveUsd);
  const perCallLimitUsd = roundUsd(Math.max(workingBudgetUsd / maxPaidCalls, 0.001));

  return {
    ok: true,
    tool: "procurement.plan",
    goal,
    budget: {
      totalUsd: roundUsd(budgetUsd),
      reserveForReceiptsUsd: reserveUsd,
      workingBudgetUsd,
      maxPaidCalls,
      perCallLimitUsd
    },
    policy: {
      mode: "plan-only",
      liveSpendEnabled: false,
      riskTolerance,
      minimumTrustScore,
      allowedRegistries: Array.isArray(input.allowedRegistries) ? input.allowedRegistries : [],
      requireProofReceipts: input.requireProofReceipts !== false,
      stopIf: [
        "candidate score is below minimumTrustScore",
        "price is above perCallLimitUsd",
        "endpoint lacks input schema",
        "endpoint lacks a parseable x402 challenge",
        "result cannot be hashed and cited"
      ]
    },
    route: [
      { step: "discover", paid: false, action: "Collect candidate resources from allowed registries and direct origins." },
      { step: "check", paid: true, maxSpendUsd: 0.005, action: "Run check-x402 for candidates that pass URL and policy filters." },
      { step: "score", paid: true, maxSpendUsd: 0.01, action: "Score each candidate resource." },
      { step: "compare", paid: true, maxSpendUsd: 0.03, action: "Rank resources against the goal and budget." },
      { step: "buy", paid: "future", maxSpendUsd: perCallLimitUsd, action: "Execute only after explicit live-spend approval." },
      { step: "receipt", paid: "future", action: "Hash final result and attach proof receipt when configured." }
    ],
    approvalPayload: {
      goal,
      maxSpendUsd: roundUsd(budgetUsd),
      maxPaidCalls,
      perCallLimitUsd,
      minimumTrustScore
    }
  };
}

export async function x402Diligence(input = {}, options = {}) {
  const endpoint = optionalString(input.endpoint || input.url);
  const origin = optionalString(input.origin);
  if (!endpoint && !origin) {
    throw new ApiError(400, "invalid_input", "x402 diligence requires endpoint or origin.", {
      endpoint: "Provide endpoint and/or origin."
    });
  }

  const endpointCheck = endpoint ? await checkX402({ endpoint, method: input.method || "GET" }, options) : null;
  const resourceScore = endpoint
    ? scoreResource({
        ...input,
        endpoint,
        observed: endpointCheck?.observed,
        x402: endpointCheck?.x402,
        has402: endpointCheck?.observed?.status === 402
      })
    : null;
  const originReport = origin ? await evaluateOrigin({ origin }, options) : null;
  const sellerReport = await sellerReadiness({ ...input, endpoint, origin }, options).catch(() => null);

  const sections = {
    endpointCheck,
    resourceScore,
    originReport,
    sellerReport
  };
  const overallScore = averageScores([resourceScore?.score, originReport?.score, sellerReport?.score]);
  const report = {
    ok: true,
    tool: "reports.x402_diligence",
    subject: endpoint || origin,
    generatedAt: new Date().toISOString(),
    overallScore,
    riskLevel: scoreToRisk(overallScore),
    recommendation: scoreToRecommendation(overallScore),
    sections,
    policy: {
      liveSpendEnabled: false,
      paidOtherAgents: false,
      receiptReady: true
    }
  };

  return {
    ...report,
    evidenceHash: sha256Json(report),
    nextSteps: diligenceNextSteps(report)
  };
}

function extractX402Challenge({ status, headers, body }) {
  const bodyAccepts = body && typeof body === "object" && Array.isArray(body.accepts) ? body.accepts : null;
  if (bodyAccepts) {
    return {
      source: "body.accepts",
      x402Version: body.x402Version || body.error?.details?.x402Version || null,
      accepts: bodyAccepts
    };
  }

  if (headers.paymentRequired) {
    const decoded = decodePaymentRequired(headers.paymentRequired);
    if (decoded) {
      return {
        source: "payment-required-header",
        x402Version: decoded.x402Version || null,
        accepts: Array.isArray(decoded.accepts) ? decoded.accepts : []
      };
    }
  }

  if (status === 402 && body?.error?.details) {
    const details = body.error.details;
    return {
      source: "body.error.details",
      x402Version: details.x402Version || null,
      accepts: [
        {
          scheme: details.scheme,
          network: details.network,
          amount: details.amount || details.maxAmountRequired,
          asset: details.asset,
          payTo: details.payTo
        }
      ].filter((accept) => Object.values(accept).some(Boolean))
    };
  }

  return null;
}

function decodePaymentRequired(header) {
  try {
    return JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function safeResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text.slice(0, 2000) };
    }
  }
  return { raw: text.slice(0, 2000) };
}

async function fetchJsonIfAvailable(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" }
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      return { ok: false, status: response.status, body: null };
    }
    return { ok: true, status: response.status, body: await response.json() };
  } catch (error) {
    return { ok: false, status: null, body: null, error: error.message };
  }
}

function hasPaymentInfo(pathItem = {}) {
  return Object.values(pathItem).some((operation) => operation?.["x-payment-info"]);
}

function pathHasRequestSchema(pathItem = {}) {
  return Object.values(pathItem).some((operation) => operation?.requestBody?.content?.["application/json"]?.schema);
}

function summarizeOpenApi(body) {
  const paths = Object.keys(body.paths || {});
  return {
    title: body.info?.title || null,
    version: body.info?.version || null,
    pathCount: paths.length,
    paidPathCount: paths.filter((path) => hasPaymentInfo(body.paths[path])).length
  };
}

function summarizeWellKnown(body) {
  return {
    name: body.name || null,
    resourceCount: Array.isArray(body.resources) ? body.resources.length : 0,
    hasInstructions: Boolean(body.instructions)
  };
}

function buildScoreResult({ tool, subject, checks, context }) {
  const totalWeight = checks.reduce((sum, item) => sum + item.weight, 0) || 1;
  const earned = checks.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);
  return {
    ok: true,
    tool,
    subject,
    score,
    riskLevel: scoreToRisk(score),
    recommendation: scoreToRecommendation(score),
    checks,
    missing: checks.filter((item) => !item.passed).map((item) => item.id),
    context,
    nextSteps: genericNextSteps(checks)
  };
}

function weighted(checks, id, weight, passed, passMessage, failMessage) {
  checks.push({
    id,
    weight,
    passed: Boolean(passed),
    message: passed ? passMessage : failMessage
  });
}

function check(id, passed, passMessage, failMessage) {
  return {
    id,
    passed: Boolean(passed),
    message: passed ? passMessage : failMessage
  };
}

function scoreToRisk(score) {
  if (score >= 82) return "low";
  if (score >= 60) return "medium";
  return "high";
}

function scoreToRecommendation(score) {
  if (score >= 82) return "use";
  if (score >= 60) return "test-first";
  return "avoid-until-fixed";
}

function genericNextSteps(checks) {
  const missing = new Set(checks.filter((item) => !item.passed).map((item) => item.id));
  const steps = [];
  if (missing.has("x402_challenge") || missing.has("status_402")) steps.push("Probe the endpoint and confirm it returns HTTP 402 before payment.");
  if (missing.has("input_schema") || missing.has("schema_coverage")) steps.push("Add strict input schemas for autonomous callers.");
  if (missing.has("openapi")) steps.push("Publish /openapi.json.");
  if (missing.has("well_known")) steps.push("Publish /.well-known/x402.");
  if (missing.has("price") || missing.has("pricing")) steps.push("Expose clear fixed pricing metadata.");
  if (missing.has("receipt_ready")) steps.push("Add a receipt/proof path for final outputs.");
  if (steps.length === 0) steps.push("Run a paid smoke test with an explicit max spend and attach a proof receipt.");
  return steps;
}

function sellerChecklist(missing) {
  return genericNextSteps(missing.map((id) => ({ id, passed: false })));
}

function recommendTags(input, result) {
  const tags = new Set(["x402", "trust"]);
  if (input.origin) tags.add("origin");
  if (input.endpoint || input.url) tags.add("endpoint");
  if (result.score >= 82) tags.add("marketplace-ready");
  if (result.missing.includes("input_schema")) tags.add("needs-schema");
  return Array.from(tags);
}

function priceAdvice(price) {
  const priceUsd = numberOrNull(price);
  if (priceUsd === null) return "Publish a clear USD price. Starter trust tools perform best at or below $0.05.";
  if (priceUsd <= 0.01) return "Price is very agent-friendly for discovery and utility calls.";
  if (priceUsd <= 0.05) return "Price is acceptable for decision tools if the output is structured and reliable.";
  return "Price is high for first-call trust. Add strong evidence, examples, and a clear value reason.";
}

function diligenceNextSteps(report) {
  const steps = [];
  if (report.overallScore < 82) steps.push("Fix missing trust signals before using this resource in live procurement.");
  if (report.sections.endpointCheck?.recommendation !== "payment-flow-ready") steps.push("Fix the x402 challenge flow or probe evidence.");
  steps.push("Hash any final purchased result and attach a proof receipt when Proof402 integration is configured.");
  return steps;
}

function firstAccept(challenge) {
  return Array.isArray(challenge?.accepts) ? challenge.accepts[0] : null;
}

function methodAllowsBody(method) {
  return !["GET", "HEAD"].includes(method);
}

function normalizeMethod(method) {
  const normalized = String(method || "GET").trim().toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(normalized)) {
    throw new ApiError(400, "invalid_input", "Unsupported HTTP method.", {
      method: "Use GET, POST, PUT, PATCH, DELETE, or HEAD."
    });
  }
  return normalized;
}

function requiredUrl(value, field, { allowLocal = false } = {}) {
  const url = optionalString(value);
  if (!url || !(HTTPS_URL_RE.test(url) || (allowLocal && LOCAL_URL_RE.test(url)))) {
    throw new ApiError(400, "invalid_input", `${field} must be an HTTPS URL. Localhost HTTP is allowed for tests.`, {
      [field]: "Use https://... or local http://127.0.0.1:<port> for tests."
    });
  }
  return url;
}

function normalizeOrigin(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.host}`;
}

function isPublicOrLocalUrl(value) {
  return Boolean(value && (HTTPS_URL_RE.test(value) || LOCAL_URL_RE.test(value)));
}

function optionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampNumber(value, min, max, fallback) {
  const parsed = numberOrNull(value);
  if (parsed === null) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function roundUsd(value) {
  return Math.round(value * 1000000) / 1000000;
}

function averageScores(values) {
  const scores = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function safeProbeHeaders(inputHeaders) {
  const headers = {};
  const dropped = [];
  const blocked = new Set([
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-payment"
  ]);

  if (!inputHeaders || typeof inputHeaders !== "object" || Array.isArray(inputHeaders)) {
    return { headers, dropped };
  }

  for (const [name, value] of Object.entries(inputHeaders)) {
    const normalized = name.toLowerCase();
    if (blocked.has(normalized)) {
      dropped.push(name);
      continue;
    }
    if (value !== undefined && value !== null) {
      headers[name] = String(value);
    }
  }

  return { headers, dropped };
}
