import test from "node:test";
import assert from "node:assert/strict";
import { paymentBridgeCheck } from "../src/paymentBridgeCheck.js";

const baseConfig = {
  livePaymentProvider: "agentcash-mcp",
  livePaymentAdapterUrl: "https://bridge.example/pay",
  liveMaxPerCallUsd: 0.01,
  x402Network: "eip155:8453",
  proof402BaseUrl: "https://proof402.vercel.app",
  requestTimeoutMs: 100
};

test("paymentBridgeCheck passes when bridge confirms dry-run and no paid subcalls", async () => {
  const calls = [];
  const result = await paymentBridgeCheck({
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    method: "POST"
  }, {
    config: baseConfig,
    operatorAuthorized: true,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({
        ok: true,
        dryRun: true,
        safety: { paidSubcallsMade: 0 },
        response: { status: 402, headers: {}, body: { ok: false } }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(result.status, "passed");
  assert.equal(result.passed, true);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.adapter.host, "bridge.example");
  assert.equal(calls[0].url, "https://bridge.example/pay");
  assert.equal(calls[0].body.dryRun, true);
  assert.equal(calls[0].body.request.headers["x-trust402-bridge-check"], "true");
});

test("paymentBridgeCheck requires operator authorization by default", async () => {
  await assert.rejects(
    () => paymentBridgeCheck({}, { config: baseConfig }),
    /operator-key/
  );
});

test("paymentBridgeCheck blocks missing or unsafe adapter URLs without probing", async () => {
  const missing = await paymentBridgeCheck({}, {
    config: { ...baseConfig, livePaymentAdapterUrl: "" },
    requireOperator: false,
    fetchImpl: async () => {
      throw new Error("should not probe missing bridge");
    }
  });
  assert.equal(missing.status, "blocked");
  assert.ok(missing.blockers.some((item) => item.id === "missing_payment_adapter_url"));

  const unsafe = await paymentBridgeCheck({ adapterUrl: "http://example.com/bridge" }, {
    config: { ...baseConfig, livePaymentAdapterUrl: "" },
    requireOperator: false,
    allowCustomAdapterUrl: true
  });
  assert.equal(unsafe.status, "blocked");
  assert.ok(unsafe.blockers.some((item) => item.id === "unsafe_payment_adapter_url"));
});

test("paymentBridgeCheck rejects arbitrary adapter URLs in API mode", async () => {
  const result = await paymentBridgeCheck({ adapterUrl: "https://other.example/bridge" }, {
    config: baseConfig,
    operatorAuthorized: true
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((item) => item.id === "custom_adapter_url_not_allowed"));
});

test("paymentBridgeCheck fails if bridge cannot prove no payment happened", async () => {
  const result = await paymentBridgeCheck({}, {
    config: baseConfig,
    operatorAuthorized: true,
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      response: {
        status: 200,
        headers: { "payment-response": "paid" },
        body: { ok: true }
      }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });

  assert.equal(result.status, "failed");
  assert.equal(result.passed, false);
  assert.ok(result.blockers.some((item) => item.id === "payment_bridge_made_payment"));
  assert.ok(result.blockers.some((item) => item.id === "payment_bridge_dry_run_not_confirmed"));
});

test("paymentBridgeCheck requires explicit dry-run confirmation beyond a zero paid-subcall count", async () => {
  const result = await paymentBridgeCheck({}, {
    config: baseConfig,
    operatorAuthorized: true,
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      safety: { paidSubcallsMade: 0 },
      response: {
        status: 402,
        headers: {},
        body: { ok: false }
      }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });

  assert.equal(result.status, "failed");
  assert.equal(result.passed, false);
  assert.equal(result.safety.paidSubcallsMade, 0);
  assert.ok(result.blockers.some((item) => item.id === "payment_bridge_dry_run_not_confirmed"));
});
