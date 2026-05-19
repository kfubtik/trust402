import test from "node:test";
import assert from "node:assert/strict";
import { autonomousRun } from "../src/autonomousJob.js";

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

test("autonomousRun creates a dry-run quote, execution audit, receipt, and proof preview", async () => {
  const result = await autonomousRun({
    mode: "dry-run",
    goal: "Run a safe autonomous diligence job.",
    budgetUsd: 0.5,
    maxPaidCalls: 1,
    candidates: [goodCandidate, weakCandidate],
    includeProofPreview: true
  }, {
    config: {
      publicBaseUrl: "https://trust402.example",
      proof402BaseUrl: "https://proof402.vercel.app",
      proof402DelegationMode: "preview",
      proof402MaxSpendUsd: 0,
      liveSpendEnabled: false,
      requestTimeoutMs: 100
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "jobs.autonomous_run");
  assert.equal(result.mode, "dry-run");
  assert.equal(result.quote.quote.selectedResources.length, 1);
  assert.equal(result.quote.quote.selectedResources[0].id, "good");
  assert.equal(result.execution.paidSubcallsMade, 0);
  assert.match(result.resultHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.proof.delegation.paidProofCallMade, false);
  assert.ok(result.stages.some((stage) => stage.id === "receipt" && stage.status === "complete"));
});
