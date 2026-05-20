import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { openApiSpec, x402WellKnown } from "../src/openapi.js";
import { spendPolicyStatus } from "../src/policies.js";
import { completionAudit } from "../src/completionAudit.js";
import { completionPlan } from "../src/completionPlan.js";
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
const liveEvidenceSmokeScript = readFileSync("scripts/live-evidence-smoke.js", "utf8");
const configSource = readFileSync("src/config.js", "utf8");
const policySource = readFileSync("src/policies.js", "utf8");
const localAgentcashPolicySource = readFileSync("src/localAgentcashPolicy.js", "utf8");
const liveEvidenceSmokeSource = readFileSync("src/liveEvidenceSmoke.js", "utf8");
const proof402ClientSource = readFileSync("src/proof402Client.js", "utf8");
const liveWindowPlanSource = readFileSync("src/liveWindowPlan.js", "utf8");
const launchMonitorScript = readFileSync("scripts/launch-monitor.js", "utf8");
const finalVerificationScript = readFileSync("scripts/final-verification.js", "utf8");
const operatorActionPackScript = readFileSync("scripts/operator-action-pack.js", "utf8");
const operatorReadinessScript = readFileSync("scripts/operator-readiness.js", "utf8");
const operatorUnblockCheckScript = readFileSync("scripts/operator-unblock-check.js", "utf8");
const githubActionsSetupScript = readFileSync("scripts/github-actions-setup-pack.js", "utf8");
const openapi = openApiSpec();
const wellKnown = x402WellKnown();
const checklist = launchChecklist();
const bundle = marketplaceBundle();
const spendPolicy = spendPolicyStatus();
const plan = completionPlan();
const completion = completionAudit();

assert(packageJson.name === "trust402", "package name must be trust402");
assert(packageJson.private === false, "package private must be false before GitHub release");
assert(packageJson.license === "MIT", "package license must be MIT");
assert(packageJson.main === "src/server.js", "package main must point at src/server.js for Vercel entrypoint inference");
assert(packageJson.scripts?.test, "package must expose npm test");
assert(packageJson.scripts?.doctor, "package must expose npm run doctor");
assert(packageJson.scripts?.["env:doctor"], "package must expose npm run env:doctor");
assert(packageJson.scripts?.["bazaar:indexing:check"], "package must expose npm run bazaar:indexing:check");
assert(packageJson.scripts?.["bazaar:indexing:check:all"], "package must expose npm run bazaar:indexing:check:all");
assert(packageJson.scripts?.["directories:check"], "package must expose npm run directories:check");
assert(packageJson.scripts?.["launch:monitor"], "package must expose npm run launch:monitor");
assert(packageJson.scripts?.["live:evidence-smoke"], "package must expose npm run live:evidence-smoke");
assert(packageJson.scripts?.["live:smoke-window"], "package must expose npm run live:smoke-window");
assert(packageJson.scripts?.["live:window-plan"], "package must expose npm run live:window-plan");
assert(packageJson.scripts?.["marketplace:bundle"], "package must expose npm run marketplace:bundle");
assert(packageJson.scripts?.["agentcash:mcp-observation"], "package must expose npm run agentcash:mcp-observation");
assert(packageJson.scripts?.["payment:bridge-check"], "package must expose npm run payment:bridge-check");
assert(packageJson.scripts?.["payment:buyer-preflight"], "package must expose npm run payment:buyer-preflight");
assert(packageJson.scripts?.["proof402:preflight"], "package must expose npm run proof402:preflight");
assert(packageJson.scripts?.["agentcash:policy"], "package must expose npm run agentcash:policy");
assert(packageJson.scripts?.["agentcash:refill-check"], "package must expose npm run agentcash:refill-check");
assert(packageJson.scripts?.["completion:audit"], "package must expose npm run completion:audit");
assert(packageJson.scripts?.["completion:unblockers"], "package must expose npm run completion:unblockers");
assert(packageJson.scripts?.["operator:unblock-report"], "package must expose npm run operator:unblock-report");
assert(packageJson.scripts?.["operator:readiness"], "package must expose npm run operator:readiness");
assert(packageJson.scripts?.["completion:actions"], "package must expose npm run completion:actions");
assert(packageJson.scripts?.["deployment:preflight"], "package must expose npm run deployment:preflight");
assert(packageJson.scripts?.["deployment:github-actions-setup"], "package must expose npm run deployment:github-actions-setup");
assert(packageJson.scripts?.["domains:activation-pack"], "package must expose npm run domains:activation-pack");
assert(packageJson.scripts?.["domains:readiness-check"], "package must expose npm run domains:readiness-check");
assert(packageJson.scripts?.["directories:submission-pack"], "package must expose npm run directories:submission-pack");
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
assert(existsSync("src/resourceDiscovery.js"), "resource discovery module must exist");
assert(existsSync("src/agentcashRefill.js"), "AgentCash refill workflow module must exist");
assert(existsSync("src/agentcashPolicyGuard.js"), "AgentCash policy guard module must exist");
assert(existsSync("src/agentcashMcpObservation.js"), "AgentCash MCP observation guard module must exist");
assert(existsSync("src/evidenceLedger.js"), "evidence ledger module must exist");
assert(existsSync("src/localAgentcashPolicy.js"), "local AgentCash policy guard module must exist");
assert(existsSync("src/liveSmokeWindow.js"), "live smoke window module must exist");
assert(existsSync("src/liveWindowPlan.js"), "live window planning module must exist");
assert(existsSync("src/operatorActionPack.js"), "operator action pack module must exist");
assert(existsSync("src/operatorReadiness.js"), "operator readiness module must exist");
assert(existsSync("src/operatorUnblockReport.js"), "operator unblock report module must exist");
assert(existsSync("src/deploymentPreflight.js"), "deployment preflight module must exist");
assert(existsSync("src/githubActionsSetupPack.js"), "GitHub Actions setup pack module must exist");
assert(existsSync("src/completionAudit.js"), "completion audit module must exist");
assert(existsSync("src/completionPlan.js"), "completion plan module must exist");
assert(existsSync("src/domainActivationPack.js"), "domain activation pack module must exist");
assert(existsSync("src/domainReadinessCheck.js"), "domain readiness check module must exist");
assert(existsSync("src/directorySubmissionPack.js"), "directory submission pack module must exist");
assert(existsSync("src/paymentAdapters.js"), "payment adapter module must exist");
assert(existsSync("src/paymentBridgeCheck.js"), "payment bridge check module must exist");
assert(existsSync("src/paymentBuyerPreflight.js"), "CDP buyer preflight module must exist");
assert(existsSync("src/proof402Preflight.js"), "Proof402 paid preflight module must exist");
assert(existsSync("src/policies.js"), "spend policy status module must exist");
assert(existsSync("compose.yaml"), "compose.yaml must exist");
assert(existsSync("docs/deployment.md"), "deployment docs must exist");
assert(existsSync("docs/bazaar-indexing.md"), "Bazaar indexing runbook must exist");
assert(existsSync("docs/external-marketplace-listing.md"), "external marketplace listing pack must exist");
assert(existsSync("docs/github-release-checklist.md"), "GitHub release checklist must exist");
assert(existsSync("docs/launch-issues.md"), "launch issue mirror must exist");
assert(existsSync("docs/autonomous-completion-plan.md"), "autonomous completion plan must exist");
assert(existsSync("examples/x402-diligence.json"), "x402 diligence example must exist");
assert(existsSync("examples/proof402-preflight.json"), "Proof402 preflight example must exist");
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
assert(existsSync("scripts/env-doctor.js"), "env doctor script must exist");
assert(existsSync("scripts/check-agentcash-policy.js"), "AgentCash policy check script must exist");
assert(existsSync("scripts/agentcash-mcp-observation.js"), "AgentCash MCP observation script must exist");
assert(existsSync("scripts/agentcash-refill-check.js"), "AgentCash refill check script must exist");
assert(existsSync("scripts/completion-audit.js"), "completion audit script must exist");
assert(existsSync("scripts/operator-unblock-check.js"), "operator unblock check script must exist");
assert(existsSync("scripts/operator-action-pack.js"), "operator action pack script must exist");
assert(existsSync("scripts/operator-readiness.js"), "operator readiness script must exist");
assert(existsSync("scripts/deployment-preflight.js"), "deployment preflight script must exist");
assert(existsSync("scripts/github-actions-setup-pack.js"), "GitHub Actions setup pack script must exist");
assert(existsSync("scripts/domain-activation-pack.js"), "domain activation pack script must exist");
assert(existsSync("scripts/domain-readiness-check.js"), "domain readiness check script must exist");
assert(existsSync("scripts/directory-submission-pack.js"), "directory submission pack script must exist");
assert(existsSync("scripts/final-verification.js"), "final verification script must exist");
assert(existsSync("scripts/live-evidence-smoke.js"), "live evidence smoke script must exist");
assert(existsSync("scripts/live-smoke-window.js"), "live smoke window script must exist");
assert(existsSync("scripts/live-window-plan.js"), "live window plan script must exist");
assert(existsSync("scripts/payment-bridge-check.js"), "payment bridge check script must exist");
assert(existsSync("scripts/payment-buyer-preflight.js"), "CDP buyer preflight script must exist");
assert(existsSync("scripts/proof402-preflight.js"), "Proof402 paid preflight script must exist");
assert(readFileSync("src/liveEvidenceSmoke.js", "utf8").includes("evaluateLocalAgentcashPolicyForLive"), "live evidence smoke must enforce local AgentCash policy before live mode");
assert(readFileSync("src/liveEvidenceSmoke.js", "utf8").includes("appendEvidenceLedger"), "live evidence smoke must support local public-safe evidence ledger writes");
assert(readFileSync("src/liveEvidenceSmoke.js", "utf8").includes("payment_bridge_preflight"), "live evidence smoke must require payment bridge preflight before bridge-backed live spend");
assert(localAgentcashPolicySource.includes("local_candidate_origin_not_allowed"), "local AgentCash policy must block downstream paid origins that are not allowlisted");
assert(readFileSync("src/agentcashPolicyGuard.js", "utf8").includes("live-window"), "AgentCash policy guard must validate approved live smoke windows");
assert(readFileSync("scripts/check-agentcash-policy.js", "utf8").includes("evaluateAgentcashPolicyGuard"), "AgentCash policy check CLI must use the reusable guard");
assert(readFileSync("scripts/agentcash-refill-check.js", "utf8").includes("policyMode"), "AgentCash refill check CLI must support explicit local policy guard modes");
assert(liveEvidenceSmokeSource.includes("candidateEndpoint: candidate.endpoint"), "live evidence smoke must pass downstream paid endpoint origin into local AgentCash policy evaluation");
assert(readFileSync("src/operatorUnblockReport.js", "utf8").includes("candidateEndpoint,"), "operator unblock report must include downstream paid endpoint in local AgentCash readiness checks");
assert(readFileSync("src/liveSmokeWindow.js", "utf8").includes("restoredAfterRun"), "live smoke window must restore local policy after approved runs");
assert(proof402ClientSource.includes("links?.proof"), "Proof402 client must capture Proof402 links.proof from paid responses");
assert(proof402ClientSource.includes("proof402_hash_mismatch"), "Proof402 client must reject paid responses with mismatched content hashes");
assert(liveWindowPlanSource.includes("writesLocalPolicy: false"), "live window plan must stay read-only");
assert(liveWindowPlanSource.includes("LIVE_SPENT_TODAY_USD"), "live window plan must include spent-today tracking");
assert(liveWindowPlanSource.includes("proof402PreflightCommand"), "live window plan must include Proof402 paid preflight command");
assert(configSource.includes("liveSpentTodayUsd"), "config must expose LIVE_SPENT_TODAY_USD");
assert(policySource.includes("dailyRemainingUsd"), "spend policy must expose remaining daily capacity");
assert(existsSync("scripts/launch-monitor.js"), "production launch monitor script must exist");
assert(liveEvidenceSmokeScript.includes("writeEvidenceLedger"), "live evidence smoke CLI must expose evidence ledger write option");
assert(smokeScript.includes("/api/jobs/autonomous-run"), "smoke script must cover autonomous job dry-run");
assert(smokeScript.includes("/api/agentcash/refill-check"), "smoke script must cover AgentCash refill dry-run");
assert(smokeScript.includes("/api/agentcash/mcp-observation"), "smoke script must cover AgentCash MCP observation guard");
assert(smokeScript.includes("/api/payments/bridge-check"), "smoke script must cover payment bridge authorization gate");
assert(smokeScript.includes("/api/payments/buyer-preflight"), "smoke script must cover CDP buyer preflight");
assert(smokeScript.includes("/api/proof402/preflight"), "smoke script must cover Proof402 paid preflight");
assert(smokeScript.includes("/api/completion/plan"), "smoke script must cover completion plan");
assert(smokeScript.includes("/api/completion/audit"), "smoke script must cover completion audit");
assert(smokeScript.includes("/api/deployments/preflight"), "smoke script must cover deployment preflight API");
assert(smokeScript.includes("/api/deployments/github-actions-setup"), "smoke script must cover GitHub Actions setup pack API");
assert(smokeScript.includes("/api/domains/activation-pack"), "smoke script must cover domain activation pack");
assert(smokeScript.includes("/api/directories/submission-pack"), "smoke script must cover directory submission pack");
assert(smokeScript.includes("/api/live/window-plan"), "smoke script must cover live window plan");
assert(smokeScript.includes("/api/operator/unblock-report"), "smoke script must cover operator unblock report");
assert(smokeScript.includes("/api/operator/action-pack"), "smoke script must cover operator action pack");
assert(smokeScript.includes("/api/registries/candidates"), "smoke script must cover registry candidate discovery");
assert(smokeScript.includes("/.well-known/agent.json"), "smoke script must cover agent manifest discovery");
assert(smokeScript.includes("/llms.txt"), "smoke script must cover llms.txt discovery");
assert(smokeScript.includes("/sitemap.xml"), "smoke script must cover sitemap discovery");
assert(launchMonitorScript.includes("/api/policies/spend"), "launch monitor must check spend policy");
assert(launchMonitorScript.includes("childTimeoutMs"), "launch monitor must cap child directory/indexing checks");
assert(launchMonitorScript.includes('status: "script-timeout"'), "launch monitor must report child script timeouts");
assert(workflow.includes("npm audit --omit=dev --audit-level=high"), "CI must run high-severity npm audit");
assert(workflow.includes("docker build -t trust402:test ."), "CI must build the Docker image");
assert(workflow.includes("docker compose config"), "CI must validate docker compose config");
assert(workflow.includes("npm run smoke -- http://127.0.0.1:4032"), "CI must smoke test the Docker image");
assert(workflow.includes("npm run smoke:x402 -- http://127.0.0.1:4036"), "CI must smoke test mock x402 challenge");
assert(launchMonitorWorkflow.includes("workflow_dispatch"), "launch monitor workflow must be manual");
assert(launchMonitorWorkflow.includes("npm run launch:monitor"), "launch monitor workflow must run npm run launch:monitor");
assert(launchMonitorWorkflow.includes("--strict"), "launch monitor workflow must fail on required production monitor failures");
assert(finalVerificationScript.includes("--strict"), "final verifier must run launch monitor in strict mode");
assert(operatorActionPackScript.includes("/api/operator/action-pack"), "operator action pack CLI must support production API mode");
assert(operatorActionPackScript.includes("args.local"), "operator action pack CLI must preserve explicit local mode");
assert(readFileSync("src/operatorActionPack.js", "utf8").includes("evidenceCollectionPlan"), "operator action pack must aggregate final evidence collection steps");
assert(readFileSync("src/operatorActionPack.js", "utf8").includes("nextBlockingActionId"), "operator action pack must expose the next blocking action");
assert(readFileSync("src/operatorActionPack.js", "utf8").includes("proof402PreflightCommand"), "operator action pack must include Proof402 preflight in evidence collection");
assert(operatorReadinessScript.includes("operatorReadiness"), "operator readiness CLI must call the reusable readiness module");
assert(readFileSync("src/operatorReadiness.js", "utf8").includes("manualInputs"), "operator readiness must expose manual input gates");
assert(readFileSync("src/operatorReadiness.js", "utf8").includes("localEnvDiagnostics"), "operator readiness must include local env diagnostics");
assert(readFileSync("src/autonomousJob.js", "utf8").includes("candidatesForAutonomousRun"), "autonomous job must resolve candidates before quote when none are supplied");
assert(readFileSync("src/resourceDiscovery.js", "utf8").includes("proof402.notarize"), "resource discovery must include Proof402 trusted seed candidate");
assert(operatorUnblockCheckScript.includes("/api/operator/unblock-report"), "operator unblock CLI must support production API mode");
assert(operatorUnblockCheckScript.includes("args.local"), "operator unblock CLI must preserve explicit local mode");
assert(operatorUnblockCheckScript.includes("localAgentcashPolicyProbe"), "operator unblock CLI must include local AgentCash policy probe context");
assert(githubActionsSetupScript.includes(".vercel/project.json"), "GitHub Actions setup CLI must read local Vercel project ids when available");
assert(githubActionsSetupScript.includes("githubActionsSetupPack"), "GitHub Actions setup CLI must use the reusable setup pack");
assert(readFileSync("scripts/domain-activation-pack.js", "utf8").includes("/api/domains/activation-pack"), "domain activation CLI must support production API mode");
assert(readFileSync("scripts/directory-submission-pack.js", "utf8").includes("/api/directories/submission-pack"), "directory submission CLI must support production API mode");
assert(productionDeployWorkflow.includes("branches: [main]"), "production deploy workflow must run on main pushes");
assert(productionDeployWorkflow.includes("VERCEL_TOKEN"), "production deploy workflow must require VERCEL_TOKEN");
assert(productionDeployWorkflow.includes("VERCEL_ORG_ID"), "production deploy workflow must require VERCEL_ORG_ID");
assert(productionDeployWorkflow.includes("VERCEL_PROJECT_ID"), "production deploy workflow must require VERCEL_PROJECT_ID");
assert(productionDeployWorkflow.includes("vercel@latest build --prod"), "production deploy workflow must build production output");
assert(productionDeployWorkflow.includes("vercel@latest deploy --prebuilt --prod"), "production deploy workflow must deploy prebuilt production output");
assert(productionDeployWorkflow.includes("npm run release:check"), "production deploy workflow must run release checks before deploying");
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
assert(autonomousPlan.includes("at least one external directory visibly shows Trust402"), "autonomous plan must require visible external directory evidence");
assert(autonomousPlan.includes("zero remaining manual smoke"), "autonomous plan must record current AgentCash blocker");
assert(autonomousPlan.includes("npm run live:evidence-smoke"), "autonomous plan must document live evidence smoke runner");
assert(autonomousPlan.includes("npm run live:window-plan"), "autonomous plan must document live window planner");
assert(autonomousPlan.includes("--write-evidence"), "autonomous plan must document public-safe evidence ledger writes");
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
  catalog.freeResources.some((resource) => resource.path === "/api/completion/plan"),
  "free completion plan helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/completion/audit"),
  "free completion audit helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/deployments/preflight" && resource.priceUsd === 0),
  "free deployment preflight helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/deployments/github-actions-setup" && resource.priceUsd === 0),
  "free GitHub Actions setup pack helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/domains/activation-pack" && resource.priceUsd === 0),
  "free domain activation pack helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/domains/readiness-check" && resource.priceUsd === 0),
  "free domain readiness check helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/directories/submission-pack" && resource.priceUsd === 0),
  "free directory submission pack helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/procurement/execute" && resource.priceUsd === 0),
  "free dry-run execute helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/live/window-plan" && resource.priceUsd === 0),
  "free live window plan helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/operator/unblock-report" && resource.priceUsd === 0),
  "free operator unblock report helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/operator/action-pack" && resource.priceUsd === 0),
  "free operator action pack helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/jobs/autonomous-run" && resource.priceUsd === 0),
  "free autonomous dry-run helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/registries/candidates" && resource.priceUsd === 0),
  "free registry candidate discovery helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/agentcash/mcp-observation" && resource.priceUsd === 0),
  "free AgentCash MCP observation guard must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/payments/bridge-check" && resource.priceUsd === 0),
  "free operator-gated payment bridge check helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/payments/buyer-preflight" && resource.priceUsd === 0),
  "free CDP buyer preflight helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/proof402/preflight" && resource.priceUsd === 0),
  "free Proof402 paid preflight helper must exist"
);
for (const path of [
  "/.well-known/x402.json",
  "/.well-known/agent.json",
  "/.well-known/agent-services.json",
  "/.well-known/ai-plugin.json",
  "/.well-known/mcp.json",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml"
]) {
  assert(
    catalog.freeResources.some((resource) => resource.path === path && resource.priceUsd === 0),
    `${path} free discovery helper must exist`
  );
}
assert(openapi.paths?.["/api/receipts/hash-result"]?.post, "hash-result helper must be present in OpenAPI");
assert(openapi.paths?.["/api/receipts/notarize-result"]?.post, "notarize-result helper must be present in OpenAPI");
assert(openapi.paths?.["/api/launch/checklist"]?.get, "launch checklist must be present in OpenAPI");
assert(openapi.paths?.["/api/marketplace/bundle"]?.get, "marketplace bundle must be present in OpenAPI");
assert(openapi.paths?.["/api/settlement/status"]?.get, "settlement status must be present in OpenAPI");
assert(openapi.paths?.["/api/settlement/preflight"]?.get, "settlement preflight must be present in OpenAPI");
assert(openapi.paths?.["/api/policies/spend"]?.get, "spend policy status must be present in OpenAPI");
assert(openapi.paths?.["/api/completion/plan"]?.get, "completion plan must be present in OpenAPI");
assert(openapi.paths?.["/api/completion/audit"]?.get, "completion audit must be present in OpenAPI");
assert(openapi.paths?.["/api/deployments/preflight"]?.get, "deployment preflight GET must be present in OpenAPI");
assert(openapi.paths?.["/api/deployments/preflight"]?.post, "deployment preflight POST must be present in OpenAPI");
assert(openapi.paths?.["/api/deployments/github-actions-setup"]?.get, "GitHub Actions setup GET must be present in OpenAPI");
assert(openapi.paths?.["/api/deployments/github-actions-setup"]?.post, "GitHub Actions setup POST must be present in OpenAPI");
assert(openapi.paths?.["/api/domains/activation-pack"]?.get, "domain activation pack GET must be present in OpenAPI");
assert(openapi.paths?.["/api/domains/activation-pack"]?.post, "domain activation pack POST must be present in OpenAPI");
assert(openapi.paths?.["/api/domains/readiness-check"]?.get, "domain readiness check GET must be present in OpenAPI");
assert(openapi.paths?.["/api/domains/readiness-check"]?.post, "domain readiness check POST must be present in OpenAPI");
assert(openapi.paths?.["/api/directories/submission-pack"]?.get, "directory submission pack GET must be present in OpenAPI");
assert(openapi.paths?.["/api/directories/submission-pack"]?.post, "directory submission pack POST must be present in OpenAPI");
assert(openapi.paths?.["/api/live/window-plan"]?.post, "live window plan must be present in OpenAPI");
assert(openapi.paths?.["/api/operator/unblock-report"]?.get, "operator unblock report GET must be present in OpenAPI");
assert(openapi.paths?.["/api/operator/unblock-report"]?.post, "operator unblock report POST must be present in OpenAPI");
assert(openapi.paths?.["/api/operator/action-pack"]?.post, "operator action pack must be present in OpenAPI");
assert(openapi.paths?.["/api/registries/candidates"]?.get, "registry candidates GET must be present in OpenAPI");
assert(openapi.paths?.["/api/registries/candidates"]?.post, "registry candidates POST must be present in OpenAPI");
assert(JSON.stringify(openapi.paths["/api/live/window-plan"]).includes("liveSpentTodayUsd"), "live window plan OpenAPI must expose spent-today input");
assert(openapi.paths?.["/api/jobs/autonomous-run"]?.post, "autonomous job flow must be present in OpenAPI");
assert(openapi.paths?.["/api/agentcash/refill-check"]?.post, "AgentCash refill check must be present in OpenAPI");
assert(openapi.paths?.["/api/agentcash/mcp-observation"]?.post, "AgentCash MCP observation guard must be present in OpenAPI");
assert(openapi.paths?.["/api/payments/bridge-check"]?.post, "payment bridge check must be present in OpenAPI");
assert(openapi.paths?.["/api/payments/buyer-preflight"]?.post, "CDP buyer preflight must be present in OpenAPI");
assert(openapi.paths?.["/api/proof402/preflight"]?.post, "Proof402 paid preflight must be present in OpenAPI");
assert(openapi.paths?.["/.well-known/x402.json"]?.get, "x402 JSON alias must be present in OpenAPI");
assert(openapi.paths?.["/.well-known/agent.json"]?.get, "agent manifest must be present in OpenAPI");
assert(openapi.paths?.["/.well-known/agent-services.json"]?.get, "agent services manifest must be present in OpenAPI");
assert(openapi.paths?.["/.well-known/ai-plugin.json"]?.get, "ai-plugin manifest must be present in OpenAPI");
assert(openapi.paths?.["/.well-known/mcp.json"]?.get, "MCP manifest must be present in OpenAPI");
assert(openapi.paths?.["/llms.txt"]?.get, "llms.txt must be present in OpenAPI");
assert(openapi.paths?.["/robots.txt"]?.get, "robots.txt must be present in OpenAPI");
assert(openapi.paths?.["/sitemap.xml"]?.get, "sitemap.xml must be present in OpenAPI");
assert(
  openapi.paths["/api/trust/compare-resources"].post.requestBody.content["application/json"].schema.properties.candidates.items.properties.endpoint.format === "uri",
  "compare-resources OpenAPI must expose structured candidate endpoint schema"
);
assert(
  openapi.paths["/api/trust/compare-resources"].post.requestBody.content["application/json"].schema.properties.candidates.items.properties.receiptReady.type === "boolean",
  "compare-resources OpenAPI must expose candidate receipt readiness schema"
);
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
assert(plan.requirements.length === 10, "completion plan must pin 10 requirements");
assert(plan.evidenceRules.allAuditRequirementsMustBeVerified === true, "completion plan must require all audit requirements");
assert(plan.safety.readOnly === true, "completion plan must stay read-only");
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
  completion.blockers.some((item) => item.id === "external_x402_directories"),
  "completion audit must expose visible external directory blocker"
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
  !openapi.paths["/api/live/window-plan"].post["x-payment-info"],
  "live window plan helper must not require payment"
);
assert(
  !openapi.paths["/api/deployments/preflight"].post["x-payment-info"],
  "deployment preflight helper must not require payment"
);
assert(
  !openapi.paths["/api/deployments/github-actions-setup"].post["x-payment-info"],
  "GitHub Actions setup pack helper must not require payment"
);
assert(
  !openapi.paths["/api/domains/activation-pack"].post["x-payment-info"],
  "domain activation pack helper must not require payment"
);
assert(
  !openapi.paths["/api/domains/readiness-check"].post["x-payment-info"],
  "domain readiness check helper must not require payment"
);
assert(
  !openapi.paths["/api/directories/submission-pack"].post["x-payment-info"],
  "directory submission pack helper must not require payment"
);
assert(
  !openapi.paths["/api/operator/unblock-report"].post["x-payment-info"],
  "operator unblock report helper must not require payment"
);
assert(
  !openapi.paths["/api/operator/action-pack"].post["x-payment-info"],
  "operator action pack helper must not require payment"
);
assert(
  !openapi.paths["/api/registries/candidates"].post["x-payment-info"],
  "registry candidate discovery helper must not require payment"
);
assert(
  !openapi.paths["/api/jobs/autonomous-run"].post["x-payment-info"],
  "autonomous dry-run helper must not require payment"
);
assert(
  !openapi.paths["/api/agentcash/refill-check"].post["x-payment-info"],
  "AgentCash refill dry-run helper must not require payment"
);
assert(
  !openapi.paths["/api/agentcash/mcp-observation"].post["x-payment-info"],
  "AgentCash MCP observation guard must not require payment"
);
assert(
  !openapi.paths["/api/payments/bridge-check"].post["x-payment-info"],
  "payment bridge check helper must not require payment"
);
assert(
  !openapi.paths["/api/payments/buyer-preflight"].post["x-payment-info"],
  "CDP buyer preflight helper must not require payment"
);
assert(
  !openapi.paths["/api/proof402/preflight"].post["x-payment-info"],
  "Proof402 paid preflight helper must not require payment"
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

assert(wellKnown.resources.length === catalog.paidLaunchResources.length, ".well-known/x402 must expose each paid launch resource as a URL");
assert(wellKnown.endpoints.length === catalog.paidLaunchResources.length, ".well-known/x402 must expose endpoint metadata for each paid launch resource");
assert(wellKnown.resources.every((entry) => entry.startsWith("http")), ".well-known/x402 resources must be absolute URLs");
assert(wellKnown.resources.every((entry) => !entry.startsWith("POST ")), ".well-known/x402 resources must not include method prefixes");
assert(wellKnown.endpoints.every((entry) => entry.accepts?.[0]?.network), ".well-known/x402 endpoints must include payment accept metadata");

for (const resource of catalog.laterResourcesToPreserve) {
  assert(resource.status !== "launch-mvp", `${resource.id} later resource must not be launch-mvp`);
}

run("node", ["scripts/privacy-check.js"]);
run("node", ["scripts/check-agentcash-policy.js"]);
run("node", ["scripts/agentcash-refill-check.js", "--balance", "1.00"]);
run("node", ["scripts/agentcash-mcp-observation.js"]);
run("node", ["scripts/payment-bridge-check.js"]);
run("node", ["scripts/payment-buyer-preflight.js"]);
run("node", ["scripts/proof402-preflight.js", "--result-hash", "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "--approved-hash", "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "--price-usd", "0.005"]);
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
