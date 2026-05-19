import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAgentcashPolicyGuard } from "../src/agentcashPolicyGuard.js";

test("AgentCash policy guard keeps the current locked policy strict", () => {
  const result = evaluateAgentcashPolicyGuard(basePolicy({
    trust402LiveProcurement: "disabled-until-separate-approval",
    proof402Delegation: "disabled-until-separate-approval",
    manualSmokeRemainingBudgetUsd: 0,
    autoRefillEnabled: false
  }), {
    cwd: process.cwd()
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "locked");
  assert.equal(result.liveSpendAllowed, false);
  assert.equal(result.autoRefillAllowed, false);
  assert.equal(result.paidProofDelegationAllowed, false);
});

test("AgentCash policy guard validates an approved live smoke window", () => {
  const result = evaluateAgentcashPolicyGuard(basePolicy({
    trust402LiveProcurement: "approved-for-manual-smoke",
    proof402Delegation: "approved-for-manual-smoke",
    manualSmokeRemainingBudgetUsd: 0.03,
    agentcashGlobalMaxAmountUsd: 0.03,
    autoRefillEnabled: false
  }), {
    cwd: process.cwd(),
    mode: "live-window",
    includeProof: true,
    estimatedMaxSpendUsd: 0.02
  });

  assert.equal(result.ok, true);
  assert.equal(result.liveSpendAllowed, true);
  assert.equal(result.paidProofDelegationAllowed, true);
});

test("AgentCash policy guard blocks live windows that exceed local budget", () => {
  const result = evaluateAgentcashPolicyGuard(basePolicy({
    trust402LiveProcurement: "approved-for-manual-smoke",
    proof402Delegation: "approved-for-manual-smoke",
    manualSmokeRemainingBudgetUsd: 0.01,
    agentcashGlobalMaxAmountUsd: 0.03,
    autoRefillEnabled: false
  }), {
    cwd: process.cwd(),
    mode: "live-window",
    includeProof: true,
    estimatedMaxSpendUsd: 0.02
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((item) => item.includes("exceeds manual smoke budget")));
});

test("AgentCash policy guard validates approved auto-refill policy without enabling spend", () => {
  const result = evaluateAgentcashPolicyGuard(basePolicy({
    trust402LiveProcurement: "disabled-until-separate-approval",
    proof402Delegation: "disabled-until-separate-approval",
    manualSmokeRemainingBudgetUsd: 0,
    autoRefillEnabled: true,
    futureThresholdUsd: 0.5
  }), {
    cwd: process.cwd(),
    mode: "auto-refill"
  });

  assert.equal(result.ok, true);
  assert.equal(result.liveSpendAllowed, false);
  assert.equal(result.autoRefillAllowed, true);
});

function basePolicy(overrides = {}) {
  return {
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
      lastVerifiedBalanceUsd: overrides.lastVerifiedBalanceUsd ?? 1.283,
      minimumReserveUsd: overrides.minimumReserveUsd ?? 0.5,
      autoRefill: {
        enabled: overrides.autoRefillEnabled,
        futureThresholdUsd: overrides.futureThresholdUsd ?? 0.5
      }
    }
  };
}
