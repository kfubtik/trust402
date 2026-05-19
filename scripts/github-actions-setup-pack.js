#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { githubActionsSetupPack } from "../src/githubActionsSetupPack.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app";
const vercelProject = args.projectId || args.orgId
  ? {
      projectName: args.projectName || "trust402",
      projectId: args.projectId || "",
      orgId: args.orgId || "",
      source: "cli-args"
    }
  : safeProject(".vercel/project.json");

const result = githubActionsSetupPack({
  baseUrl,
  repo: args.repo || "kfubtik/trust402",
  workflowPath: args.workflowPath || ".github/workflows/vercel-production-deploy.yml",
  workflowPresent: existsSync(args.workflowPath || ".github/workflows/vercel-production-deploy.yml"),
  gitHead: commandText("git", ["rev-parse", "--short", "HEAD"]),
  vercelProject
}, {
  config
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "ready-to-configure") process.exit(1);

function safeProject(path) {
  if (!existsSync(path)) return null;
  try {
    return {
      ...JSON.parse(readFileSync(path, "utf8")),
      source: path
    };
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
