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
    assert.equal(resources.body.paidLaunchResources.length, 10);
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/status"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/receipts/hash-result"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/receipts/notarize-result"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/settlement/status"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/settlement/preflight"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/policies/spend"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/completion/audit"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/procurement/execute"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/live/window-plan"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/operator/unblock-report"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/operator/action-pack"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/jobs/autonomous-run"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/agentcash/refill-check"));
    assert.ok(resources.body.paidLaunchResources.some((resource) => resource.path === "/api/trust/check-x402"));
    assert.ok(resources.body.paidLaunchResources.some((resource) => resource.path === "/api/procurement/quote"));
    assert.ok(resources.body.paidLaunchResources.some((resource) => resource.path === "/api/monitor/snapshot"));
    assert.ok(resources.body.paidLaunchResources.some((resource) => resource.path === "/api/monitor/badge"));
    assert.ok(resources.body.laterResourcesToPreserve.some((resource) => resource.path === "/api/procurement/execute"));

    const status = await request(baseUrl, "/api/status");
    assert.equal(status.response.status, 200);
    assert.equal(status.body.launchReadiness.readyForGitHub, true);
    assert.equal(status.body.launchReadiness.readyForReceiptLayer, true);
    assert.equal(status.body.launchReadiness.readyForControlledProcurementDryRun, true);
    assert.equal(status.body.launchReadiness.readyForAutonomousDryRun, true);
    assert.equal(status.body.launchReadiness.readyForOneShotMonitoring, true);
    assert.equal(status.body.launchReadiness.readyForLiveSpend, false);
    assert.equal(status.body.launchReadiness.readyForAgentCashAutoRefill, false);
    assert.equal(status.body.launchReadiness.readyForAgentCashRefillDryRun, true);
    assert.equal(status.body.launchReadiness.readyForRealX402Settlement, false);

    const settlement = await request(baseUrl, "/api/settlement/status");
    assert.equal(settlement.response.status, 200);
    assert.equal(settlement.body.tool, "settlement.status");
    assert.equal(settlement.body.readiness.realSettlementReady, false);
    assert.equal(settlement.body.readiness.marketplaceIndexingReady, false);
    assert.ok(settlement.body.blockers.some((item) => item.id === "explicit_real_settlement_enabled"));

    const preflight = await request(baseUrl, "/api/settlement/preflight");
    assert.equal(preflight.response.status, 200);
    assert.equal(preflight.body.tool, "settlement.preflight");
    assert.equal(preflight.body.readiness.paidSmokeReady, false);
    assert.ok(preflight.body.blockers.some((item) => item.id === "paid_smoke_approved"));

    const policies = await request(baseUrl, "/api/policies/spend");
    assert.equal(policies.response.status, 200);
    assert.equal(policies.body.tool, "policies.spend_status");
    assert.equal(policies.body.readiness.anyLiveSpendReady, false);
    assert.equal(policies.body.policies.liveProcurement.enabled, false);
    assert.equal(typeof policies.body.policies.liveProcurement.controls.dailyRemainingUsd, "number");
    assert.equal(policies.body.policies.agentcashAutoRefill.enabled, false);
    assert.equal(policies.body.policies.proof402Delegation.mode, "disabled");
    assert.ok(policies.body.issues.agentcashAutoRefill.includes("/issues/7"));

    const completion = await request(baseUrl, "/api/completion/audit");
    assert.equal(completion.response.status, 200);
    assert.equal(completion.body.tool, "completion.audit");
    assert.equal(completion.body.goalComplete, false);
    assert.ok(completion.body.requirements.some((item) => item.id === "unified_spend_policy" && item.status === "verified"));
    assert.ok(completion.body.blockers.some((item) => item.id === "git_vercel_auto_deploy"));

    const unblockGet = await request(baseUrl, "/api/operator/unblock-report");
    assert.equal(unblockGet.response.status, 200);
    assert.equal(unblockGet.body.tool, "operator.unblock_report");
    assert.equal(unblockGet.body.safety.readOnly, true);
    assert.equal(unblockGet.body.safety.sendsPaymentHeaders, false);
    assert.ok(unblockGet.body.checks.some((item) => item.id === "external_x402_directories"));

    const checklist = await request(baseUrl, "/api/launch/checklist");
    assert.equal(checklist.response.status, 200);
    assert.equal(checklist.body.tool, "launch.checklist");
    assert.equal(checklist.body.readiness.dryRunLaunchReady, true);
    assert.equal(checklist.body.readiness.publicMarketplaceReady, false);

    const bundle = await request(baseUrl, "/api/marketplace/bundle");
    assert.equal(bundle.response.status, 200);
    assert.equal(bundle.body.tool, "marketplace.bundle");
    assert.equal(bundle.body.resources.length, 10);
    assert.equal(bundle.body.listingState.dryRunMetadataReady, true);
    assert.equal(bundle.body.listingState.cdpBazaarIndexingReady, false);
    assert.equal(bundle.body.indexing.cdpBazaar.status, "blocked");
    assert.ok(bundle.body.resources.every((resource) => resource.bazaarExtensionDraft?.bazaar));
    assert.ok(bundle.body.resources.every((resource) => resource.listingStatus === "blocked"));

    const openapi = await request(baseUrl, "/openapi.json");
    assert.equal(openapi.response.status, 200);
    assert.equal(openapi.body.openapi, "3.1.0");
    assert.ok(openapi.body.paths["/api/status"].get);
    assert.ok(openapi.body.paths["/api/launch/checklist"].get);
    assert.ok(openapi.body.paths["/api/marketplace/bundle"].get);
    assert.ok(openapi.body.paths["/api/settlement/status"].get);
    assert.ok(openapi.body.paths["/api/settlement/preflight"].get);
    assert.ok(openapi.body.paths["/api/policies/spend"].get);
    assert.ok(openapi.body.paths["/api/completion/audit"].get);
    assert.ok(openapi.body.paths["/api/live/window-plan"].post);
    assert.ok(openapi.body.paths["/api/operator/unblock-report"].get);
    assert.ok(openapi.body.paths["/api/operator/unblock-report"].post);
    assert.ok(openapi.body.paths["/api/operator/action-pack"].post);
    assert.ok(openapi.body.paths["/api/jobs/autonomous-run"].post);
    assert.ok(openapi.body.paths["/api/agentcash/refill-check"].post);
    assert.ok(openapi.body.paths["/api/receipts/hash-result"].post);
    assert.ok(openapi.body.paths["/api/receipts/notarize-result"].post);
    assert.ok(openapi.body.paths["/api/procurement/quote"].post["x-payment-info"]);
    const compareSchema = openapi.body.paths["/api/trust/compare-resources"].post.requestBody.content["application/json"].schema;
    const compareCandidateSchema = compareSchema.properties.candidates.items;
    assert.equal(compareCandidateSchema.properties.endpoint.format, "uri");
    assert.ok(compareCandidateSchema.properties.hasInputSchema);
    assert.ok(compareCandidateSchema.properties.receiptReady);
    assert.ok(openapi.body.paths["/api/procurement/execute"].post);
    assert.ok(openapi.body.paths["/api/monitor/snapshot"].post["x-payment-info"]);
    assert.ok(openapi.body.paths["/api/monitor/badge"].post["x-payment-info"]);
    assert.ok(openapi.body.paths["/api/reports/x402-diligence"].post["x-payment-info"]);

    const wellKnown = await request(baseUrl, "/.well-known/x402");
    assert.equal(wellKnown.response.status, 200);
    assert.ok(wellKnown.body.resources.some((resource) => resource.includes("/api/trust/score-resource")));

    const liveWindow = await request(baseUrl, "/api/live/window-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidateEndpoint: "https://trusted.example/api/paid",
        candidatePriceUsd: 0.01,
        maxTotalUsd: 0.03,
        includeProof: true
      })
    });
    assert.equal(liveWindow.response.status, 200);
    assert.equal(liveWindow.body.tool, "live.window_plan");
    assert.equal(liveWindow.body.status, "ready-to-stage");
    assert.equal(liveWindow.body.vercelEnvPlan.production.LIVE_SPENT_TODAY_USD, "0");
    assert.equal(liveWindow.body.safety.readOnly, true);
    assert.equal(liveWindow.body.safety.writesLocalPolicy, false);
    assert.equal(liveWindow.body.safety.sendsPaymentHeaders, false);

    const unblockPost = await request(baseUrl, "/api/operator/unblock-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        candidatePriceUsd: 0.01,
        proofReserveUsd: 0.01,
        includeProof: true
      })
    });
    assert.equal(unblockPost.response.status, 200);
    assert.equal(unblockPost.body.tool, "operator.unblock_report");
    assert.equal(unblockPost.body.safety.readOnly, true);
    assert.equal(unblockPost.body.safety.mutatesWallet, false);

    const actionPack = await request(baseUrl, "/api/operator/action-pack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidateEndpoint: "https://trusted.example/api/paid",
        candidatePriceUsd: 0.01,
        maxTotalUsd: 0.03,
        includeProof: true
      })
    });
    assert.equal(actionPack.response.status, 200);
    assert.equal(actionPack.body.tool, "operator.action_pack");
    assert.equal(actionPack.body.safety.readOnly, true);
    assert.equal(actionPack.body.safety.includesSecretValues, false);
    assert.ok(actionPack.body.actions.some((action) => action.id === "git_vercel_auto_deploy"));
    assert.ok(actionPack.body.actions.some((action) => action.id === "live_procurement"));
  });
});

test("procurement quote and execute endpoints stay dry-run", async () => {
  await withServer(async (baseUrl) => {
    const candidates = [
      {
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
      },
      {
        id: "weak",
        endpoint: "https://example.com/weak",
        priceUsd: 0.04
      }
    ];

    const quote = await request(baseUrl, "/api/procurement/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "Buy one safe x402 data resource.",
        budgetUsd: 0.5,
        candidates
      })
    });

    assert.equal(quote.response.status, 200);
    assert.equal(quote.body.tool, "procurement.quote");
    assert.equal(quote.body.approvalPayload.liveSpendEnabled, false);

    const execute = await request(baseUrl, "/api/procurement/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(quote.body)
    });

    assert.equal(execute.response.status, 200);
    assert.equal(execute.body.tool, "procurement.execute");
    assert.equal(execute.body.mode, "dry-run");
    assert.equal(execute.body.paidSubcallsMade, 0);
    assert.equal(execute.body.liveSpendEnabled, false);
  });
});

test("hash-result returns a dry-run receipt bundle", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "/api/receipts/hash-result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: "example result",
        payload: { recommendation: "test-first", score: 76 }
      })
    });

    assert.equal(response.status, 200);
    assert.equal(body.tool, "receipts.hash_result");
    assert.match(body.resultHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(body.receiptBundle.proofProvider, "Proof402");
    assert.equal(body.receiptBundle.delegation.paidProofCallMade, false);
    assert.equal(body.receiptBundle.policy.liveSpendEnabled, false);

    const notarize = await request(baseUrl, "/api/receipts/notarize-result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: "example result",
        resultHash: body.resultHash,
        metadata: { taskId: "api_test" }
      })
    });

    assert.equal(notarize.response.status, 200);
    assert.equal(notarize.body.tool, "receipts.notarize_result");
    assert.equal(notarize.body.resultHash, body.resultHash);
    assert.equal(notarize.body.delegation.paidProofCallMade, false);
  });
});

test("agentcash refill-check returns a dry-run policy decision", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "/api/agentcash/refill-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "dry-run",
        currentBalanceUsd: 0.42,
        amountRefilledTodayUsd: 0
      })
    });

    assert.equal(response.status, 200);
    assert.equal(body.tool, "agentcash.refill_check");
    assert.equal(body.mode, "dry-run");
    assert.equal(body.decision.action, "refill");
    assert.equal(body.decision.status, "dry-run-planned");
    assert.equal(body.decision.plannedRefillUsd, 1);
    assert.equal(body.safety.mutatesWalletBalance, false);
  });
});

test("monitor snapshot and badge endpoints return one-shot outputs", async () => {
  await withServer(async (baseUrl) => {
    const snapshot = await request(baseUrl, "/api/monitor/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: `${baseUrl}/api/trust/score-resource`,
        method: "POST",
        expectedStatus: 402
      })
    });

    assert.equal(snapshot.response.status, 200);
    assert.equal(snapshot.body.tool, "monitor.snapshot");
    assert.match(snapshot.body.snapshotHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(snapshot.body.policy.storesHistory, false);

    const badge = await request(baseUrl, "/api/monitor/badge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot: snapshot.body })
    });

    assert.equal(badge.response.status, 200);
    assert.equal(badge.body.tool, "monitor.badge");
    assert.match(badge.body.badgeHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(badge.body.policy.paidSubcallsMade, 0);
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
    assert.equal(body.x402Version, 2);
    assert.equal(body.paymentRequired.x402Version, 2);
    assert.equal(body.error.details.requiredHeader, "PAYMENT-SIGNATURE");
    assert.equal(body.error.code, "payment_required");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("mock paywall accepts modern PAYMENT-SIGNATURE header", async (t) => {
  const oldMode = process.env.TRUST402_PAYWALL_MODE;
  process.env.TRUST402_PAYWALL_MODE = "mock";
  t.after(() => {
    if (oldMode === undefined) delete process.env.TRUST402_PAYWALL_MODE;
    else process.env.TRUST402_PAYWALL_MODE = oldMode;
  });

  const { createTrust402Server: createFreshServer } = await import(`../src/server.js?payment-signature=${Date.now()}`);
  const server = createFreshServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/trust/score-resource`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "PAYMENT-SIGNATURE": "mock-signature"
      },
      body: JSON.stringify({
        endpoint: "https://example.com/api/paid",
        priceUsd: 0.01,
        has402: true,
        hasInputSchema: true
      })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.tool, "trust.score_resource");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
