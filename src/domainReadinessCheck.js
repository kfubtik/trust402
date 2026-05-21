import { resolve4, resolve6, resolveCname } from "node:dns/promises";
import { config } from "./config.js";
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

export async function domainReadinessCheck(input = {}, options = {}) {
  const cfg = options.config || config;
  const domain = normalizeDomain(input.domain || input.customDomain || input.selectedDomain || "");
  const baseUrl = normalizeBaseUrl(
    input.baseUrl ||
    input.expectedBaseUrl ||
    (domain ? `https://${domain}` : cfg.publicBaseUrl)
  );
  const host = safeHost(domain || baseUrl);
  const expectedBaseUrl = normalizeBaseUrl(input.expectedBaseUrl || (host ? `https://${host}` : baseUrl));
  const timeoutMs = clampNumber(input.timeoutMs, 1000, 20000, 6000);
  const fetcher = options.fetch || globalThis.fetch;
  const resolver = options.resolver || defaultResolver;
  const policy = hostPolicy(host);
  const dns = input.skipDns === true
    ? skippedCheck("dns", "Skipped by input.skipDns.")
    : await dnsCheck(host, resolver, timeoutMs);
  const [health, wellKnown, challenge] = await Promise.all([
    httpJsonCheck(fetcher, `${expectedBaseUrl}/health`, { timeoutMs, expectedStatus: 200 }),
    httpJsonCheck(fetcher, `${expectedBaseUrl}/.well-known/x402`, { timeoutMs, expectedStatus: 200 }),
    x402ChallengeCheck(fetcher, `${expectedBaseUrl}/api/trust/score-resource`, timeoutMs)
  ]);

  const discovery = discoveryReadiness(wellKnown.body, expectedBaseUrl);
  const blockers = blockersFor({ host, policy, dns, health, wellKnown, discovery, challenge, expectedBaseUrl });
  const readinessCore = {
    host,
    expectedBaseUrl,
    policy,
    dns: summarizeDns(dns),
    health: summarizeHttp(health),
    wellKnown: {
      status: wellKnown.status,
      ok: wellKnown.ok,
      resourceCount: Array.isArray(wellKnown.body?.resources) ? wellKnown.body.resources.length : 0,
      resourcesUseExpectedBaseUrl: discovery.resourcesUseExpectedBaseUrl
    },
    challenge: {
      status: challenge.status,
      ok: challenge.ok,
      httpStatus: challenge.httpStatus,
      hasPaymentRequiredHeader: challenge.hasPaymentRequiredHeader,
      resourceUsesExpectedBaseUrl: challenge.resourceUsesExpectedBaseUrl
    },
    blockers
  };

  return {
    ok: true,
    tool: "domains.readiness_check",
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0 ? "ready" : "blocked",
    readinessHash: sha256Json(readinessCore),
    target: {
      domain: host,
      expectedBaseUrl,
      timeoutMs
    },
    policy,
    checks: {
      dns,
      health,
      wellKnown: {
        ...wellKnown,
        discovery
      },
      x402Challenge: challenge
    },
    blockers,
    evidenceEnv: {
      PUBLIC_BASE_URL: expectedBaseUrl,
      TRUST402_CUSTOM_DOMAIN_READY: "true",
      TRUST402_CUSTOM_DOMAIN: host || "<custom-domain>",
      TRUST402_CUSTOM_DOMAIN_EVIDENCE_REF: "sha256:<domain-readiness-check>",
      TRUST402_EXTERNAL_DIRECTORY_STATUS: "visible",
      TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL: "<public non-CDP listing URL after directory check>",
      TRUST402_EXTERNAL_DIRECTORY_NAME: "<non-CDP directory name>"
    },
    verifyCommands: [
      `npm run domains:readiness-check -- ${cfg.publicBaseUrl} --domain=${host || "<custom-domain>"}`,
      `npm run smoke -- ${expectedBaseUrl}`,
      `npm run smoke:x402 -- ${expectedBaseUrl}`,
      `npm run launch:monitor -- ${expectedBaseUrl} --timeout-ms=10000 --strict`,
      `npm run directories:check -- ${expectedBaseUrl} --timeout-ms=10000 --concurrency=6`,
      `npm run deployment:preflight -- ${expectedBaseUrl} --custom-domain=${host || "<custom-domain>"} --probe-vercel-api`
    ],
    nextActions: blockers.length === 0
      ? [
          "Set production PUBLIC_BASE_URL to the custom HTTPS origin if it is not already set.",
          "Rerun smoke, x402 smoke, launch monitor, and external directory checks on the custom domain.",
          "Submit public-safe listing copy only after the custom-domain smoke passes."
        ]
      : blockers.map((item) => item.message),
    safety: {
      readOnly: true,
      buysDomain: false,
      mutatesVercel: false,
      setsEnv: false,
      submitsDirectoryForms: false,
      sendsPaymentHeaders: false,
      includesSecrets: false
    }
  };
}

async function dnsCheck(host, resolver, timeoutMs) {
  if (!host) {
    return {
      id: "dns",
      ok: false,
      status: "invalid-host",
      records: { cname: [], a: [], aaaa: [] },
      error: "No custom domain host was provided."
    };
  }
  try {
    const records = await withTimeout(resolver(host), timeoutMs);
    const cname = Array.isArray(records?.cname) ? records.cname : [];
    const a = Array.isArray(records?.a) ? records.a : [];
    const aaaa = Array.isArray(records?.aaaa) ? records.aaaa : [];
    return {
      id: "dns",
      ok: cname.length + a.length + aaaa.length > 0,
      status: cname.length + a.length + aaaa.length > 0 ? "records-found" : "no-records",
      records: { cname, a, aaaa },
      error: null
    };
  } catch (error) {
    return {
      id: "dns",
      ok: false,
      status: error.name === "AbortError" ? "timeout" : "lookup-failed",
      records: { cname: [], a: [], aaaa: [] },
      error: error.message
    };
  }
}

async function httpJsonCheck(fetcher, url, { timeoutMs, expectedStatus }) {
  const response = await fetchWithTimeout(fetcher, url, { timeoutMs });
  const body = parseJson(response.text);
  return {
    id: url,
    ok: response.status === expectedStatus && Boolean(body),
    status: response.status,
    contentType: response.headers["content-type"] || null,
    body,
    error: response.error || (body ? null : "Response was not valid JSON.")
  };
}

async function x402ChallengeCheck(fetcher, url, timeoutMs) {
  const response = await fetchWithTimeout(fetcher, url, {
    timeoutMs,
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      endpoint: "https://example.com/api/paid",
      priceUsd: 0.01,
      has402: true,
      hasInputSchema: true
    })
  });
  const paymentRequired = headerValue(response.headers, "payment-required");
  const decoded = decodePaymentRequired(paymentRequired);
  const acceptResources = challengeResourceUrls(decoded);
  return {
    id: url,
    ok: response.status === 402 && Boolean(paymentRequired),
    status: response.status === 402 && paymentRequired ? "challenge-ready" : "challenge-not-ready",
    httpStatus: response.status,
    hasPaymentRequiredHeader: Boolean(paymentRequired),
    x402Version: decoded?.x402Version || null,
    acceptResources,
    resourceUsesExpectedBaseUrl: acceptResources.some((resource) => String(resource).startsWith(url.replace(/\/api\/trust\/score-resource$/, ""))),
    error: response.error || null
  };
}

async function fetchWithTimeout(fetcher, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 6000);
  try {
    const response = await fetcher(url, {
      method: options.method || "GET",
      headers: options.headers || { accept: "application/json" },
      body: options.body,
      signal: controller.signal
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: headersObject(response.headers),
      text,
      error: null
    };
  } catch (error) {
    return {
      status: error.name === "AbortError" ? "timeout" : "error",
      headers: {},
      text: "",
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function discoveryReadiness(body, expectedBaseUrl) {
  const resources = Array.isArray(body?.resources) ? body.resources : [];
  const endpoints = Array.isArray(body?.endpoints) ? body.endpoints : [];
  return {
    resourcesCount: resources.length,
    endpointsCount: endpoints.length,
    resourcesUseExpectedBaseUrl: resources.length > 0 &&
      resources.every((resource) => String(resource).startsWith(expectedBaseUrl)),
    openapiUsesExpectedBaseUrl: typeof body?.openapi === "string"
      ? body.openapi.startsWith(expectedBaseUrl)
      : null
  };
}

function blockersFor({ host, policy, dns, health, wellKnown, discovery, challenge }) {
  const blockers = [];
  if (!host) blockers.push(blocker("custom_domain_missing", "Provide the custom domain to check."));
  if (!policy.valid) blockers.push(blocker("custom_domain_invalid", "Custom domain must be a bare domain such as trust402.dev."));
  if (policy.freeHostingSuffix) blockers.push(blocker("custom_domain_free_hosting", "Custom domain is still a known free-hosting/dev-tunnel host."));
  if (!dns.ok && !health.ok) blockers.push(blocker("dns_not_ready", "DNS records were not found for the custom domain."));
  if (!health.ok || health.body?.service !== "Trust402") blockers.push(blocker("health_not_ready", "Custom domain /health must return Trust402 health JSON."));
  if (!wellKnown.ok) blockers.push(blocker("x402_discovery_not_ready", "Custom domain /.well-known/x402 must return JSON."));
  if (wellKnown.ok && !discovery.resourcesUseExpectedBaseUrl) {
    blockers.push(blocker("public_base_url_not_updated", "Custom domain x402 resources must use the custom HTTPS base URL."));
  }
  if (!challenge.ok) blockers.push(blocker("x402_challenge_not_ready", "Custom domain protected route must return an unpaid x402 402 challenge."));
  if (challenge.ok && !challenge.resourceUsesExpectedBaseUrl) {
    blockers.push(blocker("x402_challenge_resource_mismatch", "PAYMENT-REQUIRED resource must use the custom HTTPS base URL."));
  }
  return blockers;
}

async function defaultResolver(host) {
  const [cname, a, aaaa] = await Promise.allSettled([
    resolveCname(host),
    resolve4(host),
    resolve6(host)
  ]);
  return {
    cname: cname.status === "fulfilled" ? cname.value : [],
    a: a.status === "fulfilled" ? a.value : [],
    aaaa: aaaa.status === "fulfilled" ? aaaa.value : []
  };
}

function hostPolicy(host) {
  const freeHostingSuffix = freeHostingSuffixFor(host);
  return {
    host,
    valid: isValidDomain(host),
    freeHostingSuffix,
    acceptedByPolicy: isValidDomain(host) && !freeHostingSuffix
  };
}

function summarizeDns(dns) {
  return {
    ok: dns.ok,
    status: dns.status,
    cname: dns.records?.cname?.length || 0,
    a: dns.records?.a?.length || 0,
    aaaa: dns.records?.aaaa?.length || 0
  };
}

function summarizeHttp(check) {
  return {
    ok: check.ok,
    status: check.status
  };
}

function skippedCheck(id, reason) {
  return {
    id,
    ok: true,
    status: "skipped",
    reason,
    records: { cname: [], a: [], aaaa: [] }
  };
}

function decodePaymentRequired(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function challengeResourceUrls(decoded) {
  const resources = [];
  const topLevelResource = decoded?.resource;
  if (typeof topLevelResource === "string") resources.push(topLevelResource);
  if (topLevelResource && typeof topLevelResource.url === "string") resources.push(topLevelResource.url);
  if (Array.isArray(decoded?.accepts)) {
    for (const item of decoded.accepts) {
      if (typeof item?.resource === "string") resources.push(item.resource);
      if (item?.resource && typeof item.resource.url === "string") resources.push(item.resource.url);
    }
  }
  return [...new Set(resources.filter(Boolean))];
}

function headersObject(headers) {
  if (!headers) return {};
  if (typeof headers.entries === "function") return Object.fromEntries(headers.entries());
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)]));
}

function headerValue(headers, key) {
  const normalized = String(key || "").toLowerCase();
  return headers?.[normalized] || headers?.[key] || null;
}

function parseJson(text) {
  try {
    return JSON.parse(text || "");
  } catch {
    return null;
  }
}

function withTimeout(promise, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted", "AbortError")));
    })
  ]);
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.vercel.app").replace(/\/+$/, "");
}

function normalizeDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (/^https?:\/\//.test(raw)) {
    try {
      return new URL(raw).host;
    } catch {
      return raw;
    }
  }
  return raw.replace(/^\/+|\/+$/g, "");
}

function safeHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (isValidDomain(raw)) return raw;
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
}

function isValidDomain(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(String(value || ""));
}

function freeHostingSuffixFor(value) {
  const host = String(value || "").toLowerCase();
  return FREE_HOST_SUFFIXES.find((suffix) => host === suffix || host.endsWith(`.${suffix}`)) || null;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function blocker(id, message) {
  return { id, message };
}
