import test from "node:test";
import assert from "node:assert/strict";
import { operatorReadiness } from "../src/operatorReadiness.js";

test("operatorReadiness combines env, local policy, and action blockers without secrets", () => {
  const report = operatorReadiness({
    baseUrl: "https://trust402.vercel.app",
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    paymentProvider: "cdp-x402",
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: false,
    vercelProjectLinked: true
  }, {
    config: baseConfig(),
    envDiagnostics: envDiagnostics({
      cdpWalletSecret: false,
      cdpAccountName: false,
      bridge: false
    }),
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });

  const paymentRuntime = report.manualInputs.find((item) => item.id === "payment_runtime");

  assert.equal(report.status, "blocked");
  assert.match(report.readinessHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(report.summary.nextBlockingId, "git_vercel_auto_deploy");
  assert.equal(paymentRuntime.status, "blocked-config");
  assert.ok(paymentRuntime.missingNames.includes("CDP_WALLET_SECRET"));
  assert.ok(paymentRuntime.missingNames.includes("CDP_EVM_ACCOUNT_ADDRESS"));
  assert.ok(paymentRuntime.missingNames.includes("CDP_EVM_ACCOUNT_NAME"));
  assert.equal(report.localAgentcashPolicy.ok, false);
  assert.equal(report.safety.includesSecretValues, false);
  assert.equal(JSON.stringify(report).includes("secret-value"), false);
});

test("operatorReadiness can become ready for live evidence once manual gates are proven", () => {
  const report = operatorReadiness({
    baseUrl: "https://trust402.example",
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    paymentProvider: "cdp-x402",
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: true,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      publicBaseUrl: "https://trust402.example",
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "abc1234",
      cdpBazaarAllResourcesIndexed: true,
      cdpBazaarEvidenceRef: "sha256:cdp-bazaar",
      cdpBazaarCheckStatus: "all-indexed",
      cdpBazaarExpectedResources: 10,
      cdpBazaarIndexedResources: 10,
      cdpBazaarMissingResources: [],
      externalDirectoryStatus: "visible",
      externalDirectoryEvidenceUrl: "https://directory.example/trust402",
      externalDirectoryName: "Example Directory",
      liveSpendEnabled: true,
      livePaymentProvider: "cdp-x402",
      liveAllowedRegistries: ["https://proof402.vercel.app"],
      liveMaxPerCallUsd: 0.005,
      liveMaxPerJobUsd: 0.015,
      liveDailyLimitUsd: 0.015,
      operatorApiKey: "configured",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      cdpWalletSecretConfigured: true,
      cdpEvmAccountName: "trust402-buyer",
      proof402DelegationMode: "live",
      proof402MaxSpendUsd: 0.005,
      liveProcurementSmokeObserved: true,
      liveProcurementEvidenceRef: "sha256:procurement",
      proof402PaidSmokeObserved: true,
      proof402EvidenceRef: "sha256:proof402",
      autonomousJobSmokeObserved: true,
      autonomousJobEvidenceRef: "sha256:autonomous",
      finalVerificationObserved: true,
      finalVerificationEvidenceRef: "sha256:final"
    },
    envDiagnostics: envDiagnostics({
      cdpWalletSecret: true,
      cdpAccountName: true,
      bridge: false
    }),
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0.015,
      agentcashGlobalMaxAmountUsd: 0.015,
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "approved-for-manual-smoke"
    })
  });

  assert.equal(report.status, "ready-for-live-evidence-window");
  assert.equal(report.summary.blocked, 0);
  assert.equal(report.manualInputs.every((item) => item.status === "ready" || item.status === "not-required"), true);
});

test("operatorReadiness recommends a concrete payment provider when runtime is disabled", () => {
  const report = operatorReadiness({
    baseUrl: "https://trust402.vercel.app",
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: false,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true
    },
    envDiagnostics: envDiagnostics({
      cdpWalletSecret: false,
      cdpAccountName: false,
      bridge: false
    }),
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });

  const paymentRuntime = report.manualInputs.find((item) => item.id === "payment_runtime");

  assert.equal(report.paymentProvider.configured, "disabled");
  assert.equal(report.paymentProvider.selected, "cdp-x402");
  assert.equal(report.paymentProvider.source, "recommended");
  assert.match(report.paymentProvider.recommendation.reason, /CDP credentials/);
  assert.ok(paymentRuntime.missingNames.includes("CDP_WALLET_SECRET"));
  assert.ok(paymentRuntime.missingNames.includes("CDP_EVM_ACCOUNT_ADDRESS"));
  assert.ok(paymentRuntime.missingNames.includes("CDP_EVM_ACCOUNT_NAME"));
  assert.ok(report.suggestedCommands.some((item) => item.includes("payment:buyer-preflight")));
  assert.equal(report.suggestedCommands.some((item) => item.includes("--provider=disabled")), false);
});

test("operatorReadiness does not list payment env as missing when x402-fetch runtime is ready", () => {
  const report = operatorReadiness({
    baseUrl: "https://trust402.vercel.app",
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    paymentProvider: "x402-fetch",
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: false,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      livePaymentProvider: "x402-fetch",
      x402BuyerPrivateKeyConfigured: true,
      x402BuyerRpcUrl: "https://base.example/rpc"
    },
    envDiagnostics: envDiagnostics({
      cdpWalletSecret: false,
      cdpAccountName: false,
      bridge: false
    }),
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });

  const paymentRuntime = report.manualInputs.find((item) => item.id === "payment_runtime");

  assert.equal(report.paymentProvider.selected, "x402-fetch");
  assert.equal(paymentRuntime.status, "ready");
  assert.deepEqual(paymentRuntime.missingNames, []);
});

function baseConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app",
    gitAutoDeployVerified: false,
    gitAutoDeployEvidenceUrl: "",
    gitAutoDeployCommitSha: "",
    externalDirectoryStatus: "not-visible-yet",
    externalDirectoryEvidenceUrl: "",
    externalDirectoryName: "",
    liveSpendEnabled: false,
    livePaymentProvider: "disabled",
    livePaymentAdapterUrl: "",
    liveAllowedRegistries: [],
    liveMaxPerCallUsd: 0,
    liveMaxPerJobUsd: 0,
    liveDailyLimitUsd: 0,
    liveSpentTodayUsd: 0,
    operatorApiKey: "",
    cdpApiKeyIdConfigured: false,
    cdpApiKeySecretConfigured: false,
    cdpWalletSecretConfigured: false,
    cdpEvmAccountAddress: "",
    cdpEvmAccountName: "",
    x402BuyerPrivateKeyConfigured: false,
    x402BuyerRpcUrl: "",
    proof402DelegationMode: "disabled",
    proof402BaseUrl: "https://proof402.vercel.app",
    proof402MaxSpendUsd: 0,
    agentcashAutoRefillApproved: true,
    agentcashAutoRefillEnabled: true,
    agentcashAutoRefillProvider: "manual-operator-top-up",
    agentcashAutoRefillThresholdUsd: 0.5,
    agentcashAutoRefillAmountUsd: 1,
    agentcashAutoRefillDailyCapUsd: 2,
    liveProcurementSmokeObserved: false,
    liveProcurementEvidenceRef: "",
    proof402PaidSmokeObserved: false,
    proof402EvidenceRef: "",
    agentcashAutoRefillEvidenceObserved: true,
    agentcashAutoRefillEvidenceRef: "not-required",
    autonomousJobSmokeObserved: false,
    autonomousJobEvidenceRef: "",
    finalVerificationObserved: false,
    finalVerificationEvidenceRef: ""
  };
}

function envDiagnostics({ cdpWalletSecret, cdpAccountName, bridge }) {
  const key = (present, nonEmpty = present) => ({ present, nonEmpty, placeholderLike: false });
  const keys = {
    CDP_API_KEY_ID: key(true),
    CDP_API_KEY_SECRET: key(true),
    CDP_WALLET_SECRET: key(true, cdpWalletSecret),
    CDP_EVM_ACCOUNT_ADDRESS: key(false, false),
    CDP_EVM_ACCOUNT_NAME: key(cdpAccountName),
    LIVE_PAYMENT_ADAPTER_URL: key(bridge),
    LIVE_SPEND_ENABLED: key(true),
    LIVE_ALLOWED_REGISTRIES: key(true),
    TRUST402_OPERATOR_API_KEY: key(true),
    PROOF402_DELEGATION_MODE: key(true),
    PROOF402_MAX_SPEND_USD: key(true),
    AGENTCASH_AUTO_REFILL_APPROVED: key(false, false),
    AGENTCASH_AUTO_REFILL_ENABLED: key(false, false),
    AGENTCASH_AUTO_REFILL_PROVIDER: key(false, false)
  };
  return {
    ok: true,
    tool: "local.env_diagnostics",
    present: true,
    keys,
    readiness: {
      cdpX402Buyer: {
        ready: cdpWalletSecret && cdpAccountName,
        missing: cdpWalletSecret ? [] : ["CDP_WALLET_SECRET"],
        missingAny: cdpAccountName ? [] : ["CDP_EVM_ACCOUNT_ADDRESS", "CDP_EVM_ACCOUNT_NAME"]
      },
      agentcashBridge: {
        ready: bridge,
        missing: bridge ? [] : ["LIVE_PAYMENT_ADAPTER_URL"],
        missingAny: []
      },
      liveSpendPolicy: {
        ready: true,
        missing: [],
        missingAny: []
      },
      proof402Delegation: {
        ready: true,
        missing: [],
        missingAny: []
      },
      agentcashAutoRefill: {
        ready: false,
        missing: ["AGENTCASH_AUTO_REFILL_APPROVED", "AGENTCASH_AUTO_REFILL_ENABLED", "AGENTCASH_AUTO_REFILL_PROVIDER"],
        missingAny: []
      }
    },
    safety: {
      printsValues: false,
      printsLengths: false,
      sendsValues: false,
      storesValues: false,
      mutatesEnvFile: false,
      readsEnvFile: false
    }
  };
}

function localPolicy(overrides = {}) {
  return {
    present: true,
    policyPath: ".local/trust402-agentcash-wallet.json",
    failures: [],
    policy: {
      service: "Trust402",
      status: "dedicated-for-trust402-operator-spend",
      wallet: {
        provider: "AgentCash",
        network: "base",
        address: "0x1111111111111111111111111111111111111111"
      },
      restrictions: {
        allowedProjectRoot: process.cwd(),
        allowedOrigins: [
          "https://trust402.vercel.app",
          "https://trust402.example",
          "https://proof402.vercel.app"
        ],
        trust402LiveProcurement: overrides.trust402LiveProcurement,
        proof402Delegation: overrides.proof402Delegation
      },
      limits: {
        agentcashGlobalMaxAmountUsd: overrides.agentcashGlobalMaxAmountUsd ?? 0.01,
        manualSmokeRemainingBudgetUsd: overrides.manualSmokeRemainingBudgetUsd,
        lastVerifiedBalanceUsd: 1.20,
        minimumReserveUsd: 0.50,
        autoRefill: {
          enabled: false,
          futureThresholdUsd: 0.50
        }
      }
    }
  };
}
