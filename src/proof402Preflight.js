import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json, sha256Text } from "./hash.js";
import { prepareProof402Request } from "./proof402Client.js";
import { proof402DelegationPolicy } from "./policies.js";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const USDC_BASE_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();

export function proof402Preflight(input = {}, options = {}) {
  const cfg = options.config || config;
  const prepared = prepareProof402Request(input, cfg);
  const approval = hashApproval(prepared.resultHash, input);
  const quote = normalizeQuote(input, cfg);
  const policy = proof402DelegationPolicy(cfg);
  const requestProfile = proofRequestProfile(prepared);
  const blockers = [
    ...requestBlockers({ prepared, requestProfile }),
    ...approval.blockers,
    ...quote.blockers,
    ...quotePolicyBlockers({ quote, cfg }),
    ...livePolicyBlockers(policy)
  ];
  const status = statusFor(blockers);
  const preflightCore = {
    resultHash: prepared.resultHash,
    approved: approval.approved,
    quoteStatus: quote.status,
    maxProofSpendUsd: cfg.proof402MaxSpendUsd,
    proof402BaseUrlConfigured: Boolean(cfg.proof402BaseUrl),
    livePolicyReady: policy.ready,
    blockerIds: blockers.map((item) => item.id)
  };

  return {
    ok: true,
    tool: "proof402.preflight",
    generatedAt: new Date().toISOString(),
    status,
    passed: blockers.length === 0,
    preflightHash: sha256Json(preflightCore),
    subject: prepared.subject,
    resultHash: prepared.resultHash,
    approval,
    quote,
    request: requestProfile,
    policy: {
      ready: policy.ready,
      mode: policy.mode,
      maxSpendUsd: cfg.proof402MaxSpendUsd,
      paymentProvider: policy.controls.paymentProvider,
      paymentAdapter: policy.controls.paymentAdapter,
      operatorApiKeyConfigured: policy.controls.operatorApiKeyConfigured,
      emergencyStop: policy.controls.emergencyStop,
      blockers: policy.blockers
    },
    blockers,
    nextAction: nextActionFor({ status, blockers, policy, quote }),
    safety: {
      readOnly: true,
      callsProof402: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      paidSubcallsMade: 0,
      privatePayloadIncludedInProofRequest: false,
      storesPrivatePayload: false,
      includesSecretValues: false
    }
  };
}

function hashApproval(resultHash, input) {
  const approvedHashes = approvedHashSet(input);
  if (approvedHashes.size === 0) {
    return {
      approved: false,
      approvedHashesConfigured: false,
      blockers: [blocker("approved_hash_missing", "Provide approvedHash or approvedHashes before any paid Proof402 delegation.")]
    };
  }
  const approved = approvedHashes.has(resultHash);
  return {
    approved,
    approvedHashesConfigured: true,
    approvedHashCount: approvedHashes.size,
    blockers: approved
      ? []
      : [blocker("hash_not_approved", "The requested resultHash is not present in approvedHash/approvedHashes.")]
  };
}

function approvedHashSet(input) {
  const values = [
    input.approvedHash,
    ...(Array.isArray(input.approvedHashes) ? input.approvedHashes : [])
  ].filter(Boolean);
  return new Set(values.map((value) => normalizeHash(value)));
}

function normalizeQuote(input, cfg) {
  const source = input.paymentQuote || input.proof402Quote || input.quote || input.accept || {};
  const directPrice = firstFiniteNumber(
    input.quotedPriceUsd,
    input.priceUsd,
    source.priceUsd,
    source.price,
    source.usd,
    source.amountUsd
  );
  const atomicAmount = firstPresent(source.amount, source.maxAmountRequired, source.maxAmount, input.amount, input.maxAmountRequired);
  const decimals = firstFiniteNumber(source.assetDecimals, input.assetDecimals, decimalsForAsset(source.asset || cfg.x402Asset));
  const priceUsd = directPrice ?? priceFromAtomic(atomicAmount, decimals);
  const network = stringOrDefault(source.network || input.network, cfg.x402Network);
  const asset = stringOrDefault(source.asset || input.asset, cfg.x402Asset);
  const payTo = stringOrDefault(source.payTo || input.payTo, "");
  const blockers = [];

  if (!(priceUsd > 0)) {
    blockers.push(blocker("proof402_quote_missing", "Provide a Proof402 x402 quote price, amount, maxAmountRequired, or payment option before live paid proof."));
  }
  if (network && network !== cfg.x402Network) {
    blockers.push(blocker("proof402_network_mismatch", `Proof402 quote network ${network} does not match configured ${cfg.x402Network}.`));
  }
  if (asset && cfg.x402Asset && asset.toLowerCase() !== cfg.x402Asset.toLowerCase()) {
    blockers.push(blocker("proof402_asset_mismatch", "Proof402 quote asset does not match configured X402_ASSET."));
  }
  if (payTo && !EVM_ADDRESS_RE.test(payTo)) {
    blockers.push(blocker("proof402_pay_to_invalid", "Proof402 quote payTo must be a 0x-prefixed EVM address."));
  }

  return {
    status: priceUsd > 0 && blockers.length === 0 ? "quoted" : "blocked",
    priceUsd: priceUsd ?? null,
    network,
    asset,
    payToPreview: payTo ? previewAddress(payTo) : null,
    payToHash: payTo ? sha256Text(payTo.toLowerCase()) : null,
    amountAtomic: atomicAmount === undefined || atomicAmount === null ? null : String(atomicAmount),
    assetDecimals: decimals ?? null,
    source: quoteSource(input),
    blockers
  };
}

function quotePolicyBlockers({ quote, cfg }) {
  const blockers = [];
  if (!(cfg.proof402MaxSpendUsd > 0)) return blockers;
  if (quote.priceUsd > cfg.proof402MaxSpendUsd) {
    blockers.push(blocker(
      "proof402_quote_exceeds_cap",
      `Proof402 quote ${quote.priceUsd} exceeds PROOF402_MAX_SPEND_USD ${cfg.proof402MaxSpendUsd}.`
    ));
  }
  return blockers;
}

function livePolicyBlockers(policy) {
  if (policy.ready) return [];
  return policy.blockers.map((item) => blocker(`policy_${item.id}`, item.message));
}

function proofRequestProfile(prepared) {
  const body = prepared.proofRequestBody;
  const fields = Object.keys(body).sort();
  return {
    method: "POST",
    path: "/api/proof/notarize",
    fields,
    contentHash: body.contentHash,
    label: body.label,
    idempotencyKey: body.idempotencyKey,
    metadataHash: sha256Json(body.metadata || {}),
    metadataKeys: Object.keys(body.metadata || {}).sort(),
    payloadFieldsPresent: fields.filter((field) => ["payload", "result", "privatePayload"].includes(field)),
    sendsOnlyHashAndPublicMetadata: true,
    requestBodyHash: sha256Json(body)
  };
}

function requestBlockers({ prepared, requestProfile }) {
  const blockers = [];
  if (requestProfile.payloadFieldsPresent.length > 0) {
    blockers.push(blocker("private_payload_in_proof_request", "Proof402 request body must not include payload/result/privatePayload fields."));
  }
  if (prepared.consistency.warnings.length > 0) {
    blockers.push(blocker("proof_metadata_or_hash_warning", "Resolve proof metadata/hash warnings before paid delegation."));
  }
  return blockers;
}

function statusFor(blockers) {
  if (blockers.length === 0) return "ready-for-paid-proof";
  if (blockers.some((item) => item.id.startsWith("policy_"))) return "blocked-policy";
  if (blockers.some((item) => item.id.includes("quote"))) return "blocked-quote";
  if (blockers.some((item) => item.id.includes("approved") || item.id.includes("hash_not"))) return "blocked-approval";
  return "blocked";
}

function nextActionFor({ status, blockers, policy, quote }) {
  if (status === "ready-for-paid-proof") {
    return "Run the bounded paid Proof402 smoke only during an approved live window, then store the public-safe proof evidence ref.";
  }
  if (blockers.some((item) => item.id === "approved_hash_missing" || item.id === "hash_not_approved")) {
    return "Approve the exact sha256 result hash before paid Proof402 delegation.";
  }
  if (quote.status !== "quoted") {
    return "Capture a current Proof402 x402 payment quote and rerun this preflight with price or amount fields.";
  }
  if (!policy.ready) {
    return "Finish Proof402 spend policy, payment-provider readiness, operator key, and live-spend approval before paid proof.";
  }
  return "Resolve listed blockers and rerun proof402 preflight.";
}

function quoteSource(input) {
  if (input.paymentQuote) return "paymentQuote";
  if (input.proof402Quote) return "proof402Quote";
  if (input.quote) return "quote";
  if (input.accept) return "accept";
  if (input.quotedPriceUsd !== undefined || input.priceUsd !== undefined) return "direct-price";
  return "missing";
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function priceFromAtomic(value, decimals) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isFinite(decimals) || decimals < 0) return null;
  return roundUsd(parsed / (10 ** decimals));
}

function decimalsForAsset(asset) {
  if (String(asset || "").toLowerCase() === USDC_BASE_ASSET) return 6;
  return null;
}

function normalizeHash(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new ApiError(400, "invalid_approved_hash", "approvedHash/approvedHashes must use sha256:<64 hex chars>.", {
      value: String(value || "").slice(0, 32)
    });
  }
  return normalized;
}

function stringOrDefault(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function previewAddress(value) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function blocker(id, message) {
  return { id, message };
}
