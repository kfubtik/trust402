import { ApiError } from "./errors.js";
import { appendEvidenceLedger } from "./evidenceLedger.js";
import { sha256Json } from "./hash.js";
import { evaluateLocalAgentcashPolicyForLive, readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";
import { trust402RouteSmokeBodyForEndpoint } from "./liveWindowPlan.js";
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
  const candidate = candidateFrom(input, { baseUrl });
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
        candidateEndpoint: candidate.endpoint,
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

  const bridgePreflightNeeded = mode === "live" && bridgePreflightRequired(policies);
  let bridgePreflight = null;
  if (bridgePreflightNeeded) {
    bridgePreflight = await runBridgePreflight({
      fetchImpl,
      baseUrl,
      headers,
      policies,
      candidate,
      maxAmountUsd: Math.min(candidate.priceUsd || 0, numberOr(input.bridgePreflightMaxAmountUsd, candidate.priceUsd || 0.01))
    });
    stages.push(stage("payment_bridge_preflight", bridgePreflight.passed ? "passed" : "blocked", bridgePreflight.bridgeRequestHash || hashPublic(bridgePreflight), {
      provider: bridgePreflight.provider || bridgeProvider(policies) || null,
      adapterConfigured: bridgePreflight.readiness?.adapterUrlConfigured ?? null,
      paidSubcallsMade: bridgePreflight.safety?.paidSubcallsMade ?? null,
      sendsPaymentHeaders: bridgePreflight.safety?.sendsPaymentHeaders ?? null
    }));
    if (!bridgePreflight.passed) {
      throw new ApiError(403, "payment_bridge_preflight_failed", "Live evidence smoke requires a passing dry-run payment bridge preflight before paid execution.", {
        status: bridgePreflight.status || "failed",
        blockers: bridgePreflight.blockers || [],
        httpStatus: bridgePreflight.httpStatus || null,
        bridgeRequestHash: bridgePreflight.bridgeRequestHash || null
      });
    }
  }

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
    paidSubcallsMade: execution.paidSubcallsMade || 0,
    settlementEvidenceComplete: mode === "live" ? liveExecutionEvidenceReady(execution) : null
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
      paidSubcallsMade: autonomous.execution?.paidSubcallsMade || 0,
      settlementEvidenceComplete: mode === "live" ? liveExecutionEvidenceReady(autonomous.execution) : null
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
      paymentBridgePreflightRequired: bridgePreflightNeeded,
      paymentBridgePreflightPassed: bridgePreflight?.passed === true,
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

function candidateFrom(input, { baseUrl } = {}) {
  const endpoint = input.candidateEndpoint || "";
  const requestBody = candidateRequestBody({ input, endpoint, baseUrl });
  const proof402Candidate = isProof402NotarizeEndpoint(endpoint);
  const compareResourcesCandidate = isTrust402CompareResourcesEndpoint(endpoint, baseUrl);
  return {
    id: input.candidateId || (proof402Candidate
      ? "proof402.notarize"
      : compareResourcesCandidate
        ? "trust.compare_resources"
        : "trust402-live-smoke-candidate"),
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
    description: input.candidateDescription || (proof402Candidate
      ? "Approved Proof402 paid notarization endpoint for bounded Trust402 evidence smoke."
      : compareResourcesCandidate
        ? "Approved Trust402 compare-resources endpoint for bounded marketplace indexing smoke."
      : "Approved x402 resource for a bounded Trust402 evidence smoke."),
    receiptReady: true,
    requestBody
  };
}

function candidateRequestBody({ input, endpoint, baseUrl }) {
  if (input.candidateRequestBody) return input.candidateRequestBody;
  if (isProof402NotarizeEndpoint(endpoint)) {
    const contentHash = validSha256(input.candidateContentHash)
      ? input.candidateContentHash
      : sha256Json({
          agent: "Trust402",
          stage: "live-procurement-smoke",
          goal: input.goal || "Trust402 live evidence smoke"
        });
    return {
      contentHash,
      label: input.candidateLabel || "Trust402 live procurement smoke",
      idempotencyKey: input.candidateIdempotencyKey || `trust402-live-smoke-${contentHash.slice(7, 19)}`,
      metadata: {
        agent: "trust402",
        stage: "live-procurement-smoke",
        privatePayload: false
      }
    };
  }
  if (isTrust402CompareResourcesEndpoint(endpoint, baseUrl)) {
    const trustOrigin = normalizeBaseUrl(originOf(endpoint) || baseUrl || DEFAULT_BASE_URL);
    return {
      goal: input.goal || "Rank candidate x402 resources by trust and budget fit.",
      budgetUsd: numberOr(input.budgetUsd, 0.05),
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
  const trust402RouteBody = trust402RouteSmokeBodyForEndpoint(endpoint, baseUrl);
  if (trust402RouteBody) return trust402RouteBody;
  return {
    goal: input.goal || "Trust402 live evidence smoke"
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

async function runBridgePreflight({ fetchImpl, baseUrl, headers, policies, candidate, maxAmountUsd }) {
  const response = await fetchImpl(`${baseUrl}/api/payments/bridge-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: bridgeProvider(policies),
      candidateEndpoint: candidate.endpoint,
      method: candidate.method,
      maxAmountUsd,
      body: candidate.requestBody || null
    })
  });
  const body = await responseJson(response);
  if (response.ok) return body || {};
  return {
    ok: false,
    status: "failed",
    passed: false,
    httpStatus: response.status,
    blockers: [{
      id: body?.error?.code || "payment_bridge_preflight_http_error",
      message: body?.error?.message || `Payment bridge preflight returned HTTP ${response.status}.`
    }],
    responseHash: hashPublic(body || {})
  };
}

async function responseJsonOrThrow(response, url) {
  const text = await response.text();
  const body = parseJsonText(text);
  if (!response.ok) {
    throw new ApiError(response.status || 502, "live_evidence_request_failed", "Live evidence smoke request failed.", {
      url,
      status: response.status,
      body
    });
  }
  return body || {};
}

async function responseJson(response) {
  return parseJsonText(await response.text());
}

function parseJsonText(text) {
  if (!String(text || "").trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: String(text).slice(0, 1000) };
  }
}

function evidenceFrom({ mode, execution, proof, autonomous, refill }) {
  return {
    liveProcurement: liveExecutionEvidenceReady(execution)
      ? execution.executionHash
      : null,
    proof402: proof?.delegation?.paidProofCallMade
      ? proof.resultHash
      : null,
    autonomousJob: autonomous?.mode === "live" && liveExecutionEvidenceReady(autonomous.execution)
      ? autonomous.resultHash
      : null,
    agentcashRefill: refill?.decisionHash || null,
    dryRunOnly: mode !== "live"
  };
}

function liveExecutionEvidenceReady(execution) {
  if (!execution || execution.mode !== "live" || !(execution.paidSubcallsMade > 0)) return false;
  const calls = Array.isArray(execution.result?.calls) ? execution.result.calls : [];
  if (calls.length === 0) return false;
  return calls.every((call) => callSettlementEvidenceReady(call));
}

function callSettlementEvidenceReady(call = {}) {
  return Boolean(
    call.paymentResponseHash ||
    call.paymentResponseObserved === true ||
    call.settlementHash ||
    call.settlement?.status === "settled" ||
    call.payment?.paid === true ||
    call.payment?.status === "settled"
  );
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

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function bridgePreflightRequired(policies) {
  const adapter = bridgeAdapter(policies);
  return Boolean(adapter?.bridgeContract) || ["agentcash-mcp", "external-adapter"].includes(adapter?.provider);
}

function bridgeProvider(policies) {
  return bridgeAdapter(policies)?.provider || "agentcash-mcp";
}

function bridgeAdapter(policies) {
  return policies?.policies?.liveProcurement?.controls?.paymentAdapter ||
    policies?.policies?.proof402Delegation?.controls?.paymentAdapter ||
    null;
}

function validSha256(value) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
