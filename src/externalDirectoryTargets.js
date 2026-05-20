export const FREE_HOST_SUFFIXES = [
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

export const EXTERNAL_DIRECTORY_TARGETS = [
  {
    id: "agentic_market",
    name: "Agentic.Market",
    mode: "crawler-or-search",
    url: "https://agentic.market",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor search and CDP Bazaar-derived discovery before making visibility claims.",
    monitorUrls: [
      "https://agentic.market",
      "https://agentic.market/about",
      "https://agentic.market/search?q=Trust402",
      "https://agentic.market/search?q={host}"
    ]
  },
  {
    id: "x402scan",
    name: "x402scan",
    mode: "crawler-or-directory",
    url: "https://www.x402scan.com/resources",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor public resources/search pages for Trust402 visibility.",
    monitorUrls: [
      "https://www.x402scan.com/",
      "https://www.x402scan.com/resources",
      "https://www.x402scan.com/search?q=Trust402",
      "https://www.x402scan.com/search?q={host}"
    ]
  },
  {
    id: "x402bazaar",
    name: "x402Bazaar",
    mode: "directory-or-search",
    url: "https://x402bazaar.org",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Submit only if a public-safe form/API is confirmed.",
    monitorUrls: [
      "https://x402bazaar.org/",
      "https://x402bazaar.org/search?q=Trust402",
      "https://x402bazaar.org/search?q={host}"
    ]
  },
  {
    id: "x402_ecosystem",
    name: "x402.org ecosystem",
    mode: "curated-manual-submission",
    url: "https://www.x402.org/ecosystem",
    submissionUrl: "https://www.x402.org/ecosystem",
    manualSubmissionAllowed: true,
    requiresCustomDomain: false,
    note: "Curated ecosystem outreach requires operator approval.",
    monitorUrls: [
      "https://www.x402.org/ecosystem"
    ]
  },
  {
    id: "relai_market",
    name: "RelAI market",
    mode: "directory-or-search",
    url: "https://relai.fi/market",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor or submit only after a safe public form is confirmed.",
    monitorUrls: [
      "https://relai.fi/market",
      "https://relai.fi/market?search=Trust402",
      "https://relai.fi/market?search={host}"
    ]
  },
  {
    id: "x402list_fun",
    name: "x402list.fun",
    mode: "directory-or-search",
    url: "https://x402list.fun",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor public directory/search results for Trust402 visibility.",
    monitorUrls: [
      "https://x402list.fun/",
      "https://x402list.fun/?q=Trust402",
      "https://x402list.fun/?q={host}"
    ]
  },
  {
    id: "orbis_api_marketplace",
    name: "Orbis API Marketplace",
    mode: "api-marketplace-or-search",
    url: "https://orbisapi.com",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor Orbis API Marketplace for x402 endpoint visibility; submit only if a safe public form/API is confirmed.",
    monitorUrls: [
      "https://orbisapi.com/",
      "https://orbisapi.com/search?q=Trust402",
      "https://orbisapi.com/search?q={host}"
    ]
  },
  {
    id: "world_fun_x402_market",
    name: "World.fun x402 Market",
    mode: "permissionless-launchpad-monitor",
    url: "https://x402.world.fun",
    submissionUrl: "https://x402.world.fun",
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "AWE/World.fun x402 Market is treated as monitor-only until the operator approves a separate launchpad listing flow.",
    monitorUrls: [
      "https://x402.world.fun/",
      "https://www.world.fun/",
      "https://www.world.fun/?q=Trust402",
      "https://www.world.fun/?q={host}"
    ]
  },
  {
    id: "x402agency",
    name: "x402agency",
    mode: "niche-bsv-marketplace-monitor",
    url: "https://x402agency.com",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor the BSV-oriented x402agency surface separately; do not claim compatibility until the listing format and chain fit are reviewed.",
    monitorUrls: [
      "https://x402agency.com/",
      "https://x402agency.com/search?q=Trust402",
      "https://x402agency.com/search?q={host}"
    ]
  },
  {
    id: "agent_bazaar",
    name: "Agent Bazaar",
    mode: "agent-skill-marketplace-monitor",
    url: "https://www.agent-bazaar.com/marketplace",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor agent skill marketplace visibility; submit only if a safe public form/API is confirmed.",
    monitorUrls: [
      "https://www.agent-bazaar.com/marketplace",
      "https://www.agent-bazaar.com/marketplace?search=Trust402",
      "https://www.agent-bazaar.com/marketplace?search={host}"
    ]
  },
  {
    id: "the402",
    name: "the402",
    mode: "agent-service-marketplace-monitor",
    url: "https://the402.ai",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor agent service marketplace visibility; submit only if a safe public form/API is confirmed.",
    monitorUrls: [
      "https://the402.ai/",
      "https://the402.ai/search?q=Trust402",
      "https://the402.ai/search?q={host}"
    ]
  },
  {
    id: "x402_list_com",
    name: "x402 List",
    mode: "manual-review-custom-domain-required",
    url: "https://x402-list.com",
    submissionUrl: "https://x402-list.com/submit",
    manualSubmissionAllowed: true,
    requiresCustomDomain: true,
    note: "This target rejects free-hosting/dev-tunnel domains; submit after custom domain is active.",
    monitorUrls: [
      "https://x402-list.com/",
      "https://x402-list.com/submit",
      "https://x402-list.com/api",
      "https://x402-list.com/api/v1/services?q=Trust402",
      "https://x402-list.com/api/v1/services?q={host}"
    ]
  },
  {
    id: "agora402",
    name: "Agora402",
    mode: "registry-or-search",
    url: "https://agora402.io",
    submissionUrl: null,
    manualSubmissionAllowed: false,
    requiresCustomDomain: false,
    note: "Monitor or submit only after a safe public form/API is confirmed.",
    monitorUrls: [
      "https://agora402.io/",
      "https://agora402.io/search?q=Trust402",
      "https://agora402.io/search?q={host}",
      "https://agora402.io/api/v1/discover?query=Trust402",
      "https://agora402.io/api/v1/discover?query={host}"
    ]
  }
];

export function isFreeHostingHost(value) {
  const hostValue = String(value || "").toLowerCase();
  return FREE_HOST_SUFFIXES.some((suffix) => hostValue === suffix || hostValue.endsWith(`.${suffix}`));
}

export function freeHostingSuffixFor(value) {
  const hostValue = String(value || "").toLowerCase();
  return FREE_HOST_SUFFIXES.find((suffix) => hostValue === suffix || hostValue.endsWith(`.${suffix}`)) || null;
}

export function searchUrlFor(target, term) {
  const value = String(term || "").trim();
  if (!value) return null;
  const encoded = encodeURIComponent(value);
  const hostEncoded = encoded;
  const template = target.monitorUrls?.find((url) => url.includes("{host}")) ||
    target.monitorUrls?.find((url) => url.includes("Trust402"));
  if (template) {
    return template
      .replaceAll("{host}", hostEncoded)
      .replaceAll("Trust402", encoded);
  }
  return target.url;
}

export function monitorUrlsFor(target, host) {
  return (target.monitorUrls || [target.url])
    .map((url) => url.replaceAll("{host}", encodeURIComponent(host || "")))
    .filter(Boolean);
}
