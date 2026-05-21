import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_BUDGET_USD = 0.25;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MAX_REGISTRY_URLS = 5;

export async function discoverResourceCandidates(input = {}, options = {}) {
  const cfg = options.config || config;
  const goal = String(input.goal || "Trust402 autonomous buyer-agent job").trim();
  const budgetUsd = numberOr(input.budgetUsd, DEFAULT_BUDGET_USD);
  const explicitCandidates = Array.isArray(input.candidates) ? input.candidates : [];
  const registryCandidates = Array.isArray(input.registryCandidates) ? input.registryCandidates : [];
  const registryFetches = await fetchRegistryCandidates(input, {
    cfg,
    fetchImpl: options.fetchImpl || globalThis.fetch
  });
  const includeSeedRegistry = input.useSeedRegistry === true ||
    (input.useSeedRegistry !== false && explicitCandidates.length === 0 && registryCandidates.length === 0 && registryFetches.candidates.length === 0);
  const seedCandidates = includeSeedRegistry ? trustedSeedCandidates({ goal, budgetUsd, cfg }) : [];
  const pool = [
    ...explicitCandidates.map((candidate) => normalizeCandidate(candidate, "input.candidates")),
    ...registryCandidates.map((candidate) => normalizeCandidate(candidate, "input.registryCandidates")),
    ...registryFetches.candidates,
    ...seedCandidates
  ].filter(Boolean);
  const filtered = uniqueByEndpoint(pool)
    .filter((candidate) => candidate.priceUsd === null || candidate.priceUsd <= budgetUsd);
  const ordered = input.randomizeCandidates === true
    ? seededShuffle(filtered, input.randomSeed || sha256Json({ goal, budgetUsd, candidates: filtered.map((candidate) => candidate.endpoint) }))
    : filtered;
  const unique = ordered.slice(0, clampInt(input.maxCandidates, 1, 10, 10));
  const discoveryCore = {
    goal,
    budgetUsd,
    includeSeedRegistry,
    explicitCandidates: explicitCandidates.length,
    registryCandidates: registryCandidates.length,
    fetchedRegistryCandidates: registryFetches.candidates.length,
    selectedCandidates: unique.map((candidate) => ({
      id: candidate.id,
      endpoint: candidate.endpoint,
      priceUsd: candidate.priceUsd,
      source: candidate.source
    }))
  };

  return {
    ok: true,
    tool: "registries.candidates",
    generatedAt: new Date().toISOString(),
    mode: "local-seed-and-input-discovery",
    discoveryHash: sha256Json(discoveryCore),
    goal,
    budgetUsd,
    summary: {
      explicitCandidates: explicitCandidates.length,
      registryCandidates: registryCandidates.length,
      fetchedRegistryCandidates: registryFetches.candidates.length,
      seedCandidates: seedCandidates.length,
      returnedCandidates: unique.length,
      includeSeedRegistry
    },
    registryFetches: registryFetches.results,
    candidates: unique,
    blockers: [
      ...registryFetches.blockers,
      ...(unique.length > 0 ? [] : [{
      id: "no_candidates_available",
      message: "No input, registry, or trusted seed candidates fit the requested budget."
      }])
    ],
    safety: {
      readOnly: true,
      fetchesExternalRegistries: registryFetches.attempted,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      mutatesWallet: false,
      includesSecretValues: false
    }
  };
}

export function candidatesForAutonomousRun(input = {}, options = {}) {
  return discoverCandidatesForAutonomousRun(input, options);
}

export async function discoverCandidatesForAutonomousRun(input = {}, options = {}) {
  const discovery = await discoverResourceCandidates(input, options);
  return {
    discovery,
    candidates: discovery.candidates
  };
}

function trustedSeedCandidates({ goal, cfg }) {
  const proofHash = sha256Json({
    agent: "Trust402",
    stage: "autonomous-resource-discovery",
    goal
  });
  return [
    {
      id: "proof402.notarize",
      name: "Proof402 paid hash notarization",
      endpoint: "https://proof402.vercel.app/api/proof/notarize",
      method: "POST",
      priceUsd: 0.005,
      has402: true,
      hasInputSchema: true,
      hasOpenApi: true,
      hasWellKnown: true,
      openapiUrl: "https://proof402.vercel.app/openapi.json",
      wellKnownUrl: "https://proof402.vercel.app/.well-known/x402",
      network: cfg.x402Network || "eip155:8453",
      asset: cfg.x402Asset || BASE_USDC,
      accept: {
        network: cfg.x402Network || "eip155:8453",
        asset: cfg.x402Asset || BASE_USDC
      },
      description: "Paid x402 resource that creates a timestamped proof for an approved SHA-256 hash without receiving private payloads.",
      receiptReady: true,
      proofReady: true,
      category: "proof",
      source: "trusted-seed-registry",
      requestBody: {
        contentHash: proofHash,
        label: "Trust402 autonomous resource selection",
        idempotencyKey: `trust402-autonomous-${proofHash.slice(7, 19)}`,
        metadata: {
          agent: "trust402",
          stage: "autonomous-resource-discovery",
          privatePayload: false
        }
      }
    }
  ];
}

async function fetchRegistryCandidates(input, { cfg, fetchImpl }) {
  const configuredUrls = Array.isArray(cfg.discoveryRegistryUrls) ? cfg.discoveryRegistryUrls : [];
  const requestedUrls = Array.isArray(input.registryUrls) ? input.registryUrls : [];
  const registryUrls = uniqueStrings([...configuredUrls, ...requestedUrls]).slice(0, MAX_REGISTRY_URLS);
  const shouldFetch = registryUrls.length > 0 && (input.fetchRegistries === true || cfg.discoveryRegistryFetchEnabled === true || requestedUrls.length > 0);
  const allowlist = uniqueStrings([
    ...(Array.isArray(cfg.discoveryRegistryAllowlist) ? cfg.discoveryRegistryAllowlist : []),
    ...(Array.isArray(input.allowedRegistryOrigins) ? input.allowedRegistryOrigins : [])
  ]);
  const configuredUrlSet = new Set(configuredUrls.map((url) => normalizeUrlKey(url)).filter(Boolean));
  const results = [];
  const candidates = [];
  const blockers = [];

  if (!shouldFetch) {
    return { attempted: false, results, candidates, blockers };
  }

  for (const url of registryUrls) {
    const parsed = safeUrl(url);
    if (!parsed || !isSafePublicHttpsUrl(parsed)) {
      const result = registryResult(url, "blocked", "invalid_or_unsafe_registry_url");
      results.push(result);
      blockers.push({ id: result.reason, message: `${url} is not a safe public HTTPS registry URL.` });
      continue;
    }
    const trustedConfigured = configuredUrlSet.has(normalizeUrlKey(parsed.href));
    if (!trustedConfigured && !matchesRegistryAllowlist(parsed, allowlist)) {
      const result = registryResult(parsed.href, "blocked", "registry_url_not_allowlisted");
      results.push(result);
      blockers.push({ id: result.reason, message: `${parsed.origin} is not in TRUST402_DISCOVERY_REGISTRY_ALLOWLIST or allowedRegistryOrigins.` });
      continue;
    }

    try {
      const response = await fetchImpl(parsed.href, {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent": "Trust402 registry-discovery/0.1"
        },
        signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
      });
      const text = await response.text();
      if (!response.ok) {
        results.push(registryResult(parsed.href, "failed", `http_${response.status}`));
        continue;
      }
      if (text.length > (cfg.maxJsonBytes || 131072)) {
        results.push(registryResult(parsed.href, "failed", "registry_json_too_large"));
        continue;
      }
      const body = JSON.parse(text);
      const extracted = extractCandidatesFromRegistry(body, parsed, cfg);
      candidates.push(...extracted);
      results.push({
        url: parsed.href,
        origin: parsed.origin,
        status: "ok",
        httpStatus: response.status,
        candidates: extracted.length
      });
    } catch (error) {
      results.push(registryResult(parsed.href, "failed", error.name === "AbortError" ? "timeout" : "fetch_or_parse_failed"));
    }
  }

  return {
    attempted: results.length > 0,
    results,
    candidates,
    blockers
  };
}

function extractCandidatesFromRegistry(body, registryUrl, cfg) {
  const arrays = collectCandidateArrays(body);
  const candidates = [];
  for (const group of arrays) {
    for (const entry of group.entries) {
      const candidate = candidateFromRegistryEntry(entry, registryUrl, group.name, cfg);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function collectCandidateArrays(body) {
  if (Array.isArray(body)) return [{ name: "root", entries: body }];
  if (!body || typeof body !== "object") return [];
  return [
    ["services", body.services],
    ["resources", body.resources],
    ["paidLaunchResources", body.paidLaunchResources],
    ["freeResources", body.freeResources],
    ["endpoints", body.endpoints],
    ["tools", body.tools],
    ["items", body.items],
    ["data", body.data]
  ]
    .filter(([, entries]) => Array.isArray(entries))
    .map(([name, entries]) => ({ name, entries }));
}

function candidateFromRegistryEntry(entry, registryUrl, collectionName, cfg) {
  if (!entry || typeof entry !== "object") return null;
  if (String(entry.status || "").toLowerCase() === "offline") return null;
  const endpoint = endpointFromEntry(entry, registryUrl);
  if (!endpoint) return null;
  const paymentInfo = entry["x-payment-info"] || entry.payment || entry.paymentInfo || {};
  const accepts = Array.isArray(entry.accepts) ? entry.accepts : Array.isArray(paymentInfo.accepts) ? paymentInfo.accepts : [];
  const accept = entry.accept || accepts[0] || {};
  const priceUsd = numberOrNull(entry.priceUsd ?? entry.price ?? entry.min_price_usd ?? paymentInfo.priceUsd ?? paymentInfo.usd) ??
    priceUsdFromAccept(accept);
  const inferredPaid = collectionName.toLowerCase().includes("paid") ||
    (priceUsd !== null && priceUsd > 0) ||
    /paid|x402/i.test(String(entry.status || entry.description || ""));
  const defaultOpenapiUrl = `${registryUrl.origin}/openapi.json`;
  const defaultWellKnownUrl = `${registryUrl.origin}/.well-known/x402`;
  const network = normalizeNetwork(entry.network || accept.network || paymentInfo.network || firstNetwork(entry.networks) || cfg.x402Network);
  const effectiveAccept = Object.keys(accept).length > 0 ? accept : (inferredPaid ? {
    network: network || "eip155:8453",
    asset: entry.asset || paymentInfo.asset || cfg.x402Asset || BASE_USDC
  } : {});
  return normalizeCandidate({
    id: entry.id || entry.name || entry.operationId || endpoint,
    name: entry.name || entry.title || entry.id,
    endpoint,
    method: entry.method || entry.httpMethod || "POST",
    priceUsd,
    has402: entry.has402 === true || Boolean(entry["x-payment-info"] || entry.paymentRequired || accepts.length || inferredPaid),
    hasInputSchema: entry.hasInputSchema === true || Boolean(entry.inputSchema || entry.requestSchema || entry.schema || entry.extensions?.bazaar?.schema || entry.endpoint_count || (entry.path && defaultOpenapiUrl)),
    hasOpenApi: entry.hasOpenApi === true || Boolean(entry.openapiUrl || entry.openApiUrl || entry.base_url || defaultOpenapiUrl),
    hasWellKnown: entry.hasWellKnown === true || Boolean(entry.wellKnownUrl || entry.x402Url || defaultWellKnownUrl),
    openapiUrl: entry.openapiUrl || entry.openApiUrl || defaultOpenapiUrl,
    wellKnownUrl: entry.wellKnownUrl || entry.x402Url || defaultWellKnownUrl,
    payTo: entry.payTo || accept.payTo || null,
    network,
    asset: entry.asset || accept.asset || paymentInfo.asset || cfg.x402Asset || BASE_USDC,
    accept: Object.keys(effectiveAccept).length > 0 ? {
      ...effectiveAccept,
      network: normalizeNetwork(effectiveAccept.network) || effectiveAccept.network
    } : undefined,
    description: entry.description || entry.purpose || entry.summary || "",
    receiptReady: entry.receiptReady === true || entry.proofReady === true || Boolean(entry.receiptUrl || inferredPaid || entry.verified),
    proofReady: entry.proofReady === true,
    requestBody: entry.requestBody || entry.body || entry.request?.body || {},
    category: entry.category || entry.tags?.[0] || null,
    registryUrl: registryUrl.href,
    source: `registry:${registryUrl.origin}`
  }, `registry:${registryUrl.origin}`);
}

function endpointFromEntry(entry, registryUrl) {
  const endpoint = entry.endpoint || entry.url || entry.resourceUrl || entry.resource || entry.base_url;
  if (endpoint && typeof endpoint === "object" && typeof endpoint.url === "string") return endpoint.url.trim();
  if (typeof endpoint === "string" && endpoint.trim()) return endpoint.trim();
  const path = entry.path || entry.route;
  if (typeof path === "string" && path.startsWith("/")) return `${registryUrl.origin}${path}`;
  return null;
}

function normalizeCandidate(candidate, source) {
  if (!candidate || typeof candidate !== "object") return null;
  const endpoint = candidate.endpoint || candidate.url || "";
  if (!endpoint) return null;
  return {
    ...candidate,
    id: candidate.id || candidate.name || endpoint,
    endpoint,
    method: candidate.method || "POST",
    priceUsd: numberOrNull(candidate.priceUsd ?? candidate.price),
    source: candidate.source || source
  };
}

function uniqueByEndpoint(candidates) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates) {
    const key = String(candidate.endpoint || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function seededShuffle(values, seed) {
  return values
    .map((value, index) => ({
      value,
      sortKey: sha256Json({ seed, endpoint: value.endpoint, index })
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((item) => item.value);
}

function safeUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

function normalizeUrlKey(value) {
  const parsed = safeUrl(value);
  return parsed ? parsed.href : null;
}

function isSafePublicHttpsUrl(url) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map((part) => Number.parseInt(part, 10));
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return false;
    if (parts[0] === 169 && parts[1] === 254) return false;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    if (parts[0] === 192 && parts[1] === 168) return false;
  }
  return true;
}

function matchesRegistryAllowlist(url, allowlist) {
  return allowlist.some((entry) => {
    const parsed = safeUrl(entry);
    if (parsed) return parsed.origin === url.origin || url.href.startsWith(parsed.href);
    return entry === url.hostname || entry === url.origin;
  });
}

function registryResult(url, status, reason) {
  const parsed = safeUrl(url);
  return {
    url,
    origin: parsed?.origin || null,
    status,
    reason,
    candidates: 0
  };
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function priceUsdFromAccept(accept) {
  if (!accept || typeof accept !== "object") return null;
  const atomic = accept.amount ?? accept.maxAmountRequired;
  const parsed = numberOrNull(atomic);
  if (parsed === null) return null;
  const asset = String(accept.asset || "").toLowerCase();
  const decimals = asset === BASE_USDC.toLowerCase() || asset.includes("usdc") ? 6 : 6;
  return Math.round((parsed / 10 ** decimals) * 1_000_000) / 1_000_000;
}

function firstNetwork(networks) {
  return Array.isArray(networks) ? networks[0] : networks;
}

function normalizeNetwork(value) {
  const network = String(value || "").trim();
  if (!network) return null;
  if (/^(bse|base)$/i.test(network)) return "eip155:8453";
  return network;
}

function numberOr(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
