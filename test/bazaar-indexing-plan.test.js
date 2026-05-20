import test from "node:test";
import assert from "node:assert/strict";
import { bazaarIndexingPlan } from "../src/bazaarIndexingPlan.js";

test("bazaarIndexingPlan builds route-by-route budgets without spending", () => {
  const result = bazaarIndexingPlan({
    baseUrl: "https://trust402.aztecbeacon.uk",
    indexedResourceIds: "trust.compare_resources"
  }, {
    catalog: sampleCatalog()
  });

  assert.equal(result.ok, true);
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.executesPayment, false);
  assert.equal(result.target.indexedCount, 1);
  assert.equal(result.target.missingCount, 2);
  assert.equal(result.budget.starterBatchUsd, 0.01);
  assert.equal(result.budget.highCostBatchUsd, 0.15);
  assert.equal(result.batches.starter.routes[0].id, "trust.score_resource");
  assert.equal(result.batches.highCost.routes[0].id, "reports.x402_diligence");
  assert.match(result.batches.starter.routes[0].planCommand, /agentcash:direct-smoke-plan/);
  assert.match(result.planHash, /^sha256:[a-f0-9]{64}$/);
});

test("bazaarIndexingPlan can use an explicit missing-route list", () => {
  const result = bazaarIndexingPlan({
    baseUrl: "https://trust402.aztecbeacon.uk",
    missingResourceIds: ["reports.x402_diligence"],
    maxPerRouteUsd: 0.05
  }, {
    catalog: sampleCatalog()
  });

  assert.equal(result.target.missingCount, 1);
  assert.deepEqual(result.currentEvidence.missingResourceIds, ["reports.x402_diligence"]);
  assert.equal(result.budget.remainingAllRoutesUsd, 0.15);
  assert.equal(result.batches.starter.routeCount, 0);
  assert.equal(result.batches.highCost.routeCount, 1);
});

function sampleCatalog() {
  return {
    paidLaunchResources: [
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
        purpose: "Compare x402 resources."
      },
      {
        id: "reports.x402_diligence",
        method: "POST",
        path: "/api/reports/x402-diligence",
        priceUsd: {
          min: 0.08,
          max: 0.15
        },
        purpose: "Produce a diligence report."
      }
    ]
  };
}
