import test from "node:test";
import assert from "node:assert/strict";
import { proof402Preflight } from "../src/proof402Preflight.js";
import { sha256Json } from "../src/hash.js";

const resultHash = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const proof402PayTo = "0x0E525428d66C111672cE58B1bf649A6d167f36b1";
const usdcBase = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const readyConfig = {
  emergencyStop: false,
  proof402DelegationMode: "live",
  liveSpendEnabled: true,
  operatorApiKey: "test-operator",
  livePaymentProvider: "external-adapter",
  livePaymentAdapterUrl: "https://bridge.example/dry-run",
  proof402BaseUrl: "https://proof402.vercel.app",
  proof402MaxSpendUsd: 0.01,
  x402Network: "eip155:8453",
  x402Asset: usdcBase,
  x402BuyerPrivateKeyConfigured: false,
  x402BuyerRpcUrl: "",
  cdpApiKeyIdConfigured: false,
  cdpApiKeySecretConfigured: false,
  cdpWalletSecretConfigured: false,
  cdpEvmAccountAddress: "",
  cdpEvmAccountName: ""
};

test("proof402Preflight passes only when hash, quote, cap, and live policy are ready", () => {
  const result = proof402Preflight({
    resultHash,
    approvedHash: resultHash,
    paymentQuote: {
      amount: "5000",
      assetDecimals: 6,
      network: "eip155:8453",
      asset: usdcBase,
      payTo: proof402PayTo
    }
  }, {
    config: readyConfig
  });

  assert.equal(result.tool, "proof402.preflight");
  assert.equal(result.status, "ready-for-paid-proof");
  assert.equal(result.passed, true);
  assert.equal(result.quote.priceUsd, 0.005);
  assert.equal(result.request.sendsOnlyHashAndPublicMetadata, true);
  assert.deepEqual(result.request.payloadFieldsPresent, []);
  assert.equal(result.safety.callsProof402, false);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.match(result.preflightHash, /^sha256:[a-f0-9]{64}$/);
});

test("proof402Preflight blocks without an explicit approved hash", () => {
  const result = proof402Preflight({
    resultHash,
    quotedPriceUsd: 0.005
  }, {
    config: readyConfig
  });

  assert.equal(result.status, "blocked-approval");
  assert.equal(result.passed, false);
  assert.ok(result.blockers.some((item) => item.id === "approved_hash_missing"));
});

test("proof402Preflight blocks quotes that exceed proof spend cap", () => {
  const result = proof402Preflight({
    resultHash,
    approvedHashes: [resultHash],
    quotedPriceUsd: 0.02
  }, {
    config: readyConfig
  });

  assert.equal(result.status, "blocked-quote");
  assert.ok(result.blockers.some((item) => item.id === "proof402_quote_exceeds_cap"));
});

test("proof402Preflight blocks when Proof402 live policy is not ready", () => {
  const result = proof402Preflight({
    resultHash,
    approvedHash: resultHash,
    quotedPriceUsd: 0.005
  }, {
    config: {
      ...readyConfig,
      proof402DelegationMode: "preview",
      liveSpendEnabled: false,
      operatorApiKey: "",
      livePaymentAdapterUrl: ""
    }
  });

  assert.equal(result.status, "blocked-policy");
  assert.ok(result.blockers.some((item) => item.id === "policy_proof402_delegation_not_live"));
  assert.ok(result.blockers.some((item) => item.id === "policy_live_spend_disabled"));
  assert.ok(result.blockers.some((item) => item.id === "policy_missing_operator_key"));
});

test("proof402Preflight never includes private payload in Proof402 request body", () => {
  const payload = {
    endpoint: "https://example.com/paid",
    recommendation: "use"
  };
  const hash = sha256Json(payload);
  const result = proof402Preflight({
    payload,
    approvedHash: hash,
    quotedPriceUsd: 0.005,
    metadata: {
      taskId: "safe",
      apiKey: "secret-value"
    }
  }, {
    config: readyConfig
  });

  assert.equal(result.request.contentHash, hash);
  assert.deepEqual(result.request.payloadFieldsPresent, []);
  assert.equal(JSON.stringify(result.request).includes("secret-value"), false);
  assert.equal(result.safety.privatePayloadIncludedInProofRequest, false);
  assert.ok(result.blockers.some((item) => item.id === "proof_metadata_or_hash_warning"));
});
