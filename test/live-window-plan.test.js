import assert from "node:assert/strict";
import { test } from "node:test";
import { liveWindowPlan } from "../src/liveWindowPlan.js";

const baseConfig = {
  publicBaseUrl: "https://trust402.vercel.app",
  proof402BaseUrl: "https://proof402.vercel.app",
  livePaymentProvider: "disabled"
};

test("live window plan stays read-only and produces a bounded staging profile", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.03,
    manualSmokeBudgetUsd: 0.03,
    lastVerifiedBalanceUsd: 1.25,
    minimumReserveUsd: 0.5,
    includeProof: true
  }, { config: baseConfig });

  assert.equal(result.status, "ready-to-stage");
  assert.equal(result.estimatedMaxSpendUsd, 0.02);
  assert.equal(result.paymentProvider, "agentcash-mcp");
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.writesLocalPolicy, false);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.safety.includesPrivateKeyMaterial, false);
  assert.equal(result.vercelEnvPlan.production.LIVE_SPEND_ENABLED, "true");
  assert.equal(result.vercelEnvPlan.production.LIVE_ALLOWED_REGISTRIES, "https://trusted.example");
  assert.equal(result.vercelEnvPlan.production.LIVE_SPENT_TODAY_USD, "0");
  assert.equal(result.vercelEnvPlan.production.PROOF402_DELEGATION_MODE, "live");
  assert.deepEqual(result.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually, [
    "TRUST402_OPERATOR_API_KEY",
    "LIVE_PAYMENT_ADAPTER_URL"
  ]);
  assert.equal(result.paymentAdapterContract.provider, "agentcash-mcp");
  assert.equal(result.paymentAdapterContract.endpointEnv, "LIVE_PAYMENT_ADAPTER_URL");
  assert.equal(result.paymentAdapterContract.safety.trust402StripsSecretHeaders, true);
  assert.equal(result.paymentProviderPreflightCommand, result.paymentBridgePreflightCommand);
  assert.equal(result.paymentBuyerPreflightCommand, null);
  assert.match(result.paymentBridgePreflightCommand, /npm run payment:bridge-check/);
  assert.match(result.paymentBridgePreflightCommand, /--provider=agentcash-mcp/);
  assert.equal(result.paymentProviderAlternatives.length, 4);
  assert.equal(result.paymentProviderAlternatives.find((item) => item.provider === "agentcash-mcp").selected, true);
  assert.deepEqual(
    result.paymentProviderAlternatives.find((item) => item.provider === "cdp-x402").requiredSecrets,
    ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET", "CDP_EVM_ACCOUNT_ADDRESS_OR_NAME"]
  );
  assert.equal(result.paymentProviderAlternatives.find((item) => item.provider === "cdp-x402").requiresCdpAccountRef, true);
  assert.match(result.proof402PreflightCommand, /npm run proof402:preflight/);
  assert.match(result.proof402PreflightCommand, /--approved-hash=sha256:<approved-result-hash>/);
  assert.equal(result.localPolicyPatch.restrictions.trust402LiveProcurement, "approved-for-manual-smoke");
  assert.equal(result.localPolicyPatch.restrictions.proof402Delegation, "approved-for-manual-smoke");
  assert.equal(result.localPolicyPatch.limits.agentcashGlobalMaxAmountUsd, "0.03");
  assert.equal(result.downstreamRequestPolicy.privatePayloadAllowed, false);
  assert.match(result.command, /npm run live:evidence-smoke -- https:\/\/trust402\.vercel\.app --live/);
  assert.match(result.command, /--candidate-endpoint=https:\/\/trusted\.example\/api\/paid/);
  assert.match(result.command, /--proof-reserve-usd=0\.01/);
  assert.match(result.planHash, /^sha256:[a-f0-9]{64}$/);
});

test("live window plan describes Proof402 notarize payload safety", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    proofReserveUsd: 0.005,
    maxTotalUsd: 0.015,
    manualSmokeBudgetUsd: 0.015,
    lastVerifiedBalanceUsd: 1.25,
    minimumReserveUsd: 0.5,
    includeProof: true
  }, { config: baseConfig });

  assert.equal(result.status, "ready-to-stage");
  assert.equal(result.estimatedMaxSpendUsd, 0.01);
  assert.equal(result.vercelEnvPlan.production.LIVE_ALLOWED_REGISTRIES, "https://proof402.vercel.app");
  assert.equal(result.downstreamRequestPolicy.schema, "proof402.notarize");
  assert.deepEqual(result.downstreamRequestPolicy.sendsOnly, ["contentHash", "label", "idempotencyKey", "metadata"]);
  assert.equal(result.downstreamRequestPolicy.privatePayloadAllowed, false);
  assert.deepEqual(result.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually, [
    "TRUST402_OPERATOR_API_KEY",
    "LIVE_PAYMENT_ADAPTER_URL"
  ]);
  assert.match(result.command, /--candidate-price=0\.005/);
  assert.match(result.command, /--proof-reserve-usd=0\.005/);
  assert.match(result.proof402PreflightCommand, /--price-usd=0\.005/);
});

test("live window plan lists x402-fetch buyer secrets without bridge contract", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.02,
    manualSmokeBudgetUsd: 0.02,
    paymentProvider: "x402-fetch",
    lastVerifiedBalanceUsd: 1.25,
    minimumReserveUsd: 0.5,
    includeProof: true
  }, { config: baseConfig });

  assert.equal(result.status, "ready-to-stage");
  assert.equal(result.paymentAdapterContract, null);
  assert.equal(result.paymentBridgePreflightCommand, null);
  assert.equal(result.paymentBuyerPreflightCommand, null);
  assert.equal(result.paymentProviderPreflightCommand, null);
  assert.deepEqual(result.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually, [
    "TRUST402_OPERATOR_API_KEY",
    "X402_BUYER_PRIVATE_KEY",
    "X402_BUYER_RPC_URL"
  ]);
});

test("live window plan lists cdp-x402 buyer secrets without bridge contract", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.02,
    manualSmokeBudgetUsd: 0.02,
    paymentProvider: "cdp-x402",
    lastVerifiedBalanceUsd: 1.25,
    minimumReserveUsd: 0.5,
    includeProof: true
  }, { config: baseConfig });

  assert.equal(result.status, "ready-to-stage");
  assert.equal(result.paymentAdapterContract, null);
  assert.equal(result.paymentBridgePreflightCommand, null);
  assert.equal(result.paymentProviderPreflightCommand, result.paymentBuyerPreflightCommand);
  assert.match(result.paymentBuyerPreflightCommand, /payment:buyer-preflight/);
  assert.equal(result.paymentProviderAlternatives.find((item) => item.provider === "cdp-x402").selected, true);
  assert.deepEqual(result.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually, [
    "TRUST402_OPERATOR_API_KEY",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
    "CDP_EVM_ACCOUNT_ADDRESS_OR_NAME"
  ]);
});

test("live window plan blocks unsafe or underfunded staging profiles", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "http://trusted.example/api/paid",
    candidatePriceUsd: 0.02,
    maxTotalUsd: 0.02,
    manualSmokeBudgetUsd: 0.01,
    paymentProvider: "plain-fetch",
    lastVerifiedBalanceUsd: 0.51,
    minimumReserveUsd: 0.5,
    includeProof: true
  }, { config: baseConfig });

  assert.equal(result.status, "blocked");
  assert(result.blockers.some((item) => item.includes("HTTPS")));
  assert(result.blockers.some((item) => item.includes("Payment provider")));
  assert(result.blockers.some((item) => item.includes("Estimated max spend")));
  assert(result.blockers.some((item) => item.includes("manual smoke budget")));
  assert(result.blockers.some((item) => item.includes("minimum reserve")));
});

test("live window plan blocks when daily remaining spend capacity is too low", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.03,
    liveDailyLimitUsd: 0.03,
    liveSpentTodayUsd: 0.025,
    manualSmokeBudgetUsd: 0.03,
    lastVerifiedBalanceUsd: 1.25,
    minimumReserveUsd: 0.5,
    includeProof: true
  }, { config: baseConfig });

  assert.equal(result.status, "blocked");
  assert.equal(result.liveDailyRemainingUsd, 0.005);
  assert(result.blockers.some((item) => item.includes("remaining daily spend capacity")));
});

test("live window plan emits skip-proof for procurement-only smoke windows", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://trust402.vercel.app/api/trust/compare-resources",
    candidatePriceUsd: 0.03,
    maxTotalUsd: 0.03,
    manualSmokeBudgetUsd: 0.03,
    liveMaxPerCallUsd: 0.03,
    lastVerifiedBalanceUsd: 1.283,
    minimumReserveUsd: 0.5,
    includeProof: false
  }, { config: baseConfig });

  assert.equal(result.status, "ready-to-stage");
  assert.equal(result.estimatedMaxSpendUsd, 0.03);
  assert.equal(result.vercelEnvPlan.production.PROOF402_DELEGATION_MODE, "disabled");
  assert.equal(result.localPolicyPatch.restrictions.proof402Delegation, "disabled-until-separate-approval");
  assert.deepEqual(result.localPolicyPatch.restrictions.allowedOrigins, ["https://trust402.vercel.app"]);
  assert.equal(result.downstreamRequestPolicy.schema, "trust402.compare_resources");
  assert.deepEqual(result.downstreamRequestPolicy.sendsOnly, ["goal", "budgetUsd", "candidates"]);
  assert.equal(result.downstreamRequestPolicy.privatePayloadAllowed, false);
  assert.equal(result.proof402PreflightCommand, null);
  assert.match(result.command, /--skip-proof/);
  assert.doesNotMatch(result.command, /--include-autonomous-live/);
});

test("live window plan can include autonomous and auto-refill staging without enabling mutation", () => {
  const result = liveWindowPlan({
    candidateEndpoint: "https://trusted.example/api/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.04,
    manualSmokeBudgetUsd: 0.04,
    lastVerifiedBalanceUsd: 1.25,
    minimumReserveUsd: 0.5,
    includeAutonomous: true,
    includeAutoRefill: true,
    refillProvider: "manual-action",
    refillAmountUsd: 1,
    refillDailyCapUsd: 2
  }, { config: baseConfig });

  assert.equal(result.status, "ready-to-stage");
  assert.equal(result.estimatedMaxSpendUsd, 0.03);
  assert.equal(result.vercelEnvPlan.production.AGENTCASH_AUTO_REFILL_APPROVED, "true");
  assert.equal(result.vercelEnvPlan.production.AGENTCASH_AUTO_REFILL_ENABLED, "true");
  assert.equal(result.localPolicyPatch.limits.autoRefill.enabled, true);
  assert.match(result.command, /--include-autonomous-live/);
  assert.equal(result.safety.mutatesWallet, false);
});
