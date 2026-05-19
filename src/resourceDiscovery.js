import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_BUDGET_USD = 0.25;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function discoverResourceCandidates(input = {}, options = {}) {
  const cfg = options.config || config;
  const goal = String(input.goal || "Trust402 autonomous buyer-agent job").trim();
  const budgetUsd = numberOr(input.budgetUsd, DEFAULT_BUDGET_USD);
  const explicitCandidates = Array.isArray(input.candidates) ? input.candidates : [];
  const registryCandidates = Array.isArray(input.registryCandidates) ? input.registryCandidates : [];
  const includeSeedRegistry = input.useSeedRegistry === true ||
    (input.useSeedRegistry !== false && explicitCandidates.length === 0 && registryCandidates.length === 0);
  const seedCandidates = includeSeedRegistry ? trustedSeedCandidates({ goal, budgetUsd, cfg }) : [];
  const pool = [
    ...explicitCandidates.map((candidate) => normalizeCandidate(candidate, "input.candidates")),
    ...registryCandidates.map((candidate) => normalizeCandidate(candidate, "input.registryCandidates")),
    ...seedCandidates
  ].filter(Boolean);
  const unique = uniqueByEndpoint(pool)
    .filter((candidate) => candidate.priceUsd === null || candidate.priceUsd <= budgetUsd)
    .slice(0, clampInt(input.maxCandidates, 1, 10, 10));
  const discoveryCore = {
    goal,
    budgetUsd,
    includeSeedRegistry,
    explicitCandidates: explicitCandidates.length,
    registryCandidates: registryCandidates.length,
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
      seedCandidates: seedCandidates.length,
      returnedCandidates: unique.length,
      includeSeedRegistry
    },
    candidates: unique,
    blockers: unique.length > 0 ? [] : [{
      id: "no_candidates_available",
      message: "No input, registry, or trusted seed candidates fit the requested budget."
    }],
    safety: {
      readOnly: true,
      fetchesExternalRegistries: false,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      mutatesWallet: false,
      includesSecretValues: false
    }
  };
}

export function candidatesForAutonomousRun(input = {}, options = {}) {
  const discovery = discoverResourceCandidates(input, options);
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

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
