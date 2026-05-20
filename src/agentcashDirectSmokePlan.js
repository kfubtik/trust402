import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { evaluateLocalAgentcashPolicyForLive, readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";
import { liveWindowPlan } from "./liveWindowPlan.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_COMPARE_PATH = "/api/trust/compare-resources";
const DEFAULT_COMPARE_PRICE_USD = 0.03;

export function agentcashDirectSmokePlan(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const candidateEndpoint = input.candidateEndpoint || `${baseUrl}${DEFAULT_COMPARE_PATH}`;
  const candidatePriceUsd = numberOr(input.candidatePriceUsd ?? input.priceUsd, DEFAULT_COMPARE_PRICE_USD);
  const maxAmountUsd = numberOr(input.maxAmountUsd ?? input.maxTotalUsd, candidatePriceUsd);
  const localPolicyResult = options.localAgentcashPolicyResult || readLocalAgentcashPolicy({
    cwd: options.cwd
  });
  const policySummary = localPolicyResult.summary || {};

  const livePlan = liveWindowPlan({
    baseUrl,
    candidateEndpoint,
    candidatePriceUsd,
    maxTotalUsd: maxAmountUsd,
    manualSmokeBudgetUsd: maxAmountUsd,
    liveMaxPerCallUsd: maxAmountUsd,
    includeProof: false,
    lastVerifiedBalanceUsd: input.lastVerifiedBalanceUsd ?? policySummary.limits?.lastVerifiedBalanceUsd,
    minimumReserveUsd: input.minimumReserveUsd ?? policySummary.limits?.minimumReserveUsd
  }, options);
  const directSmoke = livePlan.agentcashDirectSmoke;
  const estimatedSpendUsd = directSmoke?.safety?.maxAmountUsd ?? maxAmountUsd;
  const localPolicyGuard = evaluateLocalAgentcashPolicyForLive({
    policyResult: localPolicyResult,
    cwd: options.cwd,
    baseUrl,
    candidateEndpoint,
    estimatedMaxSpendUsd: estimatedSpendUsd,
    includeProof: false,
    includeRefillLive: false
  });
  const policyWindowReady = localPolicyGuard.ok;
  const supported = directSmoke?.status === "operator-approval-required";
  const status = !supported
    ? "unsupported-candidate"
    : policyWindowReady
      ? "ready-for-explicit-paid-fetch-approval"
      : "blocked-policy-window";

  const schemaCheckInput = directSmoke?.schemaCheck?.input || null;
  const paidFetchInput = directSmoke?.fetch?.input || null;
  const planCore = {
    baseUrl,
    candidateEndpoint,
    candidatePriceUsd,
    maxAmountUsd: estimatedSpendUsd,
    status,
    policyWindowReady,
    schemaCheckInput,
    paidFetchInput,
    localPolicyPatch: livePlan.localPolicyPatch
  };

  return {
    ok: true,
    tool: "agentcash.direct_smoke_plan",
    generatedAt: new Date().toISOString(),
    status,
    planHash: sha256Json(planCore),
    baseUrl,
    candidateEndpoint,
    targetResource: directSmoke?.targetResource || {
      id: "unknown",
      endpoint: candidateEndpoint,
      method: "POST",
      expectedPriceUsd: candidatePriceUsd
    },
    policyWindowReady,
    localPolicy: {
      present: localPolicyResult.present,
      policyPath: localPolicyResult.policyPath,
      summary: policySummary,
      blockers: localPolicyGuard.blockers
    },
    requiredLocalPolicyPatch: livePlan.localPolicyPatch,
    restoreAfterRun: restorePatch(localPolicyResult.policy),
    approval: {
      required: true,
      oneLineApproval: `Разрешаю одноразовый AgentCash paid fetch для ${candidateEndpoint} с maxAmount $${usd(estimatedSpendUsd)}, временно открыть local policy window на $${usd(estimatedSpendUsd)} и после проверки снова закрыть бюджет.`,
      notImpliedByGoalContinuation: true
    },
    mcpCallOrder: supported
      ? [
          {
            step: 1,
            tool: directSmoke.mcpTools.schemaCheck,
            pays: false,
            input: schemaCheckInput,
            inputHash: sha256Json(schemaCheckInput)
          },
          {
            step: 2,
            tool: directSmoke.mcpTools.paidFetch,
            pays: true,
            executeOnlyAfterApproval: true,
            input: paidFetchInput,
            inputHash: sha256Json(paidFetchInput)
          }
        ]
      : [],
    evidenceAfterSuccess: directSmoke?.evidenceAfterSuccess || null,
    nextActions: nextActions({ supported, policyWindowReady, directSmoke, localPolicyGuard }),
    safety: {
      readOnly: true,
      callsAgentcashMcp: false,
      executesPayment: false,
      mutatesWallet: false,
      writesLocalPolicy: false,
      includesPrivateKeyMaterial: false,
      privatePayloadAllowed: false,
      paidFetchWouldPayIfExecuted: supported,
      doesNotProveRuntimePaymentAdapter: true
    }
  };
}

function nextActions({ supported, policyWindowReady, directSmoke, localPolicyGuard }) {
  if (!supported) {
    return [
      directSmoke?.blocker || "Use a supported Trust402 compare-resources or Proof402 notarize endpoint."
    ];
  }
  if (!policyWindowReady) {
    return [
      "Get explicit operator approval for the exact one-line approval text.",
      "Apply requiredLocalPolicyPatch only for the one-shot paid smoke window.",
      ...localPolicyGuard.blockers.map((item) => item.message)
    ];
  }
  return [
    "Confirm explicit operator approval for the exact one-line approval text.",
    "Run mcpCallOrder step 1, review the unpaid schema/price result, then run step 2 only if it still matches maxAmount.",
    "Restore the local AgentCash policy to restoreAfterRun immediately after the paid smoke.",
    "Run the evidenceAfterSuccess commands and update Bazaar evidence env only if CDP reports 10/10."
  ];
}

function restorePatch(policy) {
  if (!policy) return null;
  return {
    restrictions: {
      trust402LiveProcurement: policy.restrictions?.trust402LiveProcurement ?? null,
      proof402Delegation: policy.restrictions?.proof402Delegation ?? null,
      allowedOrigins: Array.isArray(policy.restrictions?.allowedOrigins)
        ? policy.restrictions.allowedOrigins
        : []
    },
    limits: {
      agentcashGlobalMaxAmountUsd: policy.limits?.agentcashGlobalMaxAmountUsd ?? null,
      manualSmokeRemainingBudgetUsd: policy.limits?.manualSmokeRemainingBudgetUsd ?? null,
      lastVerifiedBalanceUsd: policy.limits?.lastVerifiedBalanceUsd ?? null,
      minimumReserveUsd: policy.limits?.minimumReserveUsd ?? null,
      autoRefill: {
        enabled: policy.limits?.autoRefill?.enabled ?? null,
        futureThresholdUsd: policy.limits?.autoRefill?.futureThresholdUsd ?? null
      }
    }
  };
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function usd(value) {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}
