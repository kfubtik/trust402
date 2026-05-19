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
});

test("completionAudit can verify manual/external requirements only with explicit evidence", () => {
  const audit = completionAudit({
    ...config,
    gitAutoDeployVerified: true,
    gitAutoDeployEvidenceUrl: "https://vercel.com/example/trust402/git-deploy",
    gitAutoDeployCommitSha: "abc123",
    externalDirectoryStatus: "pending-review",
    externalDirectoryEvidenceUrl: "https://example.com/trust402-directory-review",
    externalDirectoryName: "Example x402 Directory"
  });

  assert.equal(audit.requirements.find((item) => item.id === "git_vercel_auto_deploy")?.status, "verified");
  assert.equal(audit.requirements.find((item) => item.id === "external_x402_directories")?.status, "verified");
  assert.equal(audit.goalComplete, false);
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
