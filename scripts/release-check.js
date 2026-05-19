import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { openApiSpec, x402WellKnown } from "../src/openapi.js";
import { spendPolicyStatus } from "../src/policies.js";
import { completionAudit } from "../src/completionAudit.js";
import { launchChecklist } from "../src/readiness.js";
import { marketplaceBundle } from "../src/marketplace.js";

const catalog = JSON.parse(readFileSync("marketplace/resources.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const workflow = readFileSync(".github/workflows/test.yml", "utf8");
const launchMonitorWorkflow = readFileSync(".github/workflows/launch-monitor.yml", "utf8");
const productionDeployWorkflow = readFileSync(".github/workflows/vercel-production-deploy.yml", "utf8");
const dependabot = readFileSync(".github/dependabot.yml", "utf8");
const launchIssues = readFileSync("docs/launch-issues.md", "utf8");
const autonomousPlan = readFileSync("docs/autonomous-completion-plan.md", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");
const compose = readFileSync("compose.yaml", "utf8");
const vercelConfig = readFileSync("vercel.json", "utf8");
const vercelIgnore = readFileSync(".vercelignore", "utf8");
const apiIndex = readFileSync("api/index.js", "utf8");
const serverSource = readFileSync("src/server.js", "utf8");
const smokeScript = readFileSync("scripts/smoke.js", "utf8");
const launchMonitorScript = readFileSync("scripts/launch-monitor.js", "utf8");
const openapi = openApiSpec();
const wellKnown = x402WellKnown();
const checklist = launchChecklist();
const bundle = marketplaceBundle();
const spendPolicy = spendPolicyStatus();
const completion = completionAudit();

assert(packageJson.name === "trust402", "package name must be trust402");
assert(packageJson.private === false, "package private must be false before GitHub release");
assert(packageJson.license === "MIT", "package license must be MIT");
assert(packageJson.main === "src/server.js", "package main must point at src/server.js for Vercel entrypoint inference");
assert(packageJson.scripts?.test, "package must expose npm test");
assert(packageJson.scripts?.doctor, "package must expose npm run doctor");
assert(packageJson.scripts?.["bazaar:indexing:check"], "package must expose npm run bazaar:indexing:check");
assert(packageJson.scripts?.["bazaar:indexing:check:all"], "package must expose npm run bazaar:indexing:check:all");
assert(packageJson.scripts?.["directories:check"], "package must expose npm run directories:check");
assert(packageJson.scripts?.["launch:monitor"], "package must expose npm run launch:monitor");
assert(packageJson.scripts?.["marketplace:bundle"], "package must expose npm run marketplace:bundle");
assert(packageJson.scripts?.["agentcash:policy"], "package must expose npm run agentcash:policy");
assert(packageJson.scripts?.["agentcash:refill-check"], "package must expose npm run agentcash:refill-check");
assert(packageJson.scripts?.["completion:audit"], "package must expose npm run completion:audit");
assert(packageJson.scripts?.["final:verify"], "package must expose npm run final:verify");
assert(packageJson.scripts?.["privacy:check"], "package must expose npm run privacy:check");
assert(packageJson.scripts?.["release:check"], "package must expose npm run release:check");
assert(packageJson.scripts?.["settlement:preflight"], "package must expose npm run settlement:preflight");
assert(packageJson.scripts?.["settlement:check"], "package must expose npm run settlement:check");
assert(packageJson.scripts?.["smoke:x402"], "package must expose npm run smoke:x402");
assert(packageJson.dependencies?.["@x402/express"], "package must include @x402/express dependency");
assert(packageJson.dependencies?.["@x402/core"], "package must include @x402/core dependency");
assert(packageJson.dependencies?.["@x402/evm"], "package must include @x402/evm dependency");
assert(packageJson.dependencies?.["@x402/fetch"], "package must include @x402/fetch dependency for buyer-side live payment adapter");
assert(packageJson.dependencies?.["@coinbase/x402"], "package must include @coinbase/x402 dependency");
assert(packageJson.dependencies?.viem, "package must include viem dependency for x402 buyer signing adapter");
assert(existsSync("package-lock.json"), "package-lock.json must exist for reproducible installs");
assert(Array.isArray(packageJson.keywords) && packageJson.keywords.includes("x402"), "package keywords must include x402");
assert(existsSync("README.md"), "README.md must exist");
assert(existsSync("SECURITY.md"), "SECURITY.md must exist");
assert(existsSync("LICENSE"), "LICENSE must exist");
assert(existsSync("Dockerfile"), "Dockerfile must exist");
assert(existsSync(".dockerignore"), ".dockerignore must exist");
assert(existsSync(".vercelignore"), ".vercelignore must exist");
assert(existsSync(".github/dependabot.yml"), "Dependabot config must exist");
assert(existsSync(".github/workflows/launch-monitor.yml"), "launch monitor workflow must exist");
assert(existsSync(".github/workflows/vercel-production-deploy.yml"), "Vercel production deploy workflow must exist");
assert(existsSync("vercel.json"), "vercel.json must exist");
assert(existsSync("api/index.js"), "Vercel API handler must exist");
assert(existsSync("src/expressApp.js"), "Express x402 entrypoint bridge must exist");
assert(existsSync("src/autonomousJob.js"), "autonomous job flow module must exist");
assert(existsSync("src/agentcashRefill.js"), "AgentCash refill workflow module must exist");
assert(existsSync("src/completionAudit.js"), "completion audit module must exist");
assert(existsSync("src/paymentAdapters.js"), "payment adapter module must exist");
assert(existsSync("src/policies.js"), "spend policy status module must exist");
assert(existsSync("compose.yaml"), "compose.yaml must exist");
assert(existsSync("docs/deployment.md"), "deployment docs must exist");
assert(existsSync("docs/bazaar-indexing.md"), "Bazaar indexing runbook must exist");
assert(existsSync("docs/external-marketplace-listing.md"), "external marketplace listing pack must exist");
assert(existsSync("docs/github-release-checklist.md"), "GitHub release checklist must exist");
assert(existsSync("docs/launch-issues.md"), "launch issue mirror must exist");
assert(existsSync("docs/autonomous-completion-plan.md"), "autonomous completion plan must exist");
assert(existsSync("examples/x402-diligence.json"), "x402 diligence example must exist");
assert(dockerfile.includes("HEALTHCHECK"), "Dockerfile must expose a healthcheck");
assert(dockerfile.includes("npm ci --omit=dev"), "Dockerfile must install production dependencies");
assert(compose.includes("TRUST402_MODE: dry-run"), "compose must keep Trust402 in dry-run mode");
assert(compose.includes("TRUST402_REAL_SETTLEMENT_ENABLED: \"false\""), "compose must keep real settlement disabled");
assert(compose.includes("PROOF402_DELEGATION_MODE: disabled"), "compose must keep Proof402 delegation disabled");
assert(vercelConfig.includes("/api/index.js"), "Vercel config must route traffic to api/index.js");
assert(vercelIgnore.includes(".env"), "Vercel ignore must exclude local env files");
assert(vercelIgnore.includes(".agentcash"), "Vercel ignore must exclude AgentCash material");
assert(apiIndex.includes("createTrust402ExpressApp"), "Vercel API handler must use the Express x402 bridge");
assert(serverSource.includes("createTrust402ExpressApp"), "node start must use the Express bridge in real paywall mode");
assert(serverSource.includes("x-trust402-operator-key"), "server must require an operator key header for live operator actions");
assert(existsSync("scripts/check-external-directories.js"), "external directory check script must exist");
assert(existsSync("scripts/check-agentcash-policy.js"), "AgentCash policy check script must exist");
assert(existsSync("scripts/agentcash-refill-check.js"), "AgentCash refill check script must exist");
assert(existsSync("scripts/completion-audit.js"), "completion audit script must exist");
assert(existsSync("scripts/final-verification.js"), "final verification script must exist");
assert(existsSync("scripts/launch-monitor.js"), "production launch monitor script must exist");
assert(smokeScript.includes("/api/jobs/autonomous-run"), "smoke script must cover autonomous job dry-run");
assert(smokeScript.includes("/api/agentcash/refill-check"), "smoke script must cover AgentCash refill dry-run");
assert(smokeScript.includes("/api/completion/audit"), "smoke script must cover completion audit");
assert(launchMonitorScript.includes("/api/policies/spend"), "launch monitor must check spend policy");
assert(workflow.includes("npm audit --omit=dev --audit-level=high"), "CI must run high-severity npm audit");
assert(workflow.includes("docker build -t trust402:test ."), "CI must build the Docker image");
assert(workflow.includes("docker compose config"), "CI must validate docker compose config");
assert(workflow.includes("npm run smoke -- http://127.0.0.1:4032"), "CI must smoke test the Docker image");
assert(workflow.includes("npm run smoke:x402 -- http://127.0.0.1:4036"), "CI must smoke test mock x402 challenge");
assert(launchMonitorWorkflow.includes("workflow_dispatch"), "launch monitor workflow must be manual");
assert(launchMonitorWorkflow.includes("npm run launch:monitor"), "launch monitor workflow must run npm run launch:monitor");
assert(launchMonitorWorkflow.includes("--strict"), "launch monitor workflow must fail on required production monitor failures");
assert(productionDeployWorkflow.includes("branches: [main]"), "production deploy workflow must run on main pushes");
assert(productionDeployWorkflow.includes("VERCEL_TOKEN"), "production deploy workflow must require VERCEL_TOKEN");
assert(productionDeployWorkflow.includes("VERCEL_ORG_ID"), "production deploy workflow must require VERCEL_ORG_ID");
assert(productionDeployWorkflow.includes("VERCEL_PROJECT_ID"), "production deploy workflow must require VERCEL_PROJECT_ID");
assert(productionDeployWorkflow.includes("vercel@latest build --prod"), "production deploy workflow must build production output");
assert(productionDeployWorkflow.includes("vercel@latest deploy --prebuilt --prod"), "production deploy workflow must deploy prebuilt production output");
assert(productionDeployWorkflow.includes("npm run smoke:x402 -- https://trust402.vercel.app"), "production deploy workflow must run production x402 smoke");
assert(productionDeployWorkflow.includes("npm run launch:monitor -- https://trust402.vercel.app"), "production deploy workflow must run production launch monitor");
assert(dependabot.includes("package-ecosystem: npm"), "Dependabot must monitor npm dependencies");
assert(dependabot.includes("package-ecosystem: github-actions"), "Dependabot must monitor GitHub Actions");
assert(launchIssues.includes("https://github.com/kfubtik/trust402/issues/5"), "launch issues must track Vercel Git auto-deploy");
assert(launchIssues.includes("https://github.com/kfubtik/trust402/issues/6"), "launch issues must track external directories");
assert(launchIssues.includes("https://github.com/kfubtik/trust402/issues/7"), "launch issues must track AgentCash auto-refill policy");
assert(launchIssues.includes("https://github.com/kfubtik/trust402/issues/8"), "launch issues must track live procurement policy");
assert(launchIssues.includes("https://github.com/kfubtik/trust402/issues/9"), "launch issues must track paid Proof402 delegation policy");
assert(launchIssues.includes("https://github.com/kfubtik/trust402/issues/10"), "launch issues must track final autonomous completion plan");
assert(launchIssues.includes("AgentCash auto-refill: disabled"), "launch issues must keep AgentCash auto-refill disabled");
assert(launchIssues.includes("Trust402 live procurement: disabled"), "launch issues must keep live procurement disabled");
assert(launchIssues.includes("Paid Proof402 delegation: disabled"), "launch issues must keep paid Proof402 delegation disabled");
assert(autonomousPlan.includes("Final Definition Of Done"), "autonomous plan must define final success criteria");
assert(autonomousPlan.includes("operator authorization"), "autonomous plan must require operator authorization for live execution");
assert(autonomousPlan.includes("emergency stop"), "autonomous plan must include emergency stop criteria");
assert(autonomousPlan.includes("zero remaining manual smoke"), "autonomous plan must record current AgentCash blocker");
assert(catalog.paidLaunchResources.length === 10, "expected 10 paid launch resources");
assert(catalog.status === "production-mvp", "catalog status must reflect production MVP state");
assert(catalog.laterResourcesToPreserve.length >= 2, "expected preserved later resources");
assert(catalog.safety.liveSpendDefault === false, "live spend must default to false");
assert(catalog.safety.storesPrivateKeys === false, "storesPrivateKeys must be false");
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/receipts/hash-result" && resource.priceUsd === 0),
  "free hash-result receipt helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/receipts/notarize-result" && resource.priceUsd === 0),
  "free Proof402 notarize-result helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/settlement/status"),
  "free settlement status helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/settlement/preflight"),
  "free settlement preflight helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/policies/spend"),
  "free spend policy status helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/completion/audit"),
  "free completion audit helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/procurement/execute" && resource.priceUsd === 0),
  "free dry-run execute helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/jobs/autonomous-run" && resource.priceUsd === 0),
  "free autonomous dry-run helper must exist"
);
assert(openapi.paths?.["/api/receipts/hash-result"]?.post, "hash-result helper must be present in OpenAPI");
assert(openapi.paths?.["/api/receipts/notarize-result"]?.post, "notarize-result helper must be present in OpenAPI");
assert(openapi.paths?.["/api/launch/checklist"]?.get, "launch checklist must be present in OpenAPI");
assert(openapi.paths?.["/api/marketplace/bundle"]?.get, "marketplace bundle must be present in OpenAPI");
assert(openapi.paths?.["/api/settlement/status"]?.get, "settlement status must be present in OpenAPI");
assert(openapi.paths?.["/api/settlement/preflight"]?.get, "settlement preflight must be present in OpenAPI");
assert(openapi.paths?.["/api/policies/spend"]?.get, "spend policy status must be present in OpenAPI");
assert(openapi.paths?.["/api/completion/audit"]?.get, "completion audit must be present in OpenAPI");
assert(openapi.paths?.["/api/jobs/autonomous-run"]?.post, "autonomous job flow must be present in OpenAPI");
assert(openapi.paths?.["/api/agentcash/refill-check"]?.post, "AgentCash refill check must be present in OpenAPI");
assert(checklist.readiness.dryRunLaunchReady === true, "dry-run launch checklist must pass");
assert(checklist.readiness.publicMarketplaceReady === false, "public marketplace readiness must remain false for localhost/no-settlement defaults");
assert(checklist.settlement.realSettlementReady === false, "real settlement must remain disabled by default");
assert(bundle.resources.length === catalog.paidLaunchResources.length, "marketplace bundle must cover every paid launch resource");
assert(bundle.listingState.dryRunMetadataReady === true, "marketplace bundle metadata must be dry-run ready");
assert(bundle.listingState.realSettlementReady === false, "marketplace bundle must not claim real settlement readiness by default");
assert(bundle.listingState.cdpBazaarIndexingReady === false, "marketplace bundle must not claim CDP Bazaar indexing readiness");
assert(bundle.indexing?.cdpBazaar?.status === "blocked", "default marketplace bundle must mark CDP Bazaar indexing blocked");
assert(spendPolicy.readiness.anyLiveSpendReady === false, "spend policy status must keep live spend unavailable by default");
assert(spendPolicy.policies.liveProcurement.controls.paymentAdapter, "live procurement policy must expose payment adapter status");
assert(spendPolicy.policies.agentcashAutoRefill.ready === false, "AgentCash auto-refill must not be ready by default");
assert(spendPolicy.policies.liveProcurement.ready === false, "live procurement must not be ready by default");
assert(spendPolicy.policies.proof402Delegation.ready === false, "Proof402 delegation must not be ready by default");
assert(completion.goalComplete === false, "completion audit must not claim full completion by default");
assert(
  completion.goalComplete === completion.requirements.every((item) => item.status === "verified"),
  "completion audit goalComplete must require every requirement to be verified"
);
assert(
  completion.summary.implementedBlocked > 0,
  "completion audit must expose implemented-but-blocked live paths"
);
assert(
  completion.requirements.some((item) => item.id === "unified_spend_policy" && item.status === "verified"),
  "completion audit must verify unified spend policy"
);
assert(
  completion.blockers.some((item) => item.id === "git_vercel_auto_deploy"),
  "completion audit must expose Git/Vercel blocker"
);
assert(
  bundle.resources.every((resource) => resource.metadata?.inputSchema && resource.bazaarExtensionDraft?.bazaar),
  "marketplace bundle resources must include input schemas and Bazaar drafts"
);
assert(
  bundle.resources.every((resource) => resource.listingStatus === "blocked" && resource.listingBlockers.length > 0),
  "default marketplace bundle resources must keep listing blockers"
);
assert(
  !openapi.paths["/api/receipts/hash-result"].post["x-payment-info"],
  "hash-result helper must not require payment"
);
assert(
  !openapi.paths["/api/receipts/notarize-result"].post["x-payment-info"],
  "notarize-result helper must not require payment"
);
assert(openapi.paths?.["/api/procurement/execute"]?.post, "dry-run execute helper must be present in OpenAPI");
assert(
  !openapi.paths["/api/procurement/execute"].post["x-payment-info"],
  "dry-run execute helper must not require payment"
);
assert(
  !openapi.paths["/api/jobs/autonomous-run"].post["x-payment-info"],
  "autonomous dry-run helper must not require payment"
);
assert(
  !openapi.paths["/api/agentcash/refill-check"].post["x-payment-info"],
  "AgentCash refill dry-run helper must not require payment"
);

const ids = new Set();
const paths = new Set();
for (const resource of catalog.paidLaunchResources) {
  assert(!ids.has(resource.id), `${resource.id} id must be unique`);
  assert(!paths.has(resource.path), `${resource.path} path must be unique`);
  ids.add(resource.id);
  paths.add(resource.path);
  assert(resource.method === "POST", `${resource.id} must be POST`);
  assert(resource.path.startsWith("/api/"), `${resource.id} path must start with /api/`);
  assert(resource.status === "launch-mvp", `${resource.id} must be launch-mvp`);
  assert(openapi.paths?.[resource.path]?.post, `${resource.id} must be present in OpenAPI`);
  assert(openapi.paths[resource.path].post["x-payment-info"], `${resource.id} must expose x-payment-info`);
  assert(
    wellKnown.resources.some((entry) => entry.includes(resource.path)),
    `${resource.id} must be present in .well-known/x402`
  );
}

for (const resource of catalog.laterResourcesToPreserve) {
  assert(resource.status !== "launch-mvp", `${resource.id} later resource must not be launch-mvp`);
}

run("node", ["scripts/privacy-check.js"]);
run("node", ["scripts/check-agentcash-policy.js"]);
run("node", ["scripts/agentcash-refill-check.js", "--balance", "1.00"]);
run("node", ["scripts/completion-audit.js"]);
run("node", ["scripts/settlement-check.js"]);
run("node", ["--test", "test"]);

console.log("Trust402 release check passed.");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Release check failed: ${message}`);
    process.exit(1);
  }
}
