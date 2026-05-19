import test from "node:test";
import assert from "node:assert/strict";
import { discoverResourceCandidates } from "../src/resourceDiscovery.js";

test("discoverResourceCandidates returns trusted seed candidates without spending", () => {
  const result = discoverResourceCandidates({
    goal: "Create a proof-backed receipt.",
    budgetUsd: 0.02
  }, {
    config: {
      x402Network: "eip155:8453",
      x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  });

  assert.equal(result.tool, "registries.candidates");
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.safety.paidSubcallsMade, 0);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "proof402.notarize");
  assert.equal(result.candidates[0].requestBody.privatePayload, undefined);
  assert.match(result.candidates[0].requestBody.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.discoveryHash, /^sha256:[a-f0-9]{64}$/);
});

test("discoverResourceCandidates prefers explicit candidates without merging seed by default", () => {
  const result = discoverResourceCandidates({
    goal: "Cheap check",
    budgetUsd: 0.02,
    candidates: [
      {
        id: "freeish",
        endpoint: "https://candidate.example/freeish",
        priceUsd: 0.001,
        has402: true
      }
    ]
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "freeish");
  assert.equal(result.candidates[0].source, "input.candidates");
  assert.equal(result.summary.includeSeedRegistry, false);
});
