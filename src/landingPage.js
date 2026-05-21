import { config } from "./config.js";
import { publicResources } from "./catalog.js";

export function rootLinks() {
  return {
    ok: true,
    service: config.serviceName,
    tagline: "Trust before you pay. Proof after you buy.",
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
  const resources = publicResources();
  const paidResources = resources.paidLaunchResources.slice(0, 10);
  const x402scanUrl = config.externalDirectoryEvidenceUrl || "https://www.x402scan.com/server/239600ba-27ae-44f1-92b0-8ea1c8fb8a14";
  const baseUrl = config.publicBaseUrl.replace(/\/+$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Trust402",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: baseUrl,
    description:
      "Buyer-side trust and procurement agent for x402 resources, with paid endpoint checks, receipts, spend policy, and Proof402 delegation.",
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trust402 - Trust before you pay</title>
  <meta name="description" content="Trust402 is a buyer-side trust and procurement agent for x402 resources, built for agents that need spend policy, receipts, and proof before paying.">
  <meta property="og:title" content="Trust402">
  <meta property="og:description" content="Trust before you pay. Proof after you buy.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${htmlEscape(baseUrl)}">
  <link rel="canonical" href="${htmlEscape(baseUrl)}">
  <link rel="service-desc" type="application/openapi+json" href="/openapi.json">
  <link rel="alternate" type="application/json" href="/directory.json">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
  <style>
    :root {
      color-scheme: light;
      --ink: #111827;
      --muted: #586174;
      --line: #d9e1ea;
      --panel: rgba(255, 255, 255, 0.88);
      --paper: #f7f9fb;
      --green: #15803d;
      --blue: #1d4ed8;
      --amber: #b45309;
      --teal: #0f766e;
      --black: #0b1020;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
      letter-spacing: 0;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      min-height: 64px;
      padding: 0 32px;
      border-bottom: 1px solid rgba(17, 24, 39, 0.08);
      background: rgba(247, 249, 251, 0.9);
      backdrop-filter: blur(16px);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 760;
    }

    .mark {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--line);
      background: #ffffff;
      color: var(--green);
      font-size: 15px;
      font-weight: 800;
    }

    .nav {
      display: flex;
      align-items: center;
      gap: 18px;
      color: #334155;
      font-size: 14px;
    }

    .nav a:hover,
    .link:hover {
      color: var(--blue);
    }

    .hero {
      position: relative;
      min-height: 88svh;
      overflow: hidden;
      border-bottom: 1px solid var(--line);
      background: #eef3f7;
    }

    .scene {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.98;
    }

    .scene-inner {
      position: absolute;
      top: 50%;
      right: max(32px, calc((100vw - 1120px) / 2));
      width: min(520px, 42vw);
      height: min(560px, 72vh);
      transform: translateY(-45%);
    }

    .trace-map,
    .evidence-panel {
      min-height: 460px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.72);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      padding: 18px;
    }

    .trace-map {
      position: absolute;
      top: 74px;
      right: 118px;
      width: 430px;
      opacity: 0.34;
    }

    .evidence-panel {
      position: absolute;
      top: 0;
      right: 0;
      width: min(360px, 100%);
    }

    .trace-row {
      display: grid;
      grid-template-columns: 92px 1fr 70px;
      align-items: center;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      color: #334155;
    }

    .trace-line {
      height: 6px;
      background: linear-gradient(90deg, #15803d 0 22%, #1d4ed8 22% 64%, #b45309 64% 100%);
    }

    .metric {
      display: grid;
      gap: 8px;
      padding: 18px 0;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

    .metric strong {
      font-size: clamp(28px, 5vw, 58px);
      line-height: 1;
      letter-spacing: 0;
    }

    .metric span {
      color: var(--muted);
      font-size: 14px;
    }

    .hero-content {
      position: relative;
      z-index: 2;
      width: min(1120px, calc(100% - 48px));
      margin: 0 auto;
      padding: clamp(80px, 12vh, 132px) 0 56px;
    }

    .hero-copy {
      max-width: 680px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 24px;
      color: #0f766e;
      font-weight: 720;
      font-size: 13px;
      text-transform: uppercase;
    }

    .dot {
      width: 9px;
      height: 9px;
      background: var(--green);
    }

    h1 {
      margin: 0;
      max-width: 780px;
      font-size: clamp(72px, 15vw, 156px);
      line-height: 0.9;
      letter-spacing: 0;
    }

    .lede {
      max-width: 640px;
      margin: 28px 0 0;
      color: #263244;
      font-size: clamp(19px, 2.2vw, 27px);
      line-height: 1.28;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 34px;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 18px;
      border: 1px solid var(--black);
      background: var(--black);
      color: #ffffff;
      font-weight: 720;
      font-size: 14px;
    }

    .button.secondary {
      border-color: var(--line);
      background: #ffffff;
      color: var(--black);
    }

    .proof-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 60px;
      max-width: 840px;
    }

    .proof {
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.78);
      padding: 14px;
    }

    .proof b {
      display: block;
      color: var(--black);
      font-size: 15px;
    }

    .proof span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
    }

    section {
      padding: 72px 0;
    }

    .wrap {
      width: min(1120px, calc(100% - 48px));
      margin: 0 auto;
    }

    .section-head {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(260px, 0.7fr);
      gap: 36px;
      align-items: end;
      margin-bottom: 28px;
    }

    h2 {
      margin: 0;
      font-size: clamp(34px, 5vw, 62px);
      line-height: 1;
      letter-spacing: 0;
    }

    .section-copy {
      margin: 0;
      color: var(--muted);
      font-size: 17px;
    }

    .resource-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      border-top: 1px solid var(--line);
      border-left: 1px solid var(--line);
      background: #ffffff;
    }

    .resource {
      min-height: 150px;
      padding: 18px;
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .resource small {
      display: block;
      color: var(--teal);
      font-weight: 760;
    }

    .resource b {
      display: block;
      margin-top: 18px;
      color: var(--black);
      font-size: 15px;
      word-break: break-word;
    }

    .resource span {
      display: block;
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
    }

    .policy-band {
      background: #ffffff;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .policy-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1px;
      background: var(--line);
      border: 1px solid var(--line);
    }

    .policy {
      min-height: 220px;
      padding: 24px;
      background: #ffffff;
    }

    .policy .label {
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      font-weight: 760;
    }

    .policy strong {
      display: block;
      margin-top: 22px;
      color: var(--black);
      font-size: 34px;
      line-height: 1;
    }

    .policy p {
      margin: 18px 0 0;
      color: var(--muted);
    }

    .links-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .link-card {
      display: block;
      min-height: 128px;
      padding: 20px;
      border: 1px solid var(--line);
      background: #ffffff;
    }

    .link-card b {
      display: block;
      font-size: 18px;
    }

    .link-card span {
      display: block;
      margin-top: 10px;
      color: var(--muted);
      font-size: 14px;
    }

    .footer {
      padding: 34px 0 44px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 14px;
    }

    .footer .wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
    }

    @media (max-width: 920px) {
      .topbar {
        padding: 0 20px;
      }

      .nav {
        display: none;
      }

      .hero {
        min-height: auto;
      }

      .scene-inner {
        top: 52%;
        right: -34vw;
        width: 88vw;
        height: 520px;
        transform: translateY(-45%);
        opacity: 0.28;
      }

      .evidence-panel {
        display: none;
      }

      .trace-map {
        top: 0;
        right: 0;
        width: 100%;
      }

      .hero-content {
        width: min(100% - 32px, 680px);
        padding-top: 72px;
      }

      .proof-strip,
      .resource-grid,
      .policy-grid,
      .links-grid,
      .section-head {
        grid-template-columns: 1fr;
      }

      .proof-strip {
        max-width: none;
      }

      section {
        padding: 52px 0;
      }

      .wrap {
        width: min(100% - 32px, 680px);
      }

      .resource,
      .policy,
      .link-card {
        min-height: auto;
      }

      .footer .wrap {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      .trace-line {
        background-size: 180% 100%;
        animation: trace 8s linear infinite;
      }

      @keyframes trace {
        from { background-position: 0% 0; }
        to { background-position: 180% 0; }
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/" aria-label="Trust402 home"><span class="mark">T</span><span>Trust402</span></a>
    <nav class="nav" aria-label="Primary">
      <a href="#resources">Resources</a>
      <a href="#policy">Policy</a>
      <a href="#discovery">Discovery</a>
      <a href="https://github.com/kfubtik/trust402">GitHub</a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="scene" aria-hidden="true">
        <div class="scene-inner">
          <div class="trace-map">
            ${traceRows()}
          </div>
          <div class="evidence-panel">
            <div class="metric"><strong>10/10</strong><span>CDP Bazaar indexed resources</span></div>
            <div class="metric"><strong>$0.005</strong><span>minimum paid trust check</span></div>
            <div class="metric"><strong>Base</strong><span>USDC x402 settlement network</span></div>
            <div class="metric"><strong>Proof402</strong><span>hash-only evidence delegation</span></div>
          </div>
        </div>
      </div>

      <div class="hero-content">
        <div class="hero-copy">
          <p class="eyebrow"><span class="dot"></span>Buyer-side trust for x402 agents</p>
          <h1 id="hero-title">Trust402</h1>
          <p class="lede">Trust before you pay. Proof after you buy. Trust402 gives autonomous buyers a policy-gated way to inspect x402 endpoints, compare paid resources, cap spend, keep receipts, and prove the result.</p>
          <div class="actions" aria-label="Primary actions">
            <a class="button" href="/openapi.json">OpenAPI</a>
            <a class="button secondary" href="/.well-known/x402">x402 Discovery</a>
            <a class="button secondary" href="${htmlEscape(x402scanUrl)}">x402scan Evidence</a>
          </div>
        </div>

        <div class="proof-strip" aria-label="Production proof points">
          <div class="proof"><b>Production</b><span>${htmlEscape(new URL(baseUrl).host)}</span></div>
          <div class="proof"><b>10 resources</b><span>$0.005-$0.15 per call</span></div>
          <div class="proof"><b>Policy gated</b><span>caps, allowlists, receipts</span></div>
          <div class="proof"><b>Public repo</b><span>kfubtik/trust402</span></div>
        </div>
      </div>
    </section>

    <section id="resources">
      <div class="wrap">
        <div class="section-head">
          <h2>Paid x402 resources for cautious buyers.</h2>
          <p class="section-copy">Each endpoint is built around one buyer problem: should an agent trust this paid API, what should it spend, what receipt did it get, and how can the final result be proven?</p>
        </div>
        <div class="resource-grid">
          ${paidResources.map(resourceCard).join("")}
        </div>
      </div>
    </section>

    <section id="policy" class="policy-band">
      <div class="wrap">
        <div class="section-head">
          <h2>Autonomy with hard edges.</h2>
          <p class="section-copy">Trust402 can run scheduled buyer checks and interact with allowlisted agents, but every paid path stays behind machine-readable spend policy.</p>
        </div>
        <div class="policy-grid">
          <div class="policy"><span class="label">Per call cap</span><strong>$0.005</strong><p>Current production live window limits downstream paid calls to small, auditable purchases.</p></div>
          <div class="policy"><span class="label">Per job cap</span><strong>$0.02</strong><p>Autonomous jobs quote first, then execute only inside the configured approval and receipt profile.</p></div>
          <div class="policy"><span class="label">Daily cap</span><strong>$0.05</strong><p>Vercel Cron runs pseudo-random daily autonomy while GitHub random scheduling remains inactive without a shared secret.</p></div>
        </div>
      </div>
    </section>

    <section id="discovery">
      <div class="wrap">
        <div class="section-head">
          <h2>Ready for agents, directories, and reviewers.</h2>
          <p class="section-copy">The public surface is designed for crawlers and humans: OpenAPI, x402 discovery, agent manifests, resource catalog, completion audit, and a crawler-friendly directory profile.</p>
        </div>
        <div class="links-grid">
          <a class="link-card" href="/api/resources"><b>Resource Catalog</b><span>Prices, routes, schemas, and safety notes for all launch resources.</span></a>
          <a class="link-card" href="/api/policies/spend"><b>Spend Policy</b><span>Live procurement, Proof402, refill gates, caps, allowlists, and emergency stop.</span></a>
          <a class="link-card" href="/api/completion/audit"><b>Completion Audit</b><span>Current production verdict against the pinned autonomous buyer-agent plan.</span></a>
          <a class="link-card" href="/directory"><b>Directory Profile</b><span>Public landing data for marketplaces and ecosystem directories.</span></a>
          <a class="link-card" href="/llms.txt"><b>LLMs.txt</b><span>Compact agent-readable summary for models and crawler tools.</span></a>
          <a class="link-card" href="https://github.com/kfubtik/trust402"><b>GitHub</b><span>Public source, tests, release docs, and deployment evidence.</span></a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap">
      <span>Trust402 - buyer-side trust and procurement for the x402 economy.</span>
      <a class="link" href="/api/status">Runtime status</a>
    </div>
  </footer>
</body>
</html>
`;
}

function traceRows() {
  const rows = [
    ["probe", "402 challenge", "$0.005"],
    ["score", "schema + price + receipt", "$0.01"],
    ["compare", "2-10 candidate resources", "$0.03"],
    ["quote", "budgeted procurement plan", "$0.04"],
    ["execute", "allowlist + receipt bundle", "cap"],
    ["prove", "hash-only Proof402 proof", "$0.005"],
    ["audit", "public-safe completion state", "10/10"]
  ];
  return rows
    .map(([step, signal, price]) => `
      <div class="trace-row">
        <span>${htmlEscape(step)}</span>
        <div class="trace-line"></div>
        <span>${htmlEscape(price)}</span>
        <span></span>
        <span>${htmlEscape(signal)}</span>
        <span></span>
      </div>`)
    .join("");
}

function resourceCard(resource) {
  return `<a class="resource" href="/api/resources" aria-label="View catalog details for ${htmlEscape(resource.id)}">
    <small>${htmlEscape(displayPrice(resource.priceUsd))}</small>
    <b>${htmlEscape(resource.id)}</b>
    <span>${htmlEscape(resource.path)}</span>
  </a>`;
}

function displayPrice(value) {
  if (typeof value === "number") return `$${value.toFixed(value < 0.01 ? 3 : 2)}`;
  if (value && typeof value === "object") return `$${value.min}-$${value.max}`;
  return String(value);
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
