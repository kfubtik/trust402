import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";
import { paymentBridgeContract, paymentProviderReadiness } from "./paymentAdapters.js";

const BRIDGE_PROVIDERS = new Set(["agentcash-mcp", "external-adapter"]);

export async function paymentBridgeCheck(input = {}, options = {}) {
  const cfg = options.config || config;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const requireOperator = options.requireOperator !== false;
  const provider = String(input.provider || cfg.livePaymentProvider || "agentcash-mcp");
  const adapterUrl = String(input.adapterUrl || cfg.livePaymentAdapterUrl || "").trim();
  const maxAmountUsd = numberOr(input.maxAmountUsd, cfg.liveMaxPerCallUsd || 0.01);
  const candidateEndpoint = String(input.candidateEndpoint || input.endpoint || `${cfg.proof402BaseUrl || "https://proof402.vercel.app"}/api/proof/notarize`);
  const method = normalizeMethod(input.method || "POST");
  const blockers = [];

  if (requireOperator && options.operatorAuthorized !== true) {
    throw new ApiError(403, "operator_not_authorized", "Payment bridge check requires x-trust402-operator-key.", {
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0
    });
  }

  if (!BRIDGE_PROVIDERS.has(provider)) {
    blockers.push(blocker("unsupported_bridge_provider", "Payment bridge check supports agentcash-mcp and external-adapter only."));
  }
  if (!adapterUrl) {
    blockers.push(blocker("missing_payment_adapter_url", "LIVE_PAYMENT_ADAPTER_URL or --adapter-url is required."));
  } else if (!safeAdapterUrl(adapterUrl, options)) {
    blockers.push(blocker("unsafe_payment_adapter_url", "Payment bridge URL must be HTTPS unless localhost is explicitly allowed for local checks."));
  }
  if (input.adapterUrl && !options.allowCustomAdapterUrl && input.adapterUrl !== cfg.livePaymentAdapterUrl) {
    blockers.push(blocker("custom_adapter_url_not_allowed", "Public API bridge checks may only use the configured LIVE_PAYMENT_ADAPTER_URL."));
  }
  if (!(maxAmountUsd > 0)) {
    blockers.push(blocker("missing_max_amount", "maxAmountUsd or LIVE_MAX_PER_CALL_USD must be greater than zero."));
  }

  const contract = paymentBridgeContract(provider);
  const readiness = paymentProviderReadiness({
    ...cfg,
    livePaymentProvider: provider,
    livePaymentAdapterUrl: adapterUrl
  });
  const bridgeRequest = buildBridgeRequest({
    cfg,
    provider,
    maxAmountUsd,
    candidateEndpoint,
    method,
    body: input.body
  });
  const bridgeRequestHash = sha256Json(bridgeRequest);
  const base = {
    ok: true,
    tool: "payments.bridge_check",
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    provider,
    adapter: {
      runtime: contract?.runtime || "not-bridge-provider",
      configured: Boolean(adapterUrl),
      host: adapterUrl ? safeHost(adapterUrl) : null
    },
    candidateEndpoint,
    bridgeRequestHash,
    readiness,
    contract,
    safety: {
      dryRunOnly: true,
      sendsPaymentHeaders: false,
      sendsPrivateKeys: false,
      sendsSecretHeaders: false,
      mutatesWallet: false,
      paidSubcallsMade: 0,
      exposesAdapterUrl: false
    }
  };

  if (blockers.length > 0) {
    return {
      ...base,
      status: "blocked",
      passed: false,
      blockers,
      nextActions: nextActions(blockers)
    };
  }

  let response;
  let body;
  try {
    response = await fetchImpl(adapterUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Trust402 payment bridge preflight/0.1"
      },
      body: JSON.stringify(bridgeRequest),
      signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
    });
    body = await responseJson(response);
  } catch (error) {
    return {
      ...base,
      status: "failed",
      passed: false,
      httpStatus: null,
      responseHash: null,
      blockers: [blocker("payment_bridge_unreachable", `Payment bridge request failed: ${error.message}`)],
      nextActions: ["Verify LIVE_PAYMENT_ADAPTER_URL is reachable from the runtime before enabling live spend."]
    };
  }

  const verdict = bridgeVerdict({ httpStatus: response.status, body });
  return {
    ...base,
    status: verdict.status,
    passed: verdict.status === "passed",
    httpStatus: response.status,
    responseHash: sha256Json(body || {}),
    responseSummary: summarizeBridgeBody(body),
    blockers: verdict.blockers,
    nextActions: nextActions(verdict.blockers),
    safety: {
      ...base.safety,
      paidSubcallsMade: verdict.paidSubcallsMade
    }
  };
}

function buildBridgeRequest({ cfg, provider, maxAmountUsd, candidateEndpoint, method, body }) {
  return {
    service: "Trust402",
    provider,
    protocol: "x402",
    mode: "dry-run",
    dryRun: true,
    maxAmountUsd,
    network: cfg.x402Network,
    request: {
      url: candidateEndpoint,
      method,
      headers: {
        accept: "application/json",
        "x-trust402-bridge-check": "true"
      },
      body: body === undefined ? null : bodyForBridge(body)
    },
    probe: {
      purpose: "payment-bridge-preflight",
      noPaymentExpected: true
    }
  };
}

function bridgeVerdict({ httpStatus, body }) {
  const blockers = [];
  const paidSubcallsMade = paidSubcallCount(body);
  if (httpStatus < 200 || httpStatus >= 300) {
    blockers.push(blocker("payment_bridge_http_error", `Payment bridge returned HTTP ${httpStatus}.`));
  }
  if (paidSubcallsMade > 0 || hasPaymentResponse(body)) {
    blockers.push(blocker("payment_bridge_made_payment", "Payment bridge response indicates a payment or payment-response during dry-run."));
  }
  if (!dryRunConfirmed(body)) {
    blockers.push(blocker("payment_bridge_dry_run_not_confirmed", "Payment bridge did not explicitly confirm dry-run/no-payment behavior."));
  }
  return {
    status: blockers.length === 0 ? "passed" : "failed",
    blockers,
    paidSubcallsMade
  };
}

async function responseJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

function dryRunConfirmed(body) {
  if (!body || typeof body !== "object") return false;
  return body.dryRun === true ||
    body.mode === "dry-run" ||
    body.safety?.dryRunOnly === true ||
    body.safety?.paidSubcallsMade === 0 ||
    body.payment?.paid === false ||
    body.response?.paymentMade === false;
}

function paidSubcallCount(body) {
  const value = body?.safety?.paidSubcallsMade ?? body?.paidSubcallsMade ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasPaymentResponse(body) {
  const headers = body?.response?.headers || body?.headers || {};
  return Object.entries(headers).some(([key, value]) =>
    /payment-response/i.test(key) && String(value || "").trim()
  );
}

function summarizeBridgeBody(body) {
  if (!body || typeof body !== "object") return body;
  return {
    ok: body.ok ?? null,
    dryRun: body.dryRun ?? null,
    mode: body.mode || null,
    responseStatus: body.response?.status ?? body.status ?? null,
    paidSubcallsMade: paidSubcallCount(body),
    keys: Object.keys(body).slice(0, 20)
  };
}

function safeAdapterUrl(value, options) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (options.allowLocalhost === true && url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function normalizeMethod(value) {
  const method = String(value || "POST").toUpperCase();
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method) ? method : "POST";
}

function bodyForBridge(body) {
  if (body === null) return null;
  if (typeof body === "string") return body.slice(0, 100_000);
  return JSON.stringify(body).slice(0, 100_000);
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function blocker(id, message) {
  return { id, message };
}

function nextActions(blockers) {
  if (blockers.length === 0) return ["Bridge dry-run preflight passed; keep live spend disabled until policy and local AgentCash budget are separately approved."];
  return blockers.map((item) => item.message);
}
