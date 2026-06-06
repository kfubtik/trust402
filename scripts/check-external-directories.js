import { config } from "../src/config.js";
import { EXTERNAL_DIRECTORY_TARGETS, isFreeHostingHost, monitorUrlsFor } from "../src/externalDirectoryTargets.js";

const baseUrl = (process.argv.find((arg) => /^https?:\/\//.test(arg)) || config.publicBaseUrl).replace(/\/$/, "");
const strict = process.argv.includes("--strict");
const timeoutMs = numberArg("--timeout-ms", 10_000);
const concurrency = numberArg("--concurrency", 6);
const x402scanOriginId = valueArg("--x402scan-origin-id") ||
  process.env.TRUST402_X402SCAN_ORIGIN_ID ||
  x402scanOriginIdFromEvidenceUrl(config.externalDirectoryEvidenceUrl) ||
  "";
const host = safeHost(baseUrl);
const hostRequiresCustomDomain = isFreeHostingHost(host);
const terms = Array.from(new Set([
  "trust402",
  host.toLowerCase(),
  baseUrl.toLowerCase(),
  "/api/trust/score-resource",
  "/api/reports/x402-diligence"
].filter(Boolean)));

const directories = EXTERNAL_DIRECTORY_TARGETS.map((target) => ({
  ...target,
  status: target.mode,
  urls: monitorUrlsFor(target, host)
}));

if (x402scanOriginId) {
  const x402scan = directories.find((target) => target.id === "x402scan");
  if (x402scan) {
    x402scan.urls = [
      `https://www.x402scan.com/server/${encodeURIComponent(x402scanOriginId)}`,
      ...x402scan.urls
    ];
  }
}

async function main() {
  const results = await mapWithConcurrency(directories, concurrency, checkDirectory);

  const visible = results.filter((item) => item.visible);
  const reachable = results.filter((item) => item.reachable);
  const result = {
    ok: true,
    tool: "marketplace.external_directory_check",
    generatedAt: new Date().toISOString(),
    target: {
      baseUrl,
      host,
      hostRequiresCustomDomain,
      terms
    },
    summary: {
      checked: results.length,
      reachable: reachable.length,
      visible: visible.length,
      notVisibleYet: results.filter((item) => item.reachable && !item.visible).length,
      unreachable: results.filter((item) => !item.reachable).length,
      customDomainBlocked: results.filter((item) => item.submission?.blockedByHost).length
    },
    status: visible.length > 0
      ? "visible-in-some-directories"
      : reachable.length > 0
        ? "not-visible-yet"
        : "unknown",
    directories: results,
    notes: [
      "This check is read-only and never submits listing forms.",
      "Directory pages can be client-rendered or rate-limited, so not-visible-yet is not proof that Trust402 is absent.",
      "Use this alongside the CDP Bazaar check, which is the authoritative x402 discovery signal for Trust402 right now."
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  if (strict && visible.length === 0) process.exit(1);
}

async function checkDirectory(directory) {
  const checks = await mapWithConcurrency(directory.urls, Math.min(concurrency, directory.urls.length || 1), checkUrl);
  const reachableChecks = checks.filter((item) => item.reachable);
  const matchedChecks = checks.filter((item) => item.matched);
  const blockedByHost = Boolean(directory.requiresCustomDomain && hostRequiresCustomDomain);
  return {
    id: directory.id,
    name: directory.name,
    expectedMode: directory.status,
    submission: {
      requiresCustomDomain: Boolean(directory.requiresCustomDomain),
      blockedByHost,
      host
    },
    reachable: reachableChecks.length > 0,
    visible: matchedChecks.length > 0,
    checkedUrls: checks,
    matchedUrls: matchedChecks.map((item) => item.url),
    nextAction: matchedChecks.length > 0
      ? "Record visibility evidence before making public listing claims."
      : blockedByHost
        ? "Configure a custom production domain before submitting; this directory rejects vercel.app, workers.dev, ngrok, trycloudflare, and similar free-hosting domains."
      : directory.status === "curated-manual-submission"
        ? "Submit public-safe listing copy only after the user approves outreach."
        : "Keep monitoring; submit manually only if the directory exposes a safe public form."
  };
}

async function checkUrl(url) {
  const response = await fetchText(url);
  const text = (response.text || "").toLowerCase();
  const matchedTerms = response.ok
    ? terms.filter((term) => text.includes(term))
    : [];
  return {
    url,
    reachable: response.ok,
    httpStatus: response.status,
    matched: matchedTerms.length > 0,
    matchedTerms,
    contentType: response.contentType,
    title: titleFrom(response.text),
    error: response.ok ? null : response.error
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "user-agent": "Mozilla/5.0 (compatible; Trust402 external directory check/0.1; +https://trust402.aztecbeacon.uk)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") || null,
      text: text.slice(0, 250_000),
      error: response.ok ? null : text.slice(0, 300)
    };
  } catch (error) {
    return {
      ok: false,
      status: error.name === "AbortError" ? "timeout" : "error",
      contentType: null,
      text: "",
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function titleFrom(text) {
  if (!text) return null;
  const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? compact(match[1]) : null;
}

function compact(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 160);
}

function numberArg(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function valueArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
}

function x402scanOriginIdFromEvidenceUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname !== "www.x402scan.com" && url.hostname !== "x402scan.com") return "";
    const match = url.pathname.match(/^\/server\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const values = Array.from(items || []);
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit || 1, values.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }));
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
