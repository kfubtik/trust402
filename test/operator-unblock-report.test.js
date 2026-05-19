import test from "node:test";
import assert from "node:assert/strict";
import { operatorUnblockReport } from "../src/operatorUnblockReport.js";

test("operatorUnblockReport exposes manual blockers without secrets", () => {
  const report = operatorUnblockReport({
    baseUrl: "https://trust402.vercel.app",
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: false,
    vercelProjectLinked: true
  }, {
    config: baseConfig(),
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.some((item) => item.id === "git_vercel_auto_deploy"));
  assert.ok(report.blockers.some((item) => item.id === "custom_domain"));
  assert.ok(report.checks.find((item) => item.id === "live_procurement").evidence.localAgentcashPolicy.wallet.addressPreview);
  assert.equal(JSON.stringify(report).includes("private"), false);
});

test("operatorUnblockReport becomes ready when every gate has evidence", () => {
  const report = operatorUnblockReport({
    baseUrl: "https://trust402.example",
    candidateEndpoint: "https://resource.example/paid",
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: true,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "abc1234",
      cdpBazaarAllResourcesIndexed: true,
      cdpBazaarEvidenceRef: "sha256:cdp-bazaar-10-of-10",
      cdpBazaarCheckStatus: "all-indexed",
      cdpBazaarExpectedResources: 10,
      cdpBazaarIndexedResources: 10,
      cdpBazaarMissingResources: [],
      externalDirectoryStatus: "visible",
      externalDirectoryEvidenceUrl: "https://directory.example/trust402",
      externalDirectoryName: "Example Directory",
      liveSpendEnabled: true,
      livePaymentProvider: "external-adapter",
      livePaymentAdapterUrl: "https://bridge.example/pay",
      liveAllowedRegistries: ["https://resource.example"],
      operatorApiKey: "configured",
      proof402DelegationMode: "live",
      proof402BaseUrl: "https://proof402.vercel.app",
      proof402MaxSpendUsd: 0.01,
      agentcashAutoRefillApproved: true,
      agentcashAutoRefillEnabled: true,
      agentcashAutoRefillProvider: "manual-action",
      liveProcurementSmokeObserved: true,
      liveProcurementEvidenceRef: "sha256:procurement",
      autonomousJobSmokeObserved: true,
      autonomousJobEvidenceRef: "sha256:autonomous",
      finalVerificationObserved: true,
      finalVerificationEvidenceRef: "sha256:final"
    },
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0.10,
      agentcashGlobalMaxAmountUsd: 0.10,
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "approved-for-manual-smoke"
    })
  });

  assert.equal(report.status, "ready-for-final-window");
  assert.equal(report.blockers.length, 0);
  assert.equal(report.summary.candidateOrigin, "https://resource.example");
});

test("operatorUnblockReport includes downstream origin in local AgentCash readiness", () => {
  const report = operatorUnblockReport({
    baseUrl: "https://trust402.example",
    candidateEndpoint: "https://not-allowed.example/paid",
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: true,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "abc1234",
      cdpBazaarAllResourcesIndexed: true,
      cdpBazaarEvidenceRef: "sha256:cdp-bazaar-10-of-10",
      cdpBazaarCheckStatus: "all-indexed",
      cdpBazaarExpectedResources: 10,
      cdpBazaarIndexedResources: 10,
      cdpBazaarMissingResources: [],
      externalDirectoryStatus: "visible",
      externalDirectoryEvidenceUrl: "https://directory.example/trust402",
      externalDirectoryName: "Example Directory",
      liveSpendEnabled: true,
      livePaymentProvider: "external-adapter",
      livePaymentAdapterUrl: "https://bridge.example/pay",
      liveAllowedRegistries: ["https://not-allowed.example"],
      operatorApiKey: "configured",
      proof402DelegationMode: "live",
      proof402BaseUrl: "https://proof402.vercel.app",
      proof402MaxSpendUsd: 0.01,
      agentcashAutoRefillApproved: true,
      agentcashAutoRefillEnabled: true,
      agentcashAutoRefillProvider: "manual-action",
      liveProcurementSmokeObserved: true,
      liveProcurementEvidenceRef: "sha256:procurement",
      autonomousJobSmokeObserved: true,
      autonomousJobEvidenceRef: "sha256:autonomous",
      finalVerificationObserved: true,
      finalVerificationEvidenceRef: "sha256:final"
    },
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0.10,
      agentcashGlobalMaxAmountUsd: 0.10,
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "approved-for-manual-smoke"
    })
  });

  const live = report.checks.find((item) => item.id === "live_procurement");

  assert.equal(report.status, "blocked");
  assert.equal(report.summary.candidateOrigin, "https://not-allowed.example");
  assert.ok(live.evidence.blockers.some((item) => item.includes("local_candidate_origin_not_allowed")));
});

test("operatorUnblockReport keeps external directories blocked without CDP Bazaar 10/10 evidence", () => {
  const report = operatorUnblockReport({
    baseUrl: "https://trust402.example"
  }, {
    config: {
      ...baseConfig(),
      externalDirectoryStatus: "visible",
      externalDirectoryEvidenceUrl: "https://directory.example/trust402",
      externalDirectoryName: "Example Directory"
    },
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });
  const external = report.checks.find((item) => item.id === "external_x402_directories");

  assert.equal(external.status, "blocked-cdp-bazaar");
  assert.equal(external.evidence.cdpBazaarReady, false);
  assert.equal(external.evidence.nonCdpDirectoryReady, true);
  assert.match(external.nextAction, /CDP Bazaar 10\/10/);
});

test("operatorUnblockReport previews proposed CDP x402 buyer blockers", () => {
  const report = operatorUnblockReport({
    baseUrl: "https://trust402.vercel.app",
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    paymentProvider: "cdp-x402",
    githubActionsFallbackPresent: true,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      liveSpendEnabled: true,
      livePaymentProvider: "agentcash-mcp",
      liveAllowedRegistries: ["https://proof402.vercel.app"],
      operatorApiKey: "configured",
      liveMaxPerCallUsd: 0.005,
      liveMaxPerJobUsd: 0.015,
      liveDailyLimitUsd: 0.015,
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true
    },
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0.015,
      agentcashGlobalMaxAmountUsd: 0.015,
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "approved-for-manual-smoke"
    })
  });
  const live = report.checks.find((item) => item.id === "live_procurement");

  assert.equal(report.summary.paymentProvider, "agentcash-mcp");
  assert.equal(report.summary.proposedPaymentProvider, "cdp-x402");
  assert.equal(live.evidence.paymentProvider, "agentcash-mcp");
  assert.equal(live.evidence.proposedPaymentProvider, "cdp-x402");
  assert.equal(live.evidence.paymentAdapter.provider, "cdp-x402");
  assert.deepEqual(live.evidence.paymentAdapter.requiredSecrets, [
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
    "CDP_EVM_ACCOUNT_ADDRESS_OR_NAME"
  ]);
  assert.ok(live.evidence.paymentAdapter.blockers.some((item) => item.id === "missing_cdp_wallet_secret"));
  assert.ok(live.evidence.paymentAdapter.blockers.some((item) => item.id === "missing_cdp_evm_account"));
});

function baseConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app",
    gitAutoDeployVerified: false,
    gitAutoDeployEvidenceUrl: "",
    gitAutoDeployCommitSha: "",
    cdpBazaarAllResourcesIndexed: false,
    cdpBazaarEvidenceRef: "",
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
    agentcashAutoRefillApproved: false,
    agentcashAutoRefillEnabled: false,
    agentcashAutoRefillProvider: "",
    agentcashAutoRefillThresholdUsd: 0.5,
    agentcashAutoRefillAmountUsd: 1,
    agentcashAutoRefillDailyCapUsd: 2,
    liveProcurementSmokeObserved: false,
    liveProcurementEvidenceRef: "",
    autonomousJobSmokeObserved: false,
    autonomousJobEvidenceRef: "",
    finalVerificationObserved: false,
    finalVerificationEvidenceRef: ""
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
          "https://proof402.vercel.app",
          "https://resource.example"
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
