import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";

const ROUTE_KEYWORDS = {
  "trust.check_x402": ["x402 check", "payment required", "endpoint probe", "paid api readiness"],
  "trust.score_resource": ["resource score", "trust score", "x402 buyer safety", "schema readiness"],
  "trust.evaluate_origin": ["origin evaluation", "domain trust", "x402 discovery", "seller origin"],
  "seller.readiness": ["seller readiness", "marketplace readiness", "x402 seller hardening", "metadata quality"],
  "trust.compare_resources": ["compare x402 resources", "rank paid APIs", "buyer agent decision", "resource comparison"],
  "procurement.plan": ["procurement plan", "bounded spend", "agent budget", "x402 purchase plan"],
  "procurement.quote": ["purchase quote", "approval payload", "max payment", "Base MCP purchase"],
  "monitor.snapshot": ["payment flow monitor", "x402 drift", "challenge snapshot", "endpoint monitoring"],
  "monitor.badge": ["trust badge", "snapshot badge", "seller badge", "x402 trust signal"],
  "reports.x402_diligence": ["diligence report", "x402 report", "proof-ready evidence", "marketplace review"]
};

const MCP_TOOL_BY_RESOURCE = {
  "trust.score_resource": "score_x402_resource",
  "trust.compare_resources": "compare_x402_resources",
  "procurement.quote": "prepare_x402_purchase"
};

export function indexingRoutes(input = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl || options.config?.publicBaseUrl || config.publicBaseUrl);
  const catalog = options.catalog || loadCatalog();
  const records = catalog.paidLaunchResources.map((resource) => indexingRecord(resource, baseUrl));
  const core = {
    baseUrl,
    resources: records.map((record) => record.id),
    mcpTools: records.flatMap((record) => record.mcpToolName ? [record.mcpToolName] : [])
  };
  return {
    ok: true,
    tool: "indexing.routes",
    schema: "trust402.indexing_routes.v1",
    generatedAt: new Date().toISOString(),
    indexingHash: sha256Json(core),
    summary:
      "Route-level discovery feed for Trust402 paid x402 resources, MCP wrappers, semantic search, and external marketplace indexing.",
    records,
    sitemap: `${baseUrl}/sitemap.xml`,
    x402: `${baseUrl}/.well-known/x402`,
    mcp: `${baseUrl}/.well-known/mcp.json`,
    safety: {
      publicSafe: true,
      includesSecrets: false,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0
    }
  };
}

export function routeIndexRecord(resourceIdOrSlug, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || options.config?.publicBaseUrl || config.publicBaseUrl);
  const resource = loadCatalog().paidLaunchResources.find((item) =>
    item.id === resourceIdOrSlug || slugFor(item.id) === resourceIdOrSlug
  );
  if (!resource) {
    throw new ApiError(404, "resource_page_not_found", "Paid resource page not found.", { resource: resourceIdOrSlug });
  }
  return indexingRecord(resource, baseUrl);
}

export function routeIndexPageHtml(resourceIdOrSlug, options = {}) {
  const record = routeIndexRecord(resourceIdOrSlug, options);
  const keywordList = record.keywords.map((keyword) => `<li>${htmlEscape(keyword)}</li>`).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: record.name,
    description: record.description,
    url: record.x402Url,
    provider: {
      "@type": "Organization",
      name: "Trust402",
      url: record.baseUrl
    },
    offers: {
      "@type": "Offer",
      price: String(record.priceUsd),
      priceCurrency: "USD",
      url: record.x402Url
    }
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(record.name)} - Trust402</title>
  <meta name="description" content="${htmlEscape(record.description)}">
  <link rel="canonical" href="${htmlEscape(record.pageUrl)}">
  <link rel="service-desc" type="application/openapi+json" href="/openapi.json">
  <script type="application/ld+json">${safeScriptJson(jsonLd)}</script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0d0b; color: #f6f7f2; font-family: Inter, "Segoe UI", Arial, sans-serif; line-height: 1.5; letter-spacing: 0; }
    a { color: inherit; }
    header, main { width: min(100% - 40px, 980px); margin: 0 auto; }
    header { min-height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid rgba(246,247,242,0.14); }
    nav { display: flex; gap: 16px; flex-wrap: wrap; color: #bac6bd; font-size: 14px; }
    main { padding: 52px 0 80px; }
    .eyebrow { color: #7be0b0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; text-transform: uppercase; }
    h1 { margin: 10px 0 16px; font-size: clamp(40px, 8vw, 78px); line-height: 0.98; letter-spacing: 0; }
    p { color: #dce4dd; font-size: 18px; max-width: 760px; }
    .panel { border: 1px solid rgba(246,247,242,0.14); border-radius: 8px; background: rgba(246,247,242,0.045); padding: 18px; margin-top: 18px; }
    dl { display: grid; gap: 10px; }
    dt { color: #9cab9f; font-size: 12px; text-transform: uppercase; }
    dd { margin: 2px 0 0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
    ul { color: #dce4dd; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
    .button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; padding: 0 16px; border: 1px solid rgba(246,247,242,0.16); border-radius: 8px; text-decoration: none; font-weight: 720; }
    .primary { color: #11130f; background: #7be0b0; border-color: #7be0b0; }
  </style>
</head>
<body>
  <header>
    <strong>Trust402</strong>
    <nav aria-label="Resource navigation">
      <a href="/api/indexing/routes">Indexing JSON</a>
      <a href="/.well-known/x402">x402</a>
      <a href="/.well-known/mcp.json">MCP</a>
      <a href="/api/resources">Resources</a>
    </nav>
  </header>
  <main>
    <div class="eyebrow">${htmlEscape(record.id)}</div>
    <h1>${htmlEscape(record.name)}</h1>
    <p>${htmlEscape(record.description)}</p>
    <div class="actions">
      <a class="button primary" href="${htmlEscape(record.x402Url)}">Paid x402 route</a>
      <a class="button" href="/openapi.json">OpenAPI</a>
      <a class="button" href="/.well-known/mcp.json">MCP wrapper</a>
    </div>
    <section class="panel">
      <h2>Discovery</h2>
      <dl>
        <div><dt>Method</dt><dd>${htmlEscape(record.method)}</dd></div>
        <div><dt>Price</dt><dd>${htmlEscape(record.priceDisplay)}</dd></div>
        <div><dt>x402 URL</dt><dd>${htmlEscape(record.x402Url)}</dd></div>
        <div><dt>MCP tool</dt><dd>${htmlEscape(record.mcpToolName || "not mapped")}</dd></div>
      </dl>
    </section>
    <section class="panel">
      <h2>Keywords</h2>
      <ul>${keywordList}</ul>
    </section>
  </main>
</body>
</html>`;
}

function indexingRecord(resource, baseUrl) {
  const id = resource.id;
  const slug = slugFor(id);
  const mcpToolName = MCP_TOOL_BY_RESOURCE[id] || null;
  return {
    id,
    slug,
    name: nameFor(resource),
    method: resource.method,
    path: resource.path,
    x402Url: `${baseUrl}${resource.path}`,
    pageUrl: `${baseUrl}/resources/${slug}`,
    baseUrl,
    priceUsd: resource.priceUsd,
    priceDisplay: priceDisplay(resource.priceUsd),
    category: categoryFor(resource),
    description: resource.purpose,
    keywords: ROUTE_KEYWORDS[id] || ["x402", "Trust402", "paid resource"],
    semanticQueries: semanticQueries(resource),
    mcpToolName,
    mcpManifest: `${baseUrl}/.well-known/mcp.json`,
    openapi: `${baseUrl}/openapi.json`,
    x402Discovery: `${baseUrl}/.well-known/x402`,
    indexingHints: {
      canonicalResourceUrl: `${baseUrl}${resource.path}`,
      exactRouteQuery: `${baseUrl}${resource.path}`,
      routeIdQuery: `${id} Trust402`,
      descriptionQuery: resource.purpose,
      preferredListingOrigin: baseUrl
    }
  };
}

function semanticQueries(resource) {
  const keywords = ROUTE_KEYWORDS[resource.id] || [];
  return [
    resource.id,
    resource.path,
    resource.purpose,
    `Trust402 ${resource.id}`,
    ...keywords.map((keyword) => `Trust402 ${keyword}`)
  ];
}

function nameFor(resource) {
  return resource.id
    .split(".")
    .join(" ")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function categoryFor(resource) {
  if (resource.id.startsWith("procurement.")) return "procurement";
  if (resource.id.startsWith("monitor.")) return "monitoring";
  if (resource.id.startsWith("reports.")) return "diligence";
  if (resource.id.startsWith("seller.")) return "seller";
  return "trust";
}

function priceDisplay(price) {
  if (typeof price === "object" && price) return `$${price.min}-$${price.max}`;
  return `$${price}`;
}

function slugFor(id) {
  return String(id).replaceAll(".", "-").replaceAll("_", "-");
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.aztecbeacon.uk").replace(/\/+$/, "");
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
