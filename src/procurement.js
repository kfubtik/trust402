import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";
import { createPaidFetch } from "./paymentAdapters.js";
import { liveProcurementPolicy } from "./policies.js";
import { receiptBundle } from "./receipts.js";
import { compareResources, procurementPlan, scoreResource } from "./trustEngine.js";

const QUOTE_FEE_USD = 0.04;

export function procurementQuote(input = {}) {
  const plan = procurementPlan(input);
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const comparison = candidates.length >= 2 ? compareResources({
    goal: input.goal,
    budgetUsd: plan.budget.perCallLimitUsd,
    candidates
  }) : null;
  const rankedCandidates = comparison?.ranked || (candidates.length === 1 ? rankSingleCandidate({
    candidate: candidates[0],
    budgetUsd: plan.budget.perCallLimitUsd
  }) : []);
  const selectedResources = selectResources({
    ranked: rankedCandidates,
    candidates,
    maxPaidCalls: plan.budget.maxPaidCalls,
    minimumTrustScore: plan.policy.minimumTrustScore,
    perCallLimitUsd: plan.budget.perCallLimitUsd
  });
  const passThroughEstimateUsd = roundUsd(selectedResources.reduce((sum, resource) => sum + (resource.priceUsd || 0), 0));
  const estimatedTrust402FeesUsd = roundUsd(QUOTE_FEE_USD + estimateTrust402DecisionFees({
    candidateCount: Math.max(candidates.length, selectedResources.length),
    includeComparison: Boolean(comparison),
    includeReceipt: plan.policy.requireProofReceipts
  }));
  const estimatedTotalUsd = roundUsd(passThroughEstimateUsd + estimatedTrust402FeesUsd);

  const quoteCore = {
    goal: plan.goal,
    budget: plan.budget,
    selectedResources,
    passThroughEstimateUsd,
    estimatedTrust402FeesUsd,
    estimatedTotalUsd,
    withinBudget: estimatedTotalUsd <= plan.budget.totalUsd,
    comparison: comparison ? {
      recommendation: comparison.recommendation,
      avoid: comparison.avoid,
      rankedCount: comparison.ranked.length
    } : null,
    policy: plan.policy
  };
  const quoteHash = sha256Json(quoteCore);

  return {
    ok: true,
    tool: "procurement.quote",
    mode: "quote-only",
    quoteId: `trust402-quote-${quoteHash.slice(7, 19)}`,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    quoteHash,
    quote: quoteCore,
    route: plan.route,
    approvalPayload: {
      ...plan.approvalPayload,
      quoteHash,
      quoteId: `trust402-quote-${quoteHash.slice(7, 19)}`,
      estimatedTotalUsd,
      liveSpendEnabled: false
    },
    receiptBundle: receiptBundle({
      subject: input.goal,
      resultHash: quoteHash,
      payloadHash: quoteHash,
      purpose: "procurement quote evidence"
    }),
    nextSteps: quoteNextSteps({ selectedResources, comparison, quoteCore })
  };
}

export function procurementExecute(input = {}, options = {}) {
  if (input.liveSpendEnabled === true || input.mode === "live") {
    return procurementExecuteLive(input, options);
  }

  const quote = input.quote?.quoteHash
    ? normalizeSubmittedQuote(input.quote)
    : input.quoteHash && input.quote
      ? normalizeSubmittedQuote(input)
      : procurementQuote(input);
  const audit = buildDryRunAudit({ input, quote });
  const executionHash = sha256Json({
    quoteHash: quote.quoteHash,
    audit
  });

  return {
    ok: true,
    tool: "procurement.execute",
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    quoteId: quote.quoteId,
    quoteHash: quote.quoteHash,
    executionHash,
    paidSubcallsMade: 0,
    liveSpendEnabled: false,
    result: {
      status: "not-executed",
      reason: "Controlled procurement execution is simulated until live-spend policy is explicitly enabled.",
      selectedResources: quote.quote.selectedResources || [],
      estimatedTotalUsd: quote.quote.estimatedTotalUsd
    },
    audit,
    receiptBundle: receiptBundle({
      subject: quote.quote.goal || "dry-run procurement execution",
      resultHash: executionHash,
      payloadHash: executionHash,
      purpose: "dry-run procurement execution audit"
    }),
    nextSteps: [
      "Review the audit stages and selected resources.",
      "Run diligence on selected resources before any live execution.",
      "Enable live procurement only through a separate hot-wallet profile and explicit budget approval."
    ]
  };
}

async function procurementExecuteLive(input = {}, options = {}) {
  const cfg = options.config || config;
  const operatorAuthorized = options.operatorAuthorized === true;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const paidFetchImpl = options.paidFetchImpl || null;
  const quote = input.quote?.quoteHash
    ? normalizeSubmittedQuote(input.quote)
    : input.quoteHash && input.quote
      ? normalizeSubmittedQuote(input)
      : procurementQuote(input);
  const policy = liveProcurementPolicy(cfg);
  const blockers = [...policy.blockers];
  const selectedResources = quote.quote.selectedResources || [];
  const approval = input.approval || input.approvalPayload || {};

  if (!operatorAuthorized) {
    blockers.push({
      id: "operator_not_authorized",
      message: "Live procurement requires x-trust402-operator-key."
    });
  }
  if (selectedResources.length === 0) {
    blockers.push({
      id: "no_selected_resources",
      message: "Quote has no selected resources to execute."
    });
  }
  if (!quote.quote.withinBudget) {
    blockers.push({
      id: "quote_over_budget",
      message: "Quote estimated total exceeds the requested budget."
    });
  }
  if (quote.quote.passThroughEstimateUsd > cfg.liveMaxPerJobUsd) {
    blockers.push({
      id: "pass_through_exceeds_job_cap",
      message: "Selected resource pass-through estimate exceeds LIVE_MAX_PER_JOB_USD."
    });
  }
  const dailyRemainingUsd = dailyRemaining(cfg);
  if (cfg.liveDailyLimitUsd > 0 && quote.quote.passThroughEstimateUsd > dailyRemainingUsd) {
    blockers.push({
      id: "pass_through_exceeds_daily_remaining",
      message: "Selected resource pass-through estimate exceeds remaining daily spend capacity."
    });
  }
  if (approvalRequired(quote, cfg) && !approvalMatchesQuote(approval, quote)) {
    blockers.push({
      id: "approval_required",
      message: "Live execution requires approval.approved=true and a matching approval.quoteHash."
    });
  }

  for (const resource of selectedResources) {
    blockers.push(...resourcePolicyBlockers(resource, cfg));
  }

  if (blockers.length > 0) {
    throw new ApiError(403, "live_spend_policy_blocked", "Live procurement is blocked by spend policy.", {
      quoteId: quote.quoteId,
      quoteHash: quote.quoteHash,
      blockers,
      paidSubcallsMade: 0
    });
  }

  const paidFetch = await createPaidFetch({ cfg, fetchImpl, paidFetchImpl });
  const calls = [];
  let estimatedPaidUsd = 0;
  for (const resource of selectedResources) {
    const call = await callPaidResource({ resource, input, fetchImpl: paidFetch, cfg });
    calls.push(call);
    if (!call.ok) {
      const executionHash = sha256Json({ quoteHash: quote.quoteHash, calls });
      throw new ApiError(call.status || 502, "downstream_purchase_failed", "A downstream paid resource call failed.", {
        quoteId: quote.quoteId,
        executionHash,
        failedResource: resource.id,
        calls,
        paidSubcallsMade: calls.filter((item) => item.ok).length
      });
    }
    estimatedPaidUsd = roundUsd(estimatedPaidUsd + (resource.priceUsd || 0));
  }

  const executionHash = sha256Json({
    quoteHash: quote.quoteHash,
    calls,
    estimatedPaidUsd
  });

  return {
    ok: true,
    tool: "procurement.execute",
    mode: "live",
    generatedAt: new Date().toISOString(),
    quoteId: quote.quoteId,
    quoteHash: quote.quoteHash,
    executionHash,
    paidSubcallsMade: calls.length,
    liveSpendEnabled: true,
    result: {
      status: "executed",
      selectedResources,
      estimatedPaidUsd,
      calls
    },
    audit: {
      goal: quote.quote.goal || input.goal || "live procurement execution",
      policyResult: {
        liveSpendEnabled: true,
        paymentProvider: cfg.livePaymentProvider,
        receiptLogMode: cfg.liveReceiptLogMode,
        approvalRequired: approvalRequired(quote, cfg),
        approvalObserved: approvalMatchesQuote(approval, quote)
      },
      limits: {
        maxPerCallUsd: cfg.liveMaxPerCallUsd,
        maxPerJobUsd: cfg.liveMaxPerJobUsd,
        dailyLimitUsd: cfg.liveDailyLimitUsd,
        spentTodayUsd: cfg.liveSpentTodayUsd,
        dailyRemainingBeforeUsd: dailyRemainingUsd,
        dailyRemainingAfterEstimatedUsd: roundUsd(dailyRemainingUsd - estimatedPaidUsd),
        approvalThresholdUsd: cfg.liveApprovalThresholdUsd
      }
    },
    receiptBundle: receiptBundle({
      subject: quote.quote.goal || "live procurement execution",
      resultHash: executionHash,
      payloadHash: executionHash,
      purpose: "live procurement execution audit"
    }),
    nextSteps: [
      "Review downstream call receipts and result hashes.",
      "Create a Proof402 receipt only for approved public-safe hashes.",
      "Stop execution immediately if spend policy or receipts do not match expectations."
    ]
  };
}

function selectResources({ ranked, candidates = [], maxPaidCalls, minimumTrustScore, perCallLimitUsd }) {
  return ranked
    .filter((resource) => resource.budgetFit)
    .filter((resource) => resource.score >= minimumTrustScore)
    .filter((resource) => resource.priceUsd === null || resource.priceUsd <= perCallLimitUsd)
    .slice(0, maxPaidCalls)
    .map((resource) => {
      const source = findSourceCandidate(resource, candidates);
      return {
        rank: resource.rank,
        id: resource.id,
        endpoint: resource.endpoint,
        method: source.method || source.request?.method || "POST",
        requestBody: source.requestBody ?? source.body ?? source.request?.body ?? {},
        priceUsd: resource.priceUsd,
        score: resource.score,
        riskLevel: resource.riskLevel,
        reason: "selected by quote policy"
      };
    });
}

function rankSingleCandidate({ candidate, budgetUsd }) {
  const scored = scoreResource(candidate);
  const priceUsd = numberOrNull(candidate.priceUsd ?? candidate.price);
  const budgetFit = budgetUsd === null || priceUsd === null || priceUsd <= budgetUsd;
  return [{
    rank: 1,
    id: candidate.id || candidate.name || "candidate-1",
    endpoint: candidate.endpoint || candidate.url || null,
    priceUsd,
    score: scored.score,
    riskLevel: scored.riskLevel,
    recommendation: scored.recommendation,
    budgetFit,
    valueScore: scored.score,
    missing: scored.missing
  }];
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function estimateTrust402DecisionFees({ candidateCount, includeComparison, includeReceipt }) {
  const checkFees = Math.min(candidateCount || 1, 10) * 0.005;
  const scoreFees = Math.min(candidateCount || 1, 10) * 0.01;
  const comparisonFee = includeComparison ? 0.03 : 0;
  const receiptReserve = includeReceipt ? 0.005 : 0;
  return roundUsd(checkFees + scoreFees + comparisonFee + receiptReserve);
}

function quoteNextSteps({ selectedResources, comparison, quoteCore }) {
  const steps = [];
  if (!comparison && selectedResources.length === 0) steps.push("Add 1-10 candidates with enough trust metadata to select concrete resources.");
  if (!comparison && selectedResources.length > 0) steps.push("Optionally add 2-10 candidates when you want Trust402 to compare alternatives before live execution.");
  if (selectedResources.length === 0) steps.push("No candidate met the score and budget policy; fix metadata or raise the budget.");
  if (!quoteCore.withinBudget) steps.push("Reduce selected resources or increase the total budget before live execution.");
  if (steps.length === 0) steps.push("Run x402 diligence for selected resources, then execute only after explicit live-spend approval.");
  return steps;
}

function normalizeSubmittedQuote(quote) {
  if (!quote.quoteHash || !quote.quote) {
    throw new ApiError(400, "invalid_input", "Submitted quote must include quoteHash and quote.", {
      quote: "Pass the full output from /api/procurement/quote."
    });
  }
  return quote;
}

function approvalRequired(quote, cfg) {
  const threshold = cfg.liveApprovalThresholdUsd;
  if (!(threshold > 0)) return true;
  return quote.quote.estimatedTotalUsd >= threshold;
}

function approvalMatchesQuote(approval, quote) {
  return approval?.approved === true && approval?.quoteHash === quote.quoteHash;
}

function resourcePolicyBlockers(resource, cfg) {
  const blockers = [];
  const endpoint = parseEndpoint(resource.endpoint);
  if (!endpoint) {
    blockers.push({ id: "invalid_resource_endpoint", message: `${resource.id} endpoint is not a valid URL.` });
    return blockers;
  }
  if (resource.priceUsd === null || resource.priceUsd === undefined) {
    blockers.push({ id: "missing_resource_price", message: `${resource.id} has no priceUsd.` });
  } else if (resource.priceUsd > cfg.liveMaxPerCallUsd) {
    blockers.push({ id: "resource_exceeds_per_call_cap", message: `${resource.id} exceeds LIVE_MAX_PER_CALL_USD.` });
  }
  if (!matchesAllowlist(endpoint, cfg.liveAllowedRegistries)) {
    blockers.push({ id: "resource_not_allowlisted", message: `${resource.id} origin is not in LIVE_ALLOWED_REGISTRIES.` });
  }
  if (matchesDenylist(endpoint, cfg.liveEndpointDenylist)) {
    blockers.push({ id: "resource_denylisted", message: `${resource.id} matches LIVE_ENDPOINT_DENYLIST.` });
  }
  return blockers;
}

async function callPaidResource({ resource, input, fetchImpl, cfg }) {
  const method = normalizeMethod(resource.method);
  const response = await fetchImpl(resource.endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": "Trust402 live procurement/0.1"
    },
    body: method === "GET" || method === "HEAD"
      ? undefined
      : JSON.stringify(resource.requestBody || { goal: input.goal || "Trust402 procurement" }),
    signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
  });
  const body = await responseBody(response);
  const paymentResponse = response.headers?.get?.("payment-response") || "";
  const paymentRequired = response.headers?.get?.("payment-required") || "";
  return {
    id: resource.id,
    endpoint: resource.endpoint,
    method,
    ok: response.ok,
    status: response.status,
    plannedPriceUsd: resource.priceUsd,
    paymentResponseObserved: Boolean(paymentResponse),
    paymentRequiredObserved: Boolean(paymentRequired),
    bodyHash: sha256Json(body ?? {}),
    bodySummary: summarizeBody(body)
  };
}

async function responseBody(response) {
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
    tool: body.tool || null,
    keys: Object.keys(body).slice(0, 20)
  };
}

function parseEndpoint(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function matchesAllowlist(url, allowlist) {
  return allowlist.some((entry) => matchesListEntry(url, entry));
}

function matchesDenylist(url, denylist) {
  return denylist.some((entry) => matchesListEntry(url, entry));
}

function matchesListEntry(url, entry) {
  if (!entry) return false;
  if (entry === "*") return true;
  try {
    const parsed = new URL(entry);
    return url.href.startsWith(parsed.href) || url.origin === parsed.origin;
  } catch {
    return url.hostname === entry || url.origin === entry || url.href.startsWith(entry);
  }
}

function normalizeMethod(value) {
  const method = String(value || "POST").toUpperCase();
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method) ? method : "POST";
}

function findSourceCandidate(resource, candidates) {
  return candidates.find((candidate) => {
    const id = candidate.id || candidate.name;
    const endpoint = candidate.endpoint || candidate.url;
    return id === resource.id || endpoint === resource.endpoint;
  }) || {};
}

function buildDryRunAudit({ input, quote }) {
  const stages = [
    auditStage("validate_policy", false, "Policy validated without enabling live spend."),
    auditStage("select_resources", false, `${quote.quote.selectedResources?.length || 0} resources selected by quote policy.`),
    auditStage("check_x402", true, "Would probe selected endpoints before payment."),
    auditStage("score", true, "Would score selected resources before purchase."),
    auditStage("buy", "blocked", "Live x402 purchase is blocked in dry-run mode."),
    auditStage("receipt", false, "Dry-run receipt bundle created for this execution audit.")
  ];

  return {
    goal: quote.quote.goal || input.goal || "dry-run procurement execution",
    stages,
    stopConditions: quote.quote.policy?.stopIf || [],
    limits: {
      maxSpendUsd: quote.quote.budget?.totalUsd || null,
      perCallLimitUsd: quote.quote.budget?.perCallLimitUsd || null,
      maxPaidCalls: quote.quote.budget?.maxPaidCalls || null
    },
    allowlists: {
      allowedRegistries: quote.quote.policy?.allowedRegistries || [],
      endpointDenylist: Array.isArray(input.endpointDenylist) ? input.endpointDenylist : []
    },
    policyResult: {
      liveSpendEnabled: false,
      blockedLiveActions: ["buy"],
      paidSubcallsMade: 0,
      approvalRequiredBeforeLive: true
    }
  };
}

function auditStage(id, paid, summary) {
  return {
    id,
    paid,
    summary,
    status: paid === "blocked" ? "blocked" : "planned"
  };
}

function roundUsd(value) {
  return Math.round(value * 1000000) / 1000000;
}

function dailyRemaining(cfg) {
  if (!(cfg.liveDailyLimitUsd > 0)) return 0;
  return roundUsd(Math.max(0, cfg.liveDailyLimitUsd - Math.max(0, cfg.liveSpentTodayUsd || 0)));
}
