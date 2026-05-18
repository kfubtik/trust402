import test from "node:test";
import assert from "node:assert/strict";
import { paymentChallengeFor, routeConfigFor, settlementPreflight, settlementStatus } from "../src/settlement.js";

const resource = {
  id: "trust.score_resource",
  method: "POST",
  path: "/api/trust/score-resource",
  priceUsd: 0.01,
  purpose: "Score one x402 resource."
};

test("settlementStatus blocks real settlement until every explicit guard is satisfied", () => {
  const result = settlementStatus({
    config: testConfig(),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "settlement.status");
  assert.equal(result.readiness.realSettlementReady, false);
  assert.equal(result.readiness.marketplaceIndexingReady, false);
  assert.ok(result.blockers.some((item) => item.id === "explicit_real_settlement_enabled"));
  assert.ok(result.blockers.some((item) => item.id === "paywall_mode_real"));
  assert.ok(result.blockers.some((item) => item.id === "facilitator_configured"));
  assert.equal(result.routeConfigDraft["POST /api/trust/resource-1"].accepts[0].price, "$0.01");
});

test("settlementStatus can become real-settlement ready without claiming marketplace indexing", () => {
  const result = settlementStatus({
    config: testConfig({
      realSettlementEnabled: true,
      paywallMode: "real",
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true
    }),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.blockers.length, 0);
  assert.equal(result.readiness.realSettlementReady, true);
  assert.equal(result.readiness.marketplaceIndexingReady, false);
  assert.ok(result.nextActions.some((action) => action.includes("paid smoke")));
});

test("settlementStatus requires observed settlement before marketplace indexing readiness", () => {
  const result = settlementStatus({
    config: testConfig({
      realSettlementEnabled: true,
      paywallMode: "real",
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      successfulSettlementObserved: true
    }),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.readiness.realSettlementReady, true);
  assert.equal(result.readiness.marketplaceIndexingReady, true);
});

test("settlementPreflight requires explicit paid-smoke approval and a small budget", () => {
  const result = settlementPreflight({
    config: testConfig({
      realSettlementEnabled: true,
      paywallMode: "real",
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      paidSmokeApproved: false,
      paidSmokeMaxUsd: 0
    }),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.tool, "settlement.preflight");
  assert.equal(result.readiness.realSettlementReady, true);
  assert.equal(result.readiness.paidSmokeReady, false);
  assert.ok(result.blockers.some((item) => item.id === "paid_smoke_approved"));
  assert.ok(result.blockers.some((item) => item.id === "paid_smoke_limit_present"));
});

test("settlementPreflight can become ready for one paid smoke without claiming indexing", () => {
  const result = settlementPreflight({
    config: testConfig({
      realSettlementEnabled: true,
      paywallMode: "real",
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      paidSmokeApproved: true,
      paidSmokeMaxUsd: 0.02
    }),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.readiness.paidSmokeReady, true);
  assert.equal(result.readiness.marketplaceIndexingReady, false);
  assert.equal(result.policy.liveSpendEnabled, false);
  assert.equal(result.selectedSmokeResource.id, "trust.resource_1");
});

test("routeConfigFor and paymentChallengeFor expose x402-compatible route metadata", () => {
  const cfg = testConfig({
    publicBaseUrl: "https://trust402.example",
    payTo: "0x1111111111111111111111111111111111111111"
  });
  const routeConfig = routeConfigFor(resource, cfg);
  const challenge = paymentChallengeFor(resource, cfg);

  assert.equal(routeConfig.accepts[0].scheme, "exact");
  assert.equal(routeConfig.accepts[0].price, "$0.01");
  assert.equal(routeConfig.accepts[0].network, "eip155:8453");
  assert.equal(routeConfig.extensions.bazaar.info.input.type, "http");
  assert.equal(routeConfig.extensions.bazaar.info.input.bodyType, "json");
  assert.equal(routeConfig.extensions.bazaar.info.input.body.endpoint, "https://api.example.com/paid");
  assert.equal(challenge.x402Version, 2);
  assert.equal(challenge.accepts[0].amount, "10000");
  assert.equal(challenge.accepts[0].resource, "https://trust402.example/api/trust/score-resource");
});

function testConfig(overrides = {}) {
  return {
    serviceName: "Trust402",
    defaultMode: "dry-run",
    paywallMode: "demo",
    publicBaseUrl: "http://127.0.0.1:4032",
    x402Network: "eip155:8453",
    x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x0000000000000000000000000000000000000000",
    facilitatorUrl: "",
    cdpApiKeyIdConfigured: false,
    cdpApiKeySecretConfigured: false,
    realSettlementEnabled: false,
    successfulSettlementObserved: false,
    paidSmokeApproved: false,
    paidSmokeMaxUsd: 0,
    paidSmokeResourceId: "trust.score_resource",
    liveSpendEnabled: false,
    ...overrides
  };
}

function manyResources() {
  return Array.from({ length: 10 }, (_, index) => ({
    ...resource,
    id: `trust.resource_${index + 1}`,
    path: `/api/trust/resource-${index + 1}`
  }));
}
