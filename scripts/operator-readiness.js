#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { operatorReadiness } from "../src/operatorReadiness.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app";

const report = operatorReadiness({
  baseUrl,
  candidateEndpoint: args.candidateEndpoint,
  candidatePriceUsd: args.candidatePrice || args.candidatePriceUsd,
  proofReserveUsd: args.proofReserveUsd,
  includeProof: args.skipProof !== true,
  includeAutonomous: args.includeAutonomous === true,
  includeAutoRefill: args.includeAutoRefill === true,
  paymentProvider: args.paymentProvider,
  githubActionsFallbackPresent: existsSync(".github/workflows/vercel-production-deploy.yml"),
  githubCliAuthenticated: commandOk("gh", ["auth", "status"]),
  vercelProjectLinked: existsSync(".vercel/project.json"),
  selectedDomain: args.selectedDomain || args.domain
}, { config });

console.log(JSON.stringify(report, null, 2));
if (args.strict === true && report.status !== "ready-for-live-evidence-window") process.exit(1);

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

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
