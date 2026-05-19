import test from "node:test";
import assert from "node:assert/strict";
import { deploymentPreflight } from "../src/deploymentPreflight.js";

const productionWorkflow = `
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    steps:
      - run: npm run release:check
      - run: npx vercel@latest build --prod --token=\${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel@latest deploy --prebuilt --prod --token=\${{ secrets.VERCEL_TOKEN }}
      - run: npm run smoke:x402 -- https://trust402.vercel.app
      - run: npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --strict
    env:
      VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}
`;

const launchWorkflow = `
on:
  workflow_dispatch:
    inputs:
      include_external_directories:
        type: boolean
jobs:
  launch-monitor:
    steps:
      - run: npm run launch:monitor -- https://trust402.vercel.app --strict
`;

test("deploymentPreflight exposes fallback readiness and custom-domain blocker", () => {
  const result = deploymentPreflight({
    baseUrl: "https://trust402.vercel.app",
    gitRemote: "https://github.com/kfubtik/trust402.git",
    gitHead: "abc1234",
    vercelProject: {
      projectName: "trust402",
      projectId: "prj_123",
      orgId: "team_123"
    },
    productionDeployWorkflowText: productionWorkflow,
    launchMonitorWorkflowText: launchWorkflow
  }, {
    config: baseConfig()
  });

  assert.equal(result.status, "blocked-manual-evidence");
  assert.equal(result.summary.fallbackReadyToConfigure, true);
  assert.equal(result.summary.customDomainReady, false);
  assert.ok(result.blockers.some((item) => item.id === "github_actions_secrets_unverified"));
  assert.ok(result.blockers.some((item) => item.id === "custom_domain_required"));
  assert.equal(result.safety.readsSecretValues, false);
});

test("deploymentPreflight verifies when evidence, secrets, Git link, and domain are proven", () => {
  const result = deploymentPreflight({
    baseUrl: "https://trust402.example",
    gitRemote: "https://github.com/kfubtik/trust402.git",
    gitHead: "abc1234",
    vercelProject: {
      projectName: "trust402",
      projectId: "prj_123",
      orgId: "team_123"
    },
    productionDeployWorkflowText: productionWorkflow,
    launchMonitorWorkflowText: launchWorkflow,
    vercelGitConnected: true,
    githubActionsSecretsConfigured: true,
    gitAutoDeployVerified: true,
    gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
    gitAutoDeployCommitSha: "abc1234"
  }, {
    config: {
      ...baseConfig(),
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "abc1234"
    }
  });

  assert.equal(result.status, "verified");
  assert.equal(result.blockers.length, 0);
  assert.equal(result.summary.customDomainReady, true);
  assert.equal(result.evidenceEnv.TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA, "abc1234");
});

function baseConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app",
    gitAutoDeployVerified: false,
    gitAutoDeployEvidenceUrl: "",
    gitAutoDeployCommitSha: ""
  };
}
