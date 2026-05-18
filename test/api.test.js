import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createTrust402Server } from "../src/server.js";

async function withServer(fn) {
  const server = createTrust402Server();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

test("discovery endpoints expose Trust402 launch resources", async () => {
  await withServer(async (baseUrl) => {
    const health = await request(baseUrl, "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, "Trust402");
    assert.equal(health.body.liveSpendEnabled, false);

    const resources = await request(baseUrl, "/api/resources");
    assert.equal(resources.response.status, 200);
    assert.equal(resources.body.paidLaunchResources.length, 7);
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/status"));
    assert.ok(resources.body.paidLaunchResources.some((resource) => resource.path === "/api/trust/check-x402"));
    assert.ok(resources.body.laterResourcesToPreserve.some((resource) => resource.path === "/api/procurement/execute"));

    const status = await request(baseUrl, "/api/status");
    assert.equal(status.response.status, 200);
    assert.equal(status.body.launchReadiness.readyForGitHub, true);
    assert.equal(status.body.launchReadiness.readyForLiveSpend, false);

    const openapi = await request(baseUrl, "/openapi.json");
    assert.equal(openapi.response.status, 200);
    assert.equal(openapi.body.openapi, "3.1.0");
    assert.ok(openapi.body.paths["/api/status"].get);
    assert.ok(openapi.body.paths["/api/reports/x402-diligence"].post["x-payment-info"]);

    const wellKnown = await request(baseUrl, "/.well-known/x402");
    assert.equal(wellKnown.response.status, 200);
    assert.ok(wellKnown.body.resources.some((resource) => resource.includes("/api/trust/score-resource")));
  });
});

test("score-resource returns recommendation and missing signals", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "/api/trust/score-resource", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://example.com/api/paid",
        priceUsd: 0.01,
        has402: true,
        hasInputSchema: true,
        hasOpenApi: true,
        hasWellKnown: true,
        payTo: "0x1111111111111111111111111111111111111111",
        network: "eip155:8453",
        asset: "USDC",
        description: "Structured paid x402 resource for autonomous agents.",
        receiptReady: true
      })
    });

    assert.equal(response.status, 200);
    assert.equal(body.tool, "trust.score_resource");
    assert.equal(body.recommendation, "use");
    assert.equal(body.riskLevel, "low");
    assert.ok(body.score >= 82);
  });
});

test("procurement-plan is plan-only and budget bounded", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "/api/procurement/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "Buy the safest x402 endpoint intelligence resource.",
        budgetUsd: 0.25,
        maxPaidCalls: 5,
        riskTolerance: "low"
      })
    });

    assert.equal(response.status, 200);
    assert.equal(body.tool, "procurement.plan");
    assert.equal(body.policy.mode, "plan-only");
    assert.equal(body.policy.liveSpendEnabled, false);
    assert.equal(body.budget.totalUsd, 0.25);
    assert.ok(body.budget.perCallLimitUsd > 0);
  });
});

test("mock paywall returns 402 when enabled", async (t) => {
  const oldMode = process.env.TRUST402_PAYWALL_MODE;
  process.env.TRUST402_PAYWALL_MODE = "mock";
  t.after(() => {
    if (oldMode === undefined) delete process.env.TRUST402_PAYWALL_MODE;
    else process.env.TRUST402_PAYWALL_MODE = oldMode;
  });

  const { createTrust402Server: createFreshServer } = await import(`../src/server.js?mock=${Date.now()}`);
  const server = createFreshServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/trust/score-resource`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(response.status, 402);
    assert.ok(response.headers.get("payment-required"));
    const body = await response.json();
    assert.equal(body.error.code, "payment_required");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
