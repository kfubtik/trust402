import { readFileSync } from "node:fs";

import { config } from "./config.js";

const DEFAULT_X402SCAN_URL = "https://www.x402scan.com/server/239600ba-27ae-44f1-92b0-8ea1c8fb8a14";
const RADAR_TEMPLATE_URL = new URL("../brand/x402-radar/landing-preview.html", import.meta.url);
const RADAR_TOKEN_CSS_URL = new URL("../brand/x402-radar/tokens.css", import.meta.url);

let cachedRadarTemplate;
let cachedRadarTokens;

export function rootLinks() {
  return {
    ok: true,
    service: config.serviceName,
    tagline: "A live radar for x402 resources.",
    links: {
      health: "/health",
      status: "/api/status",
      launchChecklist: "/api/launch/checklist",
      marketplaceBundle: "/api/marketplace/bundle",
      settlementStatus: "/api/settlement/status",
      settlementPreflight: "/api/settlement/preflight",
      spendPolicy: "/api/policies/spend",
      paymentBuyerPreflight: "/api/payments/buyer-preflight",
      paymentBridgeCheck: "/api/payments/bridge-check",
      proof402Preflight: "/api/proof402/preflight",
      completionPlan: "/api/completion/plan",
      completionAudit: "/api/completion/audit",
      deploymentPreflight: "/api/deployments/preflight",
      githubActionsSetup: "/api/deployments/github-actions-setup",
      domainActivationPack: "/api/domains/activation-pack",
      domainReadinessCheck: "/api/domains/readiness-check",
      directoryProfile: "/directory",
      directoryProfileJson: "/directory.json",
      apiDirectoryProfile: "/api/directories/profile",
      directorySubmissionPack: "/api/directories/submission-pack",
      liveWindowPlan: "/api/live/window-plan",
      operatorUnblockReport: "/api/operator/unblock-report",
      operatorActionPack: "/api/operator/action-pack",
      operatorReadiness: "/api/operator/readiness",
      agentcashRefillCheck: "/api/agentcash/refill-check",
      agentcashMcpObservation: "/api/agentcash/mcp-observation",
      autonomousRun: "/api/jobs/autonomous-run",
      dailyAutonomyCron: "/api/cron/daily-autonomous",
      registryCandidates: "/api/registries/candidates",
      resources: "/api/resources",
      proof402Preview: "/api/receipts/notarize-result",
      capabilities: "/api/capabilities",
      openapi: "/openapi.json",
      x402WellKnown: "/.well-known/x402",
      x402WellKnownJson: "/.well-known/x402.json",
      agentManifest: "/.well-known/agent.json",
      agentServices: "/.well-known/agent-services.json",
      aiPlugin: "/.well-known/ai-plugin.json",
      mcpManifest: "/.well-known/mcp.json",
      llms: "/llms.txt",
      robots: "/robots.txt",
      sitemap: "/sitemap.xml"
    }
  };
}

export function landingPageHtml() {
  const x402scanUrl = config.externalDirectoryEvidenceUrl || DEFAULT_X402SCAN_URL;
  const baseUrl = config.publicBaseUrl.replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Trust402",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: baseUrl,
    description:
      "Trust402 is a live radar and buyer-side procurement agent for x402 resources, with spend policy, receipts, and Proof402-ready evidence.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0.005",
      highPrice: "0.15",
      priceCurrency: "USD"
    },
    sameAs: [
      "https://github.com/kfubtik/trust402",
      x402scanUrl,
      `${baseUrl}/.well-known/x402`,
      `${baseUrl}/openapi.json`
    ]
  };

  try {
    return renderRadarTemplate({ baseUrl, x402scanUrl, jsonLd });
  } catch {
    return fallbackLanding({ baseUrl, x402scanUrl, jsonLd });
  }
}

function renderRadarTemplate({ baseUrl, x402scanUrl, jsonLd }) {
  const tokenCss = radarTokenCss();
  return radarTemplateHtml()
    .replace('  <link rel="stylesheet" href="./tokens.css">\n', `  <style>\n${tokenCss}\n  </style>\n`)
    .replaceAll("https://trust402.aztecbeacon.uk", htmlEscape(baseUrl))
    .replaceAll(DEFAULT_X402SCAN_URL, htmlEscape(x402scanUrl))
    .replace(
      "</head>",
      `  <meta property="og:title" content="Trust402">
  <meta property="og:description" content="A live radar for x402 resources.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${htmlEscape(baseUrl)}">
  <link rel="canonical" href="${htmlEscape(baseUrl)}">
  <link rel="service-desc" type="application/openapi+json" href="/openapi.json">
  <link rel="alternate" type="application/json" href="/directory.json">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
</head>`
    );
}

function radarTemplateHtml() {
  if (!cachedRadarTemplate) cachedRadarTemplate = readFileSync(RADAR_TEMPLATE_URL, "utf8");
  return cachedRadarTemplate;
}

function radarTokenCss() {
  if (!cachedRadarTokens) cachedRadarTokens = readFileSync(RADAR_TOKEN_CSS_URL, "utf8");
  return cachedRadarTokens;
}

function fallbackLanding({ baseUrl, x402scanUrl, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trust402 - x402 Radar</title>
  <meta name="description" content="Trust402 is a live radar and buyer-side procurement agent for x402 resources.">
  <meta property="og:title" content="Trust402">
  <meta property="og:description" content="A live radar for x402 resources.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${htmlEscape(baseUrl)}">
  <link rel="canonical" href="${htmlEscape(baseUrl)}">
  <link rel="service-desc" type="application/openapi+json" href="/openapi.json">
  <link rel="alternate" type="application/json" href="/directory.json">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #07110f;
      color: #f2f7f4;
      font-family: Inter, Geist, "Segoe UI", Arial, sans-serif;
      line-height: 1.5;
      letter-spacing: 0;
    }
    a { color: inherit; text-decoration: none; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      min-height: 68px;
      padding: 0 max(20px, calc((100vw - 1180px) / 2));
      border-bottom: 1px solid rgba(215, 229, 222, 0.12);
      background: rgba(7, 17, 15, 0.9);
    }
    nav { display: flex; gap: 18px; color: #b4c8be; font-size: 15px; }
    main { width: min(100% - 40px, 1180px); margin: 0 auto; padding: 76px 0 92px; }
    h1 { margin: 0; font-size: clamp(52px, 12vw, 118px); line-height: 0.9; letter-spacing: 0; }
    p { max-width: 760px; color: #d7e5de; font-size: 20px; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
    .button {
      display: inline-flex;
      min-height: 46px;
      align-items: center;
      justify-content: center;
      padding: 0 18px;
      border: 1px solid rgba(215, 229, 222, 0.16);
      border-radius: 8px;
      background: rgba(215, 229, 222, 0.06);
      color: #f2f7f4;
      font-weight: 720;
    }
    .primary { background: #54f2a1; color: #04100c; border-color: #54f2a1; }
  </style>
</head>
<body>
  <header>
    <strong>Trust402</strong>
    <nav aria-label="Primary navigation">
      <a href="/api/resources">Resources</a>
      <a href="/api/policies/spend">Policy</a>
      <a href="/.well-known/x402">Discovery</a>
      <a href="https://github.com/kfubtik/trust402">GitHub</a>
    </nav>
  </header>
  <main>
    <h1 id="hero-title">Trust402</h1>
    <p>A live radar for x402 resources. Trust before you pay, proof after you buy: compare prices, detect risk, route safe payments, and keep receipts.</p>
    <div class="actions">
      <a class="button primary" href="/api/resources">Inspect Resources</a>
      <a class="button" href="/api/policies/spend">Spend Policy</a>
      <a class="button" href="${htmlEscape(x402scanUrl)}">x402scan Evidence</a>
      <a class="button" href="/openapi.json">OpenAPI</a>
    </div>
  </main>
</body>
</html>`;
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
