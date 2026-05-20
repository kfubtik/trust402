import test from "node:test";
import assert from "node:assert/strict";
import { localEnvDiagnostics, runtimeEnvDiagnostics } from "../src/envDiagnostics.js";

test("localEnvDiagnostics reports readiness without secret values or lengths", () => {
  const report = localEnvDiagnostics({
    text: [
      "CDP_API_KEY_ID=secret-value",
      "CDP_API_KEY_SECRET=another-secret",
      "CDP_WALLET_SECRET=",
      "CDP_EVM_ACCOUNT_NAME=<paste-account-name>",
      "LIVE_PAYMENT_ADAPTER_URL=https://bridge.example/pay"
    ].join("\n"),
    keys: [
      "CDP_API_KEY_ID",
      "CDP_API_KEY_SECRET",
      "CDP_WALLET_SECRET",
      "CDP_EVM_ACCOUNT_NAME",
      "LIVE_PAYMENT_ADAPTER_URL"
    ]
  });

  const serialized = JSON.stringify(report);

  assert.equal(report.present, true);
  assert.equal(report.keys.CDP_API_KEY_ID.present, true);
  assert.equal(report.keys.CDP_API_KEY_ID.nonEmpty, true);
  assert.equal(report.keys.CDP_WALLET_SECRET.present, true);
  assert.equal(report.keys.CDP_WALLET_SECRET.nonEmpty, false);
  assert.equal(report.keys.CDP_EVM_ACCOUNT_NAME.placeholderLike, true);
  assert.equal(report.readiness.cdpX402Buyer.ready, false);
  assert.equal(report.readiness.agentcashBridge.ready, true);
  assert.equal(report.safety.printsValues, false);
  assert.equal(report.safety.printsLengths, false);
  assert.equal(report.safety.sendsValues, false);
  assert.equal(report.safety.storesValues, false);
  assert.equal(report.safety.readsEnvFile, true);
  assert.equal(serialized.includes("secret-value"), false);
  assert.equal(serialized.includes("another-secret"), false);
  assert.equal(serialized.includes("https://bridge.example/pay"), false);
});

test("localEnvDiagnostics handles a missing env file as public-safe missing config", () => {
  const report = localEnvDiagnostics({
    cwd: "Z:/does-not-exist",
    keys: ["CDP_WALLET_SECRET"]
  });

  assert.equal(report.present, false);
  assert.deepEqual(report.keys.CDP_WALLET_SECRET, {
    present: false,
    nonEmpty: false,
    placeholderLike: false
  });
});

test("runtimeEnvDiagnostics reports production readiness without reading env files", () => {
  const report = runtimeEnvDiagnostics({
    cdpApiKeyIdConfigured: true,
    cdpApiKeySecretConfigured: true,
    cdpWalletSecretConfigured: true,
    cdpEvmAccountName: "trust402-buyer",
    livePaymentProvider: "cdp-x402",
    liveSpendEnabled: true,
    liveAllowedRegistries: ["https://proof402.vercel.app"],
    operatorApiKey: "configured",
    proof402DelegationMode: "live",
    proof402MaxSpendUsd: 0.005,
    agentcashAutoRefillApproved: false,
    agentcashAutoRefillEnabled: false,
    agentcashAutoRefillProvider: ""
  });

  assert.equal(report.tool, "runtime.env_diagnostics");
  assert.equal(report.safety.readsEnvFile, false);
  assert.equal(report.safety.printsValues, false);
  assert.equal(report.readiness.cdpX402Buyer.ready, true);
  assert.equal(report.readiness.liveSpendPolicy.ready, true);
  assert.equal(report.readiness.proof402Delegation.ready, true);
  assert.equal(report.readiness.agentcashAutoRefill.ready, false);
  assert.equal(JSON.stringify(report).includes("trust402-buyer"), false);
});
