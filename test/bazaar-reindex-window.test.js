import test from "node:test";
import assert from "node:assert/strict";
import { bazaarReindexWindow } from "../src/bazaarReindexWindow.js";

test("bazaarReindexWindow builds a read-only route-by-route recovery plan", () => {
  const result = bazaarReindexWindow({
    baseUrl: "https://trust402.aztecbeacon.uk",
    indexedResourceIds: "trust.check_x402,trust.compare_resources",
    missingResourceIds: ["trust.score_resource", "reports.x402_diligence"],
    paymentProvider: "cdp-x402",
    includeProof: false
  }, {
    catalog: sampleCatalog(),
    config: sampleConfig(),
    spendPolicy: sampleSpendPolicy()
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "plan-only");
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.executesPayment, false);
  assert.equal(result.safety.proofDisabledByDefault, true);
  assert.equal(result.target.selectedCount, 2);
  assert.deepEqual(result.batches.starter.routeIds, ["trust.score_resource"]);
  assert.deepEqual(result.batches.highCost.routeIds, ["reports.x402_diligence"]);
  assert.equal(result.budget.selectedMaxSpendUsd, 0.16);
  assert.equal(result.budget.starterBatchUsd, 0.01);
  assert.equal(result.budget.highCostBatchUsd, 0.15);

  const scoreRoute = result.routes.find((route) => route.id === "trust.score_resource");
  assert.equal(scoreRoute.requiredTemporaryPolicyWindow.vercelEnv.LIVE_PAYMENT_PROVIDER, "cdp-x402");
  assert.equal(scoreRoute.requiredTemporaryPolicyWindow.vercelEnv.LIVE_MAX_PER_CALL_USD, "0.01");
  assert.equal(scoreRoute.requiredTemporaryPolicyWindow.vercelEnv.LIVE_ALLOWED_REGISTRIES, "https://trust402.aztecbeacon.uk");
  assert.equal(scoreRoute.requiredTemporaryPolicyWindow.vercelEnv.PROOF402_DELEGATION_MODE, "disabled");
  assert.match(scoreRoute.commands.liveEvidenceSmoke, /live:evidence-smoke/);
  assert.match(scoreRoute.commands.liveEvidenceSmoke, /--candidate-endpoint=https:\/\/trust402\.aztecbeacon\.uk\/api\/trust\/score-resource/);
  assert.match(scoreRoute.commands.liveEvidenceSmoke, /--skip-proof/);
  assert.equal(scoreRoute.directAgentcashFallback.fetch.input.body.id, "trust.check_x402");
  assert.equal(scoreRoute.directAgentcashFallback.fetch.input.maxAmount, 0.01);
  assert.equal(scoreRoute.currentPolicyFit.readyNow, false);
  assert.equal(result.closeWindowEnv.LIVE_SPEND_ENABLED, "false");
  assert.match(result.planHash, /^sha256:[a-f0-9]{64}$/);
});

test("bazaarReindexWindow can include Proof402 reserve only when requested", () => {
  const result = bazaarReindexWindow({
    baseUrl: "https://trust402.aztecbeacon.uk",
    routeIds: "monitor.snapshot",
    includeProof: true,
    proofReserveUsd: 0.005
  }, {
    catalog: sampleCatalog(),
    config: sampleConfig(),
    spendPolicy: sampleSpendPolicy()
  });

  const route = result.routes[0];
  assert.equal(route.id, "monitor.snapshot");
  assert.equal(route.price.maxUsd, 0.015);
  assert.equal(route.price.routeWindowMaxUsd, 0.02);
  assert.equal(route.requiredTemporaryPolicyWindow.vercelEnv.PROOF402_DELEGATION_MODE, "live");
  assert.equal(result.budget.proofReserveUsdPerRoute, 0.005);
  assert.equal(route.safety.proofIncluded, true);
});

function sampleCatalog() {
  return {
    paidLaunchResources: [
      {
        id: "trust.check_x402",
        method: "POST",
        path: "/api/trust/check-x402",
        priceUsd: 0.005,
        purpose: "Run a fast live probe."
      },
      {
        id: "trust.score_resource",
        method: "POST",
        path: "/api/trust/score-resource",
        priceUsd: 0.01,
        purpose: "Score one x402 resource."
      },
      {
        id: "trust.compare_resources",
        method: "POST",
        path: "/api/trust/compare-resources",
        priceUsd: 0.03,
        purpose: "Compare resources."
      },
      {
        id: "monitor.snapshot",
        method: "POST",
        path: "/api/monitor/snapshot",
        priceUsd: 0.015,
        purpose: "Run a one-shot snapshot."
      },
      {
        id: "reports.x402_diligence",
        method: "POST",
        path: "/api/reports/x402-diligence",
        priceUsd: {
          min: 0.08,
          max: 0.15
        },
        purpose: "Produce a full diligence report."
      }
    ]
  };
}

function sampleConfig() {
  return {
    publicBaseUrl: "https://trust402.aztecbeacon.uk",
    proof402BaseUrl: "https://proof402.vercel.app",
    proof402MaxSpendUsd: 0.005,
    livePaymentProvider: "cdp-x402"
  };
}

function sampleSpendPolicy() {
  return {
    tool: "policies.spend_status",
    generatedAt: "2026-06-21T00:00:00.000Z",
    policies: {
      liveProcurement: {
        ready: true,
        controls: {
          maxPerCallUsd: 0.005,
          maxPerJobUsd: 0.02,
          dailyRemainingUsd: 0.035,
          paymentProvider: "cdp-x402",
          allowedRegistriesCount: 1,
          operatorApiKeyConfigured: true
        },
        blockers: []
      },
      proof402Delegation: {
        ready: true
      },
      agentcashAutoRefill: {
        ready: true
      }
    }
  };
}
