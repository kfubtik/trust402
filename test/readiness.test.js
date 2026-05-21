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
    cdpBazaarAllResourcesIndexed: true,
    cdpBazaarEvidenceRef: "sha256:cdp-bazaar",
    cdpBazaarCheckStatus: "all-indexed",
    cdpBazaarExpectedResources: 10,
    cdpBazaarIndexedResources: 10,
    cdpBazaarMissingResources: [],
    paidSmokeApproved: false,
    paidSmokeMaxUsd: 0,
    paidSmokeResourceId: "trust.score_resource",
    liveSpendEnabled: false,
    liveMaxPerCallUsd: 0.05,
    liveMaxPerJobUsd: 0.25,
    liveDailyLimitUsd: 2,
    liveSpentTodayUsd: 0,
    liveApprovalThresholdUsd: 0,
    liveAllowedRegistries: ["https://proof402.vercel.app"],
    liveEndpointDenylist: [],
    liveReceiptLogMode: "response-only",
    livePaymentProvider: "disabled",
    livePaymentAdapterUrl: "",
    x402BuyerPrivateKeyConfigured: false,
    x402BuyerRpcUrl: "",
    cdpEvmAccountAddress: "",
    cdpEvmAccountName: "",
    operatorApiKey: "",
    emergencyStop: false,
    proof402DelegationMode: "disabled",
    proof402MaxSpendUsd: 0.005
  });

  assert.equal(result.readiness.dryRunLaunchReady, true);
  assert.equal(result.checks.find((item) => item.id === "live_spend_policy")?.passed, true);
});

test("launchChecklist accepts controlled live spend after reviewed evidence", () => {
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
    cdpWalletSecretConfigured: true,
    cdpEvmAccountAddress: "0x2222222222222222222222222222222222222222",
    cdpEvmAccountName: "trust402-buyer",
    realSettlementEnabled: true,
    successfulSettlementObserved: true,
    cdpBazaarAllResourcesIndexed: true,
    cdpBazaarEvidenceRef: "sha256:cdp-bazaar",
    cdpBazaarCheckStatus: "all-indexed",
    cdpBazaarExpectedResources: 10,
    cdpBazaarIndexedResources: 10,
    cdpBazaarMissingResources: [],
    paidSmokeApproved: false,
    paidSmokeMaxUsd: 0,
    paidSmokeResourceId: "trust.score_resource",
    liveSpendEnabled: true,
    livePaymentProvider: "cdp-x402",
    livePaymentAdapterUrl: "",
    liveMaxPerCallUsd: 0.005,
    liveMaxPerJobUsd: 0.02,
    liveDailyLimitUsd: 0.05,
    liveSpentTodayUsd: 0.015,
    liveApprovalThresholdUsd: 0,
    liveAllowedRegistries: ["https://proof402.vercel.app"],
    liveEndpointDenylist: [],
    liveReceiptLogMode: "response-only",
    x402BuyerPrivateKeyConfigured: false,
    x402BuyerRpcUrl: "",
    operatorApiKey: "test-operator",
    emergencyStop: false,
    proof402BaseUrl: "https://proof402.vercel.app",
    proof402DelegationMode: "live",
    proof402MaxSpendUsd: 0.005,
    liveProcurementSmokeObserved: true,
    liveProcurementEvidenceRef: "sha256:procurement",
    proof402PaidSmokeObserved: true,
    proof402EvidenceRef: "sha256:proof",
    autonomousJobSmokeObserved: true,
    autonomousJobEvidenceRef: "sha256:autonomous"
  });

  assert.equal(result.readiness.dryRunLaunchReady, true);
  assert.equal(result.readiness.publicMarketplaceReady, true);
  assert.equal(result.environment.controlledLiveSpendReady, true);
  assert.equal(result.checks.find((item) => item.id === "live_spend_policy")?.passed, true);
});
