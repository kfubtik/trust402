import test from "node:test";
import assert from "node:assert/strict";
import { procurementExecute, procurementQuote } from "../src/procurement.js";

const goodCandidate = {
  id: "good",
  endpoint: "https://example.com/good",
  priceUsd: 0.01,
  has402: true,
  hasInputSchema: true,
  hasOpenApi: true,
  hasWellKnown: true,
  payTo: "0x1111111111111111111111111111111111111111",
  network: "eip155:8453",
  asset: "USDC",
  description: "Good structured endpoint for x402 buyers.",
  receiptReady: true
};

const weakCandidate = {
  id: "weak",
  endpoint: "https://example.com/weak",
  priceUsd: 0.04
};

test("procurementQuote creates a bounded quote without spending", () => {
  const result = procurementQuote({
    goal: "Buy one safe x402 data resource.",
    budgetUsd: 0.5,
    maxPaidCalls: 3,
    riskTolerance: "low",
    candidates: [goodCandidate, weakCandidate]
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "procurement.quote");
  assert.equal(result.mode, "quote-only");
  assert.match(result.quoteHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.quote.selectedResources[0].id, "good");
  assert.equal(result.approvalPayload.liveSpendEnabled, false);
  assert.equal(result.receiptBundle.delegation.paidProofCallMade, false);
});

test("procurementExecute simulates execution and blocks paid subcalls", () => {
  const result = procurementExecute({
    mode: "dry-run",
    goal: "Simulate controlled procurement.",
    budgetUsd: 0.5,
    candidates: [goodCandidate, weakCandidate]
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "procurement.execute");
  assert.equal(result.mode, "dry-run");
  assert.equal(result.paidSubcallsMade, 0);
  assert.equal(result.audit.policyResult.liveSpendEnabled, false);
  assert.ok(result.audit.policyResult.blockedLiveActions.includes("buy"));
  assert.equal(result.result.status, "not-executed");
});

test("procurementExecute rejects live spend requests", () => {
  assert.throws(
    () => procurementExecute({ liveSpendEnabled: true }),
    /Trust402 execute is dry-run only/
  );
});
