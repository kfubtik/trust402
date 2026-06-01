import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { directorySubmissionPack } from "./directorySubmissionPack.js";
import { sha256Json } from "./hash.js";

export function directoryProfile(input = {}, options = {}) {
  const cfg = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || "https://trust402.vercel.app");
  const submissionPack = directorySubmissionPack({ baseUrl, userApprovedOutreach: input.userApprovedOutreach === true }, {
    ...options,
    config: cfg,
    catalog
  });
  const publicLinks = publicDiscoveryLinks(baseUrl);
  const paidResources = catalog.paidLaunchResources.map((resource) => ({
    id: resource.id,
    method: resource.method,
    path: resource.path,
    url: `${baseUrl}${resource.path}`,
    priceUsd: resource.priceUsd,
    status: resource.status,
    purpose: resource.purpose
  }));
  const profileCore = {
    name: catalog.name,
    baseUrl,
    category: catalog.category,
    pricing: "$0.005-$0.15 per call",
    paidResourceCount: paidResources.length,
    cdpBazaarReady: submissionPack.cdpBazaar.ready,
    externalDirectoryVisible: cfg.externalDirectoryStatus === "visible" && Boolean(cfg.externalDirectoryEvidenceUrl)
  };
  const profileHash = sha256Json(profileCore);

  return {
    ok: true,
    tool: "directories.profile",
    generatedAt: new Date().toISOString(),
    profileHash,
    name: catalog.name,
    tagline: catalog.tagline,
    category: catalog.category,
    status: catalog.status,
    defaultMode: catalog.defaultMode,
    shortDescription: "Buyer-side trust and procurement checks for x402 resources.",
    longDescription:
      "Trust402 helps autonomous agents and builders evaluate paid x402 endpoints before spending. It exposes unpaid discovery surfaces plus x402 resources for endpoint probing, trust scoring, seller readiness, procurement planning, monitoring snapshots, badges, and diligence reports with hash-ready evidence.",
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
    pricing: {
      display: "$0.005-$0.15 per call",
      currency: "USD",
      asset: "USDC",
      network: "Base",
      tiers: catalog.pricingLadder
    },
    discovery: publicLinks,
    resourceSummary: {
      free: catalog.freeResources.length,
      paidLaunch: paidResources.length,
      preservedLater: catalog.laterResourcesToPreserve.length
    },
    paidResources,
    safety: {
      dryRunFirst: true,
      liveSpendDefault: false,
      liveSpendRequiresOperatorPolicy: true,
      requiresBudget: true,
      requiresPerCallLimit: true,
      requiresAllowlist: true,
      receiptRequiredForLiveProcurement: true,
      publicProfileIncludesSecrets: false,
      publicProfileIncludesPaymentHeaders: false,
      publicProfileIncludesLocalWalletPolicy: false
    },
    listingStatus: {
      cdpBazaarReady: submissionPack.cdpBazaar.ready,
      cdpBazaarEvidenceRef: submissionPack.cdpBazaar.evidenceRef || null,
      externalDirectoryVisible: cfg.externalDirectoryStatus === "visible" && Boolean(cfg.externalDirectoryEvidenceUrl),
      externalDirectoryName: cfg.externalDirectoryName || null,
      externalDirectoryEvidenceUrl: cfg.externalDirectoryEvidenceUrl || null,
      hostPolicy: submissionPack.hostPolicy,
      submissionPackStatus: submissionPack.status,
      readyTargets: submissionPack.summary.readyToSubmit,
      monitorOnlyTargets: submissionPack.summary.monitorOnly,
      directoryTargets: submissionPack.directoryTargets.map((target) => ({
        id: target.id,
        name: target.name,
        url: target.url,
        status: target.status,
        blockers: target.blockers,
        searchTrust402: target.links.searchTrust402
      }))
    },
    contact: {
      repository: "https://github.com/kfubtik/trust402",
      directorySubmissionPack: publicLinks.directorySubmissionPack,
      operatorUnblockReport: publicLinks.operatorUnblockReport
    }
  };
}

export function directoryProfileHtml(input = {}, options = {}) {
  const profile = directoryProfile(input, options);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: profile.name,
    description: profile.longDescription,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: profile.website,
    offers: {
      "@type": "Offer",
      price: "0.005",
      priceCurrency: "USD",
      availability: "https://schema.org/OnlineOnly"
    },
    sameAs: [profile.discovery.x402, profile.discovery.openapi, profile.contact.repository]
  };
  const resourceList = profile.paidResources
    .map((resource) => `<li><a href="${htmlEscape(resource.url)}">${htmlEscape(resource.id)}</a> - ${htmlEscape(String(resource.priceUsd))} USD</li>`)
    .join("\n");
  const targetList = profile.listingStatus.directoryTargets
    .map((target) => `<li>${htmlEscape(target.name)}: ${htmlEscape(target.status)}</li>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trust402</title>
  <meta name="description" content="${htmlEscape(profile.shortDescription)}">
  <link rel="canonical" href="${htmlEscape(profile.website)}/directory">
  <link rel="alternate" type="application/json" href="${htmlEscape(profile.discovery.directoryProfileJson)}">
  <link rel="service-desc" type="application/openapi+json" href="${htmlEscape(profile.discovery.openapi)}">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
</head>
<body>
  <main>
    <h1>Trust402</h1>
    <p>${htmlEscape(profile.tagline)}</p>
    <p>${htmlEscape(profile.longDescription)}</p>
    <h2>Discovery</h2>
    <ul>
      <li><a href="${htmlEscape(profile.discovery.openapi)}">OpenAPI</a></li>
      <li><a href="${htmlEscape(profile.discovery.x402)}">x402 discovery</a></li>
      <li><a href="${htmlEscape(profile.discovery.radar)}">Trust402 Radar</a></li>
      <li><a href="${htmlEscape(profile.discovery.radarJson)}">Radar digest JSON</a></li>
      <li><a href="${htmlEscape(profile.discovery.agentManifest)}">Agent manifest</a></li>
      <li><a href="${htmlEscape(profile.discovery.resources)}">Resource catalog</a></li>
      <li><a href="${htmlEscape(profile.discovery.marketplaceBundle)}">Marketplace bundle</a></li>
      <li><a href="${htmlEscape(profile.discovery.completionAudit)}">Completion audit</a></li>
    </ul>
    <h2>Paid x402 Resources</h2>
    <ul>
${resourceList}
    </ul>
    <h2>Safety</h2>
    <p>Dry-run first. Live buyer spend requires explicit operator policy, budget caps, allowlists, and receipt logging. Public profiles omit secret values, payment signatures, and local wallet policy.</p>
    <h2>Directory Status</h2>
    <ul>
${targetList}
    </ul>
  </main>
</body>
</html>
`;
}

function publicDiscoveryLinks(baseUrl) {
  return {
    directoryProfile: `${baseUrl}/directory`,
    directoryProfileJson: `${baseUrl}/directory.json`,
    radar: `${baseUrl}/radar`,
    radarJson: `${baseUrl}/radar.json`,
    radarDigest: `${baseUrl}/api/radar/digest`,
    apiDirectoryProfile: `${baseUrl}/api/directories/profile`,
    openapi: `${baseUrl}/openapi.json`,
    x402: `${baseUrl}/.well-known/x402`,
    x402Json: `${baseUrl}/.well-known/x402.json`,
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
    directorySubmissionPack: `${baseUrl}/api/directories/submission-pack`,
    operatorUnblockReport: `${baseUrl}/api/operator/unblock-report`
  };
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeScriptJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
