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
  assert.equal(pack.evidenceCollection.status, "blocked");
  assert.equal(pack.evidenceCollection.nextBlockingActionId, "git_vercel_auto_deploy");
  assert.ok(pack.evidenceCollection.blockingActionIds.includes("custom_domain"));
  assert.equal(pack.evidenceCollection.evidenceEnvPlan.TRUST402_GIT_AUTO_DEPLOY_VERIFIED, "true");
  assert.equal(pack.evidenceCollection.evidenceEnvPlan.TRUST402_EXTERNAL_DIRECTORY_STATUS, "visible");
  assert.ok(pack.evidenceCollection.verifyCommands.includes("npm test"));
  assert.ok(pack.evidenceCollection.localEvidenceRequired.some((item) => item.includes("agentcash:policy")));
  assert.ok(pack.evidenceCollection.localEvidenceRequired.some((item) => item.includes("proof402:preflight")));
  assert.equal(pack.evidenceCollection.safety.includesSecretValues, false);
  assert.equal(pack.liveWindowPlan.localPolicyPatch.limits.lastVerifiedBalanceUsd, "1.2");
  assert.equal(pack.liveWindowPlan.localPolicyPatch.limits.minimumReserveUsd, "0.5");
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
      proof402PaidSmokeObserved: true,
      proof402EvidenceRef: "sha256:proof402",
      agentcashAutoRefillEvidenceObserved: true,
      agentcashAutoRefillEvidenceRef: "sha256:refill",
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
  assert.equal(pack.actions.find((action) => action.id === "live_procurement").status, "ready");
  assert.equal(pack.actions.find((action) => action.id === "paid_proof402_delegation").status, "ready");
  assert.equal(pack.actions.find((action) => action.id === "agentcash_auto_refill").status, "ready");
  assert.equal(pack.actions.find((action) => action.id === "autonomous_job_flow").status, "ready");
  assert.equal(pack.actions.find((action) => action.id === "final_verification").status, "blocked-evidence");
  assert.deepEqual(pack.evidenceCollection.blockingActionIds, [
    "final_verification"
  ]);
  assert.equal(pack.evidenceCollection.nextBlockingActionId, "final_verification");
});

test("operatorActionPack defaults bounded live window to Proof402 paid smoke", () => {
  const pack = operatorActionPack({
    baseUrl: "https://trust402.vercel.app",
    githubActionsFallbackPresent: true,
    vercelProjectLinked: true
  }, {
    config: baseConfig(),
    localAgentcashPolicyResult: localPolicy({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });

  assert.equal(pack.candidateEndpoint, "https://proof402.vercel.app/api/proof/notarize");
  assert.equal(pack.liveWindowPlan.estimatedMaxSpendUsd, 0.01);
  assert.equal(pack.liveWindowPlan.vercelEnvPlan.production.LIVE_ALLOWED_REGISTRIES, "https://proof402.vercel.app");
  assert.equal(pack.liveWindowPlan.vercelEnvPlan.production.PROOF402_MAX_SPEND_USD, "0.005");
  assert.deepEqual(pack.liveWindowPlan.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually, [
    "TRUST402_OPERATOR_API_KEY",
    "LIVE_PAYMENT_ADAPTER_URL"
  ]);
  assert.equal(pack.liveWindowPlan.downstreamRequestPolicy.schema, "proof402.notarize");
  assert.equal(pack.liveWindowPlan.paymentAdapterContract.provider, "agentcash-mcp");
  assert.equal(pack.liveWindowPlan.paymentAdapterContract.safety.bridgeMustEnforceMaxAmountUsd, true);
  assert.match(pack.liveWindowPlan.paymentBridgePreflightCommand, /npm run payment:bridge-check/);
  assert.match(pack.liveWindowPlan.proof402PreflightCommand, /npm run proof402:preflight/);
  assert.equal(pack.actions.find((action) => action.id === "live_procurement").downstreamRequestPolicy.privatePayloadAllowed, false);
  assert.equal(pack.actions.find((action) => action.id === "live_procurement").paymentAdapterContract.endpointEnv, "LIVE_PAYMENT_ADAPTER_URL");
  assert.match(pack.actions.find((action) => action.id === "live_procurement").paymentBridgePreflightCommand, /--strict/);
  assert.match(pack.actions.find((action) => action.id === "live_procurement").proof402PreflightCommand, /--strict/);
  assert.match(pack.actions.find((action) => action.id === "paid_proof402_delegation").preflightCommand, /--approved-hash=sha256:<approved-result-hash>/);
  assert.match(pack.liveWindowPlan.command, /--candidate-endpoint=https:\/\/proof402\.vercel\.app\/api\/proof\/notarize/);
  assert.match(pack.liveWindowPlan.command, /--candidate-price=0\.005/);
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
    proof402PaidSmokeObserved: false,
    proof402EvidenceRef: "",
    agentcashAutoRefillEvidenceObserved: false,
    agentcashAutoRefillEvidenceRef: "",
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
