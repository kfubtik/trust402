import test from "node:test";
import assert from "node:assert/strict";
import { ecosystemTrends } from "../src/ecosystemTrends.js";

test("ecosystemTrends exposes public-safe Base/x402 buyer-agent guidance", () => {
  const result = ecosystemTrends(
    {
      baseUrl: "https://trust402.example",
      now: "2026-06-21T00:00:00.000Z"
    }
  );

  assert.equal(result.tool, "ecosystem.trends");
  assert.equal(result.asOfDate, "2026-06-21");
  assert.match(result.trendHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(result.sources.some((source) => source.id === "base_mcp_x402"));
  assert.ok(result.categories.some((category) => category.id === "approval_gated_x402_mcp"));
  assert.ok(result.buyerWorkflow.some((step) => step.step === "verify" && step.trust402Route === "/api/receipts/hash-result"));
  assert.ok(result.productMoves.some((move) => move.id === "base_mcp_wrapper"));
  assert.equal(result.safety.publicSafe, true);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.safety.paidSubcallsMade, 0);
  assert.equal(result.safety.exposesSecrets, false);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /CDP_API_KEY|CDP_WALLET_SECRET|PRIVATE_KEY|PAYMENT-SIGNATURE/i);
});
