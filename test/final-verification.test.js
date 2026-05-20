import test from "node:test";
import assert from "node:assert/strict";
import { finalVerificationReport } from "../src/finalVerification.js";

const verifiedRequirements = [
  "git_vercel_auto_deploy",
  "external_x402_directories",
  "unified_spend_policy",
  "live_procurement",
  "agentcash_wallet_binding",
  "agentcash_auto_refill",
  "paid_proof402_delegation",
  "autonomous_job_flow",
  "monitoring_and_protection"
].map((id) => ({ id, status: "verified" }));

test("finalVerificationReport blocks when non-final requirements remain open", () => {
  const report = finalVerificationReport({
    baseUrl: "https://trust402.vercel.app",
    checks: [
      check("release_check", "passed"),
      check("production_smoke", "passed"),
      check("production_completion_audit", "passed")
    ],
    productionAudit: {
      goalComplete: false,
      summary: { verified: 3 },
      requirements: [
        { id: "git_vercel_auto_deploy", status: "blocked-manual" },
        { id: "final_verification", status: "unverified" }
      ],
      blockers: [{ id: "git_vercel_auto_deploy" }]
    }
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.suggestedEnv, null);
  assert.ok(report.blockers.some((item) => item.id === "git_vercel_auto_deploy"));
});

test("finalVerificationReport becomes ready for final evidence when only final verification is open", () => {
  const report = finalVerificationReport({
    baseUrl: "https://trust402.vercel.app",
    checks: [
      check("release_check", "passed"),
      check("docker_build", "passed"),
      check("production_smoke", "passed")
    ],
    productionAudit: {
      goalComplete: false,
      summary: { verified: 9, unverified: 1 },
      requirements: [
        ...verifiedRequirements,
        { id: "final_verification", status: "unverified" }
      ],
      blockers: [{ id: "final_verification" }]
    }
  });

  assert.equal(report.status, "ready-for-final-evidence");
  assert.match(report.verificationHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(report.suggestedEnv.TRUST402_FINAL_VERIFICATION_OBSERVED, "true");
  assert.equal(report.suggestedEnv.TRUST402_FINAL_VERIFICATION_EVIDENCE_REF, report.verificationHash);
});

test("finalVerificationReport is complete when production audit is complete", () => {
  const report = finalVerificationReport({
    baseUrl: "https://trust402.vercel.app",
    checks: [check("release_check", "passed")],
    productionAudit: {
      goalComplete: true,
      summary: { verified: 10 },
      requirements: [
        ...verifiedRequirements,
        { id: "final_verification", status: "verified" }
      ],
      blockers: []
    }
  });

  assert.equal(report.status, "complete");
  assert.equal(report.summary.productionGoalComplete, true);
});

test("finalVerificationReport exposes external discovery blockers from launch monitor output", () => {
  const report = finalVerificationReport({
    baseUrl: "https://trust402.vercel.app",
    checks: [
      check("release_check", "passed"),
      {
        ...check("launch_monitor", "failed"),
        stdout: JSON.stringify({
          summary: {
            cdpBazaar: {
              status: "partially-indexed",
              routeSummary: {
                expected: 10,
                indexed: 9,
                missing: ["trust.compare_resources"]
              }
            },
            externalDirectories: {
              status: "not-visible-yet",
              visible: 0,
              checked: 7
            }
          }
        })
      }
    ],
    productionAudit: {
      goalComplete: false,
      summary: { verified: 4 },
      requirements: [
        { id: "external_x402_directories", status: "blocked-external" },
        { id: "final_verification", status: "unverified" }
      ],
      blockers: [{ id: "external_x402_directories" }]
    }
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.summary.cdpBazaarStatus, "partially-indexed");
  assert.equal(report.summary.externalDirectoryStatus, "not-visible-yet");
  assert.deepEqual(report.externalEvidence.cdpBazaar.routeSummary.missing, ["trust.compare_resources"]);
  assert.ok(report.blockers.some((item) => item.id === "cdp_bazaar_indexing"));
  assert.ok(report.blockers.some((item) => item.id === "external_directory_visibility"));
});

test("finalVerificationReport does not become ready when external evidence is failing", () => {
  const report = finalVerificationReport({
    baseUrl: "https://trust402.vercel.app",
    checks: [
      check("release_check", "passed"),
      {
        ...check("launch_monitor", "passed"),
        stdout: JSON.stringify({
          summary: {
            cdpBazaar: {
              status: "all-indexed",
              routeSummary: {
                expected: 10,
                indexed: 10,
                missing: []
              }
            },
            externalDirectories: {
              status: "not-visible-yet",
              visible: 0,
              checked: 7
            }
          }
        })
      }
    ],
    productionAudit: {
      goalComplete: false,
      summary: { verified: 9, unverified: 1 },
      requirements: [
        ...verifiedRequirements,
        { id: "final_verification", status: "unverified" }
      ],
      blockers: [{ id: "final_verification" }]
    }
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.suggestedEnv, null);
  assert.equal(report.summary.externalEvidenceBlockers, 1);
  assert.ok(report.blockers.some((item) => item.id === "external_directory_visibility"));
});

test("finalVerificationReport exposes production deployment lag as its own blocker", () => {
  const report = finalVerificationReport({
    baseUrl: "https://trust402.vercel.app",
    checks: [
      check("release_check", "passed"),
      {
        ...check("production_deployment_sync", "failed"),
        nextAction: "Production is behind the local verification contract; deploy the current GitHub HEAD before running final production smoke."
      },
      {
        ...check("production_smoke", "skipped-required"),
        skipped: true,
        exitCode: null,
        nextAction: "Deploy the current GitHub HEAD to production, then rerun production smoke."
      }
    ],
    productionAudit: {
      goalComplete: false,
      summary: { verified: 9, unverified: 1 },
      requirements: [
        ...verifiedRequirements,
        { id: "final_verification", status: "unverified" }
      ],
      blockers: [{ id: "final_verification" }]
    }
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.some((item) => item.id === "production_deployment_sync"));
  assert.ok(report.blockers.some((item) => item.id === "production_smoke"));
  assert.equal(report.suggestedEnv, null);
});

function check(id, status) {
  return {
    id,
    label: id,
    status,
    required: true,
    skipped: false,
    exitCode: status === "passed" ? 0 : 1,
    durationMs: 1
  };
}
