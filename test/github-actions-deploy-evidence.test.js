import test from "node:test";
import assert from "node:assert/strict";
import { githubActionsDeployEvidenceCheck } from "../src/githubActionsDeployEvidence.js";

const baseUrl = "https://trust402.aztecbeacon.uk";
const repo = "kfubtik/trust402";
const headSha = "649033381176d09017785450a623d447e310b28d";
const runUrl = `https://github.com/${repo}/actions/runs/123`;

test("githubActionsDeployEvidenceCheck verifies matching artifact and push run", () => {
  const result = githubActionsDeployEvidenceCheck({
    baseUrl,
    repo,
    gitHead: headSha.slice(0, 7),
    evidence: deploymentEvidence(),
    workflowRun: workflowRun()
  });

  assert.equal(result.verified, true);
  assert.equal(result.status, "verified");
  assert.equal(result.artifact.schemaValid, true);
  assert.equal(result.checks.productionAliasMatches, true);
  assert.equal(result.evidenceEnv.TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA, headSha);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("githubActionsDeployEvidenceCheck blocks missing deployment evidence", () => {
  const result = githubActionsDeployEvidenceCheck({
    baseUrl,
    repo,
    gitHead: headSha,
    workflowRun: workflowRun()
  });

  assert.equal(result.verified, false);
  assert.equal(result.status, "needs-evidence");
  assert.ok(result.blockers.some((item) => item.id === "missing_deployment_evidence"));
});

test("githubActionsDeployEvidenceCheck blocks non-push workflow evidence", () => {
  const result = githubActionsDeployEvidenceCheck({
    baseUrl,
    repo,
    gitHead: headSha,
    evidence: deploymentEvidence(),
    workflowRun: workflowRun({ event: "workflow_dispatch" })
  });

  assert.equal(result.verified, false);
  assert.equal(result.status, "blocked-evidence");
  assert.ok(result.blockers.some((item) => item.id === "workflow_run_not_push_triggered"));
});

function deploymentEvidence(overrides = {}) {
  return {
    schema: "trust402.github_actions_deploy_evidence.v1",
    repository: repo,
    workflow: "vercel-production-deploy",
    runId: "123",
    runAttempt: "1",
    runUrl,
    event: "push",
    ref: "refs/heads/main",
    headSha,
    deploymentUrl: "https://trust402-clean-public-release.vercel.app",
    productionAlias: baseUrl,
    generatedAt: "2026-05-21T00:00:00.000Z",
    ...overrides
  };
}

function workflowRun(overrides = {}) {
  return {
    status: "completed",
    conclusion: "success",
    event: "push",
    headSha,
    url: runUrl,
    ...overrides
  };
}
