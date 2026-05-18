import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { settlementStatus } from "./settlement.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function launchChecklist() {
  const catalog = loadCatalog();
  const paidLaunchResources = catalog.paidLaunchResources || [];
  const freeResources = catalog.freeResources || [];
  const laterResources = catalog.laterResourcesToPreserve || [];
  const publicBase = parseUrl(config.publicBaseUrl);
  const settlement = settlementStatus({ config, catalog });
  const checks = [
    check({
      id: "catalog_paid_launch_resources",
      scope: "dry-run-launch",
      passed: paidLaunchResources.length >= 10,
      pass: "Launch catalog exposes at least 10 paid resources.",
      fail: "Launch catalog needs at least 10 paid resources."
    }),
    check({
      id: "catalog_free_discovery_resources",
      scope: "dry-run-launch",
      passed: freeResources.some((resource) => resource.path === "/openapi.json") &&
        freeResources.some((resource) => resource.path === "/.well-known/x402") &&
        freeResources.some((resource) => resource.path === "/api/status") &&
        freeResources.some((resource) => resource.path === "/api/marketplace/bundle"),
      pass: "Free discovery resources are present.",
      fail: "Free discovery resources are missing."
    }),
    check({
      id: "later_live_resources_preserved",
      scope: "dry-run-launch",
      passed: laterResources.some((resource) => resource.id === "procurement.execute_live") &&
        laterResources.some((resource) => resource.id === "receipts.notarize_result_live"),
      pass: "Live procurement and proof delegation remain preserved for later.",
      fail: "Later live-spend/proof resources are not preserved in the catalog."
    }),
    check({
      id: "dry_run_mode",
      scope: "dry-run-launch",
      passed: config.defaultMode === "dry-run",
      pass: "Default mode is dry-run.",
      fail: "Default mode must stay dry-run for the MVP."
    }),
    check({
      id: "live_spend_disabled",
      scope: "dry-run-launch",
      passed: isLiveSpendDisabled(),
      pass: "Live spend and Proof402 paid delegation are disabled.",
      fail: "Live spend settings must be disabled before launch."
    }),
    check({
      id: "public_base_url_present",
      scope: "dry-run-launch",
      passed: Boolean(publicBase),
      pass: "PUBLIC_BASE_URL is parseable.",
      fail: "PUBLIC_BASE_URL must be a valid URL."
    }),
    check({
      id: "public_base_url_https",
      scope: "public-production",
      passed: publicBase?.protocol === "https:",
      pass: "PUBLIC_BASE_URL uses HTTPS.",
      fail: "Set PUBLIC_BASE_URL to the final HTTPS origin before public marketplace listing."
    }),
    check({
      id: "public_base_url_not_localhost",
      scope: "public-production",
      passed: Boolean(publicBase) && !isLocalHost(publicBase.hostname),
      pass: "PUBLIC_BASE_URL is not localhost.",
      fail: "Replace localhost PUBLIC_BASE_URL before public marketplace listing."
    }),
    check({
      id: "pay_to_configured",
      scope: "public-production",
      passed: isNonZeroPayTo(config.payTo),
      pass: "PAY_TO is configured.",
      fail: "Set PAY_TO before enabling mock payment flow for external clients or real settlement."
    }),
    check({
      id: "real_settlement_disabled",
      scope: "public-production",
      passed: settlement.readiness.realSettlementReady,
      pass: "Real x402 settlement is enabled.",
      fail: "Real x402 settlement is intentionally disabled in this environment."
    }),
    check({
      id: "successful_settlement_observed",
      scope: "public-production",
      passed: settlement.readiness.marketplaceIndexingReady,
      pass: "At least one successful settlement has been observed.",
      fail: "Run and review one successful paid settlement smoke before claiming marketplace indexing readiness."
    })
  ];

  const dryRunChecks = checks.filter((item) => item.scope === "dry-run-launch");
  const productionChecks = checks.filter((item) => item.scope === "public-production");
  const failedChecks = checks.filter((item) => !item.passed);

  return {
    ok: true,
    tool: "launch.checklist",
    generatedAt: new Date().toISOString(),
    readiness: {
      dryRunLaunchReady: dryRunChecks.every((item) => item.passed),
      publicMarketplaceReady: checks.every((item) => item.passed),
      liveSettlementReady: settlement.readiness.realSettlementReady
    },
    environment: {
      serviceName: config.serviceName,
      version: config.version,
      host: config.host,
      port: config.port,
      publicBaseUrl: config.publicBaseUrl,
      mode: config.defaultMode,
      paywallMode: config.paywallMode,
      x402Network: config.x402Network,
      x402Asset: config.x402Asset,
      payToConfigured: isNonZeroPayTo(config.payTo),
      realSettlementEnabled: config.realSettlementEnabled,
      successfulSettlementObserved: config.successfulSettlementObserved,
      facilitatorUrlConfigured: Boolean(config.facilitatorUrl),
      cdpApiKeyIdConfigured: config.cdpApiKeyIdConfigured,
      cdpApiKeySecretConfigured: config.cdpApiKeySecretConfigured,
      cdpWalletSecretConfigured: config.cdpWalletSecretConfigured,
      liveSpendEnabled: config.liveSpendEnabled,
      liveMaxPerCallUsd: config.liveMaxPerCallUsd,
      liveMaxPerJobUsd: config.liveMaxPerJobUsd,
      liveDailyLimitUsd: config.liveDailyLimitUsd,
      liveAllowedRegistriesCount: config.liveAllowedRegistries.length,
      proof402DelegationMode: config.proof402DelegationMode,
      proof402MaxSpendUsd: config.proof402MaxSpendUsd
    },
    settlement: settlement.readiness,
    resources: {
      free: freeResources.length,
      paidLaunch: paidLaunchResources.length,
      preservedLater: laterResources.length
    },
    checks,
    blockers: failedChecks.map((item) => ({
      id: item.id,
      scope: item.scope,
      message: item.message
    })),
    nextActions: nextActions(failedChecks)
  };
}

function check({ id, scope, passed, pass, fail }) {
  return {
    id,
    scope,
    passed: Boolean(passed),
    message: passed ? pass : fail
  };
}

function nextActions(failedChecks) {
  const actions = [];
  const missing = new Set(failedChecks.map((item) => item.id));
  if (missing.has("public_base_url_https") || missing.has("public_base_url_not_localhost")) {
    actions.push("Deploy behind HTTPS and set PUBLIC_BASE_URL to the final public origin.");
  }
  if (missing.has("pay_to_configured")) {
    actions.push("Set PAY_TO to a reviewed receiving wallet before external payment-flow testing.");
  }
  if (missing.has("real_settlement_disabled")) {
    actions.push("Enable real x402 settlement only after wallet policy, allowlists, receipt logs, and paid smoke limits are approved.");
  }
  if (missing.has("successful_settlement_observed")) {
    actions.push("Run one explicit paid settlement smoke, review the receipt, then mark successful settlement observed.");
  }
  if (actions.length === 0) actions.push("Run release check, Docker build, and API smoke before publishing.");
  return actions;
}

function isLiveSpendDisabled() {
  return config.defaultMode === "dry-run" &&
    config.liveSpendEnabled === false &&
    config.proof402DelegationMode === "disabled" &&
    config.proof402MaxSpendUsd === 0;
}

function isNonZeroPayTo(payTo) {
  return /^0x[a-fA-F0-9]{40}$/.test(payTo || "") && payTo.toLowerCase() !== ZERO_ADDRESS;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}
