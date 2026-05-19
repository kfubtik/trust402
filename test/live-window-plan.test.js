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
  assert.equal(result.vercelEnvPlan.production.PROOF402_DELEGATION_MODE, "live");
  assert.deepEqual(result.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually, [
    "TRUST402_OPERATOR_API_KEY"
  ]);
  assert.equal(result.localPolicyPatch.restrictions.trust402LiveProcurement, "approved-for-manual-smoke");
  assert.equal(result.localPolicyPatch.restrictions.proof402Delegation, "approved-for-manual-smoke");
  assert.equal(result.localPolicyPatch.limits.agentcashGlobalMaxAmountUsd, "0.03");
  assert.match(result.command, /npm run live:evidence-smoke -- https:\/\/trust402\.vercel\.app --live/);
  assert.match(result.command, /--candidate-endpoint=https:\/\/trusted\.example\/api\/paid/);
  assert.match(result.planHash, /^sha256:[a-f0-9]{64}$/);
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
