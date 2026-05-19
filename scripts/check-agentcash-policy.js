import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateAgentcashPolicyGuard } from "../src/agentcashPolicyGuard.js";

const policyPath = ".local/trust402-agentcash-wallet.json";
const args = parseArgs(process.argv.slice(2));
const requiredRoot = resolve(process.cwd());

if (!existsSync(policyPath)) {
  console.log(JSON.stringify({
    ok: true,
    tool: "agentcash.policy_check",
    status: "not-configured",
    policyPath,
    liveSpendAllowed: false,
    autoRefillAllowed: false,
    paidProofDelegationAllowed: false,
    message: "No local AgentCash policy file exists. Live operator spend remains blocked."
  }, null, 2));
  process.exit(0);
}

const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const allowedRoot = resolve(policy.restrictions?.allowedProjectRoot || "");
const guard = evaluateAgentcashPolicyGuard(policy, {
  cwd: process.cwd(),
  mode: args.mode || "locked",
  includeProof: args.includeProof === "true",
  includeRefillLive: args.includeRefillLive === "true",
  estimatedMaxSpendUsd: args.estimatedSpend || args.estimatedMaxSpendUsd
});

const ok = guard.ok;
console.log(JSON.stringify({
  ok,
  tool: "agentcash.policy_check",
  status: guard.status,
  mode: guard.mode,
  policyPath,
  wallet: {
    provider: policy.wallet?.provider || null,
    network: policy.wallet?.network || null,
    addressPreview: maskAddress(policy.wallet?.address)
  },
  restrictions: {
    allowedOriginsCount: Array.isArray(policy.restrictions?.allowedOrigins) ? policy.restrictions.allowedOrigins.length : 0,
    blockedUsesCount: Array.isArray(policy.restrictions?.blockedUses) ? policy.restrictions.blockedUses.length : 0
  },
  limits: {
    agentcashGlobalMaxAmountUsd: policy.limits?.agentcashGlobalMaxAmountUsd ?? null,
    manualSmokeRemainingBudgetUsd: policy.limits?.manualSmokeRemainingBudgetUsd ?? null,
    minimumReserveUsd: policy.limits?.minimumReserveUsd ?? null,
    autoRefillEnabled: policy.limits?.autoRefill?.enabled ?? null,
    futureThresholdUsd: policy.limits?.autoRefill?.futureThresholdUsd ?? null
  },
  approvals: guard.approvals,
  liveSpendAllowed: guard.liveSpendAllowed,
  autoRefillAllowed: guard.autoRefillAllowed,
  paidProofDelegationAllowed: guard.paidProofDelegationAllowed,
  warnings: guard.warnings,
  failures: guard.failures
}, null, 2));

if (!ok) process.exit(1);

function maskAddress(value) {
  if (typeof value !== "string" || value.length < 12) return null;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) continue;
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
      parsed[key] = "true";
    }
  }
  return parsed;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
