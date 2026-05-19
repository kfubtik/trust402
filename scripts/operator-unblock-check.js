#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { operatorUnblockReport } from "../src/operatorUnblockReport.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app";
const githubActionsFallbackPresent = existsSync(".github/workflows/vercel-production-deploy.yml");
const vercelProjectLinked = existsSync(".vercel/project.json");
const githubCliAuthenticated = commandOk("gh", ["auth", "status"]);

const report = operatorUnblockReport({
  baseUrl,
  candidatePriceUsd: args.candidatePrice,
  proofReserveUsd: args.proofReserveUsd,
  includeProof: args.skipProof !== true,
  includeAutonomous: args.includeAutonomous === true,
  includeRefillLive: args.includeRefillLive === true,
  githubActionsFallbackPresent,
  githubCliAuthenticated,
  vercelProjectLinked
}, {
  config
});

console.log(JSON.stringify({
  ...report,
  localContext: {
    gitRemote: commandText("git", ["config", "--get", "remote.origin.url"]),
    gitHead: commandText("git", ["rev-parse", "--short", "HEAD"]),
    vercelProject: vercelProjectLinked ? safeProjectSummary(".vercel/project.json") : null,
    githubCliAuthenticated
  }
}, null, 2));

if (args.strict === true && report.status !== "ready-for-final-window") process.exit(1);

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

function commandOk(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return result.status === 0;
}

function commandText(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return result.status === 0 ? String(result.stdout || "").trim() : null;
}

function safeProjectSummary(path) {
  try {
    const project = JSON.parse(readFileSync(path, "utf8"));
    return {
      projectName: project.projectName || null,
      projectIdConfigured: Boolean(project.projectId),
      orgIdConfigured: Boolean(project.orgId)
    };
  } catch {
    return null;
  }
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
