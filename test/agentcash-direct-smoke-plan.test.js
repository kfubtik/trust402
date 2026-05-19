import test from "node:test";
import assert from "node:assert/strict";
import { agentcashDirectSmokePlan } from "../src/agentcashDirectSmokePlan.js";

const TEST_AGENTCASH_BASE_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_AGENTCASH_ADDRESS_PREVIEW = "0x1111...1111";

test("agentcashDirectSmokePlan blocks the current locked policy without calling AgentCash", () => {
  const result = agentcashDirectSmokePlan({}, {
    config: baseConfig(),
    localAgentcashPolicyResult: localPolicy({
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval",
      agentcashGlobalMaxAmountUsd: 0.01,
      manualSmokeRemainingBudgetUsd: 0
    })
  });

  assert.equal(result.status, "blocked-policy-window");
  assert.equal(result.policyWindowReady, false);
  assert.equal(result.safety.callsAgentcashMcp, false);
  assert.equal(result.safety.executesPayment, false);
  assert.equal(result.safety.writesLocalPolicy, false);
  assert.equal(result.targetResource.id, "trust402.compare_resources");
  assert.equal(result.mcpCallOrder[0].tool, "mcp__agentcash__check_endpoint_schema");
  assert.equal(result.mcpCallOrder[0].pays, false);
  assert.equal(result.mcpCallOrder[1].tool, "mcp__agentcash__fetch");
  assert.equal(result.mcpCallOrder[1].pays, true);
  assert.equal(result.mcpCallOrder[1].input.maxAmount, 0.03);
  assert.equal(result.mcpCallOrder[1].input.body.candidates.length, 2);
  assert.match(result.mcpCallOrder[1].inputHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.requiredLocalPolicyPatch.limits.agentcashGlobalMaxAmountUsd, "0.03");
  assert.equal(result.requiredLocalPolicyPatch.limits.manualSmokeRemainingBudgetUsd, "0.03");
  assert.equal(result.restoreAfterRun.limits.manualSmokeRemainingBudgetUsd, 0);
  assert.equal(result.restoreAfterRun.limits.lastVerifiedBalanceUsd, 1.283);
  assert.ok(result.localPolicy.blockers.some((item) => item.id === "local_live_procurement_not_approved"));
  assert.ok(result.localPolicy.blockers.some((item) => item.id === "local_manual_smoke_budget_exhausted"));
  assert.match(result.approval.oneLineApproval, /maxAmount \$0\.03/);
  assert.equal(JSON.stringify(result).includes(TEST_AGENTCASH_BASE_ADDRESS), false);
});

test("agentcashDirectSmokePlan becomes ready only after local policy window is open", () => {
  const result = agentcashDirectSmokePlan({}, {
    config: baseConfig(),
    localAgentcashPolicyResult: localPolicy({
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: "disabled-until-separate-approval",
      agentcashGlobalMaxAmountUsd: 0.03,
      manualSmokeRemainingBudgetUsd: 0.03
    })
  });

  assert.equal(result.status, "ready-for-explicit-paid-fetch-approval");
  assert.equal(result.policyWindowReady, true);
  assert.equal(result.approval.required, true);
  assert.equal(result.approval.notImpliedByGoalContinuation, true);
  assert.equal(result.mcpCallOrder[1].executeOnlyAfterApproval, true);
  assert.ok(result.evidenceAfterSuccess.commands.some((command) => command.includes("bazaar:indexing:check:all")));
  assert.equal(result.safety.doesNotProveRuntimePaymentAdapter, true);
});

function baseConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app",
    proof402BaseUrl: "https://proof402.vercel.app",
    livePaymentProvider: "disabled"
  };
}

function localPolicy(overrides = {}) {
  return {
    present: true,
    policyPath: ".local/trust402-agentcash-wallet.json",
    failures: [],
    summary: {
      present: true,
      policyPath: ".local/trust402-agentcash-wallet.json",
      status: "dedicated-for-trust402-operator-spend",
      wallet: {
        provider: "AgentCash",
        network: "base",
        addressPreview: TEST_AGENTCASH_ADDRESS_PREVIEW
      },
      limits: {
        lastVerifiedBalanceUsd: 1.283,
        minimumReserveUsd: 0.5
      }
    },
    policy: {
      service: "Trust402",
      status: "dedicated-for-trust402-operator-spend",
      wallet: {
        provider: "AgentCash",
        network: "base",
        address: TEST_AGENTCASH_BASE_ADDRESS
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
        agentcashGlobalMaxAmountUsd: overrides.agentcashGlobalMaxAmountUsd,
        manualSmokeRemainingBudgetUsd: overrides.manualSmokeRemainingBudgetUsd,
        lastVerifiedBalanceUsd: 1.283,
        minimumReserveUsd: 0.5,
        autoRefill: {
          enabled: false,
          futureThresholdUsd: 0.5
        }
      }
    }
  };
}
