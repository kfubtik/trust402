import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/errors.js";
import { paymentBuyerPreflight } from "../src/paymentBuyerPreflight.js";

const baseConfig = {
  livePaymentProvider: "cdp-x402",
  livePaymentAdapterUrl: "",
  liveMaxPerCallUsd: 0.02,
  x402Network: "eip155:8453",
  x402BuyerPrivateKeyConfigured: false,
  x402BuyerRpcUrl: "",
  cdpApiKeyIdConfigured: false,
  cdpApiKeySecretConfigured: false,
  cdpWalletSecretConfigured: false,
  cdpEvmAccountAddress: "",
  cdpEvmAccountName: "",
  requestTimeoutMs: 100
};

test("paymentBuyerPreflight reports missing CDP buyer gates without probing", async () => {
  const result = await paymentBuyerPreflight({}, { config: baseConfig });

  assert.equal(result.status, "blocked-config");
  assert.equal(result.passed, false);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.safety.createsCdpAccount, false);
  assert.ok(result.blockers.some((item) => item.id === "missing_cdp_wallet_secret"));
  assert.ok(result.blockers.some((item) => item.id === "missing_cdp_evm_account"));
});

test("paymentBuyerPreflight can become ready-to-probe with configured CDP account reference", async () => {
  const result = await paymentBuyerPreflight({}, {
    config: {
      ...baseConfig,
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      cdpWalletSecretConfigured: true,
      cdpEvmAccountName: "trust402-buyer"
    }
  });

  assert.equal(result.status, "ready-to-probe");
  assert.equal(result.passed, true);
  assert.equal(result.account.configured, true);
  assert.equal(result.account.refKind, "name");
});

test("paymentBuyerPreflight requires operator authorization for live CDP account probe", async () => {
  await assert.rejects(
    paymentBuyerPreflight({ probeCdp: true }, {
      config: {
        ...baseConfig,
        cdpApiKeyIdConfigured: true,
        cdpApiKeySecretConfigured: true,
        cdpWalletSecretConfigured: true,
        cdpEvmAccountName: "trust402-buyer"
      }
    }),
    (error) => error instanceof ApiError && error.code === "operator_not_authorized"
  );
});

test("paymentBuyerPreflight probes an existing CDP account through injected client", async () => {
  const calls = [];
  const result = await paymentBuyerPreflight({ probeCdp: true }, {
    operatorAuthorized: true,
    config: {
      ...baseConfig,
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      cdpWalletSecretConfigured: true,
      cdpEvmAccountName: "trust402-buyer"
    },
    modules: {
      cdpClient: {
        evm: {
          getAccount: async (ref) => {
            calls.push(ref);
            return {
              address: "0x1111111111111111111111111111111111111111",
              type: "evm-server"
            };
          }
        }
      }
    }
  });

  assert.equal(result.status, "passed");
  assert.equal(result.passed, true);
  assert.deepEqual(calls, [{ name: "trust402-buyer" }]);
  assert.equal(result.cdpProbe.addressPreview, "0x1111...1111");
  assert.match(result.cdpProbe.addressHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes("CDP_WALLET_SECRET"), true);
  assert.equal(JSON.stringify(result).includes("0x1111111111111111111111111111111111111111"), false);
});
