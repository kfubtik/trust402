import test from "node:test";
import assert from "node:assert/strict";
import { agentcashMcpObservation } from "../src/agentcashMcpObservation.js";

const TEST_AGENTCASH_BASE_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_AGENTCASH_OTHER_ADDRESS = "0x2222222222222222222222222222222222222222";
const TEST_AGENTCASH_ADDRESS_PREVIEW = "0x1111...1111";

test("agentcashMcpObservation asks for observation without calling AgentCash", () => {
  const result = agentcashMcpObservation({}, {
    localAgentcashPolicyResult: localPolicy()
  });

  assert.equal(result.status, "observation-required");
  assert.equal(result.passed, false);
  assert.equal(result.safety.callsAgentcashMcp, false);
  assert.equal(result.safety.sendsPaymentHeaders, false);
});

test("agentcashMcpObservation verifies observed Base account and maxAmount against local policy", () => {
  const result = agentcashMcpObservation({
    accounts: [
      { network: "base", address: TEST_AGENTCASH_BASE_ADDRESS, balance: 1.283 },
      { network: "tempo", address: TEST_AGENTCASH_BASE_ADDRESS, balance: 0 },
      { network: "solana", address: "DMjXkgJdRf5BWwKiEYHdqAiSAHYnsYZfqJaMR52pJhMg", balance: 0 }
    ],
    settings: { maxAmount: 0.01 }
  }, {
    localAgentcashPolicyResult: localPolicy()
  });

  assert.equal(result.status, "verified");
  assert.equal(result.passed, true);
  assert.equal(result.observation.baseAddressPreview, TEST_AGENTCASH_ADDRESS_PREVIEW);
  assert.deepEqual(result.observation.nonBaseFundedNetworks, []);
  assert.equal(JSON.stringify(result).includes(TEST_AGENTCASH_BASE_ADDRESS), false);
});

test("agentcashMcpObservation blocks mismatched address and unsafe maxAmount", () => {
  const result = agentcashMcpObservation({
    accounts: [
      { network: "base", address: TEST_AGENTCASH_OTHER_ADDRESS, balance: 1 },
      { network: "tempo", address: TEST_AGENTCASH_OTHER_ADDRESS, balance: 0.5 }
    ],
    settings: { maxAmount: 0.5 }
  }, {
    localAgentcashPolicyResult: localPolicy()
  });

  assert.equal(result.status, "blocked-policy");
  assert.equal(result.passed, false);
  assert.ok(result.blockers.some((item) => item.id === "agentcash_wallet_address_mismatch"));
  assert.ok(result.blockers.some((item) => item.id === "agentcash_max_amount_exceeds_policy"));
  assert.ok(result.blockers.some((item) => item.id === "agentcash_non_base_balance_present"));
});

test("agentcashMcpObservation does not compare addresses when the local policy is missing", () => {
  const result = agentcashMcpObservation({
    accounts: [
      { network: "base", address: TEST_AGENTCASH_BASE_ADDRESS, balance: 1.283 }
    ],
    settings: { maxAmount: 0.01 }
  }, {
    localAgentcashPolicyResult: {
      present: false,
      policyPath: ".local/trust402-agentcash-wallet.json",
      policy: null,
      failures: ["No local AgentCash policy file exists."]
    }
  });

  assert.equal(result.status, "blocked-policy");
  assert.ok(result.blockers.some((item) => item.id === "local_agentcash_policy_missing"));
  assert.equal(result.blockers.some((item) => item.id === "agentcash_wallet_address_mismatch"), false);
});

function localPolicy() {
  return {
    present: true,
    policyPath: ".local/trust402-agentcash-wallet.json",
    failures: [],
    summary: {
      present: true,
      policyPath: ".local/trust402-agentcash-wallet.json",
      status: "dedicated-for-trust402-operator-spend"
    },
    policy: {
      service: "Trust402",
      status: "dedicated-for-trust402-operator-spend",
      wallet: {
        provider: "AgentCash",
        network: "base",
        address: TEST_AGENTCASH_BASE_ADDRESS
      },
      limits: {
        agentcashGlobalMaxAmountUsd: 0.01,
        minimumReserveUsd: 0.5
      }
    }
  };
}
