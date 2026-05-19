import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLocalAgentcashPolicyForLive } from "../src/localAgentcashPolicy.js";

test("evaluateLocalAgentcashPolicyForLive blocks current zero-budget policy shape", () => {
  const result = evaluateLocalAgentcashPolicyForLive({
    cwd: process.cwd(),
    baseUrl: "https://trust402.vercel.app",
    estimatedMaxSpendUsd: 0.01,
    includeProof: true,
    policyResult: policyResult({
      manualSmokeRemainingBudgetUsd: 0,
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    })
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((item) => item.id === "local_manual_smoke_budget_exhausted"));
  assert.ok(result.blockers.some((item) => item.id === "local_live_procurement_not_approved"));
  assert.ok(result.blockers.some((item) => item.id === "local_proof402_not_approved"));
  assert.equal(result.summary.wallet.addressPreview, "0x1111...1111");
});

test("evaluateLocalAgentcashPolicyForLive accepts bounded approved smoke policy", () => {
  const result = evaluateLocalAgentcashPolicyForLive({
    cwd: process.cwd(),
    baseUrl: "https://trust402.vercel.app",
    estimatedMaxSpendUsd: 0.02,
    includeProof: true,
    policyResult: policyResult({
      manualSmokeRemainingBudgetUsd: 0.05,
      agentcashGlobalMaxAmountUsd: 0.05,
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "approved-for-manual-smoke"
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.blockers.length, 0);
});

function policyResult(overrides = {}) {
  const policy = {
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
  };

  return {
    present: true,
    policyPath: ".local/trust402-agentcash-wallet.json",
    policy,
    failures: [],
    summary: {
      present: true,
      wallet: {
        addressPreview: "0x1111...1111"
      }
    }
  };
}
