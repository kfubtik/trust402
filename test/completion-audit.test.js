import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { completionAudit, isGoalComplete } from "../src/completionAudit.js";

test("isGoalComplete requires every requirement to be verified", () => {
  assert.equal(isGoalComplete([]), false);
  assert.equal(isGoalComplete([{ status: "verified" }, { status: "verified" }]), true);
  assert.equal(isGoalComplete([{ status: "verified" }, { status: "implemented-blocked" }]), false);
  assert.equal(isGoalComplete([{ status: "verified" }, { status: "blocked-external" }]), false);
  assert.equal(isGoalComplete([{ status: "verified" }, { status: "unverified" }]), false);
});

test("completionAudit exposes blockers without treating implemented paths as complete", () => {
  const audit = completionAudit();

  assert.equal(audit.goalComplete, false);
  assert.ok(audit.summary.implementedBlocked > 0);
  assert.ok(audit.blockers.some((item) => item.status === "implemented-blocked"));
  assert.equal(audit.goalComplete, audit.requirements.every((item) => item.status === "verified"));
  assert.equal(audit.planSource.document, "docs/autonomous-completion-plan.md");
  assert.equal(audit.planSource.pinnedAt, "2026-05-20");
  assert.equal(audit.planSource.mustAllBeVerified, true);
  assert.deepEqual(
    audit.planSource.requirementIds,
    audit.requirements.map((item) => item.id)
  );
});

test("completionAudit can verify manual/external requirements only with explicit evidence", () => {
  const audit = completionAudit({
    ...config,
    gitAutoDeployVerified: true,
    gitAutoDeployEvidenceUrl: "https://vercel.com/example/trust402/git-deploy",
    gitAutoDeployCommitSha: "abc123",
    cdpBazaarAllResourcesIndexed: true,
    cdpBazaarEvidenceRef: "sha256:cdp-bazaar-10-of-10",
    externalDirectoryStatus: "visible",
    externalDirectoryEvidenceUrl: "https://example.com/trust402-directory",
    externalDirectoryName: "Example x402 Directory"
  });

  assert.equal(audit.requirements.find((item) => item.id === "git_vercel_auto_deploy")?.status, "verified");
  assert.equal(audit.requirements.find((item) => item.id === "external_x402_directories")?.status, "verified");
  assert.equal(audit.goalComplete, false);
});

test("completionAudit does not treat non-CDP directory visibility as CDP 10/10 evidence", () => {
  const audit = completionAudit({
    ...config,
    externalDirectoryStatus: "visible",
    externalDirectoryEvidenceUrl: "https://example.com/trust402-directory",
    externalDirectoryName: "Example x402 Directory"
  });
  const external = audit.requirements.find((item) => item.id === "external_x402_directories");

  assert.equal(external?.status, "blocked-external");
  assert.equal(external?.details.cdpBazaarVerified, false);
  assert.equal(external?.details.nonCdpDirectoryVerified, true);
  assert.ok(external?.evidence.some((item) => item === "cdpBazaarAllResourcesIndexed=false"));
});

test("completionAudit does not treat pending directory review as visible", () => {
  const audit = completionAudit({
    ...config,
    externalDirectoryStatus: "pending-review",
    externalDirectoryEvidenceUrl: "https://example.com/trust402-directory-review",
    externalDirectoryName: "Example x402 Directory"
  });

  assert.equal(audit.requirements.find((item) => item.id === "external_x402_directories")?.status, "blocked-external");
});

test("completionAudit explains custom-domain blocker for external directories", () => {
  const audit = completionAudit({
    ...config,
    publicBaseUrl: "https://trust402.vercel.app",
    cdpBazaarAllResourcesIndexed: true,
    cdpBazaarEvidenceRef: "sha256:cdp-bazaar-10-of-10",
    externalDirectoryStatus: "not-visible-yet",
    externalDirectoryEvidenceUrl: ""
  });
  const external = audit.requirements.find((item) => item.id === "external_x402_directories");

  assert.equal(external?.status, "blocked-external");
  assert.equal(external?.details.hostPolicy.requiresCustomDomain, true);
  assert.equal(external?.details.hostPolicy.freeHostingSuffix, "vercel.app");
  assert.ok(external?.evidence.some((item) => item === "customDomainRequiredForSomeDirectories=true"));
  assert.match(external?.nextAction || "", /custom production domain/);
});

test("completionAudit requires smoke evidence even when live policies are ready", () => {
  const livePolicyReadyConfig = {
    ...config,
    liveSpendEnabled: true,
    livePaymentProvider: "external-adapter",
    livePaymentAdapterUrl: "https://example.com/pay",
    liveMaxPerCallUsd: 0.01,
    liveMaxPerJobUsd: 0.1,
    liveDailyLimitUsd: 1,
    liveAllowedRegistries: ["https://example.com/registry"],
    operatorApiKey: "test-operator-key",
    proof402BaseUrl: "https://proof402.vercel.app",
    proof402DelegationMode: "live",
    proof402MaxSpendUsd: 0.01,
    agentcashAutoRefillApproved: true,
    agentcashAutoRefillEnabled: true,
    agentcashAutoRefillProvider: "manual-action"
  };

  const withoutEvidence = completionAudit(livePolicyReadyConfig);
  assert.equal(withoutEvidence.requirements.find((item) => item.id === "live_procurement")?.status, "implemented-blocked");
  assert.equal(withoutEvidence.requirements.find((item) => item.id === "paid_proof402_delegation")?.status, "implemented-blocked");
  assert.equal(withoutEvidence.requirements.find((item) => item.id === "agentcash_auto_refill")?.status, "implemented-blocked");
  assert.equal(withoutEvidence.requirements.find((item) => item.id === "autonomous_job_flow")?.status, "implemented-blocked");

  const withEvidence = completionAudit({
    ...livePolicyReadyConfig,
    cdpBazaarAllResourcesIndexed: true,
    cdpBazaarEvidenceRef: "sha256:cdp-bazaar-10-of-10",
    liveProcurementSmokeObserved: true,
    liveProcurementEvidenceRef: "receipt:live-procurement-smoke",
    proof402PaidSmokeObserved: true,
    proof402EvidenceRef: "receipt:proof402-paid-smoke",
    agentcashAutoRefillEvidenceObserved: true,
    agentcashAutoRefillEvidenceRef: "receipt:agentcash-refill-smoke",
    autonomousJobSmokeObserved: true,
    autonomousJobEvidenceRef: "receipt:autonomous-job-smoke"
  });

  assert.equal(withEvidence.requirements.find((item) => item.id === "live_procurement")?.status, "verified");
  assert.equal(withEvidence.requirements.find((item) => item.id === "paid_proof402_delegation")?.status, "verified");
  assert.equal(withEvidence.requirements.find((item) => item.id === "agentcash_auto_refill")?.status, "verified");
  assert.equal(withEvidence.requirements.find((item) => item.id === "autonomous_job_flow")?.status, "verified");
  assert.equal(withEvidence.goalComplete, false);
});

test("completionAudit final verification requires CDP Bazaar all-resource evidence", () => {
  const almostFinal = completionAudit({
    ...config,
    realSettlementEnabled: true,
    paywallMode: "real",
    successfulSettlementObserved: true,
    publicBaseUrl: "https://trust402.example",
    payTo: "0x1111111111111111111111111111111111111111",
    facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    cdpApiKeyIdConfigured: true,
    cdpApiKeySecretConfigured: true,
    finalVerificationObserved: true,
    finalVerificationEvidenceRef: "sha256:final",
    liveSpendEnabled: true,
    livePaymentProvider: "external-adapter",
    livePaymentAdapterUrl: "https://example.com/pay",
    liveMaxPerCallUsd: 0.01,
    liveMaxPerJobUsd: 0.1,
    liveDailyLimitUsd: 1,
    liveAllowedRegistries: ["https://example.com/registry"],
    operatorApiKey: "test-operator-key"
  });
  const final = almostFinal.requirements.find((item) => item.id === "final_verification");

  assert.equal(final?.status, "unverified");
  assert.ok(final?.evidence.some((item) => item === "marketplaceIndexingReady=true"));
  assert.ok(final?.evidence.some((item) => item === "cdpBazaarAllResourcesIndexed=false"));
});
