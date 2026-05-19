#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentcashRefillCheck } from "../src/agentcashRefill.js";
import { config } from "../src/config.js";

const policyPath = ".local/trust402-agentcash-wallet.json";
const args = parseArgs(process.argv.slice(2));
const policy = existsSync(policyPath)
  ? JSON.parse(readFileSync(policyPath, "utf8"))
  : null;
const currentBalanceUsd = args.balance !== undefined
  ? Number.parseFloat(args.balance)
  : Number.parseFloat(policy?.limits?.lastVerifiedBalanceUsd ?? "NaN");
const amountRefilledTodayUsd = args.refilledToday !== undefined
  ? Number.parseFloat(args.refilledToday)
  : 0;
const failures = localPolicyFailures(policy);

const result = await agentcashRefillCheck({
  mode: args.mode || "dry-run",
  currentBalanceUsd,
  amountRefilledTodayUsd
}, {
  config
});

const output = {
  ...result,
  localPolicy: policy
    ? {
        present: true,
        status: policy.status || null,
        wallet: {
          provider: policy.wallet?.provider || null,
          network: policy.wallet?.network || null,
          addressPreview: maskAddress(policy.wallet?.address)
        },
        allowedProjectRootMatches: resolve(policy.restrictions?.allowedProjectRoot || "").toLowerCase() === resolve(process.cwd()).toLowerCase(),
        manualSmokeRemainingBudgetUsd: policy.limits?.manualSmokeRemainingBudgetUsd ?? null,
        minimumReserveUsd: policy.limits?.minimumReserveUsd ?? null,
        failures
      }
    : {
        present: false,
        failures: ["No local AgentCash policy file exists; live refill remains blocked."]
      }
};

console.log(JSON.stringify(output, null, 2));
if (failures.length > 0 || output.decision.action === "collect-balance") process.exit(1);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function localPolicyFailures(policy) {
  if (!policy) return [];
  const failures = [];
  if (policy.service !== "Trust402") failures.push("service must be Trust402");
  if (policy.wallet?.provider !== "AgentCash") failures.push("wallet provider must be AgentCash");
  if (policy.wallet?.network !== config.agentcashNetwork) failures.push("wallet network must match AGENTCASH_NETWORK");
  if (policy.limits?.autoRefill?.enabled !== false) failures.push("local policy auto-refill must remain disabled until explicit approval");
  if ((policy.limits?.manualSmokeRemainingBudgetUsd || 0) > 0) failures.push("manual smoke budget must be separately approved before paid calls");
  return failures;
}

function maskAddress(value) {
  if (typeof value !== "string" || value.length < 12) return null;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
