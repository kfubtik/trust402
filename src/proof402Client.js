import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json, sha256Text } from "./hash.js";
import { createPaidFetch } from "./paymentAdapters.js";
import { proof402DelegationPolicy } from "./policies.js";

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const SENSITIVE_METADATA_KEY_RE =
  /api[_-]?key|secret|token|password|private|mnemonic|authorization|cookie|payment|signature/i;

export async function notarizeResult(input = {}, options = {}) {
  const cfg = options.config || config;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const prepared = prepareProof402Request(input, cfg);
  const delegation = await proof402Delegation(prepared, {
    cfg,
    fetchImpl,
    paidFetchImpl: options.paidFetchImpl || null,
    operatorAuthorized: options.operatorAuthorized === true
  });

  return {
    ok: true,
    tool: "receipts.notarize_result",
    mode: delegation.mode,
    subject: prepared.subject,
    generatedAt: new Date().toISOString(),
    resultHash: prepared.resultHash,
    payloadHash: prepared.payloadHash,
    consistency: prepared.consistency,
    proofProvider: "Proof402",
    proofStatus: delegation.proofStatus,
    proofLink: delegation.proofLink,
    proofRequest: delegation.proofRequest,
    delegation,
    policy: {
      liveSpendEnabled: cfg.liveSpendEnabled,
      maxProofSpendUsd: cfg.proof402MaxSpendUsd,
      requiresExplicitApproval: true,
      storesPrivatePayload: false,
      paidCallImplemented: true,
      operatorAuthorized: options.operatorAuthorized === true
    }
  };
}

export function prepareProof402Request(input = {}, cfg = config) {
  const payload = input.payload ?? input.result ?? null;
  const suppliedHash = normalizeHash(input.resultHash || input.hash);

  if (payload === null && !suppliedHash) {
    throw new ApiError(400, "invalid_input", "notarize-result requires payload, result, or resultHash.", {
      payload: "Provide a JSON payload/result or an existing sha256:<hex> resultHash."
    });
  }

  const payloadHash = payload === null ? null : hashPayload(payload);
  const resultHash = suppliedHash || payloadHash;
  const matchesPayload = suppliedHash && payloadHash ? suppliedHash === payloadHash : null;
  const metadataResult = sanitizeMetadata(input.metadata || {});
  const subject = stringOrDefault(input.subject, "Trust402 result");
  const label = stringOrDefault(input.label, subject);
  const idempotencyKey = stringOrDefault(input.idempotencyKey, `trust402-${resultHash.slice(7, 19)}`);

  const proofMetadata = {
    ...metadataResult.metadata,
    trust402: {
      subject,
      payloadHash,
      publicBaseUrl: cfg.publicBaseUrl,
      storesPrivatePayload: false
    }
  };

  return {
    subject,
    label,
    resultHash,
    payloadHash,
    requestedMode: normalizeMode(input.proof402Mode || input.mode || cfg.proof402DelegationMode),
    consistency: {
      suppliedHash: suppliedHash || null,
      matchesPayload,
      warnings: [
        ...consistencyWarnings({ suppliedHash, payloadHash, matchesPayload }),
        ...metadataResult.warnings
      ]
    },
    proofRequestBody: {
      contentHash: resultHash,
      label,
      metadata: proofMetadata,
      idempotencyKey
    }
  };
}

export async function proof402Delegation(prepared, { cfg = config, fetchImpl = globalThis.fetch, paidFetchImpl = null, operatorAuthorized = false } = {}) {
  const baseUrl = normalizeBaseUrl(cfg.proof402BaseUrl);
  const configuredMode = normalizeMode(cfg.proof402DelegationMode);
  const requestedMode = normalizeMode(prepared.requestedMode);
  const mode = chooseEffectiveMode(configuredMode, requestedMode);
  const proofRequest = baseUrl
    ? {
        method: "POST",
        url: `${baseUrl}/api/proof/notarize`,
        headers: { "content-type": "application/json" },
        body: prepared.proofRequestBody
      }
    : null;

  if (!baseUrl) {
    return previewDelegation({
      mode: "disabled",
      proofRequest,
      proofStatus: "not-configured",
      reason: "PROOF402_BASE_URL is not configured."
    });
  }

  if (mode === "disabled" || mode === "preview") {
    return previewDelegation({
      mode,
      proofRequest,
      proofStatus: "preview-only",
      reason: mode === "disabled"
        ? "PROOF402_DELEGATION_MODE is disabled."
        : "Proof402 request preview only; no network call was made."
    });
  }

  if (mode === "probe") {
    const probe = await unpaidProbe({ baseUrl, proofRequest, cfg, fetchImpl });
    return {
      configured: true,
      mode,
      baseUrl,
      proofRequest,
      proofStatus: probe.paymentChallengeObserved ? "payment-required-probed" : "probe-complete",
      proofLink: null,
      paidProofCallMade: false,
      unpaidProbeMade: true,
      reason: "Unpaid Proof402 probe completed without payment headers.",
      probe
    };
  }

  if (mode === "live") {
    const policy = proof402DelegationPolicy(cfg);
    const blockers = [...policy.blockers];
    if (!operatorAuthorized) {
      blockers.push({
        id: "operator_not_authorized",
        message: "Paid Proof402 delegation requires x-trust402-operator-key."
      });
    }
    if (blockers.length > 0) {
      throw new ApiError(403, "live_proof_delegation_blocked", "Live Proof402 delegation is blocked by policy.", {
        blockers,
        paidProofCallMade: false
      });
    }

    const paidFetch = await createPaidFetch({ cfg, fetchImpl, paidFetchImpl });
    return paidProof402Call({ baseUrl, proofRequest, cfg, fetchImpl: paidFetch });
  }

  throw new ApiError(400, "invalid_proof402_mode", "Unsupported Proof402 delegation mode.", { mode });
}

async function paidProof402Call({ baseUrl, proofRequest, cfg, fetchImpl }) {
  const response = await fetchImpl(proofRequest.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Trust402 Proof402 delegation/0.1",
      "x-trust402-max-amount-usd": String(cfg.proof402MaxSpendUsd)
    },
    body: JSON.stringify(proofRequest.body),
    signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
  });
  const body = await responseJson(response);
  const paymentRequired = response.headers.get("payment-required") || "";
  const paymentResponse = response.headers.get("payment-response") || "";

  if (response.status === 402 || paymentRequired) {
    throw new ApiError(402, "proof402_payment_required_not_settled", "Proof402 requested payment, but the configured fetch adapter did not settle it.", {
      maxProofSpendUsd: cfg.proof402MaxSpendUsd,
      paymentProvider: cfg.livePaymentProvider,
      paidProofCallMade: false
    });
  }

  if (!response.ok) {
    throw new ApiError(response.status || 502, "proof402_paid_call_failed", "Proof402 paid delegation failed.", {
      status: response.status,
      bodySummary: summarizeProof402Body(body),
      paidProofCallMade: false
    });
  }

  const proofLink = extractProofLink(body, baseUrl);
  return {
    configured: true,
    mode: "live",
    baseUrl,
    proofRequest,
    proofStatus: proofLink ? "proof-created" : "paid-call-complete",
    proofLink,
    paidProofCallMade: true,
    unpaidProbeMade: false,
    reason: "Paid Proof402 delegation completed through the configured payment adapter.",
    maxProofSpendUsd: cfg.proof402MaxSpendUsd,
    paymentResponseObserved: Boolean(paymentResponse),
    responseHash: sha256Json(body || {})
  };
}

function extractProofLink(body, baseUrl) {
  if (!body || typeof body !== "object") return null;
  const value = body.proofLink || body.url || body.proof?.url || body.proof?.link;
  if (typeof value !== "string" || !value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function previewDelegation({ mode, proofRequest, proofStatus, reason }) {
  return {
    configured: Boolean(proofRequest),
    mode,
    baseUrl: proofRequest ? new URL(proofRequest.url).origin : null,
    proofRequest,
    proofStatus,
    proofLink: null,
    paidProofCallMade: false,
    unpaidProbeMade: false,
    reason
  };
}

async function unpaidProbe({ baseUrl, proofRequest, cfg, fetchImpl }) {
  const health = await fetchJson(`${baseUrl}/health`, { method: "GET" }, cfg, fetchImpl);
  const notarize = await fetchJson(
    proofRequest.url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(proofRequest.body)
    },
    cfg,
    fetchImpl
  );

  return {
    health,
    notarize: {
      status: notarize.status,
      ok: notarize.ok,
      paymentRequiredHeaderPresent: Boolean(notarize.headers["payment-required"]),
      paymentChallengeObserved: notarize.status === 402 || Boolean(notarize.headers["payment-required"]),
      bodySummary: summarizeProof402Body(notarize.body)
    },
    paymentChallengeObserved: notarize.status === 402 || Boolean(notarize.headers["payment-required"])
  };
}

async function fetchJson(url, options, cfg, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
    });
    const body = await responseJson(response);
    return {
      status: response.status,
      ok: response.ok,
      headers: {
        "content-type": response.headers.get("content-type") || "",
        "payment-required": response.headers.get("payment-required") || ""
      },
      body
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      headers: {},
      body: {
        error: {
          code: "probe_failed",
          message: error instanceof Error ? error.message : "Unknown fetch error."
        }
      }
    };
  }
}

async function responseJson(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function summarizeProof402Body(body) {
  if (!body || typeof body !== "object") return body;
  const accepts = body.accepts || body.paymentRequired?.accepts || body.error?.details?.accepts || [];
  return {
    ok: body.ok ?? false,
    x402Version: body.x402Version || body.paymentRequired?.x402Version || null,
    acceptsCount: Array.isArray(accepts) ? accepts.length : 0,
    errorCode: body.error?.code || null
  };
}

function chooseEffectiveMode(configuredMode, requestedMode) {
  if (configuredMode === "disabled" || requestedMode === "disabled") return "disabled";
  const configuredRank = modeRank(configuredMode);
  const requestedRank = modeRank(requestedMode);
  return configuredRank < requestedRank ? configuredMode : requestedMode;
}

function modeRank(mode) {
  if (mode === "probe") return 1;
  if (mode === "live") return 2;
  return 0;
}

function normalizeMode(value) {
  const normalized = String(value || "disabled").trim().toLowerCase();
  if (normalized === "dry-run") return "preview";
  if (["disabled", "preview", "probe", "live"].includes(normalized)) return normalized;
  throw new ApiError(400, "invalid_proof402_mode", "Unsupported Proof402 delegation mode.", {
    mode: value,
    allowed: ["disabled", "preview", "probe", "live"]
  });
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol.");
    }
    return url.origin;
  } catch {
    throw new ApiError(500, "invalid_proof402_base_url", "PROOF402_BASE_URL must be an HTTP(S) URL.", {
      proof402BaseUrlConfigured: Boolean(value)
    });
  }
}

function hashPayload(payload) {
  return typeof payload === "string" ? sha256Text(payload) : sha256Json(payload);
}

function normalizeHash(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (!SHA256_RE.test(normalized)) {
    throw new ApiError(400, "invalid_input", "resultHash must be sha256:<64 lowercase hex chars>.", {
      resultHash: "Use sha256:<hex>."
    });
  }
  return normalized;
}

function consistencyWarnings({ suppliedHash, payloadHash, matchesPayload }) {
  if (!suppliedHash || !payloadHash) return [];
  if (matchesPayload) return [];
  return ["supplied resultHash does not match the provided payload hash"];
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (value === null || value === undefined) return { metadata: {}, warnings: [] };
    throw new ApiError(400, "invalid_input", "metadata must be a JSON object.", {
      metadata: "Use an object with public-safe keys only."
    });
  }

  const warnings = [];
  return {
    metadata: sanitizeObject(value, "metadata", warnings),
    warnings
  };
}

function sanitizeObject(value, path, warnings) {
  const entries = Object.entries(value).slice(0, 50);
  const result = {};
  for (const [key, nested] of entries) {
    if (SENSITIVE_METADATA_KEY_RE.test(key)) {
      warnings.push(`removed sensitive metadata key: ${path}.${key}`);
      continue;
    }
    result[key] = sanitizeValue(nested, `${path}.${key}`, warnings);
  }
  if (Object.keys(value).length > entries.length) {
    warnings.push(`metadata object truncated at ${path}`);
  }
  return result;
}

function sanitizeValue(value, path, warnings) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.length <= 500) return value;
    warnings.push(`metadata string truncated at ${path}`);
    return `${value.slice(0, 500)}...`;
  }
  if (Array.isArray(value)) {
    if (value.length > 25) warnings.push(`metadata array truncated at ${path}`);
    return value.slice(0, 25).map((item, index) => sanitizeValue(item, `${path}[${index}]`, warnings));
  }
  if (typeof value === "object") return sanitizeObject(value, path, warnings);
  return String(value);
}

function stringOrDefault(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}
