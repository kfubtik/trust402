import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LOCAL_AGENTCASH_POLICY_PATH = ".local/trust402-agentcash-wallet.json";

const APPROVED_LIVE_VALUES = new Set(["approved", "approved-for-manual-smoke"]);

export function readLocalAgentcashPolicy(options = {}) {
  const cwd = options.cwd || process.cwd();
  const policyPath = options.policyPath || LOCAL_AGENTCASH_POLICY_PATH;
  const absolutePath = resolve(cwd, policyPath);

  if (!existsSync(absolutePath)) {
    return {
      present: false,
      policyPath,
      policy: null,
      failures: ["No local AgentCash policy file exists; live operator spend remains blocked."],
      summary: {
        present: false,
        policyPath,
        status: "not-configured"
      }
    };
  }

  try {
    const policy = JSON.parse(readFileSync(absolutePath, "utf8"));
    return {
      present: true,
      policyPath,
      policy,
      failures: [],
      summary: summarizePolicy(policy, { cwd, policyPath })
    };
  } catch (error) {
    return {
      present: true,
      policyPath,
      policy: null,
      failures: [`Local AgentCash policy could not be parsed: ${error.message}`],
      summary: {
        present: true,
        policyPath,
        status: "parse-error"
      }
    };
  }
}

export function evaluateLocalAgentcashPolicyForLive(input = {}) {
  const policyResult = input.policyResult || readLocalAgentcashPolicy({ cwd: input.cwd });
  const policy = policyResult.policy;
  const cwd = input.cwd || process.cwd();
  const estimatedMaxSpendUsd = numberOrNull(input.estimatedMaxSpendUsd) ?? 0;
  const blockers = [...(policyResult.failures || []).map((message) => ({
    id: "local_agentcash_policy_invalid",
    message
  }))];

  if (!policyResult.present) {
    blockers.push({
      id: "local_agentcash_policy_missing",
      message: `${LOCAL_AGENTCASH_POLICY_PATH} is required before any Trust402 live spend.`
    });
  }

  if (!policy) {
    return evaluationResult({ policyResult, blockers });
  }

  const expectedRoot = resolve(cwd);
  const allowedRoot = resolve(policy.restrictions?.allowedProjectRoot || "");
  const allowedOrigins = Array.isArray(policy.restrictions?.allowedOrigins)
    ? policy.restrictions.allowedOrigins
    : [];
  const baseOrigin = originOf(input.baseUrl);
  const proofOrigin = originOf(input.proof402BaseUrl || "https://proof402.vercel.app");
  const remainingBudgetUsd = numberOrNull(policy.limits?.manualSmokeRemainingBudgetUsd);
  const globalMaxUsd = numberOrNull(policy.limits?.agentcashGlobalMaxAmountUsd);
  const lastVerifiedBalanceUsd = numberOrNull(policy.limits?.lastVerifiedBalanceUsd);
  const minimumReserveUsd = numberOrNull(policy.limits?.minimumReserveUsd);

  if (policy.service !== "Trust402") blockers.push(blocker("local_policy_wrong_service", "Local AgentCash policy service must be Trust402."));
  if (policy.status !== "dedicated-for-trust402-operator-spend") {
    blockers.push(blocker("local_wallet_not_dedicated", "Local AgentCash wallet must be dedicated to Trust402 operator spend."));
  }
  if (allowedRoot.toLowerCase() !== expectedRoot.toLowerCase()) {
    blockers.push(blocker("local_policy_wrong_project_root", "Local AgentCash policy allowedProjectRoot must match this Trust402 checkout."));
  }
  if (policy.wallet?.provider !== "AgentCash") blockers.push(blocker("local_wallet_wrong_provider", "Local spend wallet provider must be AgentCash."));
  if (policy.wallet?.network !== "base") blockers.push(blocker("local_wallet_wrong_network", "Local AgentCash wallet network must be base."));
  if (baseOrigin && !allowedOrigins.includes(baseOrigin)) {
    blockers.push(blocker("local_origin_not_allowed", `Local AgentCash policy must allow ${baseOrigin}.`));
  }
  if (input.includeProof && proofOrigin && !allowedOrigins.includes(proofOrigin)) {
    blockers.push(blocker("local_proof402_origin_not_allowed", `Local AgentCash policy must allow ${proofOrigin} for paid Proof402 delegation.`));
  }
  if (!APPROVED_LIVE_VALUES.has(policy.restrictions?.trust402LiveProcurement)) {
    blockers.push(blocker("local_live_procurement_not_approved", "Local AgentCash policy has not approved Trust402 live procurement."));
  }
  if (input.includeProof && !APPROVED_LIVE_VALUES.has(policy.restrictions?.proof402Delegation)) {
    blockers.push(blocker("local_proof402_not_approved", "Local AgentCash policy has not approved paid Proof402 delegation."));
  }
  if (input.includeRefillLive && policy.limits?.autoRefill?.enabled !== true) {
    blockers.push(blocker("local_auto_refill_not_approved", "Local AgentCash policy has not approved live auto-refill."));
  }
  if (!(remainingBudgetUsd > 0)) {
    blockers.push(blocker("local_manual_smoke_budget_exhausted", "Local manual smoke budget is zero; live evidence smoke is blocked."));
  } else if (estimatedMaxSpendUsd > remainingBudgetUsd) {
    blockers.push(blocker("local_estimate_exceeds_manual_budget", `Estimated max spend ${estimatedMaxSpendUsd} exceeds local manual smoke budget ${remainingBudgetUsd}.`));
  }
  if (globalMaxUsd !== null && globalMaxUsd >= 0 && estimatedMaxSpendUsd > globalMaxUsd) {
    blockers.push(blocker("local_estimate_exceeds_global_cap", `Estimated max spend ${estimatedMaxSpendUsd} exceeds local AgentCash global cap ${globalMaxUsd}.`));
  }
  if (
    lastVerifiedBalanceUsd !== null &&
    minimumReserveUsd !== null &&
    lastVerifiedBalanceUsd - estimatedMaxSpendUsd < minimumReserveUsd
  ) {
    blockers.push(blocker("local_minimum_reserve_would_break", "Estimated spend would bring the last verified AgentCash balance below the local minimum reserve."));
  }

  return evaluationResult({ policyResult, blockers });
}

export function summarizePolicy(policy, options = {}) {
  const cwd = options.cwd || process.cwd();
  const allowedRoot = resolve(policy?.restrictions?.allowedProjectRoot || "");
  return {
    present: true,
    policyPath: options.policyPath || LOCAL_AGENTCASH_POLICY_PATH,
    status: policy?.status || null,
    service: policy?.service || null,
    wallet: {
      provider: policy?.wallet?.provider || null,
      network: policy?.wallet?.network || null,
      addressPreview: maskAddress(policy?.wallet?.address)
    },
    restrictions: {
      allowedProjectRootMatches: allowedRoot.toLowerCase() === resolve(cwd).toLowerCase(),
      allowedOriginsCount: Array.isArray(policy?.restrictions?.allowedOrigins) ? policy.restrictions.allowedOrigins.length : 0,
      trust402LiveProcurement: policy?.restrictions?.trust402LiveProcurement || null,
      proof402Delegation: policy?.restrictions?.proof402Delegation || null
    },
    limits: {
      agentcashGlobalMaxAmountUsd: policy?.limits?.agentcashGlobalMaxAmountUsd ?? null,
      manualSmokeRemainingBudgetUsd: policy?.limits?.manualSmokeRemainingBudgetUsd ?? null,
      lastVerifiedBalanceUsd: policy?.limits?.lastVerifiedBalanceUsd ?? null,
      minimumReserveUsd: policy?.limits?.minimumReserveUsd ?? null,
      autoRefillEnabled: policy?.limits?.autoRefill?.enabled ?? null,
      futureThresholdUsd: policy?.limits?.autoRefill?.futureThresholdUsd ?? null
    }
  };
}

function evaluationResult({ policyResult, blockers }) {
  return {
    ok: blockers.length === 0,
    blockers,
    summary: policyResult.summary || (policyResult.policy
      ? summarizePolicy(policyResult.policy, { policyPath: policyResult.policyPath || LOCAL_AGENTCASH_POLICY_PATH })
      : {
          present: Boolean(policyResult.present),
          policyPath: policyResult.policyPath || LOCAL_AGENTCASH_POLICY_PATH
        })
  };
}

function blocker(id, message) {
  return { id, message };
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function numberOrNull(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maskAddress(value) {
  if (typeof value !== "string" || value.length < 12) return null;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
