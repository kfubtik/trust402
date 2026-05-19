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
    baseUrl: "https://trust402.vercel.app",
    customDomain: "trust402.example",
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
  assert.equal(result.domain.host, "trust402.example");
  assert.equal(result.evidenceEnv.TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA, "abc1234");
});

test("deploymentPreflight can verify from GitHub CLI probe evidence without secret values", () => {
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
    vercelGitConnected: false,
    githubCli: {
      probed: true,
      available: true,
      authenticated: true,
      secretsConfigured: true,
      workflowsVisible: true,
      latestSuccessfulDeployRunForHead: true,
      autoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/42",
      autoDeployCommitSha: "abc1234deadbeef",
      latestDeployRun: {
        status: "completed",
        conclusion: "success",
        event: "push",
        headSha: "abc1234deadbeef",
        url: "https://github.com/kfubtik/trust402/actions/runs/42",
        createdAt: "2026-05-19T09:00:00Z"
      }
    },
    vercelDeployment: {
      probed: true,
      ok: true,
      projectId: "prj_123",
      projectName: "trust402",
      envKeysPresent: ["PUBLIC_BASE_URL", "TRUST402_PAYWALL_MODE"],
      latestProductionDeployment: {
        id: "dpl_123",
        url: "https://trust402.example",
        readyState: "READY",
        target: "production",
        commitSha: "abc1234deadbeef",
        commitRepo: "trust402",
        commitOrg: "kfubtik",
        commitRef: "main",
        actor: "github-actions",
        githubDeployment: "1"
      }
    }
  }, {
    config: baseConfig()
  });

  assert.equal(result.status, "verified");
  assert.equal(result.summary.githubCliAuthenticated, true);
  assert.equal(result.summary.latestVercelDeploymentCommitSha, "abc1234deadbeef");
  assert.equal(result.githubCli.safety.readsSecretValues, false);
  assert.equal(result.vercelDeployment.safety.printsSecretValues, false);
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
});

test("deploymentPreflight blocks stale recorded auto-deploy evidence", () => {
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
    githubActionsSecretsConfigured: true,
    gitAutoDeployVerified: true,
    gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
    gitAutoDeployCommitSha: "fffffff"
  }, {
    config: {
      ...baseConfig(),
      gitAutoDeployVerified: true,
      gitAutoDeployEvidenceUrl: "https://github.com/kfubtik/trust402/actions/runs/1",
      gitAutoDeployCommitSha: "fffffff"
    }
  });

  assert.equal(result.status, "blocked-manual-evidence");
  assert.ok(result.blockers.some((item) => item.id === "git_auto_deploy_commit_stale"));
});

test("deploymentPreflight identifies Vercel Git private repo access failures", () => {
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
    launchMonitorWorkflowText: launchWorkflow,
    vercelGitConnectAttempted: true,
    vercelGitConnectError:
      "Failed to connect kfubtik/trust402 to project. Make sure there aren't any typos and that you have access to the repository if it's private."
  }, {
    config: baseConfig()
  });

  assert.equal(result.gitHubApp.connectAttempted, true);
  assert.equal(result.gitHubApp.connectFailureKind, "private_repo_access_denied");
  assert.ok(result.blockers.some((item) => item.id === "vercel_git_connect_private_repo_access_denied"));
  assert.ok(result.nextActions.some((item) => item.includes("grant the Vercel GitHub App access")));
  assert.equal(result.safety.mutatesVercel, false);
});

test("deploymentPreflight blocks unsafe Vercel deploy pipeline capture", () => {
  const unsafeWorkflow = productionWorkflow + `
      - run: npx vercel@latest deploy --prebuilt --prod --token=\${{ secrets.VERCEL_TOKEN }} | tee deployment-output.txt
`;
  const result = deploymentPreflight({
    baseUrl: "https://trust402.example",
    gitRemote: "https://github.com/kfubtik/trust402.git",
    gitHead: "abc1234",
    vercelProject: {
      projectName: "trust402",
      projectId: "prj_123",
      orgId: "team_123"
    },
    productionDeployWorkflowText: unsafeWorkflow,
    launchMonitorWorkflowText: launchWorkflow,
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

  assert.equal(result.status, "blocked-manual-evidence");
  assert.equal(result.productionWorkflow.deploymentOutputCaptureSafe, false);
  assert.ok(result.blockers.some((item) => item.id === "production_deploy_capture_not_pipefail_safe"));
});

function baseConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app",
    gitAutoDeployVerified: false,
    gitAutoDeployEvidenceUrl: "",
    gitAutoDeployCommitSha: ""
  };
}
