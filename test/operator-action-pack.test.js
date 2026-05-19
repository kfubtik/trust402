import test from "node:test";
import assert from "node:assert/strict";
import { operatorActionPack } from "../src/operatorActionPack.js";

test("operatorActionPack turns blockers into public-safe operator actions", () => {
  const pack = operatorActionPack({
    baseUrl: "https://trust402.vercel.app",
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.03,
    includeProof: true,
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

  assert.equal(pack.status, "blocked");
  assert.equal(pack.safety.readOnly, true);
  assert.equal(pack.safety.includesSecretValues, false);
  assert.match(pack.actionPackHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(pack.liveWindowPlan.status, "ready-to-stage");
  assert.ok(pack.actions.some((action) => action.id === "git_vercel_auto_deploy"));
  assert.ok(pack.actions.some((action) => action.id === "custom_domain"));
  assert.ok(pack.actions.some((action) => action.id === "live_procurement"));
  assert.ok(pack.actions.some((action) => action.id === "final_verification"));
  assert.deepEqual(
    pack.actions.find((action) => action.id === "git_vercel_auto_deploy").fallbackPath.requiredGitHubSecrets,
    ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]
  );
  assert.equal(
    pack.actions.find((action) => action.id === "live_procurement").envPlan.LIVE_ALLOWED_REGISTRIES,
    "https://trusted.example"
  );
  assert.equal(
    pack.actions.find((action) => action.id === "live_procurement").envPlan.LIVE_SPENT_TODAY_USD,
    "0"
  );
  assert.equal(JSON.stringify(pack).includes("TRUST402_OPERATOR_API_KEY\":\"configured"), false);
});

test("operatorActionPack can become ready except final evidence when runtime flags are proven", () => {
  const pack = operatorActionPack({
    baseUrl: "https://trust402.example",
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.03,
    includeProof: true,
    includeAutoRefill: true,
    includeAutonomous: true,
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: true,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "abc1234",
      externalDirectoryStatus: "visible",
      externalDirectoryEvidenceUrl: "https://directory.example/trust402",
      externalDirectoryName: "Example Directory",
      liveSpendEnabled: true,
      livePaymentProvider: "external-adapter",
      liveAllowedRegistries: ["https://trusted.example"],
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
      autonomousJobEvidenceRef: "sha256:autonomous"
    },
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0.10,
      agentcashGlobalMaxAmountUsd: 0.10,
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "approved-for-manual-smoke"
    })
  });

  assert.equal(pack.summary.livePlanStatus, "ready-to-stage");
  assert.equal(pack.actions.find((action) => action.id === "git_vercel_auto_deploy").status, "ready");
  assert.equal(pack.actions.find((action) => action.id === "custom_domain").status, "ready");
  assert.equal(pack.actions.find((action) => action.id === "final_verification").status, "blocked-evidence");
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
    liveAllowedRegistries: [],
    operatorApiKey: "",
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
          "https://trusted.example"
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
