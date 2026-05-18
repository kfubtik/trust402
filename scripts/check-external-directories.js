import { config } from "../src/config.js";

const baseUrl = (process.argv.find((arg) => /^https?:\/\//.test(arg)) || config.publicBaseUrl).replace(/\/$/, "");
const strict = process.argv.includes("--strict");
const timeoutMs = numberArg("--timeout-ms", 10_000);
const host = safeHost(baseUrl);
const terms = Array.from(new Set([
  "trust402",
  host.toLowerCase(),
  baseUrl.toLowerCase(),
  "/api/trust/score-resource",
  "/api/reports/x402-diligence"
].filter(Boolean)));

const directories = [
  {
    id: "agentic_market",
    name: "Agentic.Market",
    status: "auto-indexed-or-search",
    urls: [
      "https://agentic.market",
      "https://agentic.market/about",
      "https://agentic.market/search?q=Trust402",
      `https://agentic.market/search?q=${encodeURIComponent(host)}`
    ]
  },
  {
    id: "x402scan",
    name: "x402scan",
    status: "crawler-or-directory",
    urls: [
      "https://www.x402scan.com/",
      "https://www.x402scan.com/resources",
      "https://www.x402scan.com/search?q=Trust402",
      `https://www.x402scan.com/search?q=${encodeURIComponent(host)}`
    ]
  },
  {
    id: "x402bazaar",
    name: "x402Bazaar",
    status: "directory-or-search",
    urls: [
      "https://x402bazaar.org/",
      "https://x402bazaar.org/search?q=Trust402",
      `https://x402bazaar.org/search?q=${encodeURIComponent(host)}`
    ]
  },
  {
    id: "x402_ecosystem",
    name: "x402.org ecosystem",
    status: "curated-manual-submission",
    urls: [
      "https://www.x402.org/ecosystem"
    ]
  },
  {
    id: "relai_market",
    name: "RelAI market",
    status: "directory-or-search",
    urls: [
      "https://relai.fi/market",
      "https://relai.fi/market?search=Trust402",
      `https://relai.fi/market?search=${encodeURIComponent(host)}`
    ]
  },
  {
    id: "x402list",
    name: "x402list",
    status: "directory-or-search",
    urls: [
      "https://x402list.fun/",
      "https://x402list.fun/?q=Trust402",
      `https://x402list.fun/?q=${encodeURIComponent(host)}`
    ]
  }
];

async function main() {
  const results = [];
  for (const directory of directories) {
    results.push(await checkDirectory(directory));
  }

  const visible = results.filter((item) => item.visible);
  const reachable = results.filter((item) => item.reachable);
  const result = {
    ok: true,
    tool: "marketplace.external_directory_check",
    generatedAt: new Date().toISOString(),
    target: {
      baseUrl,
      host,
      terms
    },
    summary: {
      checked: results.length,
      reachable: reachable.length,
      visible: visible.length,
      notVisibleYet: results.filter((item) => item.reachable && !item.visible).length,
      unreachable: results.filter((item) => !item.reachable).length
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
  const checks = [];
  for (const url of directory.urls) {
    checks.push(await checkUrl(url));
  }
  const reachableChecks = checks.filter((item) => item.reachable);
  const matchedChecks = checks.filter((item) => item.matched);
  return {
    id: directory.id,
    name: directory.name,
    expectedMode: directory.status,
    reachable: reachableChecks.length > 0,
    visible: matchedChecks.length > 0,
    checkedUrls: checks,
    matchedUrls: matchedChecks.map((item) => item.url),
    nextAction: matchedChecks.length > 0
      ? "Record visibility evidence before making public listing claims."
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
        "user-agent": "Trust402 external directory check/0.1"
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
