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
    githubActionsFallbackPresent: true,
    githubCliAuthenticated: true,
    vercelProjectLinked: true
  }, {
    config: {
      ...baseConfig(),
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "abc1234",
      externalDirectoryStatus: "pending-review",
      externalDirectoryEvidenceUrl: "https://directory.example/review/trust402",
      externalDirectoryName: "Example Directory",
      liveSpendEnabled: true,
      livePaymentProvider: "external-adapter",
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
