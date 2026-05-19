import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
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

test("procurementExecute blocks live spend without policy", async () => {
  await assert.rejects(
    procurementExecute({
      liveSpendEnabled: true,
      goal: "Try live spend without policy.",
      budgetUsd: 0.5,
      candidates: [goodCandidate, weakCandidate]
    }),
    /Live procurement is blocked by spend policy/
  );
});

test("procurementExecute can run live through an injected paid fetch inside policy", async () => {
  const quote = procurementQuote({
    goal: "Buy one safe x402 data resource.",
    budgetUsd: 0.5,
    maxPaidCalls: 1,
    riskTolerance: "low",
    candidates: [goodCandidate, weakCandidate]
  });
  const fakePaymentBridge = async (url, options = {}) => new Response(JSON.stringify({
    ok: true,
    response: {
      status: 200,
      headers: {
        "content-type": "application/json",
        "payment-response": "mock-paid-receipt"
      },
      body: {
        ok: true,
        tool: "paid.example",
        result: "done"
      }
    },
    requestUrl: String(url),
    requestKeys: Object.keys(JSON.parse(options.body || "{}").request || {})
  }), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });

  const result = await procurementExecute({
    mode: "live",
    quote,
    approval: {
      approved: true,
      quoteHash: quote.quoteHash
    }
  }, {
    operatorAuthorized: true,
    fetchImpl: fakePaymentBridge,
    config: {
      ...config,
      liveSpendEnabled: true,
      livePaymentProvider: "external-adapter",
      livePaymentAdapterUrl: "https://pay.example/bridge",
      operatorApiKey: "test-operator",
      liveMaxPerCallUsd: 0.05,
      liveMaxPerJobUsd: 0.25,
      liveDailyLimitUsd: 1,
      liveApprovalThresholdUsd: 0,
      liveAllowedRegistries: ["https://example.com"],
      liveEndpointDenylist: [],
      liveReceiptLogMode: "response-only"
    }
  });

  assert.equal(result.mode, "live");
  assert.equal(result.paidSubcallsMade, 1);
  assert.equal(result.result.status, "executed");
  assert.equal(result.result.calls[0].paymentResponseObserved, true);
  assert.match(result.executionHash, /^sha256:[a-f0-9]{64}$/);
});
