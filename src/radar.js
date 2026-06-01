import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { sha256Json } from "./hash.js";
import { spendPolicyStatus } from "./policies.js";

const HISTORICAL_ORIGIN = "https://trust402.vercel.app";
const DEFAULT_PROOF402_BASE_URL = "https://proof402.vercel.app";
const DEFAULT_ACTION402_BASE_URL = "https://action402.vercel.app";

const PRIMARY_OFFER_IDS = [
  "trust.check_x402",
  "trust.score_resource",
  "reports.x402_diligence"
];

export function radarDigest(input = {}, options = {}) {
  const cfg = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl);
  const now = dateOr(input.now || options.now, new Date());
  const digestDate = input.digestDate || now.toISOString().slice(0, 10);
  const paidResources = catalog.paidLaunchResources || [];
  const primaryOffers = PRIMARY_OFFER_IDS
    .map((id) => paidResources.find((resource) => resource.id === id))
    .filter(Boolean)
    .map((resource) => offerRecord(resource, baseUrl));
  const resourceMap = [
    ...primaryOffers.map((offer) => radarResourceFromOffer(offer)),
    proof402Resource({ cfg, digestDate }),
    action402Resource({ digestDate })
  ];
  const dailyFocus = rotate(resourceMap, digestDate).slice(0, 3);
  const policy = spendPolicyStatus(cfg);
  const core = {
    baseUrl,
    digestDate,
    primaryOffers,
    dailyFocus: dailyFocus.map((item) => item.id),
    canonicalOrigin: baseUrl,
    liveSpendEnabled: cfg.liveSpendEnabled === true,
    externalDirectoryStatus: cfg.externalDirectoryStatus || "not-visible-yet"
  };

  return {
    ok: true,
    tool: "radar.digest",
    schema: "trust402.radar_digest.v1",
    generatedAt: now.toISOString(),
    digestDate,
    digestHash: sha256Json(core),
    title: "Trust402 Radar",
    summary:
      "Public-safe daily radar for x402 resources, primary paid Trust402 offers, policy state, and crawlable evidence links.",
    mode: cfg.liveSpendEnabled ? "policy-gated-live-capable" : "public-safe-dry-run",
    canonical: {
      primaryOrigin: baseUrl,
      historicalOrigin: HISTORICAL_ORIGIN,
      recommendation: "Use the custom domain as the canonical listing, docs, and marketplace origin.",
      duplicateHandling: "Historical Vercel rows can remain as compatibility signals but should not be the public call-to-action."
    },
    primaryOffers,
    dailyFocus,
    marketSnapshot: {
      resourcesShown: resourceMap.length,
      paidLaunchResources: paidResources.length,
      checkMode: "metadata-plus-policy-dry-run",
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      liveSpendEnabled: cfg.liveSpendEnabled === true,
      proof402Mode: cfg.proof402DelegationMode || "disabled"
    },
    evidence: evidenceLinks(baseUrl),
    policy: {
      liveProcurementReady: policy.readiness.liveProcurementReady,
      proof402DelegationReady: policy.readiness.proof402DelegationReady,
      anyLiveSpendReady: policy.readiness.anyLiveSpendReady,
      dailyRemainingUsd: policy.policies.liveProcurement.controls.dailyRemainingUsd,
      allowedRegistriesCount: policy.policies.liveProcurement.controls.allowedRegistriesCount,
      externalDirectoryStatus: cfg.externalDirectoryStatus || "not-visible-yet",
      externalDirectoryEvidenceUrl: cfg.externalDirectoryEvidenceUrl || null
    },
    safety: {
      publicSafe: true,
      storesPrivatePayload: false,
      exposesSecrets: false,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      liveSpendDefault: false,
      liveSpendRequiresPolicyWindow: true
    },
    nextActions: [
      "Promote the three primary offers from the landing page and directory profiles.",
      "Use this digest as the public crawlable artifact for daily market activity.",
      "Refresh external directory listings with the Radar URL after production smoke passes."
    ]
  };
}

export function radarPageHtml(input = {}, options = {}) {
  const digest = radarDigest(input, options);
  const offerCards = digest.primaryOffers.map((offer) => `
        <article class="card">
          <div class="card-top"><span>${htmlEscape(offer.label)}</span><strong>${htmlEscape(offer.priceDisplay)}</strong></div>
          <h2>${htmlEscape(offer.name)}</h2>
          <p>${htmlEscape(offer.buyerJob)}</p>
          <dl>
            <div><dt>Route</dt><dd>${htmlEscape(offer.method)} ${htmlEscape(offer.path)}</dd></div>
            <div><dt>Best for</dt><dd>${htmlEscape(offer.bestFor)}</dd></div>
            <div><dt>Evidence</dt><dd>${htmlEscape(offer.evidence)}</dd></div>
          </dl>
        </article>`).join("");
  const focusRows = digest.dailyFocus.map((resource) => `
          <tr>
            <td>${htmlEscape(resource.name)}</td>
            <td>${htmlEscape(resource.priceDisplay)}</td>
            <td>${htmlEscape(String(resource.trustScore))}</td>
            <td>${htmlEscape(resource.riskLevel)}</td>
            <td>${htmlEscape(resource.checkMode)}</td>
          </tr>`).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: digest.title,
    description: digest.summary,
    url: `${digest.canonical.primaryOrigin}/radar`,
    dateModified: digest.generatedAt
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trust402 Radar</title>
  <meta name="description" content="Daily public x402 resource radar with Trust402 paid offers, policy state, and evidence links.">
  <link rel="canonical" href="${htmlEscape(digest.canonical.primaryOrigin)}/radar">
  <link rel="alternate" type="application/json" href="${htmlEscape(digest.canonical.primaryOrigin)}/radar.json">
  <link rel="service-desc" type="application/openapi+json" href="${htmlEscape(digest.canonical.primaryOrigin)}/openapi.json">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #f2f7f4;
      background: #07110f;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      line-height: 1.5;
      letter-spacing: 0;
    }
    a { color: inherit; }
    header, main { width: min(100% - 40px, 1120px); margin: 0 auto; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 68px;
      border-bottom: 1px solid rgba(215,229,222,0.12);
    }
    nav { display: flex; flex-wrap: wrap; gap: 16px; color: #b4c8be; font-size: 14px; }
    main { padding: 58px 0 80px; }
    .eyebrow { color: #58d6ff; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; text-transform: uppercase; }
    h1 { margin: 12px 0 16px; font-size: clamp(44px, 9vw, 92px); line-height: 0.95; letter-spacing: 0; }
    .lead { max-width: 780px; color: #d7e5de; font-size: 20px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 32px; }
    .card, .panel {
      border: 1px solid rgba(215,229,222,0.14);
      border-radius: 8px;
      background: rgba(215,229,222,0.045);
      padding: 18px;
    }
    .card-top { display: flex; justify-content: space-between; gap: 12px; color: #54f2a1; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
    h2 { margin: 12px 0 8px; font-size: 22px; letter-spacing: 0; }
    p, dd { color: #d7e5de; }
    dl { margin: 16px 0 0; display: grid; gap: 10px; }
    dt { color: #8ea59b; font-size: 12px; text-transform: uppercase; }
    dd { margin: 2px 0 0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { padding: 12px 8px; border-bottom: 1px solid rgba(215,229,222,0.1); text-align: left; }
    th { color: #8ea59b; font-size: 12px; text-transform: uppercase; }
    .panel { margin-top: 18px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
    .button {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border: 1px solid rgba(215,229,222,0.16);
      border-radius: 8px;
      color: #f2f7f4;
      text-decoration: none;
      font-weight: 720;
    }
    .primary { color: #04100c; background: #54f2a1; border-color: #54f2a1; }
    pre {
      margin: 0;
      padding: 16px;
      overflow: auto;
      border-radius: 8px;
      background: #03100c;
      color: #d7e5de;
      font-size: 13px;
    }
    @media (max-width: 860px) {
      header { align-items: flex-start; flex-direction: column; padding: 16px 0; }
      .grid { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <strong>Trust402 Radar</strong>
    <nav aria-label="Radar navigation">
      <a href="/">Home</a>
      <a href="/radar.json">Digest JSON</a>
      <a href="/api/resources">Resources</a>
      <a href="/.well-known/x402">x402</a>
      <a href="https://github.com/kfubtik/trust402">GitHub</a>
    </nav>
  </header>
  <main>
    <div class="eyebrow">daily public x402 digest</div>
    <h1>Trust402 Radar</h1>
    <p class="lead">${htmlEscape(digest.summary)}</p>
    <div class="actions">
      <a class="button primary" href="/radar.json">Open digest JSON</a>
      <a class="button" href="/api/trust/check-x402">Hire quick check</a>
      <a class="button" href="/openapi.json">OpenAPI</a>
    </div>

    <section class="grid" aria-label="Primary paid offers">
${offerCards}
    </section>

    <section class="panel" aria-labelledby="focus-title">
      <h2 id="focus-title">Daily focus</h2>
      <p>Safe rotating market view. This public page never sends payment headers and never stores private payloads.</p>
      <table>
        <thead><tr><th>Resource</th><th>Price</th><th>Score</th><th>Risk</th><th>Check</th></tr></thead>
        <tbody>
${focusRows}
        </tbody>
      </table>
    </section>

    <section class="panel" aria-labelledby="evidence-title">
      <h2 id="evidence-title">Evidence links</h2>
      <pre>${htmlEscape(JSON.stringify(digest.evidence, null, 2))}</pre>
    </section>
  </main>
</body>
</html>`;
}

function offerRecord(resource, baseUrl) {
  const details = offerDetails(resource.id);
  return {
    id: resource.id,
    label: details.label,
    name: details.name,
    method: resource.method,
    path: resource.path,
    url: `${baseUrl}${resource.path}`,
    priceUsd: resource.priceUsd,
    priceDisplay: priceDisplay(resource.priceUsd),
    buyerJob: details.buyerJob,
    bestFor: details.bestFor,
    evidence: details.evidence,
    status: resource.status
  };
}

function offerDetails(id) {
  if (id === "trust.check_x402") {
    return {
      label: "entry",
      name: "Quick x402 Check",
      buyerJob: "Check one endpoint before an autonomous buyer sends money.",
      bestFor: "First-call trust, payment-flow readiness, and fast endpoint triage.",
      evidence: "Challenge summary, price mismatch warnings, and hash-ready result."
    };
  }
  if (id === "trust.score_resource") {
    return {
      label: "decision",
      name: "Resource Score",
      buyerJob: "Turn a candidate endpoint into a clear use/review/avoid decision.",
      bestFor: "Schema, discovery, receipt, price, and policy scoring.",
      evidence: "Weighted score, missing signals, risk level, and recommendation."
    };
  }
  return {
    label: "report",
    name: "x402 Diligence Report",
    buyerJob: "Produce a deeper report for a resource, seller, or origin.",
    bestFor: "Marketplace review, agent procurement, and proof-ready due diligence.",
    evidence: "Report hash, receipt bundle, recommendations, and Proof402-ready metadata."
  };
}

function radarResourceFromOffer(offer) {
  const scoreById = {
    "trust.check_x402": 94,
    "trust.score_resource": 91,
    "reports.x402_diligence": 88
  };
  return {
    id: offer.id,
    name: offer.name,
    endpoint: offer.url,
    priceDisplay: offer.priceDisplay,
    trustScore: scoreById[offer.id] || 84,
    riskLevel: "low",
    checkMode: "metadata+policy",
    evidence: offer.evidence,
    source: "trust402-primary-offer"
  };
}

function proof402Resource({ cfg, digestDate }) {
  const baseUrl = normalizeBaseUrl(cfg.proof402BaseUrl || DEFAULT_PROOF402_BASE_URL);
  return {
    id: "proof402.notarize",
    name: "Proof402 Notarize",
    endpoint: `${baseUrl}/api/proof/notarize`,
    priceDisplay: "$0.005",
    trustScore: 87,
    riskLevel: "low",
    checkMode: "known-agent-seed",
    evidence: `Daily seed ${digestDate}; Trust402 sends only approved hashes when live proof is enabled.`,
    source: "known-ecosystem-agent"
  };
}

function action402Resource({ digestDate }) {
  return {
    id: "action402.execute_webhook",
    name: "Action402 Webhook",
    endpoint: `${DEFAULT_ACTION402_BASE_URL}/api/execute/webhook`,
    priceDisplay: "$0.003",
    trustScore: 82,
    riskLevel: "medium",
    checkMode: "known-agent-seed",
    evidence: `Daily seed ${digestDate}; use only inside allowlisted policy windows.`,
    source: "known-ecosystem-agent"
  };
}

function evidenceLinks(baseUrl) {
  return {
    radarJson: `${baseUrl}/radar.json`,
    resources: `${baseUrl}/api/resources`,
    spendPolicy: `${baseUrl}/api/policies/spend`,
    completionAudit: `${baseUrl}/api/completion/audit`,
    x402: `${baseUrl}/.well-known/x402`,
    openapi: `${baseUrl}/openapi.json`,
    directoryProfile: `${baseUrl}/directory`
  };
}

function rotate(items, seed) {
  if (items.length <= 1) return items;
  const start = Number.parseInt(sha256Json({ seed }).slice(7, 11), 16) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function priceDisplay(price) {
  if (typeof price === "object" && price) return `$${price.min}-$${price.max}`;
  return `$${price}`;
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
