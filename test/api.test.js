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
    const landing = await request(baseUrl, "/");
    assert.equal(landing.response.status, 200);
    assert.match(landing.response.headers.get("content-type") || "", /text\/html/);
    assert.match(landing.body, /<h1[^>]*>Trust402<\/h1>/);
    assert.match(landing.body, /x402scan Evidence/);
    assert.match(landing.body, /Hire Trust402/);
    assert.match(landing.body, /\/radar/);
    assert.match(landing.body, /\/api\/policies\/spend/);
    assert.doesNotMatch(landing.body, /CDP_API_KEY|CDP_WALLET_SECRET|PRIVATE_KEY|PAYMENT-SIGNATURE/);

    const rootJson = await request(baseUrl, "/", { headers: { accept: "application/json" } });
    assert.equal(rootJson.response.status, 200);
    assert.equal(rootJson.body.service, "Trust402");
    assert.equal(rootJson.body.links.openapi, "/openapi.json");
    assert.equal(rootJson.body.links.radar, "/radar");
    assert.equal(rootJson.body.links.radarDigest, "/api/radar/digest");
    assert.equal(rootJson.body.links.ecosystemPulse, "/api/radar/ecosystem-pulse");

    const apiRoot = await request(baseUrl, "/api");
    assert.equal(apiRoot.response.status, 200);
    assert.equal(apiRoot.body.links.spendPolicy, "/api/policies/spend");

    const health = await request(baseUrl, "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, "Trust402");
    assert.equal(health.body.liveSpendEnabled, false);
    assert.equal(health.body.deployment.provider, "local");
    assert.equal(health.body.deployment.exposesSecretValues, false);

    const resources = await request(baseUrl, "/api/resources");
    assert.equal(resources.response.status, 200);
    assert.equal(resources.body.paidLaunchResources.length, 10);
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/status"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/receipts/hash-result"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/receipts/notarize-result"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/settlement/status"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/settlement/preflight"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/policies/spend"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/completion/plan"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/completion/audit"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/deployments/preflight"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/deployments/github-actions-setup"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/domains/activation-pack"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/domains/readiness-check"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/directories/submission-pack"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/procurement/execute"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/live/window-plan"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/operator/unblock-report"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/operator/action-pack"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/operator/readiness"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/jobs/autonomous-run"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/registries/candidates"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/agentcash/refill-check"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/payments/bridge-check"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/radar/digest"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/radar/ecosystem-pulse"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/ecosystem"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/ecosystem/trends"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/mcp"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/mcp/tools"));
    assert.ok(resources.body.freeResources.some((resource) => resource.path === "/api/indexing/routes"));
    for (const path of [
      "/.well-known/x402.json",
      "/.well-known/agent.json",
      "/.well-known/agent-services.json",
      "/.well-known/ai-plugin.json",
      "/.well-known/mcp.json",
      "/mcp",
      "/directory",
      "/directory.json",
      "/radar",
      "/radar.json",
      "/ecosystem",
      "/llms.txt",
      "/robots.txt",
      "/sitemap.xml"
    ]) {
      assert.ok(resources.body.freeResources.some((resource) => resource.path === path && resource.priceUsd === 0));
    }
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

    const bridgeUnauthorized = await request(baseUrl, "/api/payments/bridge-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(bridgeUnauthorized.response.status, 403);
    assert.equal(bridgeUnauthorized.body.error.code, "operator_not_authorized");

    const completionPlan = await request(baseUrl, "/api/completion/plan");
    assert.equal(completionPlan.response.status, 200);
    assert.equal(completionPlan.body.tool, "completion.plan");
    assert.equal(completionPlan.body.requirements.length, 10);
    assert.equal(completionPlan.body.evidenceRules.allAuditRequirementsMustBeVerified, true);
    assert.ok(completionPlan.body.requirementIds.includes("paid_proof402_delegation"));

    const completion = await request(baseUrl, "/api/completion/audit");
    assert.equal(completion.response.status, 200);
    assert.equal(completion.body.tool, "completion.audit");
    assert.equal(completion.body.goalComplete, false);
    assert.ok(completion.body.requirements.some((item) => item.id === "unified_spend_policy" && item.status === "verified"));
    assert.ok(completion.body.blockers.some((item) => item.id === "git_vercel_auto_deploy"));

    const deploymentPreflightGet = await request(baseUrl, "/api/deployments/preflight");
    assert.equal(deploymentPreflightGet.response.status, 200);
    assert.equal(deploymentPreflightGet.body.tool, "deployment.preflight");
    assert.equal(deploymentPreflightGet.body.safety.readOnly, true);
    assert.equal(deploymentPreflightGet.body.safety.mutatesVercel, false);
    assert.equal(deploymentPreflightGet.body.safety.mutatesGitHub, false);
    assert.ok(deploymentPreflightGet.body.requirementStatus.gitVercelAutoDeploy);
    assert.ok(deploymentPreflightGet.body.requirementStatus.customDomain);

    const githubActionsSetupGet = await request(baseUrl, "/api/deployments/github-actions-setup");
    assert.equal(githubActionsSetupGet.response.status, 200);
    assert.equal(githubActionsSetupGet.body.tool, "deployments.github_actions_setup");
    assert.equal(githubActionsSetupGet.body.safety.readOnly, true);
    assert.equal(githubActionsSetupGet.body.safety.includesSecretValues, false);
    assert.ok(githubActionsSetupGet.body.githubActions.requiredSecretNames.includes("VERCEL_TOKEN"));

    const directoryPackGet = await request(baseUrl, "/api/directories/submission-pack");
    assert.equal(directoryPackGet.response.status, 200);
    assert.equal(directoryPackGet.body.tool, "directories.submission_pack");
    assert.equal(directoryPackGet.body.safety.readOnly, true);
    assert.equal(directoryPackGet.body.safety.submitsDirectoryForms, false);
    assert.ok(directoryPackGet.body.listingCopy.openapi.endsWith("/openapi.json"));
    assert.ok(directoryPackGet.body.directoryTargets.some((item) => item.id === "x402_list_com"));

    const domainPackGet = await request(baseUrl, "/api/domains/activation-pack");
    assert.equal(domainPackGet.response.status, 200);
    assert.equal(domainPackGet.body.tool, "domains.activation_pack");
    assert.equal(domainPackGet.body.safety.readOnly, true);
    assert.equal(domainPackGet.body.safety.buysDomain, false);
    assert.equal(domainPackGet.body.availability.checked, false);

    const unblockGet = await request(baseUrl, "/api/operator/unblock-report");
    assert.equal(unblockGet.response.status, 200);
    assert.equal(unblockGet.body.tool, "operator.unblock_report");
    assert.equal(unblockGet.body.safety.readOnly, true);
    assert.equal(unblockGet.body.safety.sendsPaymentHeaders, false);
    assert.ok(unblockGet.body.checks.some((item) => item.id === "external_x402_directories"));

    const readinessGet = await request(baseUrl, "/api/operator/readiness");
    assert.equal(readinessGet.response.status, 200);
    assert.equal(readinessGet.body.tool, "operator.readiness");
    assert.equal(readinessGet.body.envDiagnostics.tool, "runtime.env_diagnostics");
    assert.equal(readinessGet.body.safety.readOnly, true);
    assert.equal(readinessGet.body.safety.includesSecretValues, false);
    assert.equal(readinessGet.body.safety.mutatesWallet, false);

    const registryCandidatesGet = await request(baseUrl, "/api/registries/candidates");
    assert.equal(registryCandidatesGet.response.status, 200);
    assert.equal(registryCandidatesGet.body.tool, "registries.candidates");
    assert.equal(registryCandidatesGet.body.safety.readOnly, true);
    assert.equal(registryCandidatesGet.body.safety.paidSubcallsMade, 0);
    assert.ok(registryCandidatesGet.body.candidates.some((candidate) => candidate.id === "proof402.notarize"));

    const radarHtml = await request(baseUrl, "/radar");
    assert.equal(radarHtml.response.status, 200);
    assert.match(radarHtml.body, /Trust402 Radar/);
    assert.match(radarHtml.body, /Quick x402 Check/);
    assert.doesNotMatch(radarHtml.body, /CDP_API_KEY|CDP_WALLET_SECRET|PRIVATE_KEY|PAYMENT-SIGNATURE/i);

    const radarJson = await request(baseUrl, "/radar.json");
    assert.equal(radarJson.response.status, 200);
    assert.equal(radarJson.body.tool, "radar.digest");
    assert.equal(radarJson.body.primaryOffers.length, 3);
    assert.ok(radarJson.body.primaryOffers.some((offer) => offer.id === "trust.check_x402" && offer.priceDisplay === "$0.005"));
    assert.equal(radarJson.body.safety.sendsPaymentHeaders, false);
    assert.equal(radarJson.body.marketSnapshot.paidSubcallsMade, 0);

    const radarApi = await request(baseUrl, "/api/radar/digest");
    assert.equal(radarApi.response.status, 200);
    assert.equal(radarApi.body.digestHash, radarJson.body.digestHash);

    const ecosystemPulse = await request(baseUrl, "/api/radar/ecosystem-pulse");
    assert.equal(ecosystemPulse.response.status, 200);
    assert.equal(ecosystemPulse.body.tool, "radar.ecosystem_pulse");
    assert.ok(ecosystemPulse.body.marketSignals.some((signal) => signal.id === "x402-security-hardening"));
    assert.ok(ecosystemPulse.body.recommendations.some((item) => item.id === "guard-live-spend"));
    assert.equal(ecosystemPulse.body.safety.publicSafe, true);
    assert.equal(ecosystemPulse.body.safety.sendsPaymentHeaders, false);
    assert.equal(ecosystemPulse.body.safety.paidSubcallsMade, 0);
    assert.doesNotMatch(JSON.stringify(ecosystemPulse.body), /CDP_API_KEY|CDP_WALLET_SECRET|PRIVATE_KEY|PAYMENT-SIGNATURE/i);

    const ecosystemHtml = await request(baseUrl, "/ecosystem");
    assert.equal(ecosystemHtml.response.status, 200);
    assert.match(ecosystemHtml.body, /Trust before agents spend/);
    assert.match(ecosystemHtml.body, /Buyer-agent workflow/);
    assert.doesNotMatch(ecosystemHtml.body, /CDP_API_KEY|CDP_WALLET_SECRET|PRIVATE_KEY|PAYMENT-SIGNATURE/i);

    const ecosystemJson = await request(baseUrl, "/api/ecosystem/trends");
    assert.equal(ecosystemJson.response.status, 200);
    assert.equal(ecosystemJson.body.tool, "ecosystem.trends");
    assert.ok(ecosystemJson.body.categories.some((category) => category.id === "verification_native_clearing"));
    assert.equal(ecosystemJson.body.safety.sendsPaymentHeaders, false);

    const mcpManifestGet = await request(baseUrl, "/.well-known/mcp.json");
    assert.equal(mcpManifestGet.response.status, 200);
    assert.ok(mcpManifestGet.body.mcpServers.trust402.url.endsWith("/mcp"));
    assert.ok(mcpManifestGet.body.tools.some((tool) => tool.name === "score_x402_resource"));
    assert.equal(mcpManifestGet.body.safety.bypassesX402Payment, false);

    const mcpGet = await request(baseUrl, "/mcp");
    assert.equal(mcpGet.response.status, 200);
    assert.ok(mcpGet.body.server.tools.some((tool) => tool.name === "compare_x402_resources"));

    const mcpTools = await request(baseUrl, "/api/mcp/tools");
    assert.equal(mcpTools.response.status, 200);
    assert.equal(mcpTools.body.tool, "mcp.tools_catalog");
    assert.ok(mcpTools.body.tools.some((tool) => tool.x402?.url?.endsWith("/api/procurement/quote")));

    const mcpInit = await request(baseUrl, "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })
    });
    assert.equal(mcpInit.response.status, 200);
    assert.equal(mcpInit.body.result.serverInfo.name, "trust402");

    const mcpCall = await request(baseUrl, "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "score_x402_resource",
          arguments: {
            endpoint: "https://example.com/api/paid",
            priceUsd: 0.01
          }
        }
      })
    });
    assert.equal(mcpCall.response.status, 200);
    assert.equal(mcpCall.body.result.structuredContent.request.resourceId, "trust.score_resource");
    assert.equal(mcpCall.body.result.structuredContent.safety.bypassesX402Payment, false);

    const indexing = await request(baseUrl, "/api/indexing/routes");
    assert.equal(indexing.response.status, 200);
    assert.equal(indexing.body.tool, "indexing.routes");
    assert.equal(indexing.body.records.length, 10);
    assert.ok(indexing.body.records.some((record) => record.slug === "trust-score-resource" && record.mcpToolName === "score_x402_resource"));

    const routePage = await request(baseUrl, "/resources/trust-score-resource");
    assert.equal(routePage.response.status, 200);
    assert.match(routePage.body, /Trust Score Resource|Trust Score/);
    assert.match(routePage.body, /Paid x402 route/);
    assert.doesNotMatch(routePage.body, /CDP_API_KEY|CDP_WALLET_SECRET|PRIVATE_KEY|PAYMENT-SIGNATURE/i);

    const dailyCronUnauthorized = await request(baseUrl, "/api/cron/daily-autonomous");
    assert.equal(dailyCronUnauthorized.response.status, 401);
    assert.equal(dailyCronUnauthorized.body.error.code, "cron_not_authorized");

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
    assert.ok(bundle.body.discovery.agentManifest.endsWith("/.well-known/agent.json"));
    assert.ok(bundle.body.discovery.radar.endsWith("/radar"));
    assert.ok(bundle.body.discovery.llms.endsWith("/llms.txt"));
    assert.ok(bundle.body.discovery.sitemap.endsWith("/sitemap.xml"));
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
    assert.ok(openapi.body.paths["/api/payments/bridge-check"].post);
    assert.ok(openapi.body.paths["/api/completion/plan"].get);
    assert.ok(openapi.body.paths["/api/completion/audit"].get);
    assert.ok(openapi.body.paths["/api/deployments/preflight"].get);
    assert.ok(openapi.body.paths["/api/deployments/preflight"].post);
    assert.ok(openapi.body.paths["/api/deployments/github-actions-setup"].get);
    assert.ok(openapi.body.paths["/api/deployments/github-actions-setup"].post);
    assert.ok(openapi.body.paths["/api/domains/activation-pack"].get);
    assert.ok(openapi.body.paths["/api/domains/activation-pack"].post);
    assert.ok(openapi.body.paths["/api/domains/readiness-check"].get);
    assert.ok(openapi.body.paths["/api/domains/readiness-check"].post);
    assert.ok(openapi.body.paths["/api/directories/submission-pack"].get);
    assert.ok(openapi.body.paths["/api/directories/submission-pack"].post);
    assert.ok(openapi.body.paths["/api/live/window-plan"].post);
    assert.ok(openapi.body.paths["/api/operator/unblock-report"].get);
    assert.ok(openapi.body.paths["/api/operator/unblock-report"].post);
    assert.ok(openapi.body.paths["/api/operator/action-pack"].post);
    assert.ok(openapi.body.paths["/api/operator/readiness"].get);
    assert.ok(openapi.body.paths["/api/operator/readiness"].post);
    assert.ok(openapi.body.paths["/api/registries/candidates"].get);
    assert.ok(openapi.body.paths["/api/registries/candidates"].post);
    assert.ok(openapi.body.paths["/api/jobs/autonomous-run"].post);
    assert.ok(openapi.body.paths["/api/agentcash/refill-check"].post);
    assert.ok(openapi.body.paths["/api/receipts/hash-result"].post);
    assert.ok(openapi.body.paths["/api/receipts/notarize-result"].post);
    assert.ok(openapi.body.paths["/.well-known/x402.json"].get);
    assert.ok(openapi.body.paths["/.well-known/agent.json"].get);
    assert.ok(openapi.body.paths["/.well-known/agent-services.json"].get);
    assert.ok(openapi.body.paths["/.well-known/ai-plugin.json"].get);
    assert.ok(openapi.body.paths["/.well-known/mcp.json"].get);
    assert.ok(openapi.body.paths["/mcp"].get);
    assert.ok(openapi.body.paths["/mcp"].post);
    assert.ok(openapi.body.paths["/directory"].get);
    assert.ok(openapi.body.paths["/directory.json"].get);
    assert.ok(openapi.body.paths["/radar"].get);
    assert.ok(openapi.body.paths["/radar.json"].get);
    assert.ok(openapi.body.paths["/api/radar/digest"].get);
    assert.ok(openapi.body.paths["/api/radar/ecosystem-pulse"].get);
    assert.ok(openapi.body.paths["/ecosystem"].get);
    assert.ok(openapi.body.paths["/api/ecosystem/trends"].get);
    assert.ok(openapi.body.paths["/api/mcp/tools"].get);
    assert.ok(openapi.body.paths["/api/indexing/routes"].get);
    assert.ok(openapi.body.paths["/resources/{slug}"].get);
    assert.ok(openapi.body.paths["/api/directories/profile"].get);
    assert.ok(openapi.body.paths["/llms.txt"].get);
    assert.ok(openapi.body.paths["/robots.txt"].get);
    assert.ok(openapi.body.paths["/sitemap.xml"].get);
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
    assert.equal(wellKnown.body.resources.length, 10);
    assert.equal(wellKnown.body.endpoints.length, 10);
    assert.ok(wellKnown.body.resources.every((resource) => resource.startsWith("http")));
    assert.ok(wellKnown.body.resources.every((resource) => !resource.startsWith("POST ")));
    assert.ok(wellKnown.body.endpoints.some((endpoint) => endpoint.path === "/api/procurement/quote"));
    assert.ok(wellKnown.body.endpoints.every((endpoint) => endpoint.accepts?.[0]?.network));
    assert.ok(wellKnown.body.endpoints.some((endpoint) => endpoint.mcpToolName === "score_x402_resource"));
    assert.ok(wellKnown.body.endpoints.every((endpoint) => endpoint.resourcePage));

    const wellKnownJson = await request(baseUrl, "/.well-known/x402.json");
    assert.equal(wellKnownJson.response.status, 200);
    assert.deepEqual(wellKnownJson.body.resources, wellKnown.body.resources);

    const agent = await request(baseUrl, "/.well-known/agent.json");
    assert.equal(agent.response.status, 200);
    assert.equal(agent.body.name, "Trust402");
    assert.ok(agent.body.discovery.x402.endsWith("/.well-known/x402"));
    assert.equal(agent.body.resources.length, 10);

    const agentServices = await request(baseUrl, "/.well-known/agent-services.json");
    assert.equal(agentServices.response.status, 200);
    assert.equal(agentServices.body.services[0].id, "trust402");
    assert.equal(agentServices.body.services[0].resources.length, 10);

    const aiPlugin = await request(baseUrl, "/.well-known/ai-plugin.json");
    assert.equal(aiPlugin.response.status, 200);
    assert.equal(aiPlugin.body.name_for_model, "trust402");
    assert.ok(aiPlugin.body.api.url.endsWith("/openapi.json"));

    const mcp = await request(baseUrl, "/.well-known/mcp.json");
    assert.equal(mcp.response.status, 200);
    assert.equal(mcp.body.safety.liveSpendEnabledByDefault, false);
    assert.equal(mcp.body.safety.bypassesX402Payment, false);

    const directoryJson = await request(baseUrl, "/directory.json");
    assert.equal(directoryJson.response.status, 200);
    assert.equal(directoryJson.body.tool, "directories.profile");
    assert.match(directoryJson.body.profileHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(directoryJson.body.safety.publicProfileIncludesSecrets, false);
    assert.equal(directoryJson.body.safety.publicProfileIncludesPaymentHeaders, false);
    assert.equal(directoryJson.body.safety.publicProfileIncludesLocalWalletPolicy, false);
    assert.equal(directoryJson.body.paidResources.length, 10);
    assert.ok(directoryJson.body.discovery.openapi.endsWith("/openapi.json"));
    assert.ok(directoryJson.body.listingStatus.directoryTargets.some((target) => target.id === "x402scan"));
    const directoryJsonText = JSON.stringify(directoryJson.body);
    assert.doesNotMatch(directoryJsonText, /CDP_API_KEY|CDP_WALLET_SECRET|0x1111111111111111111111111111111111111111/i);

    const directoryApi = await request(baseUrl, "/api/directories/profile");
    assert.equal(directoryApi.response.status, 200);
    assert.equal(directoryApi.body.profileHash, directoryJson.body.profileHash);

    const directoryHtml = await request(baseUrl, "/directory");
    assert.equal(directoryHtml.response.status, 200);
    assert.match(directoryHtml.body, /<script type="application\/ld\+json">/);
    assert.match(directoryHtml.body, /Paid x402 Resources/);
    assert.match(directoryHtml.body, /Trust402 Radar/);
    assert.doesNotMatch(directoryHtml.body, /CDP_API_KEY|CDP_WALLET_SECRET|0x1111111111111111111111111111111111111111/i);

    const llms = await request(baseUrl, "/llms.txt");
    assert.equal(llms.response.status, 200);
    assert.match(llms.body, /# Trust402/);
    assert.match(llms.body, /Paid x402 Resources/);
    assert.match(llms.body, /Directory profile/);
    assert.match(llms.body, /Trust402 Radar/);
    assert.match(llms.body, /Ecosystem pulse JSON/);
    assert.match(llms.body, /Ecosystem trends/);
    assert.match(llms.body, /MCP endpoint/);
    assert.match(llms.body, /Route indexing feed/);

    const robots = await request(baseUrl, "/robots.txt");
    assert.equal(robots.response.status, 200);
    assert.match(robots.body, /Sitemap:/);

    const sitemap = await request(baseUrl, "/sitemap.xml");
    assert.equal(sitemap.response.status, 200);
    assert.match(sitemap.body, /<urlset/);
    assert.match(sitemap.body, /\/directory/);
    assert.match(sitemap.body, /\/radar/);
    assert.match(sitemap.body, /\/api\/radar\/ecosystem-pulse/);
    assert.match(sitemap.body, /\/ecosystem/);
    assert.match(sitemap.body, /\/api\/indexing\/routes/);
    assert.match(sitemap.body, /\/resources\/trust-score-resource/);
    assert.match(sitemap.body, /\/api\/trust\/score-resource/);

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

    const directoryPackPost = await request(baseUrl, "/api/directories/submission-pack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        userApprovedOutreach: false
      })
    });
    assert.equal(directoryPackPost.response.status, 200);
    assert.equal(directoryPackPost.body.tool, "directories.submission_pack");
    assert.equal(directoryPackPost.body.safety.includesSecrets, false);
    assert.equal(directoryPackPost.body.evidenceEnv.TRUST402_EXTERNAL_DIRECTORY_STATUS, "visible");
    assert.ok(directoryPackPost.body.listingCopy.agentManifest.endsWith("/.well-known/agent.json"));
    assert.ok(directoryPackPost.body.listingCopy.llms.endsWith("/llms.txt"));
    assert.ok(directoryPackPost.body.listingCopy.sitemap.endsWith("/sitemap.xml"));

    const domainPackPost = await request(baseUrl, "/api/domains/activation-pack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        selectedDomain: "trust402.dev"
      })
    });
    assert.equal(domainPackPost.response.status, 200);
    assert.equal(domainPackPost.body.tool, "domains.activation_pack");
    assert.equal(domainPackPost.body.vercelPlan.envPlan.PUBLIC_BASE_URL, "https://trust402.dev");
    assert.equal(domainPackPost.body.safety.mutatesVercel, false);

    const deploymentPreflightPost = await request(baseUrl, "/api/deployments/preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        customDomain: "trust402.dev",
        gitRemote: "https://github.com/kfubtik/trust402.git",
        gitHead: "abc1234",
        vercelProject: {
          projectName: "trust402",
          projectId: "prj_test",
          orgId: "team_test"
        },
        gitAutoDeployVerified: false
      })
    });
    assert.equal(deploymentPreflightPost.response.status, 200);
    assert.equal(deploymentPreflightPost.body.tool, "deployment.preflight");
    assert.equal(deploymentPreflightPost.body.domain.ready, true);
    assert.equal(deploymentPreflightPost.body.safety.readsSecretValues, false);

    const registryCandidatesPost = await request(baseUrl, "/api/registries/candidates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "Create a proof-backed receipt.",
        budgetUsd: 0.02
      })
    });
    assert.equal(registryCandidatesPost.response.status, 200);
    assert.equal(registryCandidatesPost.body.tool, "registries.candidates");
    assert.ok(registryCandidatesPost.body.candidates.length >= 1);
    assert.equal(registryCandidatesPost.body.safety.fetchesExternalRegistries, false);

    const githubActionsSetupPost = await request(baseUrl, "/api/deployments/github-actions-setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        gitHead: "abc1234",
        vercelProject: {
          projectName: "trust402",
          projectId: "prj_test",
          orgId: "team_test"
        }
      })
    });
    assert.equal(githubActionsSetupPost.response.status, 200);
    assert.equal(githubActionsSetupPost.body.tool, "deployments.github_actions_setup");
    assert.equal(githubActionsSetupPost.body.status, "ready-to-configure");
    assert.equal(githubActionsSetupPost.body.safety.mutatesGitHub, false);
    assert.equal(githubActionsSetupPost.body.evidenceEnv.TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA, "abc1234");

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

    const readinessPost = await request(baseUrl, "/api/operator/readiness", {
      method: "POST",
      body: JSON.stringify({
        candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
        candidatePriceUsd: 0.005,
        proofReserveUsd: 0.005,
        includeProof: true,
        paymentProvider: "cdp-x402"
      })
    });
    assert.equal(readinessPost.response.status, 200);
    assert.equal(readinessPost.body.tool, "operator.readiness");
    assert.equal(readinessPost.body.paymentProvider.selected, "cdp-x402");
    assert.equal(readinessPost.body.safety.sendsPaymentHeaders, false);
    assert.equal(readinessPost.body.safety.includesPrivateKeys, false);

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
