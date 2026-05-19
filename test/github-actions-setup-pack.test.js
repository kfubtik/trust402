import test from "node:test";
import assert from "node:assert/strict";
import { githubActionsSetupPack } from "../src/githubActionsSetupPack.js";

test("githubActionsSetupPack emits exact setup commands without secret values", () => {
  const pack = githubActionsSetupPack({
    baseUrl: "https://trust402.vercel.app",
    repo: "kfubtik/trust402",
    gitHead: "abc1234",
    vercelProject: {
      projectName: "trust402",
      projectId: "prj_123",
      orgId: "team_123"
    }
  }, {
    config: baseConfig()
  });

  assert.equal(pack.status, "ready-to-configure");
  assert.equal(pack.safety.readOnly, true);
  assert.equal(pack.safety.includesSecretValues, false);
  assert.match(pack.setupPackHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(pack.githubActions.requiredSecretNames, [
    "VERCEL_TOKEN",
    "VERCEL_ORG_ID",
    "VERCEL_PROJECT_ID"
  ]);
  assert.ok(pack.githubActions.commandPlan.setupSecrets.includes(
    'gh secret set VERCEL_ORG_ID --repo kfubtik/trust402 --body "team_123"'
  ));
  assert.ok(pack.githubActions.commandPlan.setupSecrets.includes(
    'gh secret set VERCEL_PROJECT_ID --repo kfubtik/trust402 --body "prj_123"'
  ));
  assert.ok(pack.githubActions.commandPlan.setupSecrets.includes(
    'gh secret set VERCEL_TOKEN --repo kfubtik/trust402 --body "<paste-vercel-token-locally>"'
  ));
  assert.ok(pack.githubActions.commandPlan.triggerAndVerify.some((item) =>
    item.includes("gh workflow run vercel-production-deploy.yml")
  ));
  assert.equal(pack.evidenceEnv.TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA, "abc1234");
  assert.equal(JSON.stringify(pack).includes("real-token-value"), false);
});

test("githubActionsSetupPack blocks when project ids are missing", () => {
  const pack = githubActionsSetupPack({
    baseUrl: "https://trust402.vercel.app",
    vercelProject: {
      projectName: "trust402"
    }
  }, {
    config: baseConfig()
  });

  assert.equal(pack.status, "blocked-project-link");
  assert.ok(pack.blockers.some((item) => item.id === "vercel_project_ids_missing"));
  assert.ok(pack.githubActions.commandPlan.setupSecrets.some((item) =>
    item.includes("<org-id-from-.vercel/project.json>")
  ));
});

function baseConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app"
  };
}
