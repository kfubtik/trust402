import { ApiError } from "./errors.js";
import { appendEvidenceLedger } from "./evidenceLedger.js";
import { sha256Json } from "./hash.js";
import { evaluateLocalAgentcashPolicyForLive, readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";
import { procurementQuote } from "./procurement.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";

export async function liveEvidenceSmoke(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = normalizeBaseUrl(input.baseUrl || DEFAULT_BASE_URL);
  const mode = input.live === true || input.mode === "live" ? "live" : "dry-run";
  const includeProof = input.includeProof !== false;
  const includeAutonomous = input.includeAutonomous === true || (mode !== "live" && input.includeAutonomous !== false);
  const includeRefill = input.includeRefill !== false;
  const operatorKey = input.operatorKey || "";
  const candidate = candidateFrom(input);
  const proofReserveUsd = numberOr(input.proofReserveUsd, 0.01);
  const maxTotalUsd = numberOr(input.maxTotalUsd, 0);
  const estimatedMaxSpendUsd = roundUsd(
    (mode === "live" ? candidate.priceUsd * (includeAutonomous ? 2 : 1) : 0) +
    (mode === "live" && includeProof ? proofReserveUsd : 0)
  );
  const localAgentcashPolicy = mode === "live"
    ? evaluateLocalAgentcashPolicyForLive({
        policyResult: options.localAgentcashPolicyResult || readLocalAgentcashPolicy({ cwd: options.cwd }),
        cwd: options.cwd,
        baseUrl,
        proof402BaseUrl: input.proof402BaseUrl,
        estimatedMaxSpendUsd,
        includeProof,
        includeRefillLive: input.includeRefillLive === true && mode === "live"
      })
    : null;

  guardLive({
    mode,
    approved: input.approved === true,
    operatorKey,
    candidate,
    maxTotalUsd,
    estimatedMaxSpendUsd,
    localAgentcashPolicy
  });

  const headers = {
    "content-type": "application/json",
    "user-agent": "Trust402 live evidence smoke/0.1"
  };
  if (operatorKey) headers["x-trust402-operator-key"] = operatorKey;

  const stages = [];
  const policies = await getJson(fetchImpl, `${baseUrl}/api/policies/spend`);
  stages.push(stage("spend_policy", "complete", hashPublic(policies), {
    liveProcurementReady: policies.readiness?.liveProcurementReady ?? null,
    proof402DelegationReady: policies.readiness?.proof402DelegationReady ?? null,
    agentcashAutoRefillReady: policies.readiness?.agentcashAutoRefillReady ?? null
  }));

  const quoteBody = quoteInput(input, candidate);
  const quote = procurementQuote(quoteBody);
  stages.push(stage("procurement_quote", "complete", quote.quoteHash, {
    quoteId: quote.quoteId,
    source: "local-runner",
    selectedResources: quote.quote?.selectedResources?.length || 0
  }));

  const approval = { approved: true, quoteHash: quote.quoteHash };
  const execution = await postJson(fetchImpl, `${baseUrl}/api/procurement/execute`, {
    mode,
    quote,
    approval
  }, headers);
  stages.push(stage("procurement_execute", execution.mode === "live" ? "live-complete" : "dry-run-complete", execution.executionHash, {
    paidSubcallsMade: execution.paidSubcallsMade || 0
  }));

  let proof = null;
  if (includeProof) {
    proof = await postJson(fetchImpl, `${baseUrl}/api/receipts/notarize-result`, {
      subject: "Trust402 live evidence smoke",
      resultHash: execution.executionHash,
      proof402Mode: mode === "live" ? "live" : "preview",
      metadata: {
        agent: "trust402",
        stage: "live-evidence-smoke",
        source: "scripts/live-evidence-smoke.js"
      }
    }, headers);
    stages.push(stage("proof402", proof.delegation?.paidProofCallMade ? "live-complete" : "preview-complete", proof.resultHash, {
      paidProofCallMade: Boolean(proof.delegation?.paidProofCallMade),
      proofStatus: proof.proofStatus || null
    }));
  }

  let autonomous = null;
  if (includeAutonomous) {
    autonomous = await postJson(fetchImpl, `${baseUrl}/api/jobs/autonomous-run`, {
      ...quoteBody,
      mode,
      quote,
      approval,
      includeProofPreview: false
    }, headers);
    stages.push(stage("autonomous_job", autonomous.mode === "live" ? "live-complete" : "dry-run-complete", autonomous.resultHash, {
      paidSubcallsMade: autonomous.execution?.paidSubcallsMade || 0
    }));
  }

  let refill = null;
  if (includeRefill) {
    refill = await postJson(fetchImpl, `${baseUrl}/api/agentcash/refill-check`, {
      mode: input.includeRefillLive === true && mode === "live" ? "live" : "dry-run",
      currentBalanceUsd: numberOr(input.agentcashBalanceUsd, 1),
      amountRefilledTodayUsd: numberOr(input.amountRefilledTodayUsd, 0)
    }, headers);
    stages.push(stage("agentcash_refill_check", refill.decision?.liveRefillExecuted ? "live-complete" : "dry-run-complete", refill.decisionHash, {
      action: refill.decision?.action || null,
      status: refill.decision?.status || null,
      liveRefillExecuted: Boolean(refill.decision?.liveRefillExecuted)
    }));
  }

  const evidenceRefs = evidenceFrom({ mode, execution, proof, autonomous, refill });
  const evidenceHash = sha256Json({
    mode,
    baseUrl,
    candidate: {
      id: candidate.id,
      endpoint: candidate.endpoint,
      priceUsd: candidate.priceUsd
    },
    stages: stages.map((item) => ({
      id: item.id,
      status: item.status,
      hash: item.hash
    })),
    evidenceRefs
  });

  const result = {
    ok: true,
    tool: "live.evidence_smoke",
    mode,
    generatedAt: new Date().toISOString(),
    baseUrl,
    estimatedMaxSpendUsd,
    maxTotalUsd,
    stages,
    evidenceHash,
    evidenceRefs,
    suggestedEnv: suggestedEnv({ mode, evidenceRefs, policies }),
    safety: {
      requiresExplicitApprovalForLive: true,
      liveApproved: input.approved === true,
      operatorKeyIncludedInOutput: false,
      storesPrivatePayload: false,
      sendsPaymentHeadersFromRunner: false,
      liveAutonomousIncluded: includeAutonomous && mode === "live",
      liveRefillIncluded: input.includeRefillLive === true && mode === "live",
      localAgentcashPolicy: localAgentcashPolicy?.summary || null
    },
    nextActions: nextActions({ mode, evidenceRefs, policies, includeAutonomous })
  };

  if (options.writeEvidenceLedger === true) {
    result.evidenceLedger = appendEvidenceLedger({
      source: "live.evidence_smoke",
      result
    }, {
      cwd: options.cwd,
      ledgerDir: options.evidenceLedgerDir
    });
    delete result.evidenceLedger.record;
  }

  return result;
}

function guardLive({ mode, approved, operatorKey, candidate, maxTotalUsd, estimatedMaxSpendUsd, localAgentcashPolicy }) {
  if (mode !== "live") return;
  const blockers = [];
  if (!approved) blockers.push("Set TRUST402_LIVE_EVIDENCE_SMOKE_APPROVED=true and pass --live.");
  if (!operatorKey) blockers.push("Provide TRUST402_OPERATOR_API_KEY or --operator-key for live operator authorization.");
  if (!candidate.endpoint || isExampleEndpoint(candidate.endpoint)) blockers.push("Provide --candidate-endpoint with a real allowlisted x402 resource endpoint.");
  if (!(candidate.priceUsd > 0)) blockers.push("Provide --candidate-price with the downstream resource price.");
  if (!(maxTotalUsd > 0)) blockers.push("Provide --max-total-usd for a hard local live-smoke cap.");
  if (maxTotalUsd > 0 && estimatedMaxSpendUsd > maxTotalUsd) {
    blockers.push(`Estimated max spend ${estimatedMaxSpendUsd} exceeds --max-total-usd ${maxTotalUsd}.`);
  }
  for (const blocker of localAgentcashPolicy?.blockers || []) {
    blockers.push(`${blocker.id}: ${blocker.message}`);
  }
  if (blockers.length > 0) {
    throw new ApiError(403, "live_evidence_smoke_blocked", "Live evidence smoke is blocked by local runner policy.", {
      blockers,
      estimatedMaxSpendUsd,
      maxTotalUsd,
      localAgentcashPolicy: localAgentcashPolicy?.summary || null
    });
  }
}

function quoteInput(input, candidate) {
  return {
    goal: input.goal || "Run a bounded Trust402 live evidence smoke.",
    budgetUsd: numberOr(input.budgetUsd, 0.25),
    maxPaidCalls: 1,
    riskTolerance: input.riskTolerance || "low",
    candidates: [candidate]
  };
}

function candidateFrom(input) {
  const endpoint = input.candidateEndpoint || "";
  return {
    id: input.candidateId || "trust402-live-smoke-candidate",
    endpoint: endpoint || "https://example.com/trust402-live-smoke-resource",
    method: input.candidateMethod || "POST",
    priceUsd: numberOr(input.candidatePriceUsd, 0.01),
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    payTo: input.candidatePayTo || "0x1111111111111111111111111111111111111111",
    network: input.candidateNetwork || "eip155:8453",
    asset: input.candidateAsset || "USDC",
    description: input.candidateDescription || "Approved x402 resource for a bounded Trust402 evidence smoke.",
    receiptReady: true,
    requestBody: input.candidateRequestBody || {
      goal: input.goal || "Trust402 live evidence smoke"
    }
  };
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Trust402 live evidence smoke/0.1"
    }
  });
  return responseJsonOrThrow(response, url);
}

async function postJson(fetchImpl, url, body, headers) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return responseJsonOrThrow(response, url);
}

async function responseJsonOrThrow(response, url) {
  const text = await response.text();
  let body = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 1000) };
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status || 502, "live_evidence_request_failed", "Live evidence smoke request failed.", {
      url,
      status: response.status,
      body
    });
  }
  return body || {};
}

function evidenceFrom({ mode, execution, proof, autonomous, refill }) {
  return {
    liveProcurement: execution?.mode === "live" && execution?.paidSubcallsMade > 0
      ? execution.executionHash
      : null,
    proof402: proof?.delegation?.paidProofCallMade
      ? proof.resultHash
      : null,
    autonomousJob: autonomous?.mode === "live" && autonomous?.execution?.paidSubcallsMade > 0
      ? autonomous.resultHash
      : null,
    agentcashRefill: refill?.decisionHash || null,
    dryRunOnly: mode !== "live"
  };
}

function suggestedEnv({ mode, evidenceRefs, policies }) {
  if (mode !== "live") return null;
  const env = {};
  if (evidenceRefs.liveProcurement) {
    env.TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED = "true";
    env.TRUST402_LIVE_PROCUREMENT_EVIDENCE_REF = evidenceRefs.liveProcurement;
  }
  if (evidenceRefs.proof402) {
    env.TRUST402_PROOF402_PAID_SMOKE_OBSERVED = "true";
    env.TRUST402_PROOF402_EVIDENCE_REF = evidenceRefs.proof402;
  }
  if (evidenceRefs.autonomousJob) {
    env.TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED = "true";
    env.TRUST402_AUTONOMOUS_JOB_EVIDENCE_REF = evidenceRefs.autonomousJob;
  }
  if (policies.readiness?.agentcashAutoRefillReady && evidenceRefs.agentcashRefill) {
    env.TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_OBSERVED = "true";
    env.TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_REF = evidenceRefs.agentcashRefill;
  }
  return Object.keys(env).length > 0 ? env : null;
}

function nextActions({ mode, evidenceRefs, policies, includeAutonomous }) {
  if (mode !== "live") {
    return [
      "Dry-run only: review the staged output and rerun with --live only during an approved bounded spend window.",
      "Provide --candidate-endpoint, --candidate-price, --max-total-usd, TRUST402_OPERATOR_API_KEY, and TRUST402_LIVE_EVIDENCE_SMOKE_APPROVED=true for live evidence."
    ];
  }
  const actions = [];
  if (!evidenceRefs.liveProcurement) actions.push("Live procurement evidence was not produced; inspect policy and downstream receipt output.");
  if (!evidenceRefs.proof402) actions.push("Paid Proof402 evidence was not produced; inspect proof policy and proof receipt output.");
  if (!includeAutonomous) actions.push("Rerun with --include-autonomous-live after budgeting for a second downstream paid call.");
  if (!policies.readiness?.agentcashAutoRefillReady) actions.push("AgentCash auto-refill evidence remains blocked until refill policy is approved and ready.");
  if (actions.length === 0) actions.push("Record suggestedEnv values only after reviewing receipts and public-safe evidence refs.");
  return actions;
}

function stage(id, status, hash, details = {}) {
  return {
    id,
    status,
    hash,
    details
  };
}

function hashPublic(value) {
  return sha256Json(value || {});
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function isExampleEndpoint(value) {
  try {
    return new URL(value).hostname.endsWith("example.com");
  } catch {
    return true;
  }
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
