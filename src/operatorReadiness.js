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
const SUPPORTED_PAYMENT_PROVIDERS = new Set(["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"]);

export function operatorReadiness(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const candidateEndpoint = input.candidateEndpoint || DEFAULT_CANDIDATE_ENDPOINT;
  const candidatePriceUsd = numberOr(input.candidatePriceUsd ?? input.priceUsd, DEFAULT_CANDIDATE_PRICE_USD);
  const proofReserveUsd = numberOr(input.proofReserveUsd, DEFAULT_PROOF_RESERVE_USD);
  const includeProof = input.includeProof !== false;
  const includeAutonomous = input.includeAutonomous === true;
  const includeAutoRefill = input.includeAutoRefill === true;
  const env = options.envDiagnostics || localEnvDiagnostics({ cwd: options.cwd });
  const paymentProviderChoice = choosePaymentProvider(input.paymentProvider, cfg, env);
  const paymentProvider = paymentProviderChoice.selected;
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
  const paymentRuntimeProfile = paymentRuntimeProfiles({
    cfg,
    env,
    selectedProvider: paymentProvider,
    alternatives: actionPack.liveWindowPlan.paymentProviderAlternatives
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
      envAgentcashBridgeReady: env.readiness.agentcashBridge.ready,
      envX402FetchBuyerReady: env.readiness.x402FetchBuyer.ready,
      recommendedPaymentRuntime: paymentRuntimeProfile.recommended?.provider || null,
      shortestPaymentRuntimeProviders: paymentRuntimeProfile.shortlist.map((item) => item.provider)
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
      configured: paymentProviderChoice.configured,
      source: paymentProviderChoice.source,
      recommendation: paymentProviderChoice.recommendation,
      readiness: providerReadiness,
      unblockProfile: paymentRuntimeProfile,
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
  if (paymentProvider === "x402-fetch") {
    return {
      id: "payment_runtime",
      status: env.readiness.x402FetchBuyer.ready ? "ready" : "blocked-config",
      missingNames: env.readiness.x402FetchBuyer.missing,
      nextAction: "Configure X402_BUYER_PRIVATE_KEY and X402_BUYER_RPC_URL only if runtime private-key custody is explicitly approved."
    };
  }
  return {
    id: "payment_runtime",
    status: providerReadiness.ready ? "ready" : "blocked-config",
    missingNames: providerReadiness.ready
      ? []
      : ["LIVE_PAYMENT_PROVIDER", ...(providerReadiness.requiredSecrets || [])],
    nextAction: providerReadiness.ready
      ? "Selected payment runtime is configured; run the matching preflight check before live spend."
      : "Set LIVE_PAYMENT_PROVIDER to agentcash-mcp, cdp-x402, x402-fetch, or external-adapter, then run the matching preflight check."
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

function paymentRuntimeProfiles({ cfg, env, selectedProvider, alternatives }) {
  const profiles = alternatives.map((alternative) => {
    const readiness = paymentProviderReadiness({
      ...cfg,
      livePaymentProvider: alternative.provider
    });
    const missingNames = missingPaymentNames(alternative.provider, env, readiness);
    const blockerIds = readiness.blockers.map((item) => item.id);
    const score = runtimeUnblockScore({
      provider: alternative.provider,
      missingNames,
      blockerIds,
      requiresBridgePreflight: alternative.requiresBridgePreflight,
      privateKeyMaterialRequired: alternative.privateKeyMaterialRequired,
      env
    });
    return {
      provider: alternative.provider,
      selected: alternative.provider === selectedProvider,
      ready: readiness.ready,
      runtime: readiness.runtime,
      score,
      missingNames,
      blockerIds,
      requiresBridgePreflight: alternative.requiresBridgePreflight,
      requiresCdpAccountRef: alternative.requiresCdpAccountRef,
      privateKeyMaterialRequired: alternative.privateKeyMaterialRequired,
      preflightCommand: alternative.preflightCommand,
      probeCommand: alternative.probeCommand,
      nextAction: nextPaymentRuntimeAction(alternative.provider, readiness.ready),
      safety: {
        includesSecretValues: false,
        sendsPaymentHeadersDuringPreflight: false,
        mutatesWalletDuringPreflight: false
      }
    };
  });
  const minScore = Math.min(...profiles.map((item) => item.score));
  const shortlist = profiles
    .filter((item) => item.score === minScore)
    .map(publicRuntimeProfile);
  const selectedProfile = profiles.find((item) => item.selected);
  const recommended = selectedProfile?.ready
    ? selectedProfile
    : profiles
        .filter((item) => item.score === minScore)
        .sort((a, b) => providerPreference(a.provider) - providerPreference(b.provider))[0];

  return {
    selected: selectedProvider,
    recommended: publicRuntimeProfile(recommended),
    selectedProfile: publicRuntimeProfile(selectedProfile),
    shortlist,
    profiles: profiles.map(publicRuntimeProfile),
    scoring: {
      lowerIsCloser: true,
      missingNameWeight: 1,
      blockerWeight: 1,
      bridgePreflightWeight: 1,
      privateKeyMaterialWeight: 3,
      cdpPartialCredentialBonus: -3
    },
    safety: {
      readOnly: true,
      includesSecretValues: false,
      mutatesEnv: false,
      sendsPaymentHeaders: false
    }
  };
}

function publicRuntimeProfile(profile) {
  if (!profile) return null;
  return {
    provider: profile.provider,
    selected: profile.selected,
    ready: profile.ready,
    runtime: profile.runtime,
    score: profile.score,
    missingNames: profile.missingNames,
    blockerIds: profile.blockerIds,
    requiresBridgePreflight: profile.requiresBridgePreflight,
    requiresCdpAccountRef: profile.requiresCdpAccountRef,
    privateKeyMaterialRequired: profile.privateKeyMaterialRequired,
    preflightCommand: profile.preflightCommand,
    probeCommand: profile.probeCommand,
    nextAction: profile.nextAction,
    safety: profile.safety
  };
}

function missingPaymentNames(provider, env, readiness) {
  if (provider === "cdp-x402") {
    return uniqueList([
      ...env.readiness.cdpX402Buyer.missing,
      ...env.readiness.cdpX402Buyer.missingAny
    ]);
  }
  if (provider === "agentcash-mcp" || provider === "external-adapter") {
    return uniqueList(env.readiness.agentcashBridge.missing);
  }
  if (provider === "x402-fetch") {
    return uniqueList(env.readiness.x402FetchBuyer.missing);
  }
  return uniqueList(readiness.requiredSecrets || []);
}

function runtimeUnblockScore({
  provider,
  missingNames,
  blockerIds,
  requiresBridgePreflight,
  privateKeyMaterialRequired,
  env
}) {
  let score = missingNames.length + blockerIds.length;
  if (requiresBridgePreflight) score += 1;
  if (privateKeyMaterialRequired) score += 3;
  if (provider === "cdp-x402" && (hasUsable(env.keys?.CDP_API_KEY_ID) || hasUsable(env.keys?.CDP_API_KEY_SECRET))) {
    score -= 3;
  }
  return score;
}

function nextPaymentRuntimeAction(provider, ready) {
  if (ready) return "Run the provider preflight, then stage the bounded live evidence window.";
  if (provider === "cdp-x402") {
    return "Finish CDP_WALLET_SECRET plus an existing CDP_EVM_ACCOUNT_ADDRESS or CDP_EVM_ACCOUNT_NAME, then run payment:buyer-preflight.";
  }
  if (provider === "agentcash-mcp" || provider === "external-adapter") {
    return "Configure LIVE_PAYMENT_ADAPTER_URL and run payment:bridge-check before live spend.";
  }
  if (provider === "x402-fetch") {
    return "Configure X402_BUYER_PRIVATE_KEY and X402_BUYER_RPC_URL only if runtime private-key custody is explicitly approved.";
  }
  return "Select a supported LIVE_PAYMENT_PROVIDER and rerun readiness.";
}

function providerPreference(provider) {
  return {
    "cdp-x402": 0,
    "agentcash-mcp": 1,
    "external-adapter": 2,
    "x402-fetch": 3
  }[provider] ?? 9;
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

function uniqueList(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function choosePaymentProvider(inputProvider, cfg, env) {
  const configured = inputProvider || cfg.livePaymentProvider || "disabled";
  if (SUPPORTED_PAYMENT_PROVIDERS.has(configured)) {
    return {
      selected: configured,
      configured,
      source: inputProvider ? "input" : "runtime",
      recommendation: null
    };
  }

  const cdpSignal = hasUsable(env.keys?.CDP_API_KEY_ID) ||
    hasUsable(env.keys?.CDP_API_KEY_SECRET) ||
    Boolean(cfg.cdpApiKeyIdConfigured) ||
    Boolean(cfg.cdpApiKeySecretConfigured);
  const selected = cdpSignal ? "cdp-x402" : "agentcash-mcp";
  return {
    selected,
    configured,
    source: "recommended",
    recommendation: {
      provider: selected,
      reason: cdpSignal
        ? "CDP credentials are partially present, so the shortest unblock path is to finish CDP wallet/account config."
        : "No configured live payment provider was detected, so start with an external AgentCash-compatible bridge."
    }
  };
}

function hasUsable(status) {
  return Boolean(status?.present && status.nonEmpty && !status.placeholderLike);
}
