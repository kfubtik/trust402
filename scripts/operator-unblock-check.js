#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { evaluateLocalAgentcashPolicyForLive, readLocalAgentcashPolicy } from "../src/localAgentcashPolicy.js";
import { operatorUnblockReport } from "../src/operatorUnblockReport.js";

const args = parseArgs(process.argv.slice(2));
const targetUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || "";
const baseUrl = targetUrl || config.publicBaseUrl || "https://trust402.vercel.app";
const githubActionsFallbackPresent = existsSync(".github/workflows/vercel-production-deploy.yml");
const vercelProjectLinked = existsSync(".vercel/project.json");
const githubCliAuthenticated = commandOk("gh", ["auth", "status"]);

const payload = {
  baseUrl,
  candidateEndpoint: args.candidateEndpoint,
  candidatePriceUsd: args.candidatePrice || args.candidatePriceUsd,
  paymentProvider: args.paymentProvider,
  proofReserveUsd: args.proofReserveUsd,
  includeProof: args.skipProof !== true,
  includeAutonomous: args.includeAutonomous === true,
  includeRefillLive: args.includeRefillLive === true,
  githubActionsFallbackPresent,
  githubCliAuthenticated,
  vercelProjectLinked
};

if (targetUrl && args.local !== true) {
  const report = await postRemoteJson(targetUrl, "/api/operator/unblock-report", payload);
  console.log(JSON.stringify({
    ...report,
    remoteContext: {
      baseUrl: targetUrl.replace(/\/$/, ""),
      source: "/api/operator/unblock-report"
    },
    localProbeContext: localContext({ vercelProjectLinked, githubCliAuthenticated, payload })
  }, null, 2));
  if (args.strict === true && report.status !== "ready-for-final-window") process.exit(1);
  process.exit(0);
}

const report = operatorUnblockReport(payload, { config });

console.log(JSON.stringify({
  ...report,
  localContext: localContext({ vercelProjectLinked, githubCliAuthenticated, payload })
}, null, 2));

if (args.strict === true && report.status !== "ready-for-final-window") process.exit(1);

async function postRemoteJson(base, path, body) {
  const url = `${String(base).replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`${url} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

function localContext({ vercelProjectLinked, githubCliAuthenticated, payload }) {
  return {
    gitRemote: commandText("git", ["config", "--get", "remote.origin.url"]),
    gitHead: commandText("git", ["rev-parse", "--short", "HEAD"]),
    vercelProject: vercelProjectLinked ? safeProjectSummary(".vercel/project.json") : null,
    githubCliAuthenticated,
    agentcashPolicy: localAgentcashPolicyProbe(payload)
  };
}

function localAgentcashPolicyProbe(payload) {
  const estimatedMaxSpendUsd = estimatedSpendUsd(payload);
  const result = evaluateLocalAgentcashPolicyForLive({
    policyResult: readLocalAgentcashPolicy(),
    baseUrl: payload.baseUrl,
    proof402BaseUrl: config.proof402BaseUrl || "https://proof402.vercel.app",
    candidateEndpoint: payload.candidateEndpoint,
    estimatedMaxSpendUsd,
    includeProof: payload.includeProof !== false,
    includeRefillLive: payload.includeRefillLive === true
  });

  return {
    source: ".local/trust402-agentcash-wallet.json",
    trustLevel: "local-read-only",
    ok: result.ok,
    estimatedMaxSpendUsd,
    summary: result.summary,
    blockers: result.blockers.map((item) => ({
      id: item.id,
      message: item.message
    }))
  };
}

function estimatedSpendUsd(payload) {
  const candidate = numberOr(payload.candidatePriceUsd, 0.01);
  const proof = payload.includeProof === false
    ? 0
    : numberOr(payload.proofReserveUsd, Math.max(config.proof402MaxSpendUsd || 0, 0.01));
  return roundUsd(candidate * (payload.includeAutonomous === true ? 2 : 1) + proof);
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

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
