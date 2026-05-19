#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { deploymentPreflight } from "../src/deploymentPreflight.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app";

const result = deploymentPreflight({
  baseUrl,
  customDomain: args.customDomain || "",
  gitRemote: commandText("git", ["config", "--get", "remote.origin.url"]),
  gitHead: commandText("git", ["rev-parse", "--short", "HEAD"]),
  vercelProject: readJsonIfPresent(".vercel/project.json"),
  productionDeployWorkflowText: readTextIfPresent(".github/workflows/vercel-production-deploy.yml"),
  launchMonitorWorkflowText: readTextIfPresent(".github/workflows/launch-monitor.yml"),
  vercelGitConnected: args.vercelGitConnected === true,
  vercelGitConnectError: args.vercelGitConnectError || "",
  githubActionsSecretsConfigured: args.githubActionsSecretsConfigured === true
    ? true
    : args.githubActionsSecretsConfigured === false
      ? false
      : null,
  gitAutoDeployVerified: args.gitAutoDeployVerified === true,
  gitAutoDeployEvidenceUrl: args.gitAutoDeployEvidenceUrl || "",
  gitAutoDeployCommitSha: args.gitAutoDeployCommitSha || ""
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
