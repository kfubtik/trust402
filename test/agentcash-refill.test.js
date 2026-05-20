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
  assert.equal(result.auditBundle.schema, "trust402.agentcash_refill_audit.v1");
  assert.equal(result.auditBundle.mode, "dry-run");
  assert.equal(result.auditBundle.decision.action, "refill");
  assert.equal(result.auditBundle.safety.mutatesWalletBalance, false);
  assert.equal(result.auditBundle.safety.adapterResponseStoredAs, "not-observed");
  assert.match(result.auditBundle.auditBundleHash, /^sha256:[a-f0-9]{64}$/);
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
    (error) => {
      assert.equal(error.code, "agentcash_refill_policy_blocked");
      assert.equal(error.details?.auditBundle?.schema, "trust402.agentcash_refill_audit.v1");
      assert.equal(error.details?.auditBundle?.safety?.includesSecretValues, false);
      return true;
    }
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
  assert.equal(result.auditBundle.decision.status, "operator-action-required");
  assert.equal(result.auditBundle.localWalletPolicy.required, true);
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
  assert.equal(result.auditBundle.mode, "live");
  assert.equal(result.auditBundle.adapter.urlOrigin, "https://refill.example");
  assert.match(result.auditBundle.adapter.bodyHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.auditBundle.safety.rawAdapterResponseStored, false);
  assert.equal(result.auditBundle.safety.adapterResponseStoredAs, "sha256-only");
  assert.equal(JSON.stringify(result.auditBundle).includes("refill_123"), false);
});
