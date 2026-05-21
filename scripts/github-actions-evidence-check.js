#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { githubActionsDeployEvidenceCheck } from "../src/githubActionsDeployEvidence.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app";
const evidenceFile = args.evidenceFile || ".local/github-actions-evidence/deployment-evidence.json";
const runJsonFile = args.runJson || args.workflowRunJson || "";
const evidence = readJsonIfPresent(evidenceFile);
const workflowRun = readJsonIfPresent(runJsonFile);

const result = githubActionsDeployEvidenceCheck({
  baseUrl,
  repo: args.repo || "kfubtik/trust402",
  gitHead: args.gitHead || commandText("git", ["rev-parse", "--short", "HEAD"]),
  evidence,
  workflowRun
}, {
  config
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.verified !== true) process.exit(1);

function readJsonIfPresent(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
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
