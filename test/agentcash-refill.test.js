import test from "node:test";
import assert from "node:assert/strict";
import { agentcashRefillCheck } from "../src/agentcashRefill.js";

const baseConfig = {
  publicBaseUrl: "https://trust402.example",
  emergencyStop: false,
  operatorApiKey: "",
  requestTimeoutMs: 100,
  agentcashAutoRefillApproved: false,
  agentcashAutoRefillEnabled: false,
  agentcashAutoRefillProvider: "",
  agentcashAutoRefillAdapterUrl: "",
  agentcashWalletBindingRequired: true,
  agentcashNetwork: "base",
  agentcashAutoRefillThresholdUsd: 0.5,
  agentcashAutoRefillAmountUsd: 1,
  agentcashAutoRefillDailyCapUsd: 2
};

test("agentcashRefillCheck plans a dry-run refill below threshold without mutating balance", async () => {
  const result = await agentcashRefillCheck({
    mode: "dry-run",
    currentBalanceUsd: 0.42,
    amountRefilledTodayUsd: 0
  }, {
    config: baseConfig
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "agentcash.refill_check");
  assert.equal(result.decision.action, "refill");
  assert.equal(result.decision.status, "dry-run-planned");
  assert.equal(result.decision.plannedRefillUsd, 1);
  assert.equal(result.safety.mutatesWalletBalance, false);
  assert.match(result.decisionHash, /^sha256:[a-f0-9]{64}$/);
});

test("agentcashRefillCheck blocks live refill without approval policy", async () => {
  await assert.rejects(
    () => agentcashRefillCheck({
      mode: "live",
      currentBalanceUsd: 0.42
    }, {
      config: baseConfig,
      operatorAuthorized: false
    }),
    /AgentCash auto-refill is blocked by policy/
  );
});

test("agentcashRefillCheck creates an operator action when manual-action policy is ready", async () => {
  const result = await agentcashRefillCheck({
    mode: "live",
    currentBalanceUsd: 0.1
  }, {
    config: {
      ...baseConfig,
      operatorApiKey: "secret",
      agentcashAutoRefillApproved: true,
      agentcashAutoRefillEnabled: true,
      agentcashAutoRefillProvider: "manual-action"
    },
    operatorAuthorized: true
  });

  assert.equal(result.decision.action, "refill");
  assert.equal(result.decision.status, "operator-action-required");
  assert.equal(result.decision.liveRefillExecuted, false);
  assert.equal(result.decision.providerAction.amountUsd, 1);
});

test("agentcashRefillCheck can execute through an injected external adapter inside policy", async () => {
  const calls = [];
  const result = await agentcashRefillCheck({
    mode: "live",
    currentBalanceUsd: 0.1
  }, {
    config: {
      ...baseConfig,
      operatorApiKey: "secret",
      agentcashAutoRefillApproved: true,
      agentcashAutoRefillEnabled: true,
      agentcashAutoRefillProvider: "external-adapter",
      agentcashAutoRefillAdapterUrl: "https://refill.example/agentcash"
    },
    operatorAuthorized: true,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, id: "refill_123" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(result.decision.status, "sent-to-refill-adapter");
  assert.equal(result.decision.liveRefillExecuted, true);
  assert.equal(result.safety.mutatesWalletBalance, true);
});
