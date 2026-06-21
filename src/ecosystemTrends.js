import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { spendPolicyStatus } from "./policies.js";

const SOURCES = [
  {
    id: "base_agents",
    name: "Base Agents",
    url: "https://www.base.org/agents",
    signal: "Base positions AI agents around wallets, spend controls, x402 payments, and onchain services."
  },
  {
    id: "base_mcp_x402",
    name: "Base MCP x402 payments",
    url: "https://docs.base.org/ai-agents/guides/x402-payments",
    signal: "Base MCP uses an initiate/approve/complete flow, which is better for deliberate purchases than high-frequency tiny calls."
  },
  {
    id: "agentic_market",
    name: "Agentic Market",
    url: "https://agentic.market/",
    signal: "Agent-facing APIs are discovered, priced, and bought per result without accounts or subscriptions."
  },
  {
    id: "agentic_market_about",
    name: "Agentic Market About",
    url: "https://agentic.market/about",
    signal: "Buyers compare services by use case, price, network, and endpoint before paying in USDC."
  },
  {
    id: "cdp_bazaar_quality",
    name: "CDP x402 Bazaar",
    url: "https://docs.cdp.coinbase.com/x402/bazaar",
    signal: "Bazaar uses semantic search plus objective quality signals such as buyer reach, transaction volume, recency, and metadata quality."
  },
  {
    id: "x402_ecosystem",
    name: "x402 ecosystem",
    url: "https://www.x402.org/ecosystem",
    signal: "Infrastructure members and directories are converging around Base settlement, x402 discovery, MCP tools, and risk controls."
  },
  {
    id: "x402_security_research",
    name: "x402 security research",
    url: "https://arxiv.org/abs/2605.11781",
    signal: "Current risk research highlights authorization binding, replay protection, and web-layer handling as practical x402 concerns."
  }
];

const TREND_CATEGORIES = [
  {
    id: "agentic_buyer_workflows",
    label: "Agentic buyer workflows",
    momentum: "high",
    buyerNeed: "Agents need to discover, compare, pay, verify, and remember what they bought.",
    trust402Fit: "Trust402 can sit before payment as a route scorer and after payment as a receipt/proof planner.",
    recommendedOffers: ["trust.check_x402", "trust.score_resource", "trust.compare_resources", "reports.x402_diligence"]
  },
  {
    id: "paid_market_intelligence",
    label: "Paid market intelligence",
    momentum: "high",
    buyerNeed: "Visible paid services cluster around concise research, market briefs, scanners, and decision reports.",
    trust402Fit: "Trust402 should package endpoint diligence as a paid decision report, not only as raw endpoint checks.",
    recommendedOffers: ["reports.x402_diligence", "trust.compare_resources", "procurement.quote"]
  },
  {
    id: "bazaar_quality_recency",
    label: "Bazaar quality and recency",
    momentum: "high",
    buyerNeed: "Agents need endpoints that remain discoverable, recently settled, and richly described enough for semantic search.",
    trust402Fit: "Trust402 can publish route-level evidence, score metadata quality, and keep Radar/receipt artifacts crawlable.",
    recommendedOffers: ["monitor.snapshot", "monitor.badge", "seller.readiness", "trust.score_resource"]
  },
  {
    id: "approval_gated_x402_mcp",
    label: "Approval-gated x402 through MCP",
    momentum: "high",
    buyerNeed: "Human-approved Base MCP payments favor larger, higher-confidence purchases over noisy microcalls.",
    trust402Fit: "Trust402 should present one clear quote, maxPayment guidance, and receipt expectations before an agent asks for approval.",
    recommendedOffers: ["procurement.plan", "procurement.quote", "trust.compare_resources"]
  },
  {
    id: "verification_native_clearing",
    label: "Verification-native clearing",
    momentum: "emerging",
    buyerNeed: "Payment alone does not prove that the right service responded, that the result was delivered, or that no replay/binding mistake happened.",
    trust402Fit: "Trust402 should keep emphasizing challenge binding, price checks, public discovery, result hashing, and Proof402-ready evidence.",
    recommendedOffers: ["trust.check_x402", "monitor.snapshot", "reports.x402_diligence"]
  },
  {
    id: "privacy_safe_payment_metadata",
    label: "Privacy-safe payment metadata",
    momentum: "emerging",
    buyerNeed: "Agents need to avoid leaking private task details through payment descriptions, URLs, headers, and facilitator-visible metadata.",
    trust402Fit: "Trust402 should continue stripping payment headers from unpaid probes and guide sellers toward minimal public metadata.",
    recommendedOffers: ["trust.score_resource", "seller.readiness", "monitor.badge"]
  },
  {
    id: "seller_hardening",
    label: "Seller-side hardening",
    momentum: "emerging",
    buyerNeed: "Sellers need to prove that payment metadata, price consistency, request binding assumptions, and replay controls are safe before agents trust them.",
    trust402Fit: "Trust402 should package seller readiness and diligence as x402 security posture checks, not just marketing readiness.",
    recommendedOffers: ["seller.readiness", "reports.x402_diligence", "monitor.snapshot"]
  }
];

export function ecosystemTrends(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl);
  const now = dateOr(input.now || options.now, new Date());
  const policy = spendPolicyStatus(cfg);
  const categories = TREND_CATEGORIES.map((category) => ({
    ...category,
    offerUrls: category.recommendedOffers.map((id) => ({
      id,
      url: offerUrl(baseUrl, id)
    }))
  }));
  const buyerWorkflow = [
    {
      step: "discover",
      description: "Read /.well-known/x402, OpenAPI, resource catalogs, and marketplace listings before considering payment.",
      trust402Route: "/api/resources"
    },
    {
      step: "screen",
      description: "Check schema, price, x402 challenge, network, receipt readiness, and public seller metadata.",
      trust402Route: "/api/trust/score-resource"
    },
    {
      step: "compare",
      description: "Rank 2-10 candidate resources by goal fit, risk, price, discovery completeness, and proof readiness.",
      trust402Route: "/api/trust/compare-resources"
    },
    {
      step: "approve",
      description: "Ask the user or policy engine for a bounded maxPayment only after the route and quote are clear.",
      trust402Route: "/api/procurement/quote"
    },
    {
      step: "verify",
      description: "Hash the purchased result, preserve public-safe evidence, and notarize only approved hashes when proof delegation is enabled.",
      trust402Route: "/api/receipts/hash-result"
    },
    {
      step: "monitor",
      description: "Recheck payment-flow drift, challenge changes, and seller metadata before repeat purchases.",
      trust402Route: "/api/monitor/snapshot"
    }
  ];
  const productMoves = [
    {
      id: "sell_reports_not_raw_checks",
      priority: "high",
      action: "Position the diligence report and compare-resources flows as the main paid offers for agents with approval-gated wallets.",
      reason: "Current buyer behavior favors actionable bundles and reports over one-off low-context checks."
    },
    {
      id: "base_mcp_wrapper",
      priority: "high",
      action: "Expose a tiny MCP wrapper later with tools such as score_x402_resource and compare_x402_resources that call the existing paid endpoints.",
      reason: "Base MCP/Hermes/Codex flows make x402 purchasing easier when the agent can call one clear tool and receive approval guidance."
    },
    {
      id: "receipt_first_ui",
      priority: "medium",
      action: "Keep receipts, result hashes, and Proof402-ready metadata visible on every paid workflow.",
      reason: "Verification-native clearing is a stronger moat than generic endpoint scoring."
    },
    {
      id: "fresh_indexing_evidence",
      priority: "medium",
      action: "Refresh marketplace visibility evidence after every production deploy and avoid stale 10/10 claims.",
      reason: "Directory indexing can regress even when production smoke and x402 smoke pass."
    },
    {
      id: "seller_hardening_reports",
      priority: "medium",
      action: "Make seller readiness and diligence reports explicitly test discovery metadata, payment metadata privacy, replay assumptions, price clarity, and receipt output.",
      reason: "Security-hardening language is now part of the x402 buying decision, especially for autonomous purchasers."
    }
  ];
  const avoid = [
    "Do not run unbounded autonomous spend against newly discovered x402 endpoints.",
    "Do not leak private task details in payment descriptions, URLs, payment headers, or facilitator-visible metadata.",
    "Do not claim marketplace visibility from stale evidence; keep fresh route-level checks beside launch claims.",
    "Do not force Base MCP users through manual approval for tiny repeated calls when one bundled report would be clearer."
  ];
  const core = {
    baseUrl,
    asOfDate: now.toISOString().slice(0, 10),
    categoryIds: categories.map((category) => category.id),
    workflow: buyerWorkflow.map((step) => step.step),
    productMoves: productMoves.map((move) => move.id),
    liveSpendEnabled: cfg.liveSpendEnabled === true,
    anyLiveSpendReady: policy.readiness.anyLiveSpendReady
  };

  return {
    ok: true,
    tool: "ecosystem.trends",
    schema: "trust402.ecosystem_trends.v1",
    generatedAt: now.toISOString(),
    asOfDate: core.asOfDate,
    trendHash: sha256Json(core),
    summary:
      "Base/x402 agent commerce is moving toward wallet-enabled buyer agents, marketplace discovery, approval-gated purchases, bundled paid intelligence, and verification-native receipts.",
    sources: SOURCES,
    categories,
    buyerWorkflow,
    productMoves,
    trust402Positioning: {
      role: "buyer-side trust, procurement, and proof-readiness layer for x402 resources",
      bestPaidOffersNow: ["trust.compare_resources", "reports.x402_diligence", "procurement.quote"],
      mcpStrategy: "Add a wrapper later; keep OpenAPI/x402 endpoints as the canonical paid API.",
      proofStrategy: "Hash results locally and delegate to Proof402 only when policy explicitly allows approved hash notarization."
    },
    safety: {
      publicSafe: true,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      liveSpendDefault: false,
      liveSpendCurrentlyReady: policy.readiness.anyLiveSpendReady,
      exposesSecrets: false
    },
    avoid,
    links: {
      radar: `${baseUrl}/radar`,
      radarJson: `${baseUrl}/radar.json`,
      ecosystemPulse: `${baseUrl}/api/radar/ecosystem-pulse`,
      resources: `${baseUrl}/api/resources`,
      policies: `${baseUrl}/api/policies/spend`,
      openapi: `${baseUrl}/openapi.json`,
      x402: `${baseUrl}/.well-known/x402`
    }
  };
}

export function ecosystemTrendsHtml(input = {}, options = {}) {
  const trends = ecosystemTrends(input, options);
  const categoryCards = trends.categories.map((category) => `
        <article class="card">
          <div class="meta">${htmlEscape(category.momentum)}</div>
          <h2>${htmlEscape(category.label)}</h2>
          <p>${htmlEscape(category.buyerNeed)}</p>
          <p>${htmlEscape(category.trust402Fit)}</p>
        </article>`).join("");
  const workflowRows = trends.buyerWorkflow.map((step) => `
          <tr>
            <td>${htmlEscape(step.step)}</td>
            <td>${htmlEscape(step.description)}</td>
            <td><code>${htmlEscape(step.trust402Route)}</code></td>
          </tr>`).join("");
  const moves = trends.productMoves.map((move) => `
        <li><strong>${htmlEscape(move.action)}</strong><span>${htmlEscape(move.reason)}</span></li>`).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Trust402 Ecosystem Trends",
    description: trends.summary,
    url: `${trends.links.radar.replace(/\/radar$/, "")}/ecosystem`,
    dateModified: trends.generatedAt
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trust402 Ecosystem Trends</title>
  <meta name="description" content="Public-safe Base and x402 agent commerce intelligence for Trust402 buyers and directories.">
  <link rel="alternate" type="application/json" href="/api/ecosystem/trends">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #f6f7f2;
      background: #0b0d0b;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      line-height: 1.5;
      letter-spacing: 0;
    }
    a { color: inherit; }
    header, main { width: min(100% - 40px, 1120px); margin: 0 auto; }
    header {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid rgba(246,247,242,0.14);
    }
    nav { display: flex; gap: 16px; flex-wrap: wrap; color: #bac6bd; font-size: 14px; }
    main { padding: 56px 0 80px; }
    .eyebrow { color: #f0c15a; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; text-transform: uppercase; }
    h1 { margin: 12px 0 16px; font-size: clamp(42px, 8vw, 86px); line-height: 0.98; letter-spacing: 0; max-width: 920px; }
    .lead { max-width: 820px; color: #dce4dd; font-size: 20px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 30px; }
    .card, .panel {
      border: 1px solid rgba(246,247,242,0.14);
      border-radius: 8px;
      background: rgba(246,247,242,0.045);
      padding: 18px;
    }
    .meta { color: #7be0b0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; text-transform: uppercase; }
    h2 { margin: 10px 0 8px; font-size: 23px; letter-spacing: 0; }
    p { color: #dce4dd; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { padding: 12px 8px; border-bottom: 1px solid rgba(246,247,242,0.1); text-align: left; vertical-align: top; }
    th { color: #9cab9f; font-size: 12px; text-transform: uppercase; }
    code { color: #7be0b0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
    .panel { margin-top: 18px; }
    ul { padding-left: 18px; color: #dce4dd; }
    li { margin: 12px 0; }
    li span { display: block; color: #b8c4bc; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
    .button {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border: 1px solid rgba(246,247,242,0.16);
      border-radius: 8px;
      color: #f6f7f2;
      text-decoration: none;
      font-weight: 720;
    }
    .primary { color: #11130f; background: #f0c15a; border-color: #f0c15a; }
    @media (max-width: 820px) {
      header { align-items: flex-start; flex-direction: column; padding: 16px 0; }
      .grid { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <strong>Trust402</strong>
    <nav aria-label="Ecosystem navigation">
      <a href="/">Home</a>
      <a href="/radar">Radar</a>
      <a href="/api/radar/ecosystem-pulse">Pulse JSON</a>
      <a href="/api/ecosystem/trends">Trends JSON</a>
      <a href="/api/resources">Resources</a>
      <a href="/.well-known/x402">x402</a>
    </nav>
  </header>
  <main>
    <div class="eyebrow">Base / x402 agent commerce</div>
    <h1>Trust before agents spend.</h1>
    <p class="lead">${htmlEscape(trends.summary)}</p>
    <div class="actions">
      <a class="button primary" href="/api/ecosystem/trends">Open trends JSON</a>
      <a class="button" href="/api/radar/ecosystem-pulse">Market pulse</a>
      <a class="button" href="/api/trust/compare-resources">Compare resources</a>
      <a class="button" href="/api/reports/x402-diligence">Diligence report</a>
    </div>

    <section class="grid" aria-label="Trend categories">
${categoryCards}
    </section>

    <section class="panel" aria-labelledby="workflow-title">
      <h2 id="workflow-title">Buyer-agent workflow</h2>
      <table>
        <thead><tr><th>Step</th><th>Decision</th><th>Trust402 route</th></tr></thead>
        <tbody>
${workflowRows}
        </tbody>
      </table>
    </section>

    <section class="panel" aria-labelledby="moves-title">
      <h2 id="moves-title">Product moves</h2>
      <ul>${moves}</ul>
    </section>
  </main>
</body>
</html>`;
}

function offerUrl(baseUrl, id) {
  const paths = {
    "trust.check_x402": "/api/trust/check-x402",
    "trust.score_resource": "/api/trust/score-resource",
    "trust.evaluate_origin": "/api/trust/evaluate-origin",
    "seller.readiness": "/api/seller/readiness",
    "trust.compare_resources": "/api/trust/compare-resources",
    "procurement.plan": "/api/procurement/plan",
    "procurement.quote": "/api/procurement/quote",
    "monitor.snapshot": "/api/monitor/snapshot",
    "monitor.badge": "/api/monitor/badge",
    "reports.x402_diligence": "/api/reports/x402-diligence"
  };
  return `${baseUrl}${paths[id] || "/api/resources"}`;
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.aztecbeacon.uk").replace(/\/+$/, "");
}

function dateOr(value, fallback) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
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
