#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";
import { readLocalAgentcashPolicy } from "../src/localAgentcashPolicy.js";
import { operatorActionPack } from "../src/operatorActionPack.js";

const args = parseArgs(process.argv.slice(2));
const targetUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || "";
const baseUrl = targetUrl || config.publicBaseUrl || "https://trust402.vercel.app";
const vercelProjectLinked = existsSync(".vercel/project.json");
const localAgentcashPolicyResult = readLocalAgentcashPolicy();

const payload = {
  baseUrl,
  candidateEndpoint: args.candidateEndpoint,
  candidatePriceUsd: args.candidatePrice || args.candidatePriceUsd,
  maxTotalUsd: args.maxTotalUsd,
  proofReserveUsd: args.proofReserveUsd,
  includeProof: args.skipProof !== true,
  includeAutonomous: args.includeAutonomous === true,
  includeAutoRefill: args.includeAutoRefill === true,
  paymentProvider: args.paymentProvider,
  allowedRegistries: args.allowedRegistries,
  refillProvider: args.refillProvider,
  refillAmountUsd: args.refillAmountUsd,
  refillDailyCapUsd: args.refillDailyCapUsd,
  liveMaxPerCallUsd: args.liveMaxPerCallUsd,
  liveMaxPerJobUsd: args.liveMaxPerJobUsd,
  liveDailyLimitUsd: args.liveDailyLimitUsd,
  liveSpentTodayUsd: args.liveSpentTodayUsd || args.liveSpentToday,
  selectedDomain: args.selectedDomain || args.domain,
  candidateDomains: args.candidateDomains,
  selectedDomainAvailable: args.selectedDomainAvailable,
  selectedDomainPriceUsd: args.selectedDomainPriceUsd,
  selectedDomainPeriodYears: args.selectedDomainPeriodYears,
  selectedDomainPurchaseUrl: args.selectedDomainPurchaseUrl,
  selectedDomainAvailabilityMessage: args.selectedDomainAvailabilityMessage,
  availabilityCheckedAt: args.availabilityCheckedAt,
  availabilitySource: args.availabilitySource,
  domainAvailability: parseJsonArg(args.domainAvailabilityJson),
  githubActionsFallbackPresent: existsSync(".github/workflows/vercel-production-deploy.yml"),
  githubCliAuthenticated: commandOk("gh", ["auth", "status"]),
  vercelProjectLinked,
  vercelProject: vercelProjectLinked ? safeProjectSummary(".vercel/project.json") : null
};

if (targetUrl && args.local !== true) {
  const result = await postRemoteJson(targetUrl, "/api/operator/action-pack", payload);
  const localOverlay = operatorActionPack(payload, {
    config,
    localAgentcashPolicyResult
  });
  console.log(JSON.stringify({
    ...result,
    remoteContext: {
      baseUrl: targetUrl.replace(/\/$/, ""),
      source: "/api/operator/action-pack"
    },
    localExecutionContext: {
      source: ".local/trust402-agentcash-wallet.json",
      note: "Production cannot read local AgentCash policy; use this overlay for workstation live-smoke staging.",
      agentcashPolicy: {
        present: localAgentcashPolicyResult.present,
        policyPath: localAgentcashPolicyResult.policyPath,
        summary: localAgentcashPolicyResult.summary
      },
      liveWindowPlan: localOverlay.liveWindowPlan,
      liveProcurementAction: localOverlay.actions.find((action) => action.id === "live_procurement") || null,
      paidProof402Action: localOverlay.actions.find((action) => action.id === "paid_proof402_delegation") || null
    }
  }, null, 2));
  if (args.strict === true && result.status !== "ready-for-final-window") process.exit(1);
  process.exit(0);
}

const result = operatorActionPack(payload, {
  config,
  localAgentcashPolicyResult
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "ready-for-final-window") process.exit(1);

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
      const key = toCamel(raw.slice(0, eq));
      parsed[key] = key === "domainAvailabilityJson" ? raw.slice(eq + 1) : parseValue(raw.slice(eq + 1));
      continue;
    }
    const key = toCamel(raw);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = key === "domainAvailabilityJson" ? next : parseValue(next);
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function parseValue(value) {
  if (typeof value === "string" && value.includes(",") && !/^https?:\/\//.test(value)) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return value;
}

function parseJsonArg(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Invalid --domain-availability-json: ${error.message}`);
    process.exit(1);
  }
}

function commandOk(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return result.status === 0;
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
