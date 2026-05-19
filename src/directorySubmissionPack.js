import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { cdpBazaarEvidenceStatus } from "./cdpBazaarEvidence.js";
import { sha256Json } from "./hash.js";

const FREE_HOST_SUFFIXES = [
  "vercel.app",
  "workers.dev",
  "ngrok-free.app",
  "ngrok.io",
  "trycloudflare.com",
  "netlify.app",
  "pages.dev",
  "fly.dev",
  "render.com"
];

const DIRECTORY_TARGETS = [
  {
    id: "agentic_market",
    name: "Agentic.Market",
    mode: "crawler-or-search",
    url: "https://agentic.market",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor search and CDP Bazaar-derived discovery before making visibility claims."
  },
  {
    id: "x402scan",
    name: "x402scan",
    mode: "crawler-or-directory",
    url: "https://www.x402scan.com/resources",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor public resources/search pages for Trust402 visibility."
  },
  {
    id: "x402bazaar",
    name: "x402Bazaar",
    mode: "directory-or-search",
    url: "https://x402bazaar.org",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Submit only if a public-safe form/API is confirmed."
  },
  {
    id: "x402_ecosystem",
    name: "x402.org ecosystem",
    mode: "curated-manual-submission",
    url: "https://www.x402.org/ecosystem",
    submissionUrl: "https://www.x402.org/ecosystem",
    manualSubmissionAllowed: true,
    requiresCustomDomain: false,
    note: "Curated ecosystem outreach requires operator approval."
  },
  {
    id: "relai_market",
    name: "RelAI market",
    mode: "directory-or-search",
    url: "https://relai.fi/market",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor or submit only after a safe public form is confirmed."
  },
  {
    id: "x402list_fun",
    name: "x402list.fun",
    mode: "directory-or-search",
    url: "https://x402list.fun",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor public directory/search results for Trust402 visibility."
  },
  {
    id: "x402_list_com",
    name: "x402 List",
    mode: "manual-review-custom-domain-required",
    url: "https://x402-list.com",
    submissionUrl: "https://x402-list.com/submit",
    manualSubmissionAllowed: true,
    requiresCustomDomain: true,
    note: "This target rejects free-hosting/dev-tunnel domains; submit after custom domain is active."
  },
  {
    id: "agora402",
    name: "Agora402",
    mode: "registry-or-search",
    url: "https://agora402.io",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor or submit only after a safe public form/API is confirmed."
  }
];

export function directorySubmissionPack(input = {}, options = {}) {
  const cfg = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || "https://trust402.vercel.app");
  const hostPolicy = hostPolicyFor(baseUrl);
  const cdpBazaar = cdpBazaarEvidenceStatus(cfg);
  const cdpBazaarReady = cdpBazaar.verified;
  const userApprovedOutreach = input.userApprovedOutreach === true;
  const directoryTargets = DIRECTORY_TARGETS.map((target) =>
    targetPlan(target, { baseUrl, hostPolicy, cdpBazaarReady, userApprovedOutreach })
  );
  const readyTargets = directoryTargets.filter((target) => target.status === "ready-to-submit");
  const blockedTargets = directoryTargets.filter((target) => target.status.startsWith("blocked"));
  const monitoredTargets = directoryTargets.filter((target) => target.status === "monitor-only");
  const listingCopy = buildListingCopy(catalog, baseUrl);
  const evidenceEnv = {
    TRUST402_EXTERNAL_DIRECTORY_STATUS: "visible",
    TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL: "<public listing URL or search result where Trust402 is visible>",
    TRUST402_EXTERNAL_DIRECTORY_NAME: "<non-CDP directory name>"
  };
  const packCore = {
    baseUrl,
    cdpBazaarReady,
    host: hostPolicy.host,
    readyTargets: readyTargets.map((target) => target.id),
    listingCopy
  };
  const submissionPackHash = sha256Json(packCore);

  return {
    ok: true,
    tool: "directories.submission_pack",
    generatedAt: new Date().toISOString(),
    status: statusFor({ cdpBazaarReady, hostPolicy, readyTargets, userApprovedOutreach }),
    submissionPackHash,
    baseUrl,
    hostPolicy,
    cdpBazaar: {
      ready: cdpBazaarReady,
      allResourcesIndexed: cfg.cdpBazaarAllResourcesIndexed,
      evidenceRefConfigured: Boolean(cfg.cdpBazaarEvidenceRef),
      evidenceRef: cfg.cdpBazaarEvidenceRef || null,
      checkStatus: cdpBazaar.status || null,
      expectedResources: cdpBazaar.expected,
      indexedResources: cdpBazaar.indexed,
      missingResources: cdpBazaar.missingResources,
      reason: cdpBazaar.reason
    },
    summary: {
      targets: directoryTargets.length,
      readyToSubmit: readyTargets.length,
      blocked: blockedTargets.length,
      monitorOnly: monitoredTargets.length,
      userApprovedOutreach,
      hostRequiresCustomDomain: hostPolicy.requiresCustomDomain
    },
    listingCopy,
    directoryTargets,
    submissionRules: [
      "Submit only public metadata from this pack.",
      "Do not submit .env values, CDP secrets, AgentCash internals, private keys, payment headers, local receipts, or wallet policy files.",
      "Do not claim Trust402 can autonomously spend buyer funds until live procurement, paid Proof402 delegation, and auto-refill evidence are verified.",
      "Record only public-safe evidence after a directory visibly lists Trust402."
    ],
    evidenceEnv,
    cdpBazaarEvidenceEnv: {
      TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED: "true",
      TRUST402_CDP_BAZAAR_CHECK_STATUS: "all-indexed",
      TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES: String(catalog.paidLaunchResources.length),
      TRUST402_CDP_BAZAAR_INDEXED_RESOURCES: String(catalog.paidLaunchResources.length),
      TRUST402_CDP_BAZAAR_MISSING_RESOURCES: "",
      TRUST402_CDP_BAZAAR_EVIDENCE_REF: "<public-safe CDP Bazaar 10/10 check hash or run URL>"
    },
    verifyCommands: [
      `npm run smoke -- ${baseUrl}`,
      `npm run smoke:x402 -- ${baseUrl}`,
      `npm run bazaar:indexing:check:all -- ${baseUrl} --timeout-ms=10000 --limit=20`,
      `npm run directories:check -- ${baseUrl} --timeout-ms=10000`,
      `npm run completion:audit -- ${baseUrl}`
    ],
    safety: {
      readOnly: true,
      submitsDirectoryForms: false,
      sendsPaymentHeaders: false,
      includesSecrets: false,
      mutatesWallet: false,
      setsEnv: false
    }
  };
}

function targetPlan(target, context) {
  const blockedByCustomDomain = target.requiresCustomDomain && context.hostPolicy.requiresCustomDomain;
  const blockers = [];
  if (!context.cdpBazaarReady) blockers.push("cdp_bazaar_not_verified");
  if (blockedByCustomDomain) blockers.push("custom_domain_required");
  if (target.manualSubmissionAllowed && !context.userApprovedOutreach) blockers.push("operator_outreach_not_approved");

  const status = target.manualSubmissionAllowed
    ? blockers.length === 0
      ? "ready-to-submit"
      : "blocked-manual"
    : "monitor-only";

  return {
    ...target,
    status,
    blockers,
    links: {
      directory: target.url,
      submission: target.submissionUrl,
      searchTrust402: searchUrlFor(target, "Trust402"),
      searchHost: searchUrlFor(target, context.hostPolicy.host)
    },
    nextAction: nextActionFor({ target, status, blockers, blockedByCustomDomain })
  };
}

function buildListingCopy(catalog, baseUrl) {
  return {
    name: catalog.name,
    tagline: catalog.tagline,
    shortDescription: "Buyer-side trust and procurement checks for x402 resources.",
    longDescription:
      "Trust402 helps autonomous agents and builders evaluate paid x402 endpoints before spending. It exposes tools for unpaid x402 probing, resource scoring, origin evaluation, seller readiness, candidate comparison, bounded procurement plans, one-shot monitoring, badges, and diligence reports with hash-ready evidence.",
    category: "Agent infrastructure",
    tags: [
      "x402",
      "agent-infrastructure",
      "trust",
      "procurement",
      "micropayments",
      "due-diligence",
      "marketplace-readiness",
      "receipts",
      "base",
      "usdc"
    ],
    website: baseUrl,
    openapi: `${baseUrl}/openapi.json`,
    x402Discovery: `${baseUrl}/.well-known/x402`,
    x402DiscoveryJson: `${baseUrl}/.well-known/x402.json`,
    agentManifest: `${baseUrl}/.well-known/agent.json`,
    agentServices: `${baseUrl}/.well-known/agent-services.json`,
    aiPlugin: `${baseUrl}/.well-known/ai-plugin.json`,
    mcpManifest: `${baseUrl}/.well-known/mcp.json`,
    llms: `${baseUrl}/llms.txt`,
    robots: `${baseUrl}/robots.txt`,
    sitemap: `${baseUrl}/sitemap.xml`,
    resources: `${baseUrl}/api/resources`,
    marketplaceBundle: `${baseUrl}/api/marketplace/bundle`,
    completionAudit: `${baseUrl}/api/completion/audit`,
    operatorUnblockReport: `${baseUrl}/api/operator/unblock-report`,
    pricing: "$0.005-$0.15 per call",
    networks: ["Base"],
    asset: "USDC",
    safetyStatement:
      "Trust402 does not execute live buyer subcalls by default. Live procurement and paid proof delegation require explicit operator approval, spend caps, allowlists, and receipt logging.",
    paidLaunchResources: catalog.paidLaunchResources.map((resource) => ({
      id: resource.id,
      method: resource.method,
      path: resource.path,
      priceUsd: resource.priceUsd,
      purpose: resource.purpose
    }))
  };
}

function statusFor({ cdpBazaarReady, hostPolicy, readyTargets, userApprovedOutreach }) {
  if (!cdpBazaarReady) return "blocked-cdp-bazaar";
  if (hostPolicy.requiresCustomDomain) return "blocked-custom-domain";
  if (!userApprovedOutreach) return "blocked-operator-approval";
  return readyTargets.length > 0 ? "ready-to-submit" : "monitor-only";
}

function nextActionFor({ target, status, blockers, blockedByCustomDomain }) {
  if (status === "monitor-only") return "Keep read-only monitoring active; submit only if a safe public form or API is confirmed.";
  if (status === "ready-to-submit") return "Submit the public-safe listing copy and record visible directory evidence after publication.";
  if (blockedByCustomDomain) return "Attach a custom production domain before submitting to this directory.";
  if (blockers.includes("cdp_bazaar_not_verified")) return "Restore CDP Bazaar 10/10 indexing before directory outreach.";
  if (blockers.includes("operator_outreach_not_approved")) return "Get explicit operator approval before public outreach.";
  return "Resolve blockers before submission.";
}

function searchUrlFor(target, term) {
  const value = String(term || "").trim();
  if (!value) return null;
  const encoded = encodeURIComponent(value);
  if (target.id === "agentic_market") return `https://agentic.market/search?q=${encoded}`;
  if (target.id === "x402scan") return `https://www.x402scan.com/search?q=${encoded}`;
  if (target.id === "x402bazaar") return `https://x402bazaar.org/search?q=${encoded}`;
  if (target.id === "relai_market") return `https://relai.fi/market?search=${encoded}`;
  if (target.id === "x402list_fun") return `https://x402list.fun/?q=${encoded}`;
  if (target.id === "x402_list_com") return `https://x402-list.com/api/v1/services?q=${encoded}`;
  if (target.id === "agora402") return `https://agora402.io/search?q=${encoded}`;
  return target.url;
}

function hostPolicyFor(baseUrl) {
  let host = "";
  try {
    host = new URL(baseUrl).host;
  } catch {
    return {
      baseUrl,
      host: "",
      requiresCustomDomain: true,
      freeHostingSuffix: "invalid-url",
      reason: "Base URL is not valid."
    };
  }
  const freeHostingSuffix = FREE_HOST_SUFFIXES.find((suffix) => host === suffix || host.endsWith(`.${suffix}`)) || null;
  return {
    baseUrl,
    host,
    requiresCustomDomain: Boolean(freeHostingSuffix),
    freeHostingSuffix,
    reason: freeHostingSuffix
      ? "Some directories reject free-hosting or dev-tunnel domains for production service listings."
      : "Host is not on the known free-hosting/dev-tunnel blocklist."
  };
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}
