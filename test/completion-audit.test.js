import test from "node:test";
import assert from "node:assert/strict";
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
