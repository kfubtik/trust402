import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";
import { receiptBundle } from "./receipts.js";
import { compareResources, procurementPlan } from "./trustEngine.js";

const QUOTE_FEE_USD = 0.04;

export function procurementQuote(input = {}) {
  const plan = procurementPlan(input);
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const comparison = candidates.length >= 2 ? compareResources({
    goal: input.goal,
    budgetUsd: plan.budget.perCallLimitUsd,
    candidates
  }) : null;
  const selectedResources = selectResources({
    ranked: comparison?.ranked || [],
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

export function procurementExecute(input = {}) {
  if (input.liveSpendEnabled === true || input.mode === "live") {
    throw new ApiError(403, "live_spend_disabled", "Trust402 execute is dry-run only in this product phase.", {
      liveSpendEnabled: false,
      requiredBeforeLive: [
        "hot wallet profile",
        "registry allowlist",
        "per-call limit",
        "per-job limit",
        "daily limit",
        "receipt log",
        "explicit human approval"
      ]
    });
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

function selectResources({ ranked, maxPaidCalls, minimumTrustScore, perCallLimitUsd }) {
  return ranked
    .filter((resource) => resource.budgetFit)
    .filter((resource) => resource.score >= minimumTrustScore)
    .filter((resource) => resource.priceUsd === null || resource.priceUsd <= perCallLimitUsd)
    .slice(0, maxPaidCalls)
    .map((resource) => ({
      rank: resource.rank,
      id: resource.id,
      endpoint: resource.endpoint,
      priceUsd: resource.priceUsd,
      score: resource.score,
      riskLevel: resource.riskLevel,
      reason: "selected by quote policy"
    }));
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
  if (!comparison) steps.push("Add 2-10 candidates to rank and select concrete resources.");
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
