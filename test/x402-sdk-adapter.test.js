import test from "node:test";
import assert from "node:assert/strict";
import { x402RouteConfig, x402SdkStatus } from "../src/x402SdkAdapter.js";

test("x402RouteConfig builds SDK-compatible route declarations", () => {
  const routes = x402RouteConfig({
    config: testConfig(),
    catalog: {
      paidLaunchResources: [
        {
          id: "trust.score_resource",
          method: "POST",
          path: "/api/trust/score-resource",
          priceUsd: 0.01,
          purpose: "Score one x402 resource."
        }
      ]
    }
  });

  assert.equal(routes["POST /api/trust/score-resource"].accepts[0].scheme, "exact");
  assert.equal(routes["POST /api/trust/score-resource"].accepts[0].price, "$0.01");
  assert.equal(routes["POST /api/trust/score-resource"].accepts[0].network, "eip155:8453");
  assert.equal(routes["POST /api/trust/score-resource"].accepts[0].payTo, "0x1111111111111111111111111111111111111111");
});

test("x402SdkStatus reports adapter state without enabling settlement", async () => {
  const status = await x402SdkStatus({
    config: testConfig(),
    catalog: { paidLaunchResources: [] }
  });

  assert.equal(status.ok, true);
  assert.equal(status.tool, "settlement.sdk_status");
  assert.equal(status.adapter.nativeHttpServerConnected, false);
  assert.equal(status.adapter.expressEntrypointConnected, false);
  assert.ok(status.blockers.some((item) => item.id === "express_entrypoint_not_connected"));
  assert.ok(status.packages.some((item) => item.name === "@x402/express"));
});

test("x402SdkStatus can report connected Express entrypoint without adding a blocker", async () => {
  const status = await x402SdkStatus({
    config: testConfig(),
    catalog: { paidLaunchResources: [] },
    expressEntrypointConnected: true
  });

  assert.equal(status.adapter.expressEntrypointConnected, true);
  assert.equal(status.blockers.some((item) => item.id === "express_entrypoint_not_connected"), false);
});

function testConfig(overrides = {}) {
  return {
    serviceName: "Trust402",
    defaultMode: "dry-run",
    paywallMode: "demo",
    publicBaseUrl: "https://trust402.example",
    x402Network: "eip155:8453",
    x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    cdpApiKeyIdConfigured: false,
    cdpApiKeySecretConfigured: false,
    realSettlementEnabled: false,
    successfulSettlementObserved: false,
    ...overrides
  };
}
