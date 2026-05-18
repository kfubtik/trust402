import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json, sha256Text } from "./hash.js";

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;

export function hashResult(input = {}) {
  const payload = input.payload ?? input.result ?? null;
  const suppliedHash = normalizeHash(input.resultHash || input.hash);

  if (payload === null && !suppliedHash) {
    throw new ApiError(400, "invalid_input", "hash-result requires payload, result, or resultHash.", {
      payload: "Provide a JSON payload/result or an existing sha256:<hex> resultHash."
    });
  }

  const payloadHash = payload === null ? null : hashPayload(payload);
  const resultHash = suppliedHash || payloadHash;
  const matchesPayload = suppliedHash && payloadHash ? suppliedHash === payloadHash : null;

  return {
    ok: true,
    tool: "receipts.hash_result",
    mode: "dry-run",
    subject: input.subject || "result",
    generatedAt: new Date().toISOString(),
    resultHash,
    payloadHash,
    consistency: {
      suppliedHash: suppliedHash || null,
      matchesPayload,
      warnings: consistencyWarnings({ suppliedHash, payloadHash, matchesPayload })
    },
    receiptBundle: receiptBundle({
      subject: input.subject || "result",
      resultHash,
      payloadHash,
      purpose: input.purpose || "proof-ready result hash"
    })
  };
}

export function receiptBundle({ subject, resultHash, payloadHash = null, purpose = "proof-ready result hash" }) {
  if (!SHA256_RE.test(resultHash || "")) {
    throw new ApiError(400, "invalid_input", "resultHash must be sha256:<64 lowercase hex chars>.", {
      resultHash: "Use sha256:<hex>."
    });
  }

  const proofConfigured = Boolean(config.proof402BaseUrl);
  const delegationEnabled = config.proof402DelegationMode === "live";

  return {
    receiptId: `trust402:${resultHash.slice(7, 19)}`,
    subject,
    purpose,
    resultHash,
    payloadHash,
    proofProvider: "Proof402",
    proofStatus: delegationEnabled ? "blocked-by-policy" : "not-delegated",
    proofLink: null,
    delegation: {
      configured: proofConfigured,
      mode: config.proof402DelegationMode,
      baseUrl: proofConfigured ? config.proof402BaseUrl : null,
      paidProofCallMade: false,
      reason: delegationReason({ proofConfigured, delegationEnabled })
    },
    policy: {
      liveSpendEnabled: false,
      maxProofSpendUsd: config.proof402MaxSpendUsd,
      requiresExplicitApproval: true,
      storesPrivatePayload: false
    },
    nextAction: proofConfigured
      ? "Call /api/receipts/notarize-result for a Proof402 request preview; enable paid proof delegation only after explicit max-spend approval and receipt logging."
      : "Set PROOF402_BASE_URL later to delegate this hash to Proof402 without modifying Proof402."
  };
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

function delegationReason({ proofConfigured, delegationEnabled }) {
  if (!proofConfigured) return "PROOF402_BASE_URL is not configured.";
  if (!delegationEnabled) return "PROOF402_DELEGATION_MODE is not live.";
  return "Live proof delegation is blocked in this MVP because liveSpendEnabled is false.";
}
