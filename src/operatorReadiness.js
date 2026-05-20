import { config } from "./config.js";
import { localEnvDiagnostics } from "./envDiagnostics.js";
import { evaluateLocalAgentcashPolicyForLive, readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";
import { operatorActionPack } from "./operatorActionPack.js";
import { operatorUnblockReport } from "./operatorUnblockReport.js";
import { paymentProviderReadiness } from "./paymentAdapters.js";
import { sha256Json } from "./hash.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_CANDIDATE_ENDPOINT = "https://proof402.vercel.app/api/proof/notarize";
const DEFAULT_CANDIDATE_PRICE_USD = 0.005;
const DEFAULT_PROOF_RESERVE_USD = 0.005;

export function operatorReadiness(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const candidateEndpoint = input.candidateEndpoint || DEFAULT_CANDIDATE_ENDPOINT;
  const candidatePriceUsd = numberOr(input.candidatePriceUsd ?? input.priceUsd, DEFAULT_CANDIDATE_PRICE_USD);
  const proofReserveUsd = numberOr(input.proofReserveUsd, DEFAULT_PROOF_RESERVE_USD);
  const includeProof = input.includeProof !== false;
  const includeAutonomous = input.includeAutonomous === true;
  const includeAutoRefill = input.includeAutoRefill === true;
  const paymentProvider = input.paymentProvider || cfg.livePaymentProvider || "agentcash-mcp";
  const env = options.envDiagnostics || localEnvDiagnostics({ cwd: options.cwd });
  const localPolicyResult = options.localAgentcashPolicyResult || readLocalAgentcashPolicy({ cwd: options.cwd });
  const estimatedMaxSpendUsd = estimatedSpend({ candidatePriceUsd, proofReserveUsd, includeProof, includeAutonomous });
  const localPolicy = evaluateLocalAgentcashPolicyForLive({
    policyResult: localPolicyResult,
    cwd: options.cwd,
    baseUrl,
    proof402BaseUrl: cfg.proof402BaseUrl || "https://proof402.vercel.app",
    candidateEndpoint,
    estimatedMaxSpendUsd,
    includeProof,
    includeRefillLive: includeAutoRefill
  });
  const actionPack = operatorActionPack({
    baseUrl,
    candidateEndpoint,
    candidatePriceUsd,
    proofReserveUsd,
    includeProof,
    includeAutonomous,
    includeAutoRefill,
    paymentProvider,
    githubActionsFallbackPresent: input.githubActionsFallbackPresent,
    githubCliAuthenticated: input.githubCliAuthenticated,
    vercelProjectLinked: input.vercelProjectLinked,
    selectedDomain: input.selectedDomain || input.domain
  }, {
    ...options,
    config: cfg,
    localAgentcashPolicyResult: localPolicyResult
  });
  const unblock = operatorUnblockReport({
    baseUrl,
    candidateEndpoint,
    candidatePriceUsd,
    proofReserveUsd,
    includeProof,
    includeAutonomous,
    includeRefillLive: includeAutoRefill,
    paymentProvider,
    githubActionsFallbackPresent: input.githubActionsFallbackPresent,
    githubCliAuthenticated: input.githubCliAuthenticated,
    vercelProjectLinked: input.vercelProjectLinked
  }, {
    ...options,
    config: cfg,
    localAgentcashPolicyResult: localPolicyResult
  });
  const providerReadiness = paymentProviderReadiness({
    ...cfg,
    livePaymentProvider: paymentProvider
  });
  const manualInputs = manualInputPlan({
    env,
    localPolicy,
    actionPack,
    unblock,
    providerReadiness,
    paymentProvider,
    includeAutoRefill
  });
  const readinessCore = {
    baseUrl,
    candidateEndpoint,
    paymentProvider,
    estimatedMaxSpendUsd,
    envReadiness: env.readiness,
    localPolicyOk: localPolicy.ok,
    actionStatus: actionPack.status,
    unblockStatus: unblock.status,
    manualInputs
  };

  return {
    ok: true,
    tool: "operator.readiness",
    generatedAt: new Date().toISOString(),
    status: manualInputs.every((item) => item.status === "ready" || item.status === "not-required")
      ? "ready-for-live-evidence-window"
      : "blocked",
    readinessHash: sha256Json(readinessCore),
    baseUrl,
    candidateEndpoint,
    paymentProvider,
    estimatedMaxSpendUsd,
    summary: {
      manualInputs: manualInputs.length,
      ready: manualInputs.filter((item) => item.status === "ready" || item.status === "not-required").length,
      blocked: manualInputs.filter((item) => item.status.startsWith("blocked")).length,
      nextBlockingId: manualInputs.find((item) => item.status.startsWith("blocked"))?.id || null,
      actionPackStatus: actionPack.status,
      unblockStatus: unblock.status,
      localAgentcashPolicyReady: localPolicy.ok,
      envCdpBuyerReady: env.readiness.cdpX402Buyer.ready,
      envAgentcashBridgeReady: env.readiness.agentcashBridge.ready
    },
    manualInputs,
    envDiagnostics: env,
    localAgentcashPolicy: {
      ok: localPolicy.ok,
      estimatedMaxSpendUsd,
      summary: localPolicy.summary,
      blockers: localPolicy.blockers
    },
    paymentProvider: {
      selected: paymentProvider,
      readiness: providerReadiness,
      alternatives: actionPack.liveWindowPlan.paymentProviderAlternatives
    },
    actionPack: {
      status: actionPack.status,
      actionPackHash: actionPack.actionPackHash,
      nextBlockingActionId: actionPack.evidenceCollection.nextBlockingActionId,
      evidenceEnvPlan: actionPack.evidenceCollection.evidenceEnvPlan,
      verifyCommands: actionPack.evidenceCollection.verifyCommands,
      localEvidenceRequired: actionPack.evidenceCollection.localEvidenceRequired,
      liveWindowPlanHash: actionPack.liveWindowPlan.planHash
    },
    unblockReport: {
      status: unblock.status,
      blockers: unblock.blockers,
      summary: unblock.summary
    },
    suggestedCommands: suggestedCommands({ baseUrl, paymentProvider, candidateEndpoint }),
    safety: {
      readOnly: true,
      mutatesGitHub: false,
      mutatesVercel: false,
      mutatesWallet: false,
      sendsPaymentHeaders: false,
      includesSecretValues: false,
      includesPrivateKeys: false,
      envDiagnosticsPrintValues: false
    }
  };
}

function manualInputPlan({
  env,
  localPolicy,
  actionPack,
  unblock,
  providerReadiness,
  paymentProvider,
  includeAutoRefill
}) {
  const gitAction = actionPack.actions.find((item) => item.id === "git_vercel_auto_deploy");
  const domainAction = actionPack.actions.find((item) => item.id === "custom_domain");
  const externalAction = actionPack.actions.find((item) => item.id === "external_x402_directories");
  const paymentEnv = paymentEnvRequirement(env, paymentProvider, providerReadiness);
  return [
    {
      id: "git_vercel_auto_deploy",
      status: gitAction?.status === "ready" ? "ready" : "blocked-manual",
      missingNames: gitAction?.fallbackPath?.requiredGitHubSecrets || ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"],
      nextAction: "Connect Vercel GitHub App access or configure GitHub Actions Vercel secrets, then capture a push-triggered deployment run."
    },
    {
      id: "custom_domain",
      status: domainAction?.status === "ready" ? "ready" : "blocked-manual",
      missingNames: domainAction?.status === "ready" ? [] : ["PUBLIC_BASE_URL", "TRUST402_CUSTOM_DOMAIN_READY"],
      nextAction: "Attach a non-free-hosting HTTPS domain and rerun domains:readiness-check."
    },
    {
      id: "external_x402_directories",
      status: externalAction?.status === "ready" ? "ready" : "blocked-external",
      missingNames: externalAction?.status === "ready"
        ? []
        : ["TRUST402_EXTERNAL_DIRECTORY_STATUS", "TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL", "TRUST402_EXTERNAL_DIRECTORY_NAME"],
      nextAction: "Submit public-safe listing only after custom-domain readiness and record visible non-CDP directory evidence."
    },
    paymentEnv,
    {
      id: "local_agentcash_policy",
      status: localPolicy.ok ? "ready" : "blocked-policy",
      missingNames: localPolicy.blockers.map((item) => item.id),
      nextAction: "Open a bounded local AgentCash policy window only after exact live-smoke approval."
    },
    {
      id: "agentcash_auto_refill",
      status: includeAutoRefill
        ? env.readiness.agentcashAutoRefill.ready ? "ready" : "blocked-policy"
        : "not-required",
      missingNames: includeAutoRefill ? env.readiness.agentcashAutoRefill.missing : [],
      nextAction: includeAutoRefill
        ? "Approve refill provider, threshold, amount, daily cap, and emergency-stop policy."
        : "Auto-refill live mode is not included in this readiness window."
    },
    {
      id: "completion_evidence",
      status: unblock.status === "ready-for-final-window" ? "ready" : "blocked-evidence",
      missingNames: unblock.blockers.map((item) => item.id),
      nextAction: "Resolve all non-final completion blockers before recording final verification evidence."
    }
  ];
}

function paymentEnvRequirement(env, paymentProvider, providerReadiness) {
  if (paymentProvider === "cdp-x402") {
    return {
      id: "payment_runtime",
      status: env.readiness.cdpX402Buyer.ready ? "ready" : "blocked-config",
      missingNames: [
        ...env.readiness.cdpX402Buyer.missing,
        ...env.readiness.cdpX402Buyer.missingAny
      ],
      nextAction: "Configure CDP_WALLET_SECRET plus either CDP_EVM_ACCOUNT_ADDRESS or CDP_EVM_ACCOUNT_NAME, then run payment:buyer-preflight."
    };
  }
  if (paymentProvider === "agentcash-mcp" || paymentProvider === "external-adapter") {
    return {
      id: "payment_runtime",
      status: env.readiness.agentcashBridge.ready ? "ready" : "blocked-config",
      missingNames: env.readiness.agentcashBridge.missing,
      nextAction: "Configure LIVE_PAYMENT_ADAPTER_URL and run payment:bridge-check before live spend."
    };
  }
  return {
    id: "payment_runtime",
    status: providerReadiness.ready ? "ready" : "blocked-config",
    missingNames: providerReadiness.requiredSecrets || [],
    nextAction: "Configure the selected payment runtime and run its preflight check."
  };
}

function suggestedCommands({ baseUrl, paymentProvider, candidateEndpoint }) {
  const paymentCommand = paymentProvider === "cdp-x402"
    ? "npm run payment:buyer-preflight -- --provider=cdp-x402 --strict"
    : `npm run payment:bridge-check -- --provider=${paymentProvider} --candidate-endpoint=${candidateEndpoint} --max-amount-usd=0.01 --strict`;
  return [
    "npm run env:doctor",
    `npm run operator:readiness -- ${baseUrl}`,
    "npm run deployment:github-actions-setup -- https://trust402.vercel.app",
    "npm run domains:readiness-check -- https://trust402.vercel.app --domain=<custom-domain>",
    paymentCommand,
    `npm run operator:unblock-report -- ${baseUrl}`,
    `npm run completion:actions -- ${baseUrl}`,
    `npm run final:verify -- ${baseUrl} --timeout-ms=10000`
  ];
}

function estimatedSpend({ candidatePriceUsd, proofReserveUsd, includeProof, includeAutonomous }) {
  const candidateMultiplier = includeAutonomous ? 2 : 1;
  return roundUsd(candidatePriceUsd * candidateMultiplier + (includeProof ? proofReserveUsd : 0));
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
