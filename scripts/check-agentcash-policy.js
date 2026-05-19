import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const policyPath = ".local/trust402-agentcash-wallet.json";
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
const failures = [];

if (policy.service !== "Trust402") failures.push("service must be Trust402");
if (policy.status !== "dedicated-for-trust402-operator-spend") failures.push("wallet status must reserve this wallet for Trust402");
if (allowedRoot.toLowerCase() !== requiredRoot.toLowerCase()) failures.push("allowedProjectRoot must match current Trust402 root");
if (policy.wallet?.provider !== "AgentCash") failures.push("wallet provider must be AgentCash");
if (policy.wallet?.network !== "base") failures.push("wallet network must be base");
if (!includes(policy.restrictions?.allowedOrigins, "https://trust402.vercel.app")) failures.push("allowedOrigins must include Trust402 production");
if (!includes(policy.restrictions?.allowedOrigins, "https://proof402.vercel.app")) failures.push("allowedOrigins must include Proof402 production");
if (policy.restrictions?.trust402LiveProcurement !== "disabled-until-separate-approval") failures.push("Trust402 live procurement must remain disabled until approval");
if (policy.restrictions?.proof402Delegation !== "disabled-until-separate-approval") failures.push("Proof402 delegation must remain disabled until approval");
if (policy.limits?.autoRefill?.enabled !== false) failures.push("auto-refill must remain disabled");
if ((policy.limits?.manualSmokeRemainingBudgetUsd || 0) > 0) failures.push("manual smoke budget must be separately approved before paid calls");

const ok = failures.length === 0;
console.log(JSON.stringify({
  ok,
  tool: "agentcash.policy_check",
  status: ok ? "bound-to-trust402" : "blocked",
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
  liveSpendAllowed: false,
  autoRefillAllowed: false,
  paidProofDelegationAllowed: false,
  failures
}, null, 2));

if (!ok) process.exit(1);

function includes(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function maskAddress(value) {
  if (typeof value !== "string" || value.length < 12) return null;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
