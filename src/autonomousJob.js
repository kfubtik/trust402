import { sha256Json } from "./hash.js";
import { notarizeResult } from "./proof402Client.js";
import { procurementExecute, procurementQuote } from "./procurement.js";
import { hashResult } from "./receipts.js";
import { candidatesForAutonomousRun } from "./resourceDiscovery.js";

export async function autonomousRun(input = {}, options = {}) {
  const mode = input.mode === "live" ? "live" : "dry-run";
  const discoveryResult = input.quote?.quoteHash ? null : await candidatesForAutonomousRun(input, options);
  const discovery = discoveryResult?.discovery || null;
  const quoteInput = discovery ? {
    ...input,
    candidates: discovery.candidates
  } : input;
  const quote = input.quote?.quoteHash ? input.quote : procurementQuote(quoteInput);
  const execution = await procurementExecute({
    ...quoteInput,
    mode,
    quote,
    approval: input.approval || input.approvalPayload || autoApproval(options, quote)
  }, options);
  const finalReport = {
    goal: quote.quote.goal || input.goal || "autonomous Trust402 job",
    mode,
    quoteId: quote.quoteId,
    quoteHash: quote.quoteHash,
    discoveryHash: discovery?.discoveryHash || null,
    executionHash: execution.executionHash,
    paidSubcallsMade: execution.paidSubcallsMade,
    status: execution.result?.status || "unknown",
    selectedResourceIds: (quote.quote.selectedResources || []).map((resource) => resource.id)
  };
  const resultHash = sha256Json(finalReport);
  const receipt = hashResult({
    subject: finalReport.goal,
    resultHash,
    purpose: "autonomous Trust402 job final report"
  });
  const proof = await maybeProof({
    input,
    resultHash,
    subject: finalReport.goal,
    options
  });
  const proofReceiptBundle = proof?.receiptBundle || null;

  return {
    ok: true,
    tool: "jobs.autonomous_run",
    mode,
    generatedAt: new Date().toISOString(),
    stages: [
      stage("discover", discovery ? "complete" : "provided-quote", discovery?.discoveryHash || null),
      stage("quote", "complete", quote.quoteHash),
      stage("execute", execution.mode === "live" ? "live-complete" : "dry-run-complete", execution.executionHash),
      stage("receipt", "complete", resultHash),
      stage("proof", proof ? proof.proofStatus : "skipped", proof?.resultHash || null)
    ],
    discovery,
    quote,
    execution,
    finalReport,
    resultHash,
    receiptBundle: receipt.receiptBundle,
    proofReceiptBundle,
    proof,
    nextSteps: nextSteps({ mode, proof })
  };
}

function autoApproval(options, quote) {
  if (options.autoApproveQuote !== true) return undefined;
  return {
    approved: true,
    quoteHash: quote.quoteHash,
    quoteId: quote.quoteId,
    reason: "pre-approved autonomous run inside a separately authorized policy window"
  };
}

async function maybeProof({ input, resultHash, subject, options }) {
  if (!input.includeProofPreview && !input.proof402Mode) return null;
  return notarizeResult({
    subject,
    resultHash,
    proof402Mode: input.proof402Mode || "preview",
    metadata: {
      agent: "trust402",
      stage: "autonomous-run",
      ...(input.proofMetadata || {})
    }
  }, options);
}

function stage(id, status, hash) {
  return { id, status, hash };
}

function nextSteps({ mode, proof }) {
  const steps = [];
  if (mode !== "live") steps.push("Review the dry-run execution audit before approving live spend.");
  if (!proof) steps.push("Set includeProofPreview=true to attach a Proof402 request preview for the final report hash.");
  if (proof?.delegation?.paidProofCallMade) steps.push("Store the Proof402 proof link with the procurement audit.");
  if (steps.length === 0) steps.push("Review receipts, proof status, and spend policy before reusing this job plan.");
  return steps;
}
