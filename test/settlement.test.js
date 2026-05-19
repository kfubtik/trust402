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

test("settlementStatus requires observed settlement and current CDP evidence before marketplace indexing readiness", () => {
  const result = settlementStatus({
    config: testConfig({
      realSettlementEnabled: true,
      paywallMode: "real",
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      successfulSettlementObserved: true,
      cdpBazaarAllResourcesIndexed: true,
      cdpBazaarEvidenceRef: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      cdpBazaarCheckStatus: "all-indexed",
      cdpBazaarExpectedResources: 10,
      cdpBazaarIndexedResources: 10,
      cdpBazaarMissingResources: []
    }),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.readiness.realSettlementReady, true);
  assert.equal(result.readiness.marketplaceIndexingReady, true);
  assert.equal(result.marketplaceIndexing.cdpBazaar.verified, true);
});

test("settlementStatus does not treat stale CDP Bazaar boolean as marketplace-ready", () => {
  const result = settlementStatus({
    config: testConfig({
      realSettlementEnabled: true,
      paywallMode: "real",
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      successfulSettlementObserved: true,
      cdpBazaarAllResourcesIndexed: true,
      cdpBazaarEvidenceRef: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    }),
    catalog: { paidLaunchResources: manyResources() }
  });

  assert.equal(result.readiness.realSettlementReady, true);
  assert.equal(result.readiness.marketplaceIndexingReady, false);
  assert.equal(result.marketplaceIndexing.cdpBazaar.verified, false);
  assert.ok(result.nextActions.some((action) => action.includes("all-resource CDP Bazaar")));
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

test("settlementPreflight can target compare-resources with an explicit route cap", () => {
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
      paidSmokeMaxUsd: 0.02,
      paidSmokeResourceId: "trust.compare_resources"
    }),
    catalog: { paidLaunchResources: manyResourcesWithCompare() }
  });

  assert.equal(result.selectedSmokeResource.id, "trust.compare_resources");
  assert.equal(result.selectedSmokeResource.priceUsd, 0.03);
  assert.equal(result.readiness.paidSmokeReady, false);
  assert.ok(result.blockers.some((item) => item.id === "paid_smoke_limit_covers_route"));
  assert.ok(result.operatorEnv.requiredProduction.includes("TRUST402_PAID_SMOKE_RESOURCE_ID=trust.compare_resources"));
  assert.ok(result.nextActions.some((action) => action.includes("at least $0.03")));
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

test("compare-resources Bazaar metadata exposes structured candidate schema", () => {
  const cfg = testConfig({
    publicBaseUrl: "https://trust402.example",
    payTo: "0x1111111111111111111111111111111111111111"
  });
  const routeConfig = routeConfigFor({
    id: "trust.compare_resources",
    method: "POST",
    path: "/api/trust/compare-resources",
    priceUsd: 0.03,
    purpose: "Rank candidate x402 resources."
  }, cfg);

  const candidateSchema = routeConfig.extensions.bazaar.schema.properties.input.properties.body.properties.candidates.items;
  assert.equal(candidateSchema.properties.endpoint.format, "uri");
  assert.ok(candidateSchema.properties.hasInputSchema);
  assert.ok(candidateSchema.properties.receiptReady);
  assert.equal(routeConfig.extensions.bazaar.info.input.body.candidates[0].receiptReady, true);
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
    cdpBazaarAllResourcesIndexed: false,
    cdpBazaarEvidenceRef: "",
    cdpBazaarCheckStatus: "",
    cdpBazaarExpectedResources: 0,
    cdpBazaarIndexedResources: 0,
    cdpBazaarMissingResources: [],
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

function manyResourcesWithCompare() {
  return [
    {
      ...resource,
      id: "trust.compare_resources",
      path: "/api/trust/compare-resources",
      priceUsd: 0.03
    },
    ...Array.from({ length: 9 }, (_, index) => ({
      ...resource,
      id: `trust.resource_${index + 1}`,
      path: `/api/trust/resource-${index + 1}`
    }))
  ];
}
