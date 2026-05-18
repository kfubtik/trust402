import test from "node:test";
import assert from "node:assert/strict";
import { hashResult } from "../src/receipts.js";

test("hashResult creates a proof-ready dry-run receipt bundle", () => {
  const result = hashResult({
    subject: "sample",
    payload: { score: 88, recommendation: "use" }
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "receipts.hash_result");
  assert.match(result.resultHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.receiptBundle.resultHash, result.resultHash);
  assert.equal(result.receiptBundle.proofProvider, "Proof402");
  assert.equal(result.receiptBundle.policy.liveSpendEnabled, false);
  assert.equal(result.receiptBundle.delegation.paidProofCallMade, false);
});

test("hashResult warns when supplied hash does not match payload", () => {
  const result = hashResult({
    subject: "sample",
    resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    payload: { score: 1 }
  });

  assert.equal(result.resultHash, "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(result.consistency.matchesPayload, false);
  assert.equal(result.consistency.warnings.length, 1);
});
