import { spawnSync } from "node:child_process";
import { config } from "../src/config.js";

const baseUrl = (process.argv.find((arg) => /^https?:\/\//.test(arg)) || config.publicBaseUrl).replace(/\/+$/, "");
const timeoutMs = numberArg("--timeout-ms", 10_000);
const childTimeoutMs = numberArg("--child-timeout-ms", 120_000);
const strict = process.argv.includes("--strict");
const skipBazaar = process.argv.includes("--skip-bazaar");
const skipDirectories = process.argv.includes("--skip-directories");
const includeRaw = process.argv.includes("--include-raw");

async function main() {
  const api = await checkProductionApi();
  const x402Challenge = await checkX402Challenge(api.summary.realSettlementReady);
  const cdpBazaar = skipBazaar ? skipped("cdp_bazaar", "Skipped by --skip-bazaar.") : runJsonScript(
    "cdp_bazaar",
    ["scripts/check-bazaar-indexing.js", "--all-resources", baseUrl, `--timeout-ms=${timeoutMs}`, "--limit=20"]
  );
  const externalDirectories = skipDirectories ? skipped("external_directories", "Skipped by --skip-directories.") : runJsonScript(
    "external_directories",
    ["scripts/check-external-directories.js", baseUrl, `--timeout-ms=${timeoutMs}`]
  );

  const requiredChecks = [
    api.ok,
    x402Challenge.ok,
    skipBazaar ? true : cdpBazaar.ok && cdpBazaar.summary?.status === "all-indexed"
  ];
  const ok = requiredChecks.every(Boolean);
  const status = ok
    ? skipBazaar
      ? "healthy-api"
      : externalDirectories.summary?.status === "visible-in-some-directories"
      ? "healthy-visible"
      : "healthy-cdp-indexed"
    : "needs-attention";

  const result = {
    ok,
    tool: "production.launch_monitor",
    generatedAt: new Date().toISOString(),
    target: {
      baseUrl
    },
    status,
    summary: {
      api: api.summary,
      x402Challenge: x402Challenge.summary,
      cdpBazaar: cdpBazaar.summary,
      externalDirectories: externalDirectories.summary
    },
    checks: {
      api,
      x402Challenge,
      cdpBazaar,
      externalDirectories
    },
    nextActions: nextActions({ ok, api, x402Challenge, cdpBazaar, externalDirectories, skipBazaar, skipDirectories }),
    notes: [
      "This monitor is read-only and never sends payment headers or submits marketplace forms.",
      "CDP Bazaar all-indexed is the primary launch discovery signal.",
      "External directory visibility can lag or require curated submission."
    ]
  };

  console.log(JSON.stringify(result, null, 2));
  if (strict && !ok) process.exit(1);
}

async function checkProductionApi() {
  const health = await getJson("/health");
  const resources = await getJson("/api/resources");
  const bundle = await getJson("/api/marketplace/bundle");
  const settlement = await getJson("/api/settlement/status");
  const spendPolicy = await getJson("/api/policies/spend");
  const failures = [];

  if (!health.ok) failures.push("/health failed");
  if (health.body?.ok !== true) failures.push("/health ok is not true");
  if (health.body?.liveSpendEnabled !== false) failures.push("/health liveSpendEnabled must stay false");
  if (!resources.ok) failures.push("/api/resources failed");
  if (resources.body?.status !== "production-mvp") failures.push("/api/resources status must be production-mvp");
  if (resources.body?.paidLaunchResources?.length !== 10) failures.push("/api/resources expected 10 paid launch resources");
  if (!bundle.ok) failures.push("/api/marketplace/bundle failed");
  if (bundle.body?.listingState?.publicMarketplaceReady !== true) failures.push("/api/marketplace/bundle publicMarketplaceReady must be true in production");
  if (bundle.body?.listingState?.cdpBazaarIndexingReady !== true) failures.push("/api/marketplace/bundle cdpBazaarIndexingReady must be true in production");
  if (!settlement.ok) failures.push("/api/settlement/status failed");
  if (settlement.body?.readiness?.realSettlementReady !== true) failures.push("/api/settlement/status realSettlementReady must be true in production");
  if (settlement.body?.readiness?.marketplaceIndexingReady !== true) failures.push("/api/settlement/status marketplaceIndexingReady must be true in production");
  if ((settlement.body?.blockers || []).length > 0) failures.push("/api/settlement/status must not expose blockers in production");
  if (!spendPolicy.ok) failures.push("/api/policies/spend failed");
  if (spendPolicy.body?.readiness?.anyLiveSpendReady !== false) failures.push("/api/policies/spend anyLiveSpendReady must remain false until live buyer policy is approved");
  if (spendPolicy.body?.emergencyStop === true) failures.push("/api/policies/spend emergencyStop is active");

  return {
    ok: failures.length === 0,
    tool: "production.api_check",
    summary: {
      status: failures.length === 0 ? "healthy" : "needs-attention",
      catalogStatus: resources.body?.status || null,
      paidLaunchResources: resources.body?.paidLaunchResources?.length || 0,
      publicMarketplaceReady: bundle.body?.listingState?.publicMarketplaceReady ?? null,
      realSettlementReady: settlement.body?.readiness?.realSettlementReady ?? null,
      marketplaceIndexingReady: settlement.body?.readiness?.marketplaceIndexingReady ?? null,
      blockers: settlement.body?.blockers?.length || 0,
      anyLiveSpendReady: spendPolicy.body?.readiness?.anyLiveSpendReady ?? null,
      autoRefillReady: spendPolicy.body?.readiness?.agentcashAutoRefillReady ?? null
    },
    endpoints: {
      health: briefHttp(health),
      resources: briefHttp(resources),
      marketplaceBundle: briefHttp(bundle),
      settlementStatus: briefHttp(settlement),
      spendPolicy: briefHttp(spendPolicy)
    },
    failures,
    details: {
      settlementMode: settlement.body?.mode || null,
      payment: settlement.body?.payment || null,
      blockers: settlement.body?.blockers || [],
      spendPolicy: {
        emergencyStop: spendPolicy.body?.emergencyStop ?? null,
        liveProcurementReady: spendPolicy.body?.readiness?.liveProcurementReady ?? null,
        proof402DelegationReady: spendPolicy.body?.readiness?.proof402DelegationReady ?? null,
        agentcashAutoRefillReady: spendPolicy.body?.readiness?.agentcashAutoRefillReady ?? null
      }
    }
  };
}

async function checkX402Challenge(realSettlementReady) {
  if (realSettlementReady !== true) {
    return {
      ok: true,
      tool: "production.x402_challenge_check",
      summary: {
        status: "skipped",
        reason: "Real settlement is not ready, so protected paid routes are not expected to return facilitator-backed 402 challenges."
      }
    };
  }

  const response = await postRaw("/api/trust/score-resource", {
    endpoint: "https://example.com/api/paid",
    priceUsd: 0.01,
    has402: true,
    hasInputSchema: true
  });
  const paymentRequired = response.headers?.["payment-required"] || null;
  const failures = [];
  if (response.status !== 402) failures.push(`Expected HTTP 402, got ${response.status}`);
  if (!paymentRequired && !response.body?.accepts && !response.body?.error) failures.push("Missing x402 challenge body or PAYMENT-REQUIRED header");

  let decoded = null;
  if (paymentRequired) {
    try {
      decoded = JSON.parse(Buffer.from(paymentRequired, "base64url").toString("utf8"));
    } catch (error) {
      failures.push(`PAYMENT-REQUIRED header is not valid base64url JSON: ${error.message}`);
    }
  }
  if (decoded) {
    if (decoded.x402Version !== 2) failures.push(`Expected x402Version=2, got ${decoded.x402Version}`);
    if (!Array.isArray(decoded.accepts) || decoded.accepts.length === 0) failures.push("PAYMENT-REQUIRED accepts is empty");
  }

  return {
    ok: failures.length === 0,
    tool: "production.x402_challenge_check",
    summary: {
      status: failures.length === 0 ? "challenge-ready" : "needs-attention",
      httpStatus: response.status,
      hasPaymentRequiredHeader: Boolean(paymentRequired),
      x402Version: decoded?.x402Version || response.body?.x402Version || null,
      accepts: decoded?.accepts?.length || response.body?.accepts?.length || 0
    },
    failures
  };
}

async function getJson(path) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    headers: { accept: "application/json" }
  });
  let body = null;
  try {
    body = response.text ? JSON.parse(response.text) : null;
  } catch {
    body = { raw: response.text?.slice(0, 500) || "" };
  }
  return {
    ok: response.ok,
    status: response.status,
    body,
    error: response.error
  };
}

async function postRaw(path, body) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  let parsedBody = null;
  try {
    parsedBody = response.text ? JSON.parse(response.text) : null;
  } catch {
    parsedBody = { raw: response.text?.slice(0, 500) || "" };
  }
  return {
    ...response,
    body: parsedBody
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text
    };
  } catch (error) {
    return {
      ok: false,
      status: error.name === "AbortError" ? "timeout" : "error",
      headers: {},
      text: "",
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runJsonScript(id, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
    timeout: childTimeoutMs
  });

  if (result.error?.code === "ETIMEDOUT") {
    return {
      ok: false,
      tool: id,
      summary: {
        status: "script-timeout",
        timeoutMs: childTimeoutMs
      },
      stdout: trim(result.stdout),
      stderr: trim(result.stderr)
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      tool: id,
      summary: {
        status: "script-failed",
        exitCode: result.status
      },
      stdout: trim(result.stdout),
      stderr: trim(result.stderr)
    };
  }

  const parsed = parseJsonOutput(result.stdout);
  if (!parsed) {
    return {
      ok: false,
      tool: id,
      summary: {
        status: "parse-failed"
      },
      stdout: trim(result.stdout),
      stderr: trim(result.stderr)
    };
  }

  return {
    ok: parsed.ok === true,
    tool: id,
    summary: summaryForScript(id, parsed),
    details: detailsForScript(id, parsed),
    ...(includeRaw ? { raw: parsed } : {})
  };
}

function summaryForScript(id, parsed) {
  if (id === "cdp_bazaar") {
    return {
      status: parsed.status,
      indexed: parsed.indexed,
      routeSummary: parsed.routeSummary
    };
  }
  if (id === "external_directories") {
    return {
      status: parsed.status,
      ...parsed.summary
    };
  }
  return {
    status: parsed.status || "ok"
  };
}

function detailsForScript(id, parsed) {
  if (id === "cdp_bazaar") {
    return {
      routeSummary: parsed.routeSummary,
      searchMatched: parsed.discovery?.search?.filter((item) => item.matched).length || 0,
      catalogMatched: parsed.discovery?.catalog?.matched || false
    };
  }
  if (id === "external_directories") {
    return {
      directories: (parsed.directories || []).map((item) => ({
        id: item.id,
        name: item.name,
        reachable: item.reachable,
        visible: item.visible,
        matchedUrls: item.matchedUrls || []
      }))
    };
  }
  return {};
}

function parseJsonOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function skipped(tool, reason) {
  return {
    ok: true,
    tool,
    summary: {
      status: "skipped",
      reason
    }
  };
}

function nextActions({ ok, api, x402Challenge, cdpBazaar, externalDirectories, skipBazaar, skipDirectories }) {
  const actions = [];
  if (!api.ok) actions.push("Inspect production API readiness and settlement status blockers.");
  if (!x402Challenge.ok) actions.push("Inspect production x402 challenge headers for protected paid routes.");
  if (!skipBazaar && cdpBazaar.summary?.status !== "all-indexed") {
    actions.push("Re-run CDP Bazaar indexing check and inspect missing routes.");
  }
  if (!skipDirectories && externalDirectories.summary?.status !== "visible-in-some-directories") {
    actions.push("Keep monitoring external directories or submit public-safe listing copy after user approval.");
  }
  if (ok && actions.length === 0) actions.push("No action required.");
  return actions;
}

function briefHttp(result) {
  return {
    ok: result.ok,
    status: result.status,
    error: result.error || null
  };
}

function numberArg(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function trim(value) {
  return String(value || "").slice(0, 2000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
