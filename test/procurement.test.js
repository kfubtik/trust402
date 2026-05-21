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

test("procurementQuote can select one trusted candidate", () => {
  const result = procurementQuote({
    goal: "Buy one known safe x402 resource.",
    budgetUsd: 0.5,
    maxPaidCalls: 1,
    riskTolerance: "low",
    candidates: [goodCandidate]
  });

  assert.equal(result.ok, true);
  assert.equal(result.quote.selectedResources.length, 1);
  assert.equal(result.quote.selectedResources[0].id, "good");
  assert.equal(result.quote.comparison, null);
  assert.equal(result.quote.withinBudget, true);
});

test("procurementQuote filters selected resources by allowed registries", () => {
  const result = procurementQuote({
    goal: "Buy one allowlisted safe x402 resource.",
    budgetUsd: 0.5,
    maxPaidCalls: 2,
    riskTolerance: "low",
    allowedRegistries: ["https://allow.example"],
    candidates: [
      {
        ...goodCandidate,
        id: "not-allowed",
        endpoint: "https://blocked.example/good"
      },
      {
        ...goodCandidate,
        id: "allowed",
        endpoint: "https://allow.example/good"
      }
    ]
  });

  assert.deepEqual(result.quote.selectedResources.map((resource) => resource.id), ["allowed"]);
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
  assert.equal(result.auditBundle.schema, "trust402.procurement_audit.v1");
  assert.equal(result.auditBundle.mode, "dry-run");
  assert.equal(result.auditBundle.spend.paidSubcallsMade, 0);
  assert.equal(result.auditBundle.publicSafety.rawPaymentHeadersStored, false);
  assert.equal(result.auditBundle.publicSafety.paymentHeadersStoredAs, "sha256-only");
  assert.match(result.auditBundle.auditBundleHash, /^sha256:[a-f0-9]{64}$/);
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
      liveSpentTodayUsd: 0,
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
  assert.match(result.result.calls[0].paymentResponseHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.audit.limits.dailyRemainingBeforeUsd, 1);
  assert.equal(result.audit.limits.dailyRemainingAfterEstimatedUsd, 0.99);
  assert.match(result.executionHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.auditBundle.mode, "live");
  assert.equal(result.auditBundle.receiptLog.storage, "returned-to-caller");
  assert.equal(result.auditBundle.publicSafety.rawPaymentHeadersStored, false);
  assert.deepEqual(result.auditBundle.paymentResponseHashes, [result.result.calls[0].paymentResponseHash]);
  assert.equal(result.auditBundle.resourceReceipts[0].endpointOrigin, "https://example.com");
  assert.match(result.auditBundle.resourceReceipts[0].endpointHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result.auditBundle).includes("mock-paid-receipt"), false);
});

test("procurementExecute returns public-safe audit bundle on downstream live failure", async () => {
  const quote = procurementQuote({
    goal: "Buy one safe x402 data resource.",
    budgetUsd: 0.5,
    maxPaidCalls: 1,
    riskTolerance: "low",
    candidates: [goodCandidate]
  });
  const failingPaymentBridge = async () => new Response(JSON.stringify({
    ok: true,
    response: {
      status: 503,
      headers: {
        "content-type": "application/json",
        "payment-response": "mock-failed-paid-receipt"
      },
      body: {
        ok: false,
        tool: "paid.example",
        error: "temporarily unavailable"
      }
    }
  }), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });

  await assert.rejects(
    procurementExecute({
      mode: "live",
      quote,
      approval: {
        approved: true,
        quoteHash: quote.quoteHash
      }
    }, {
      operatorAuthorized: true,
      fetchImpl: failingPaymentBridge,
      config: {
        ...config,
        liveSpendEnabled: true,
        livePaymentProvider: "external-adapter",
        livePaymentAdapterUrl: "https://pay.example/bridge",
        operatorApiKey: "test-operator",
        liveMaxPerCallUsd: 0.05,
        liveMaxPerJobUsd: 0.25,
        liveDailyLimitUsd: 1,
        liveSpentTodayUsd: 0,
        liveApprovalThresholdUsd: 0,
        liveAllowedRegistries: ["https://example.com"],
        liveEndpointDenylist: [],
        liveReceiptLogMode: "response-only"
      }
    }),
    (error) => {
      assert.equal(error.code, "downstream_purchase_failed");
      assert.equal(error.details?.auditBundle?.failure?.resourceId, "good");
      assert.equal(error.details?.auditBundle?.publicSafety?.rawPaymentHeadersStored, false);
      assert.match(error.details?.auditBundle?.paymentResponseHashes?.[0], /^sha256:[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(error.details.auditBundle).includes("mock-failed-paid-receipt"), false);
      return true;
    }
  );
});

test("procurementExecute blocks live spend when daily remaining cap is exhausted", async () => {
  const quote = procurementQuote({
    goal: "Buy one safe x402 data resource.",
    budgetUsd: 0.5,
    maxPaidCalls: 1,
    riskTolerance: "low",
    candidates: [goodCandidate]
  });

  await assert.rejects(
    procurementExecute({
      mode: "live",
      quote,
      approval: {
        approved: true,
        quoteHash: quote.quoteHash
      }
    }, {
      operatorAuthorized: true,
      paidFetchImpl: async () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }),
      config: {
        ...config,
        liveSpendEnabled: true,
        livePaymentProvider: "external-adapter",
        livePaymentAdapterUrl: "https://pay.example/bridge",
        operatorApiKey: "test-operator",
        liveMaxPerCallUsd: 0.05,
        liveMaxPerJobUsd: 0.25,
        liveDailyLimitUsd: 1,
        liveSpentTodayUsd: 0.995,
        liveApprovalThresholdUsd: 0,
        liveAllowedRegistries: ["https://example.com"],
        liveEndpointDenylist: [],
        liveReceiptLogMode: "response-only"
      }
    }),
    (error) => error.details?.blockers?.some((item) => item.id === "pass_through_exceeds_daily_remaining")
  );
});
