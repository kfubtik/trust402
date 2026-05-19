#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { deploymentPreflight } from "../src/deploymentPreflight.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app";
const gitRemote = commandText("git", ["config", "--get", "remote.origin.url"]);
const gitHead = commandText("git", ["rev-parse", "--short", "HEAD"]);
const vercelProject = readJsonIfPresent(".vercel/project.json");
const githubCli = args.probeGithubCli === true
  ? probeGitHubCli({
      repo: args.repo || "kfubtik/trust402",
      workflow: args.workflow || "vercel-production-deploy.yml",
      gitHead
    })
  : null;
const vercelDeployment = args.probeVercelApi === true
  ? probeVercelApi({
      project: vercelProject,
      scope: args.vercelScope || args.scope || ""
    })
  : null;
const observedGitDeploy = githubCli?.latestSuccessfulDeployRunForHead === true;

const result = deploymentPreflight({
  baseUrl,
  customDomain: args.customDomain || "",
  gitRemote,
  gitHead,
  vercelProject,
  productionDeployWorkflowText: readTextIfPresent(".github/workflows/vercel-production-deploy.yml"),
  launchMonitorWorkflowText: readTextIfPresent(".github/workflows/launch-monitor.yml"),
  vercelGitConnected: args.vercelGitConnected === true,
  vercelGitConnectError: args.vercelGitConnectError || "",
  githubActionsSecretsConfigured: args.githubActionsSecretsConfigured === true
    ? true
    : args.githubActionsSecretsConfigured === false
      ? false
      : null,
  githubCli,
  vercelDeployment,
  gitAutoDeployVerified: args.gitAutoDeployVerified === true || observedGitDeploy,
  gitAutoDeployEvidenceUrl: args.gitAutoDeployEvidenceUrl || githubCli?.autoDeployEvidenceUrl || "",
  gitAutoDeployCommitSha: args.gitAutoDeployCommitSha || githubCli?.autoDeployCommitSha || ""
}, {
  config
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "verified") process.exit(1);

function readTextIfPresent(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function commandText(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function commandJson(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: options.maxBuffer || 10 * 1024 * 1024
  });
  const stdout = String(result.stdout || "").trim();
  if (result.status !== 0) {
    return {
      ok: false,
      stdout: "",
      error: safeError(result.stderr || result.error?.message || "command failed")
    };
  }
  try {
    return {
      ok: true,
      stdout,
      json: JSON.parse(stdout)
    };
  } catch {
    return {
      ok: false,
      stdout: "",
      error: "Command succeeded but did not return JSON."
    };
  }
}

function commandLines(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024
  });
  return {
    ok: result.status === 0,
    lines: String(result.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    error: result.status === 0 ? "" : safeError(result.stderr || result.error?.message || "command failed")
  };
}

function probeGitHubCli({ repo, workflow, gitHead }) {
  const version = commandLines("gh", ["--version"]);
  if (!version.ok) {
    return {
      probed: true,
      available: false,
      authenticated: false,
      secretsConfigured: null,
      error: version.error
    };
  }
  const auth = commandLines("gh", ["auth", "status"]);
  if (!auth.ok) {
    return {
      probed: true,
      available: true,
      authenticated: false,
      secretsConfigured: null,
      error: auth.error
    };
  }
  const secretList = commandLines("gh", ["secret", "list", "--repo", repo]);
  const secretNames = secretList.ok
    ? secretList.lines.map((line) => line.split(/\s+/)[0]).filter(Boolean)
    : [];
  const requiredSecrets = ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"];
  const secretsConfigured = requiredSecrets.every((name) => secretNames.includes(name));
  const workflows = commandJson("gh", ["workflow", "list", "--repo", repo, "--json", "name,path,state"]);
  const runs = commandJson("gh", [
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    workflow,
    "--limit",
    "10",
    "--json",
    "databaseId,status,conclusion,headSha,event,url,displayTitle,createdAt"
  ]);
  const runItems = Array.isArray(runs.json) ? runs.json : [];
  const latestDeployRun = runItems[0] || null;
  const matchingSuccess = runItems.find((run) =>
    run.event === "push" &&
    run.status === "completed" &&
    run.conclusion === "success" &&
    sameCommit(run.headSha, gitHead)
  ) || null;

  return {
    probed: true,
    available: true,
    authenticated: true,
    secretsConfigured,
    workflowsVisible: workflows.ok,
    latestDeployRun,
    latestSuccessfulDeployRunForHead: Boolean(matchingSuccess),
    autoDeployEvidenceUrl: matchingSuccess?.url || "",
    autoDeployCommitSha: matchingSuccess?.headSha || "",
    error: secretList.ok ? null : secretList.error
  };
}

function probeVercelApi({ project, scope }) {
  if (!project?.projectId) {
    return {
      probed: true,
      ok: false,
      error: ".vercel/project.json is missing projectId."
    };
  }
  const commandArgs = [
    "vercel@latest",
    "api",
    `/v9/projects/${project.projectId}`,
    "--raw"
  ];
  if (scope || project.orgId) commandArgs.push("--scope", scope || project.orgId);
  const response = commandJson("npx", commandArgs, { maxBuffer: 30 * 1024 * 1024 });
  if (!response.ok) {
    return {
      probed: true,
      ok: false,
      projectId: project.projectId,
      projectName: project.projectName || null,
      error: response.error
    };
  }
  const body = response.json || {};
  const latest = latestProductionDeployment(body);
  return {
    probed: true,
    ok: true,
    projectId: body.id || project.projectId,
    projectName: body.name || project.projectName || null,
    envKeysPresent: Array.isArray(body.env) ? body.env.map((item) => item.key).filter(Boolean).sort() : [],
    latestProductionDeployment: latest
  };
}

function latestProductionDeployment(project) {
  const deployments = Array.isArray(project.latestDeployments) ? project.latestDeployments : [];
  const latest = deployments.find((deployment) => deployment.target === "production") ||
    project.targets?.production ||
    null;
  if (!latest) return null;
  const meta = latest.meta || {};
  return {
    id: latest.id || null,
    url: latest.url ? `https://${latest.url}` : null,
    readyState: latest.readyState || null,
    target: latest.target || null,
    commitSha: meta.githubCommitSha || null,
    commitRepo: meta.githubCommitRepo || null,
    commitOrg: meta.githubCommitOrg || null,
    commitRef: meta.githubCommitRef || null,
    actor: meta.actor || null,
    githubDeployment: meta.githubDeployment || null,
    createdAt: latest.createdAt || null,
    readyAt: latest.readyAt || null
  };
}

function safeError(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function sameCommit(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a && b && (a === b || a.startsWith(b) || b.startsWith(a)));
}

function parseArgs(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) {
      parsed._.push(item);
      continue;
    }
    const raw = item.slice(2);
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      parsed[toCamel(raw.slice(0, eq))] = raw.slice(eq + 1);
      continue;
    }
    const key = toCamel(raw);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
