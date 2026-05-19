const baseUrl = (process.argv[2] || "http://127.0.0.1:4032").replace(/\/$/, "");
const base = new URL(baseUrl);
const isLocalBase = ["127.0.0.1", "localhost", "::1"].includes(base.hostname);

async function main() {
  const health = await getJson("/health");
  assert(health.ok === true, "/health ok mismatch");
  assert(health.liveSpendEnabled === false, "/health must keep liveSpendEnabled=false");

  const resources = await getJson("/api/resources");
  assert(resources.paidLaunchResources?.length === 10, "/api/resources expected 10 launch resources");
  assert(
    resources.freeResources?.some((item) => item.path === "/.well-known/agent.json"),
    "/api/resources must expose agent manifest discovery"
  );
  assert(
    resources.freeResources?.some((item) => item.path === "/llms.txt"),
    "/api/resources must expose llms.txt discovery"
  );

  const wellKnown = await getJson("/.well-known/x402");
  assert(wellKnown.resources?.length === 10, "/.well-known/x402 expected 10 paid resources");
  assert(
    wellKnown.resources.every((resource) => typeof resource === "string" && resource.startsWith("http")),
    "/.well-known/x402 resources must be absolute URLs"
  );
  assert(
    wellKnown.resources.every((resource) => !resource.startsWith("POST ")),
    "/.well-known/x402 resources must not include method prefixes"
  );
  assert(wellKnown.endpoints?.length === 10, "/.well-known/x402 expected 10 endpoint records");

  const wellKnownJson = await getJson("/.well-known/x402.json");
  assert(wellKnownJson.resources?.length === 10, "/.well-known/x402.json expected 10 paid resources");

  const agent = await getJson("/.well-known/agent.json");
  assert(agent.name === "Trust402", "/.well-known/agent.json name mismatch");
  assert(agent.resources?.length === 10, "/.well-known/agent.json expected 10 resources");

  const agentServices = await getJson("/.well-known/agent-services.json");
  assert(agentServices.services?.[0]?.id === "trust402", "/.well-known/agent-services.json service mismatch");

  const aiPlugin = await getJson("/.well-known/ai-plugin.json");
  assert(aiPlugin.name_for_model === "trust402", "/.well-known/ai-plugin.json model name mismatch");

  const mcp = await getJson("/.well-known/mcp.json");
  assert(mcp.safety?.liveSpendEnabledByDefault === false, "/.well-known/mcp.json must keep live spend disabled");

  const llms = await getText("/llms.txt");
  assert(llms.includes("# Trust402"), "/llms.txt heading mismatch");
  assert(llms.includes("Paid x402 Resources"), "/llms.txt must list paid resources");

  const robots = await getText("/robots.txt");
  assert(robots.includes("Sitemap:"), "/robots.txt must include sitemap");

  const sitemap = await getText("/sitemap.xml");
  assert(sitemap.includes("<urlset"), "/sitemap.xml must include urlset");
  assert(sitemap.includes("/api/trust/score-resource"), "/sitemap.xml must include paid resource routes");

  const status = await getJson("/api/status");
  assert(status.launchReadiness?.readyForGitHub === true, "/api/status readyForGitHub mismatch");
  assert(status.launchReadiness?.readyForLiveSpend === false, "/api/status readyForLiveSpend must be false");

  const checklist = await getJson("/api/launch/checklist");
  assert(checklist.readiness?.dryRunLaunchReady === true, "/api/launch/checklist dry-run readiness mismatch");
  assert(typeof checklist.readiness?.publicMarketplaceReady === "boolean", "/api/launch/checklist public readiness must be boolean");
  if (isLocalBase) {
    assert(checklist.readiness.publicMarketplaceReady === false, "/api/launch/checklist public readiness must be false for local defaults");
  }

  const bundle = await getJson("/api/marketplace/bundle");
  assert(bundle.resources?.length === 10, "/api/marketplace/bundle expected 10 launch resources");
  assert(typeof bundle.listingState?.cdpBazaarIndexingReady === "boolean", "/api/marketplace/bundle indexing readiness must be boolean");
  if (isLocalBase) {
    assert(bundle.listingState.cdpBazaarIndexingReady === false, "/api/marketplace/bundle must not claim CDP Bazaar indexing for local defaults");
  }

  const settlement = await getJson("/api/settlement/status");
  assert(typeof settlement.readiness?.realSettlementReady === "boolean", "/api/settlement/status real readiness must be boolean");
  assert(typeof settlement.readiness?.marketplaceIndexingReady === "boolean", "/api/settlement/status marketplace readiness must be boolean");
  if (isLocalBase) {
    assert(settlement.readiness.realSettlementReady === false, "/api/settlement/status must keep real settlement disabled for local defaults");
    assert(settlement.readiness.marketplaceIndexingReady === false, "/api/settlement/status must not claim marketplace indexing for local defaults");
  }

  const preflight = await getJson("/api/settlement/preflight");
  assert(preflight.readiness?.paidSmokeReady === false, "/api/settlement/preflight must not be paid-smoke ready by default");
  assert(preflight.policy?.liveSpendEnabled === false, "/api/settlement/preflight must not enable live spend");

  const spendPolicy = await getJson("/api/policies/spend");
  assert(spendPolicy.readiness?.anyLiveSpendReady === false, "/api/policies/spend must not make live spend ready by default");
  assert(spendPolicy.policies?.agentcashAutoRefill?.ready === false, "/api/policies/spend must keep auto-refill gated");
  assert(
    typeof spendPolicy.policies?.liveProcurement?.controls?.dailyRemainingUsd === "number",
    "/api/policies/spend must expose remaining daily capacity"
  );

  const bridgeCheckBlocked = await postRaw("/api/payments/bridge-check", {});
  assert(bridgeCheckBlocked.response.status === 403, "/api/payments/bridge-check must require operator authorization");
  assert(bridgeCheckBlocked.body.error?.code === "operator_not_authorized", "/api/payments/bridge-check must block without operator key");

  const completionPlan = await getJson("/api/completion/plan");
  assert(completionPlan.tool === "completion.plan", "/api/completion/plan tool mismatch");
  assert(completionPlan.requirements?.length === 10, "/api/completion/plan must pin 10 requirements");
  assert(
    completionPlan.evidenceRules?.allAuditRequirementsMustBeVerified === true,
    "/api/completion/plan must require every audit requirement"
  );
  assert(completionPlan.safety?.readOnly === true, "/api/completion/plan must be read-only");

  const completion = await getJson("/api/completion/audit");
  assert(completion.goalComplete === false, "/api/completion/audit must not claim full completion while live/manual blockers remain");
  assert(
    completion.requirements?.some((item) => item.id === "unified_spend_policy" && item.status === "verified"),
    "/api/completion/audit must verify unified spend policy"
  );
  assert(
    completion.blockers?.some((item) => item.id === "git_vercel_auto_deploy"),
    "/api/completion/audit must expose Git/Vercel blocker"
  );

  const deploymentPreflightGet = await getJson("/api/deployments/preflight");
  assert(deploymentPreflightGet.tool === "deployment.preflight", "/api/deployments/preflight GET tool mismatch");
  assert(deploymentPreflightGet.safety?.readOnly === true, "/api/deployments/preflight must be read-only");
  assert(deploymentPreflightGet.safety?.mutatesVercel === false, "/api/deployments/preflight must not mutate Vercel");
  assert(deploymentPreflightGet.safety?.mutatesGitHub === false, "/api/deployments/preflight must not mutate GitHub");

  const directoryPackGet = await getJson("/api/directories/submission-pack");
  assert(directoryPackGet.tool === "directories.submission_pack", "/api/directories/submission-pack GET tool mismatch");
  assert(directoryPackGet.safety?.readOnly === true, "/api/directories/submission-pack must be read-only");
  assert(directoryPackGet.safety?.submitsDirectoryForms === false, "/api/directories/submission-pack must not submit forms");
  assert(directoryPackGet.listingCopy?.openapi?.endsWith("/openapi.json"), "/api/directories/submission-pack must include OpenAPI URL");
  assert(
    directoryPackGet.directoryTargets?.some((item) => item.id === "x402_list_com"),
    "/api/directories/submission-pack must include x402 List target"
  );

  const domainPackGet = await getJson("/api/domains/activation-pack");
  assert(domainPackGet.tool === "domains.activation_pack", "/api/domains/activation-pack GET tool mismatch");
  assert(domainPackGet.safety?.readOnly === true, "/api/domains/activation-pack must be read-only");
  assert(domainPackGet.safety?.buysDomain === false, "/api/domains/activation-pack must not buy domains");
  assert(domainPackGet.availability?.checked === false, "/api/domains/activation-pack must not claim domain availability");

  const unblockGet = await getJson("/api/operator/unblock-report");
  assert(unblockGet.tool === "operator.unblock_report", "/api/operator/unblock-report GET tool mismatch");
  assert(unblockGet.safety?.readOnly === true, "/api/operator/unblock-report must be read-only");
  assert(unblockGet.safety?.sendsPaymentHeaders === false, "/api/operator/unblock-report must not send payment headers");
  assert(
    unblockGet.checks?.some((item) => item.id === "external_x402_directories"),
    "/api/operator/unblock-report must include external directory check"
  );

  const liveWindow = await postJson("/api/live/window-plan", {
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.03,
    includeProof: true
  });
  assert(liveWindow.tool === "live.window_plan", "/api/live/window-plan tool mismatch");
  assert(liveWindow.status === "ready-to-stage", "/api/live/window-plan should produce a safe staging plan");
  assert(liveWindow.vercelEnvPlan?.production?.LIVE_SPENT_TODAY_USD === "0", "/api/live/window-plan must include spent-today env");
  assert(liveWindow.safety?.readOnly === true, "/api/live/window-plan must be read-only");
  assert(liveWindow.safety?.sendsPaymentHeaders === false, "/api/live/window-plan must not send payment headers");

  const directoryPackPost = await postJson("/api/directories/submission-pack", {
    baseUrl,
    userApprovedOutreach: false
  });
  assert(directoryPackPost.tool === "directories.submission_pack", "/api/directories/submission-pack POST tool mismatch");
  assert(directoryPackPost.safety?.includesSecrets === false, "/api/directories/submission-pack POST must not include secrets");
  assert(directoryPackPost.evidenceEnv?.TRUST402_EXTERNAL_DIRECTORY_STATUS === "visible", "/api/directories/submission-pack must expose evidence env");

  const domainPackPost = await postJson("/api/domains/activation-pack", {
    baseUrl,
    selectedDomain: "trust402.dev"
  });
  assert(domainPackPost.tool === "domains.activation_pack", "/api/domains/activation-pack POST tool mismatch");
  assert(domainPackPost.vercelPlan?.envPlan?.PUBLIC_BASE_URL === "https://trust402.dev", "/api/domains/activation-pack must plan PUBLIC_BASE_URL");
  assert(domainPackPost.safety?.mutatesVercel === false, "/api/domains/activation-pack must not mutate Vercel");

  const deploymentPreflightPost = await postJson("/api/deployments/preflight", {
    baseUrl,
    customDomain: "trust402.dev",
    gitRemote: "https://github.com/kfubtik/trust402.git",
    gitHead: "abc1234",
    vercelProject: {
      projectName: "trust402",
      projectId: "prj_smoke",
      orgId: "team_smoke"
    },
    gitAutoDeployVerified: false
  });
  assert(deploymentPreflightPost.tool === "deployment.preflight", "/api/deployments/preflight POST tool mismatch");
  assert(deploymentPreflightPost.domain?.ready === true, "/api/deployments/preflight must accept bare customDomain");
  assert(deploymentPreflightPost.safety?.readsSecretValues === false, "/api/deployments/preflight must not read secret values");

  const unblockPost = await postJson("/api/operator/unblock-report", {
    baseUrl,
    candidatePriceUsd: 0.01,
    proofReserveUsd: 0.01,
    includeProof: true
  });
  assert(unblockPost.tool === "operator.unblock_report", "/api/operator/unblock-report POST tool mismatch");
  assert(unblockPost.safety?.readOnly === true, "/api/operator/unblock-report POST must be read-only");
  assert(unblockPost.safety?.mutatesWallet === false, "/api/operator/unblock-report POST must not mutate wallet");

  const actionPack = await postJson("/api/operator/action-pack", {
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.03,
    includeProof: true
  });
  assert(actionPack.tool === "operator.action_pack", "/api/operator/action-pack tool mismatch");
  assert(actionPack.safety?.readOnly === true, "/api/operator/action-pack must be read-only");
  assert(actionPack.safety?.includesSecretValues === false, "/api/operator/action-pack must not include secret values");
  assert(
    actionPack.actions?.some((item) => item.id === "git_vercel_auto_deploy"),
    "/api/operator/action-pack must include Git/Vercel action"
  );

  const openapi = await getJson("/openapi.json");
  assert(openapi.openapi === "3.1.0", "/openapi.json version mismatch");
  assert(openapi.paths?.["/api/trust/check-x402"]?.post, "/openapi missing check-x402");
  assert(openapi.paths?.["/api/receipts/hash-result"]?.post, "/openapi missing hash-result");
  assert(openapi.paths?.["/api/settlement/status"]?.get, "/openapi missing settlement status");
  assert(openapi.paths?.["/api/settlement/preflight"]?.get, "/openapi missing settlement preflight");
  assert(openapi.paths?.["/api/policies/spend"]?.get, "/openapi missing spend policy");
  assert(openapi.paths?.["/api/payments/bridge-check"]?.post, "/openapi missing payment bridge check");
  assert(openapi.paths?.["/api/completion/plan"]?.get, "/openapi missing completion plan");
  assert(openapi.paths?.["/api/completion/audit"]?.get, "/openapi missing completion audit");
  assert(openapi.paths?.["/api/deployments/preflight"]?.get, "/openapi missing deployment preflight GET");
  assert(openapi.paths?.["/api/deployments/preflight"]?.post, "/openapi missing deployment preflight POST");
  assert(openapi.paths?.["/api/domains/activation-pack"]?.get, "/openapi missing domain activation pack GET");
  assert(openapi.paths?.["/api/domains/activation-pack"]?.post, "/openapi missing domain activation pack POST");
  assert(openapi.paths?.["/api/directories/submission-pack"]?.get, "/openapi missing directory submission pack GET");
  assert(openapi.paths?.["/api/directories/submission-pack"]?.post, "/openapi missing directory submission pack POST");
  assert(openapi.paths?.["/api/live/window-plan"]?.post, "/openapi missing live window plan");
  assert(openapi.paths?.["/api/operator/unblock-report"]?.get, "/openapi missing operator unblock report GET");
  assert(openapi.paths?.["/api/operator/unblock-report"]?.post, "/openapi missing operator unblock report POST");
  assert(openapi.paths?.["/api/operator/action-pack"]?.post, "/openapi missing operator action pack");
  assert(openapi.paths?.["/api/jobs/autonomous-run"]?.post, "/openapi missing autonomous run");
  assert(openapi.paths?.["/api/monitor/snapshot"]?.post, "/openapi missing monitor snapshot");

  const autonomous = await postJson("/api/jobs/autonomous-run", {
    mode: "dry-run",
    goal: "Run a safe autonomous smoke job.",
    budgetUsd: 0.25,
    maxPaidCalls: 1,
    includeProofPreview: true,
    candidates: [
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
    ]
  });
  assert(autonomous.mode === "dry-run", "/api/jobs/autonomous-run must default to dry-run");
  assert(autonomous.quote?.quote?.selectedResources?.length === 1, "/api/jobs/autonomous-run must select a qualified dry-run resource");
  assert(autonomous.execution?.paidSubcallsMade === 0, "/api/jobs/autonomous-run dry-run must not make paid subcalls");

  const refill = await postJson("/api/agentcash/refill-check", {
    mode: "dry-run",
    currentBalanceUsd: 0.42,
    amountRefilledTodayUsd: 0
  });
  assert(refill.mode === "dry-run", "/api/agentcash/refill-check must run in dry-run mode");
  assert(refill.decision?.action === "refill", "/api/agentcash/refill-check must plan refill below threshold");
  assert(refill.safety?.mutatesWalletBalance === false, "/api/agentcash/refill-check dry-run must not mutate wallet balance");

  const realProtectedRoutes = settlement.readiness.realSettlementReady === true;
  if (realProtectedRoutes) {
    await expectPaymentRequired("/api/trust/score-resource", {
      endpoint: "https://example.com/api/paid",
      priceUsd: 0.01,
      has402: true,
      hasInputSchema: true
    });
    console.log(`Trust402 smoke passed for ${baseUrl}`);
    return;
  }

  const score = await postJson("/api/trust/score-resource", {
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
  });
  assert(score.recommendation === "use", "/api/trust/score-resource expected use");

  const plan = await postJson("/api/procurement/plan", {
    goal: "Buy the safest x402 endpoint intelligence resource.",
    budgetUsd: 0.25,
    maxPaidCalls: 5,
    riskTolerance: "low"
  });
  assert(plan.policy?.mode === "plan-only", "/api/procurement/plan must be plan-only");

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
  const quote = await postJson("/api/procurement/quote", {
    goal: "Buy one safe x402 data resource.",
    budgetUsd: 0.5,
    candidates
  });
  assert(quote.approvalPayload?.liveSpendEnabled === false, "/api/procurement/quote must not enable live spend");

  const execute = await postJson("/api/procurement/execute", quote);
  assert(execute.mode === "dry-run", "/api/procurement/execute must stay dry-run");
  assert(execute.paidSubcallsMade === 0, "/api/procurement/execute must not make paid subcalls");

  const receipt = await postJson("/api/receipts/hash-result", {
    subject: "smoke result",
    payload: { recommendation: "use", score: 88 }
  });
  assert(receipt.receiptBundle?.delegation?.paidProofCallMade === false, "/api/receipts/hash-result must not call Proof402");

  const proofPreview = await postJson("/api/receipts/notarize-result", {
    subject: "smoke result",
    resultHash: receipt.resultHash,
    metadata: { taskId: "smoke" }
  });
  assert(proofPreview.tool === "receipts.notarize_result", "/api/receipts/notarize-result tool mismatch");
  assert(proofPreview.delegation?.paidProofCallMade === false, "/api/receipts/notarize-result must not make paid Proof402 calls");

  const snapshot = await postJson("/api/monitor/snapshot", {
    endpoint: `${baseUrl}/api/trust/score-resource`,
    method: "POST",
    expectedStatus: 402
  });
  assert(snapshot.policy?.storesHistory === false, "/api/monitor/snapshot must not store history");

  const badge = await postJson("/api/monitor/badge", { snapshot });
  assert(badge.policy?.paidSubcallsMade === 0, "/api/monitor/badge must not make paid subcalls");

  console.log(`Trust402 smoke passed for ${baseUrl}`);
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return parseJson(response, path);
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  assert(response.ok, `${path} returned HTTP ${response.status}: ${body}`);
  return body;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseJson(response, path);
}

async function postRaw(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type") || "";
  const parsed = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body: parsed };
}

async function expectPaymentRequired(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  assert(response.status === 402, `${path} expected HTTP 402 in real protected mode, got ${response.status}: ${text}`);
  assert(response.headers.get("payment-required"), `${path} expected PAYMENT-REQUIRED header in real protected mode`);
}

async function parseJson(response, path) {
  const body = await response.json();
  assert(response.ok, `${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
