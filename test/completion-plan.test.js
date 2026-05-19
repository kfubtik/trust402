import test from "node:test";
import assert from "node:assert/strict";
import { completionPlan } from "../src/completionPlan.js";

test("completionPlan pins all autonomous success criteria without side effects", () => {
  const plan = completionPlan();

  assert.equal(plan.tool, "completion.plan");
  assert.equal(plan.requirements.length, 10);
  assert.equal(plan.evidenceRules.allAuditRequirementsMustBeVerified, true);
  assert.equal(plan.evidenceRules.implementedButBlockedDoesNotCountAsDone, true);
  assert.equal(plan.safety.readOnly, true);
  assert.equal(plan.safety.includesSecretValues, false);
  assert.match(plan.planHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(plan.requirementIds, [
    "git_vercel_auto_deploy",
    "external_x402_directories",
    "unified_spend_policy",
    "live_procurement",
    "agentcash_wallet_binding",
    "agentcash_auto_refill",
    "paid_proof402_delegation",
    "autonomous_job_flow",
    "monitoring_and_protection",
    "final_verification"
  ]);
  assert.ok(plan.successCriteria.some((item) => item.includes("buys only approved resources")));
});
