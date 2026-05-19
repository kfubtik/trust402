import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { liveWindowPlan } from "./liveWindowPlan.js";
import { operatorUnblockReport } from "./operatorUnblockReport.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_CANDIDATE_ENDPOINT = "https://proof402.vercel.app/api/proof/notarize";
const DEFAULT_CANDIDATE_PRICE_USD = 0.005;
const DEFAULT_PROOF402_RESERVE_USD = 0.005;

export function operatorActionPack(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const candidateEndpoint = input.candidateEndpoint || DEFAULT_CANDIDATE_ENDPOINT;
  const candidatePriceUsd = numberOr(input.candidatePriceUsd ?? input.priceUsd, DEFAULT_CANDIDATE_PRICE_USD);
  const maxTotalUsd = numberOr(input.maxTotalUsd, input.includeAutonomous === true ? 0.02 : 0.015);
  const proofReserveUsd = numberOr(input.proofReserveUsd, DEFAULT_PROOF402_RESERVE_USD);
  const includeProof = input.includeProof !== false;
  const includeAutonomous = input.includeAutonomous === true;
  const includeAutoRefill = input.includeAutoRefill === true;

  const unblock = operatorUnblockReport({
    baseUrl,
    candidatePriceUsd,
    proofReserveUsd,
    includeProof,
    includeAutonomous,
    includeRefillLive: includeAutoRefill,
    githubActionsFallbackPresent: input.githubActionsFallbackPresent,
    githubCliAuthenticated: input.githubCliAuthenticated,
    vercelProjectLinked: input.vercelProjectLinked
  }, options);

  const livePlan = liveWindowPlan({
    baseUrl,
    candidateEndpoint,
    candidatePriceUsd,
    maxTotalUsd,
    manualSmokeBudgetUsd: input.manualSmokeBudgetUsd || maxTotalUsd,
    paymentProvider: input.paymentProvider,
    allowedRegistries: input.allowedRegistries,
    proofReserveUsd,
    includeProof,
    includeAutonomous,
    includeAutoRefill,
    refillProvider: input.refillProvider,
    refillAmountUsd: input.refillAmountUsd,
    refillDailyCapUsd: input.refillDailyCapUsd,
    liveMaxPerCallUsd: input.liveMaxPerCallUsd,
    liveMaxPerJobUsd: input.liveMaxPerJobUsd,
    liveDailyLimitUsd: input.liveDailyLimitUsd,
    liveSpentTodayUsd: input.liveSpentTodayUsd,
    lastVerifiedBalanceUsd: input.lastVerifiedBalanceUsd,
    minimumReserveUsd: input.minimumReserveUsd
  }, options);

  const actions = [
    gitVercelAction(cfg, input),
    customDomainAction(baseUrl),
    externalDirectoryAction(cfg, baseUrl),
    liveProcurementAction(livePlan),
    proof402Action(livePlan),
    agentcashRefillAction(livePlan, includeAutoRefill),
    autonomousJobAction(livePlan),
    finalVerificationAction(baseUrl)
  ];

  const packCore = {
    baseUrl,
    candidateEndpoint,
    unblockStatus: unblock.status,
    livePlanStatus: livePlan.status,
    actions: actions.map((action) => ({
      id: action.id,
      status: action.status,
      required: action.required,
      evidenceEnv: action.evidenceEnv
    }))
  };
  const actionPackHash = sha256Json(packCore);

  return {
    ok: true,
    tool: "operator.action_pack",
    generatedAt: new Date().toISOString(),
    status: actions.every((action) => action.status === "ready" || action.status === "informational")
      ? "ready-for-final-window"
      : "blocked",
    actionPackHash,
    baseUrl,
    candidateEndpoint,
    summary: {
      totalActions: actions.length,
      ready: actions.filter((action) => action.status === "ready").length,
      blocked: actions.filter((action) => action.status.startsWith("blocked")).length,
      manual: actions.filter((action) => action.status.includes("manual")).length,
      livePlanStatus: livePlan.status,
      unblockStatus: unblock.status
    },
    unblockReport: {
      status: unblock.status,
      blockers: unblock.blockers,
      summary: unblock.summary
    },
    liveWindowPlan: {
      status: livePlan.status,
      planHash: livePlan.planHash,
      estimatedMaxSpendUsd: livePlan.estimatedMaxSpendUsd,
      command: livePlan.command,
      blockers: livePlan.blockers,
      downstreamRequestPolicy: livePlan.downstreamRequestPolicy,
      paymentAdapterContract: livePlan.paymentAdapterContract,
      paymentBridgePreflightCommand: livePlan.paymentBridgePreflightCommand,
      vercelEnvPlan: livePlan.vercelEnvPlan,
      localPolicyPatch: livePlan.localPolicyPatch,
      safety: livePlan.safety
    },
    actions,
    safety: {
      readOnly: true,
      writesLocalPolicy: false,
      setsVercelEnv: false,
      submitsDirectoryForms: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      includesSecretValues: false
    }
  };
}

function gitVercelAction(cfg, input) {
  const ready = cfg.gitAutoDeployVerified && cfg.gitAutoDeployEvidenceUrl && cfg.gitAutoDeployCommitSha;
  return {
    id: "git_vercel_auto_deploy",
    title: "Connect push-triggered production deploy",
    required: true,
    status: ready ? "ready" : "blocked-manual",
    preferredPath: [
      "Grant the Vercel GitHub App access to kfubtik/trust402.",
      "Connect the Vercel project trust402 to the private GitHub repository.",
      "Push a harmless commit to main and verify a production deployment appears without vercel --prod.",
      "Run production smoke, x402 smoke, and launch monitor against https://trust402.vercel.app."
    ],
    fallbackPath: {
      githubActionsWorkflow: ".github/workflows/vercel-production-deploy.yml",
      requiredGitHubSecrets: [
        "VERCEL_TOKEN",
        "VERCEL_ORG_ID",
        "VERCEL_PROJECT_ID"
      ],
      localProjectHints: input.vercelProject || {
        projectName: "trust402",
        projectIdConfigured: input.vercelProjectLinked === true,
        orgIdConfigured: input.vercelProjectLinked === true
      }
    },
    verifyCommands: [
      "git push origin main",
      "npx vercel@latest ls trust402",
      "npm run smoke -- https://trust402.vercel.app",
      "npm run smoke:x402 -- https://trust402.vercel.app",
      "npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --skip-directories --strict"
    ],
    evidenceEnv: {
      TRUST402_GIT_AUTO_DEPLOY_VERIFIED: "true",
      TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL: "<push-triggered deployment or GitHub Actions run URL>",
      TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA: "<commit sha that triggered production deploy>"
    },
    publicSafe: true
  };
}

function customDomainAction(baseUrl) {
  const host = hostOf(baseUrl);
  const needsDomain = host.endsWith(".vercel.app");
  return {
    id: "custom_domain",
    title: "Attach accepted production domain",
    required: true,
    status: needsDomain ? "blocked-manual" : "ready",
    currentHost: host,
    steps: needsDomain
      ? [
          "Choose a non-free-hosting HTTPS domain for Trust402.",
          "Add it to the Vercel project trust402.",
          "Point DNS to Vercel and wait for HTTPS readiness.",
          "Set PUBLIC_BASE_URL to the custom domain in production.",
          "Redeploy and rerun smoke, x402 smoke, launch monitor, and directory checks."
        ]
      : ["Current PUBLIC_BASE_URL host is not a known free-hosting domain."],
    evidenceEnv: {
      PUBLIC_BASE_URL: needsDomain ? "https://<custom-trust402-domain>" : baseUrl
    },
    verifyCommands: [
      "npx vercel@latest domains ls",
      "npm run smoke -- https://<custom-trust402-domain>",
      "npm run launch:monitor -- https://<custom-trust402-domain> --timeout-ms=10000 --strict"
    ],
    publicSafe: true
  };
}

function externalDirectoryAction(cfg, baseUrl) {
  const ready = cfg.externalDirectoryStatus === "visible" &&
    cfg.externalDirectoryEvidenceUrl &&
    cfg.externalDirectoryName;
  return {
    id: "external_x402_directories",
    title: "Submit public-safe directory listing",
    required: true,
    status: ready ? "ready" : "blocked-manual",
    prerequisites: [
      "CDP Bazaar remains 10/10 indexed.",
      "Custom production domain is active for directories that reject free-hosting domains.",
      "Listing pack contains no secrets, wallet internals, payment headers, or paid receipts."
    ],
    listingInputs: {
      serviceName: "Trust402",
      baseUrl,
      openapi: `${baseUrl}/openapi.json`,
      x402Discovery: `${baseUrl}/.well-known/x402`,
      marketplaceBundle: `${baseUrl}/api/marketplace/bundle`,
      listingCopy: "docs/external-marketplace-listing.md"
    },
    verifyCommands: [
      "npm run directories:check -- https://trust402.vercel.app --timeout-ms=10000",
      "npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --strict"
    ],
    evidenceEnv: {
      TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED: "true",
      TRUST402_CDP_BAZAAR_EVIDENCE_REF: "<public-safe CDP Bazaar 10/10 check hash or run URL>",
      TRUST402_EXTERNAL_DIRECTORY_STATUS: "visible",
      TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL: "<public listing URL where Trust402 is visible>",
      TRUST402_EXTERNAL_DIRECTORY_NAME: "<directory name>"
    },
    publicSafe: true
  };
}

function liveProcurementAction(livePlan) {
  return {
    id: "live_procurement",
    title: "Open bounded live procurement smoke window",
    required: true,
    status: livePlan.status === "ready-to-stage" ? "blocked-manual-approval" : "blocked-policy",
    planHash: livePlan.planHash,
    envPlan: pick(livePlan.vercelEnvPlan.production, [
      "LIVE_SPEND_ENABLED",
      "LIVE_PAYMENT_PROVIDER",
      "LIVE_MAX_PER_CALL_USD",
      "LIVE_MAX_PER_JOB_USD",
      "LIVE_DAILY_LIMIT_USD",
      "LIVE_SPENT_TODAY_USD",
      "LIVE_APPROVAL_THRESHOLD_USD",
      "LIVE_ALLOWED_REGISTRIES"
    ]),
    requiredSecretNames: livePlan.vercelEnvPlan.requiredSecretsAlreadyExistOrMustBeAddedManually,
    localPolicyPatch: livePlan.localPolicyPatch,
    downstreamRequestPolicy: livePlan.downstreamRequestPolicy,
    paymentAdapterContract: livePlan.paymentAdapterContract,
    paymentBridgePreflightCommand: livePlan.paymentBridgePreflightCommand,
    runCommand: livePlan.command,
    evidenceEnv: {
      TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED: "true",
      TRUST402_LIVE_PROCUREMENT_EVIDENCE_REF: "<public-safe procurement receipt hash or run URL>"
    },
    safety: livePlan.safety,
    publicSafe: true
  };
}

function proof402Action(livePlan) {
  return {
    id: "paid_proof402_delegation",
    title: "Enable paid Proof402 proof for approved hashes",
    required: true,
    status: livePlan.includeProof ? "blocked-manual-approval" : "blocked-policy",
    envPlan: pick(livePlan.vercelEnvPlan.production, [
      "PROOF402_BASE_URL",
      "PROOF402_DELEGATION_MODE",
      "PROOF402_MAX_SPEND_USD"
    ]),
    constraints: [
      "Send only sha256: hashes and public-safe metadata.",
      "Do not send private payloads to Proof402.",
      "Keep proof spend inside PROOF402_MAX_SPEND_USD."
    ],
    evidenceEnv: {
      TRUST402_PROOF402_PAID_SMOKE_OBSERVED: "true",
      TRUST402_PROOF402_EVIDENCE_REF: "<public-safe proof receipt reference>"
    },
    publicSafe: true
  };
}

function agentcashRefillAction(livePlan, includeAutoRefill) {
  return {
    id: "agentcash_auto_refill",
    title: "Approve AgentCash auto-refill policy",
    required: true,
    status: includeAutoRefill ? "blocked-manual-approval" : "blocked-policy",
    envPlan: pick(livePlan.vercelEnvPlan.production, [
      "AGENTCASH_AUTO_REFILL_APPROVED",
      "AGENTCASH_AUTO_REFILL_ENABLED",
      "AGENTCASH_AUTO_REFILL_PROVIDER",
      "AGENTCASH_AUTO_REFILL_THRESHOLD_USD",
      "AGENTCASH_AUTO_REFILL_AMOUNT_USD",
      "AGENTCASH_AUTO_REFILL_DAILY_CAP_USD"
    ]),
    verifyCommands: [
      "npm run agentcash:refill-check -- --balance 0.42",
      "npm run completion:unblockers -- https://trust402.vercel.app --include-refill-live"
    ],
    evidenceEnv: {
      TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_OBSERVED: "true",
      TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_REF: "<public-safe refill decision hash or reviewed action ref>"
    },
    publicSafe: true
  };
}

function autonomousJobAction(livePlan) {
  return {
    id: "autonomous_job_flow",
    title: "Run bounded autonomous live job evidence",
    required: true,
    status: livePlan.includeAutonomous ? "blocked-evidence" : "blocked-policy",
    prerequisite: "Live procurement smoke must pass first.",
    runCommand: livePlan.includeAutonomous
      ? livePlan.command
      : `${livePlan.command} --include-autonomous-live`,
    evidenceEnv: {
      TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED: "true",
      TRUST402_AUTONOMOUS_JOB_EVIDENCE_REF: "<public-safe autonomous job receipt hash or run URL>"
    },
    publicSafe: true
  };
}

function finalVerificationAction(baseUrl) {
  return {
    id: "final_verification",
    title: "Run final verification and record evidence",
    required: true,
    status: "blocked-evidence",
    commands: [
      "npm test",
      "npm run release:check",
      "npm audit --omit=dev --audit-level=high",
      "docker build -t trust402:test .",
      `npm run smoke -- ${baseUrl}`,
      `npm run smoke:x402 -- ${baseUrl}`,
      `npm run launch:monitor -- ${baseUrl} --timeout-ms=10000 --strict`,
      `npm run final:verify -- ${baseUrl} --timeout-ms=10000`
    ],
    evidenceEnv: {
      TRUST402_FINAL_VERIFICATION_OBSERVED: "true",
      TRUST402_FINAL_VERIFICATION_EVIDENCE_REF: "<public-safe final verification hash or run URL>"
    },
    publicSafe: true
  };
}

function pick(source, keys) {
  const out = {};
  for (const key of keys) out[key] = source[key];
  return out;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function hostOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
