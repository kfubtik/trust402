import { config } from "../src/config.js";
import { loadCatalog } from "../src/catalog.js";

const baseUrl = (process.argv.find((arg) => /^https?:\/\//.test(arg)) || config.publicBaseUrl).replace(/\/$/, "");
const strict = process.argv.includes("--strict");
const allResources = process.argv.includes("--all-resources");
const timeoutMs = numberArg("--timeout-ms", 12_000);
const limit = numberArg("--limit", 25);
const concurrency = numberArg("--concurrency", 8);
const searchLimit = Math.min(limit, 20);
const catalogLimit = Math.min(limit, 30);
const host = safeHost(baseUrl);
const queries = Array.from(new Set([
  "Trust402",
  host,
  baseUrl
].filter(Boolean)));

const CDP_DISCOVERY_BASE = "https://api.cdp.coinbase.com/platform/v2/x402/discovery";

async function main() {
  const searchResults = await mapLimit(queries, concurrency, checkSearch);
  const catalog = await checkCatalog();
  const routeVisibility = allResources ? await checkRouteVisibility([...searchResults, catalog]) : [];
  const matched = [...searchResults, catalog].some((item) => item.matched === true);
  const routeMatched = routeVisibility.some((item) => item.indexed === true);
  const allRoutesMatched = routeVisibility.length > 0 && routeVisibility.every((item) => item.indexed === true);
  const anyOk = [...searchResults, catalog].some((item) => item.ok === true);
  const result = {
    ok: true,
    tool: "marketplace.bazaar_indexing_check",
    generatedAt: new Date().toISOString(),
    target: {
      baseUrl,
      host,
      concurrency
    },
    indexed: allResources ? allRoutesMatched : matched,
    status: allResources
      ? allRoutesMatched
        ? "all-indexed"
        : routeMatched
          ? "partially-indexed"
          : anyOk
            ? "eligible-not-found-yet"
            : "unknown"
      : matched
        ? "indexed"
        : anyOk
          ? "eligible-not-found-yet"
          : "unknown",
    routeSummary: allResources ? {
      expected: routeVisibility.length,
      indexed: routeVisibility.filter((item) => item.indexed).length,
      missing: routeVisibility.filter((item) => !item.indexed).map((item) => item.id)
    } : null,
    discovery: {
      search: searchResults,
      catalog,
      routes: routeVisibility
    },
    notes: [
      "This check is read-only and never sends payment headers or secrets.",
      "CDP Bazaar indexing is asynchronous after successful settle, so a not-found result can be temporary.",
      "Use --strict only when a CI or release gate should fail until the external catalog contains Trust402."
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  if (strict && !(allResources ? allRoutesMatched : matched)) process.exit(1);
}

async function checkSearch(query) {
  const url = `${CDP_DISCOVERY_BASE}/search?query=${encodeURIComponent(query)}&limit=${searchLimit}`;
  const response = await fetchJson(url);
  return {
    kind: "search",
    query,
    url,
    ...summarizeResponse(response)
  };
}

async function checkCatalog() {
  const url = `${CDP_DISCOVERY_BASE}/resources?limit=${catalogLimit}&offset=0`;
  const response = await fetchJson(url);
  return {
    kind: "resources",
    url,
    ...summarizeResponse(response)
  };
}

async function checkRouteVisibility(globalResults = []) {
  const catalog = loadCatalog();
  const paidResources = catalog.paidLaunchResources || [];
  const globallyMatchedResources = new Set(globalResults.flatMap((result) => result.matchedResources || []));
  const jobs = paidResources.flatMap((resource) => {
    const resourceUrl = `${baseUrl}${resource.path}`;
    return routeQueries(resource, resourceUrl).map((query) => ({
      resource,
      resourceUrl,
      query
    }));
  });
  const routeChecks = await mapLimit(jobs, concurrency, async (job) => ({
    ...job,
    result: await checkSearch(job.query)
  }));
  const byResource = new Map();
  for (const check of routeChecks) {
    const entries = byResource.get(check.resource.id) || [];
    entries.push(check.result);
    byResource.set(check.resource.id, entries);
  }

  const results = [];
  for (const resource of paidResources) {
    const resourceUrl = `${baseUrl}${resource.path}`;
    const queryResults = byResource.get(resource.id) || [];
    const matchedByGlobalSearch = globallyMatchedResources.has(resourceUrl);
    const matchedResources = Array.from(new Set([
      ...queryResults.flatMap((result) => result.matchedResources || []),
      ...(matchedByGlobalSearch ? [resourceUrl] : [])
    ]));
    const matches = queryResults.flatMap((result) => result.matches || []);
    const indexed = matchedResources.includes(resourceUrl);
    results.push({
      id: resource.id,
      path: resource.path,
      resource: resourceUrl,
      priceUsd: resource.priceUsd,
      indexed,
      matchedByGlobalSearch,
      checkedQueries: queryResults.map((result) => ({
        query: result.query,
        ok: result.ok,
        count: result.count,
        matched: result.matched
      })),
      matchedResources,
      matches
    });
  }
  return results;
}

function routeQueries(resource, resourceUrl) {
  return Array.from(new Set([
    resource.id,
    resource.path,
    resourceUrl,
    `${resource.id} Trust402`,
    resource.purpose
  ].filter(Boolean)));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: error.name === "AbortError" ? "timeout" : "error",
      body: { message: error.message }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeResponse(response) {
  const entries = resourcesFrom(response.body);
  const matchedEntries = entries.filter(matchesTrust402);
  const matchedResources = Array.from(new Set(matchedEntries.map(resourceUrlFrom).filter(Boolean)));
  return {
    ok: response.ok,
    httpStatus: response.status,
    count: entries.length,
    matched: matchedEntries.length > 0,
    searchMethod: response.body?.searchMethod || null,
    pagination: response.body?.pagination || null,
    matchedResources,
    matches: matchedEntries.slice(0, 5).map((entry) => ({
      name: entry.name || entry.title || entry.serviceName || null,
      resource: resourceUrlFrom(entry),
      description: entry.description || null,
      payTo: entry.payTo || entry.accepts?.[0]?.payTo || null
    })),
    error: response.ok ? null : response.body?.message || response.body?.error || response.body
  };
}

function resourcesFrom(body) {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.resources)) return body.resources;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.data)) return body.data;
  return [];
}

function matchesTrust402(entry) {
  const text = JSON.stringify(entry).toLowerCase();
  return text.includes("trust402") || text.includes(host.toLowerCase()) || text.includes(baseUrl.toLowerCase());
}

function resourceUrlFrom(entry) {
  return entry.resource || entry.url || entry.endpoint || null;
}

function numberArg(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function mapLimit(items, limit, worker) {
  const safeLimit = Math.max(1, Math.min(limit, items.length || 1));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, runWorker));
  return results;
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
