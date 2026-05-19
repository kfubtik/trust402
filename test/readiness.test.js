import test from "node:test";
import assert from "node:assert/strict";
import { launchChecklist } from "../src/readiness.js";

test("launchChecklist treats proof spend cap as staged while delegation is disabled", () => {
  const result = launchChecklist({
    serviceName: "Trust402",
    version: "test",
    host: "127.0.0.1",
    port: 4032,
    publicBaseUrl: "https://trust402.example",
    defaultMode: "dry-run",
    paywallMode: "real",
    x402Network: "eip155:8453",
    x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    facilitatorUrl: "https://facilitator.example",
    cdpApiKeyIdConfigured: true,
    cdpApiKeySecretConfigured: true,
    cdpWalletSecretConfigured: false,
    realSettlementEnabled: true,
    successfulSettlementObserved: true,
    paidSmokeApproved: false,
    paidSmokeMaxUsd: 0,
    paidSmokeResourceId: "trust.score_resource",
    liveSpendEnabled: false,
    liveMaxPerCallUsd: 0.05,
    liveMaxPerJobUsd: 0.25,
    liveDailyLimitUsd: 2,
    liveSpentTodayUsd: 0,
    liveAllowedRegistries: ["https://proof402.vercel.app"],
    proof402DelegationMode: "disabled",
    proof402MaxSpendUsd: 0.005
  });

  assert.equal(result.readiness.dryRunLaunchReady, true);
  assert.equal(result.checks.find((item) => item.id === "live_spend_disabled")?.passed, true);
});
