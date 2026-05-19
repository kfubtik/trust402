import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_PROOF402_BASE_URL = "https://proof402.vercel.app";
const SUPPORTED_PAYMENT_PROVIDERS = new Set(["agentcash-mcp", "x402-fetch", "external-adapter"]);

export function liveWindowPlan(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const candidateEndpoint = input.candidateEndpoint || input.endpoint || "";
  const candidateOrigin = originOf(candidateEndpoint);
  const proof402BaseUrl = normalizeBaseUrl(input.proof402BaseUrl || cfg.proof402BaseUrl || DEFAULT_PROOF402_BASE_URL);
  const proof402Origin = originOf(proof402BaseUrl);
  const paymentProvider = choosePaymentProvider(input.paymentProvider, cfg.livePaymentProvider);
  const includeAutonomous = input.includeAutonomous === true;
  const includeProof = input.includeProof !== false;
  const includeAutoRefill = input.includeAutoRefill === true;
  const candidatePriceUsd = numberOr(input.candidatePriceUsd ?? input.priceUsd, 0.01);
  const proofReserveUsd = numberOr(input.proofReserveUsd, 0.01);
  const maxTotalUsd = numberOr(input.maxTotalUsd, Math.max(candidatePriceUsd + proofReserveUsd, 0.02));
  const manualSmokeBudgetUsd = numberOr(input.manualSmokeBudgetUsd, maxTotalUsd);
  const lastVerifiedBalanceUsd = numberOr(input.lastVerifiedBalanceUsd, 1);
  const minimumReserveUsd = numberOr(input.minimumReserveUsd, 0.5);
  const liveMaxPerCallUsd = numberOr(input.liveMaxPerCallUsd, Math.max(candidatePriceUsd, 0.01));
  const liveMaxPerJobUsd = numberOr(input.liveMaxPerJobUsd, maxTotalUsd);
  const liveDailyLimitUsd = numberOr(input.liveDailyLimitUsd, maxTotalUsd);
  const estimatedMaxSpendUsd = roundUsd(
    candidatePriceUsd * (includeAutonomous ? 2 : 1) +
    (includeProof ? proofReserveUsd : 0)
  );
  const allowlist = uniqueList([
    ...arrayOrEmpty(input.allowedRegistries),
    ...(candidateOrigin ? [candidateOrigin] : [])
  ]);
  const allowedOrigins = uniqueList([
    baseUrl,
    ...(proof402Origin ? [proof402Origin] : []),
    ...(candidateOrigin ? [candidateOrigin] : [])
  ]);
  const blockers = planBlockers({
    candidateEndpoint,
    candidateOrigin,
    paymentProvider,
    estimatedMaxSpendUsd,
    maxTotalUsd,
    manualSmokeBudgetUsd,
    lastVerifiedBalanceUsd,
    minimumReserveUsd,
    allowlist,
    includeProof,
    proof402BaseUrl,
    proofReserveUsd
  });

  const vercelEnvPlan = {
    production: {
      LIVE_SPEND_ENABLED: "true",
      LIVE_PAYMENT_PROVIDER: paymentProvider,
      LIVE_MAX_PER_CALL_USD: usd(liveMaxPerCallUsd),
      LIVE_MAX_PER_JOB_USD: usd(liveMaxPerJobUsd),
      LIVE_DAILY_LIMIT_USD: usd(liveDailyLimitUsd),
      LIVE_APPROVAL_THRESHOLD_USD: "0",
      LIVE_ALLOWED_REGISTRIES: allowlist.join(","),
      PROOF402_BASE_URL: proof402BaseUrl,
      PROOF402_DELEGATION_MODE: includeProof ? "live" : "disabled",
      PROOF402_MAX_SPEND_USD: includeProof ? usd(proofReserveUsd) : "0",
      AGENTCASH_AUTO_REFILL_APPROVED: includeAutoRefill ? "true" : "false",
      AGENTCASH_AUTO_REFILL_ENABLED: includeAutoRefill ? "true" : "false",
      AGENTCASH_AUTO_REFILL_PROVIDER: includeAutoRefill ? (input.refillProvider || "manual-action") : "",
      AGENTCASH_AUTO_REFILL_THRESHOLD_USD: "0.50",
      AGENTCASH_AUTO_REFILL_AMOUNT_USD: usd(numberOr(input.refillAmountUsd, 1)),
      AGENTCASH_AUTO_REFILL_DAILY_CAP_USD: usd(numberOr(input.refillDailyCapUsd, 2))
    },
    requiredSecretsAlreadyExistOrMustBeAddedManually: [
      "TRUST402_OPERATOR_API_KEY",
      paymentProvider === "external-adapter" ? "LIVE_PAYMENT_ADAPTER_URL" : null,
      paymentProvider === "x402-fetch" ? "X402_BUYER_PRIVATE_KEY" : null,
      paymentProvider === "x402-fetch" ? "X402_BUYER_RPC_URL" : null
    ].filter(Boolean)
  };

  const localPolicyPatch = {
    restrictions: {
      trust402LiveProcurement: "approved-for-manual-smoke",
      proof402Delegation: includeProof ? "approved-for-manual-smoke" : "disabled-until-separate-approval",
      allowedOrigins
    },
    limits: {
      agentcashGlobalMaxAmountUsd: usd(maxTotalUsd),
      manualSmokeRemainingBudgetUsd: usd(manualSmokeBudgetUsd),
      lastVerifiedBalanceUsd: usd(lastVerifiedBalanceUsd),
      minimumReserveUsd: usd(minimumReserveUsd),
      autoRefill: {
        enabled: includeAutoRefill,
        futureThresholdUsd: 0.5,
        requiresExplicitProviderAndCap: true
      }
    }
  };

  const command = [
    "npm run live:evidence-smoke --",
    baseUrl,
    "--live",
    `--candidate-endpoint=${candidateEndpoint || "<approved-x402-endpoint>"}`,
    `--candidate-price=${usd(candidatePriceUsd)}`,
    `--max-total-usd=${usd(maxTotalUsd)}`,
    includeAutonomous ? "--include-autonomous-live" : null
  ].filter(Boolean).join(" ");

  const planCore = {
    baseUrl,
    candidateEndpoint,
    estimatedMaxSpendUsd,
    maxTotalUsd,
    manualSmokeBudgetUsd,
    paymentProvider,
    includeProof,
    includeAutonomous,
    includeAutoRefill,
    blockers,
    vercelEnvPlan,
    localPolicyPatch,
    command
  };
  const planHash = sha256Json(planCore);

  return {
    ok: true,
    tool: "live.window_plan",
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0 ? "ready-to-stage" : "blocked",
    planHash,
    ...planCore,
    safety: {
      readOnly: true,
      writesLocalPolicy: false,
      setsVercelEnv: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      includesPrivateKeyMaterial: false
    },
    nextActions: blockers.length === 0
      ? [
          "Review this plan hash and local policy patch.",
          "Apply Vercel env values manually or through an approved secret-management flow.",
          "Update the ignored local AgentCash policy for the approved smoke window.",
          "Run the generated command only after the approval window is active."
        ]
      : blockers
  };
}

function planBlockers(input) {
  const blockers = [];
  if (!input.candidateEndpoint) blockers.push("Provide --candidate-endpoint for the approved downstream x402 resource.");
  if (input.candidateEndpoint && !input.candidateOrigin) blockers.push("Candidate endpoint must be a valid HTTPS URL.");
  if (input.candidateOrigin && !input.candidateOrigin.startsWith("https://")) blockers.push("Candidate endpoint must use HTTPS.");
  if (!SUPPORTED_PAYMENT_PROVIDERS.has(input.paymentProvider)) {
    blockers.push("Payment provider must be agentcash-mcp, x402-fetch, or external-adapter.");
  }
  if (input.estimatedMaxSpendUsd > input.maxTotalUsd) {
    blockers.push(`Estimated max spend ${usd(input.estimatedMaxSpendUsd)} exceeds max total ${usd(input.maxTotalUsd)}.`);
  }
  if (input.estimatedMaxSpendUsd > input.manualSmokeBudgetUsd) {
    blockers.push(`Estimated max spend ${usd(input.estimatedMaxSpendUsd)} exceeds manual smoke budget ${usd(input.manualSmokeBudgetUsd)}.`);
  }
  if (input.lastVerifiedBalanceUsd - input.estimatedMaxSpendUsd < input.minimumReserveUsd) {
    blockers.push("Estimated spend would break the requested AgentCash minimum reserve.");
  }
  if (input.allowlist.length === 0) blockers.push("LIVE_ALLOWED_REGISTRIES would be empty.");
  if (input.includeProof && !input.proof402BaseUrl) blockers.push("PROOF402_BASE_URL is required when paid Proof402 is included.");
  if (input.includeProof && !(input.proofReserveUsd > 0)) blockers.push("Proof402 reserve must be greater than zero.");
  return blockers;
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function choosePaymentProvider(inputProvider, configuredProvider) {
  if (inputProvider) return inputProvider;
  if (configuredProvider && configuredProvider !== "disabled") return configuredProvider;
  return "agentcash-mcp";
}

function arrayOrEmpty(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function uniqueList(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function usd(value) {
  return String(roundUsd(value));
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
