import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaidFetch,
  paymentBridgeContract,
  paymentProviderReadiness,
  paymentProviderRequiredSecrets
} from "../src/paymentAdapters.js";

const baseConfig = {
  livePaymentProvider: "disabled",
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

test("paymentProviderReadiness blocks AgentCash MCP without a bridge URL", () => {
  const status = paymentProviderReadiness({
    ...baseConfig,
    livePaymentProvider: "agentcash-mcp"
  });

  assert.equal(status.ready, false);
  assert.equal(status.runtime, "agentcash-bridge");
  assert.deepEqual(status.requiredSecrets, ["LIVE_PAYMENT_ADAPTER_URL"]);
  assert.equal(status.bridgeContract.endpointEnv, "LIVE_PAYMENT_ADAPTER_URL");
  assert.equal(status.bridgeContract.safety.trust402SendsPaymentHeadersToBridge, false);
  assert.ok(status.blockers.some((item) => item.id === "missing_payment_adapter_url"));
});

test("paymentProviderRequiredSecrets matches each live payment runtime", () => {
  assert.deepEqual(paymentProviderRequiredSecrets("agentcash-mcp"), ["LIVE_PAYMENT_ADAPTER_URL"]);
  assert.deepEqual(paymentProviderRequiredSecrets("external-adapter"), ["LIVE_PAYMENT_ADAPTER_URL"]);
  assert.deepEqual(paymentProviderRequiredSecrets("x402-fetch"), ["X402_BUYER_PRIVATE_KEY", "X402_BUYER_RPC_URL"]);
  assert.deepEqual(paymentProviderRequiredSecrets("cdp-x402"), ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET", "CDP_EVM_ACCOUNT_ADDRESS_OR_NAME"]);
  assert.deepEqual(paymentProviderRequiredSecrets("disabled"), []);
});

test("paymentBridgeContract documents public-safe bridge request shape", () => {
  const contract = paymentBridgeContract("agentcash-mcp");

  assert.equal(contract.provider, "agentcash-mcp");
  assert.equal(contract.endpointEnv, "LIVE_PAYMENT_ADAPTER_URL");
  assert.equal(contract.requestShape.service, "Trust402");
  assert.equal(contract.requestShape.request.headers, "<public headers only; auth/payment/secret headers stripped>");
  assert.equal(contract.responseShape.dryRun, "<true for preflight responses>");
  assert.equal(contract.responseShape.safety.paidSubcallsMade, "<0 for preflight responses>");
  assert.equal(contract.safety.trust402SendsPrivateKeys, false);
  assert.equal(paymentBridgeContract("x402-fetch"), null);
});

test("paymentProviderReadiness accepts x402-fetch only with buyer key and RPC configured", () => {
  const blocked = paymentProviderReadiness({
    ...baseConfig,
    livePaymentProvider: "x402-fetch"
  });
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockers.some((item) => item.id === "missing_x402_buyer_private_key"));
  assert.ok(blocked.blockers.some((item) => item.id === "missing_x402_buyer_rpc_url"));

  const ready = paymentProviderReadiness({
    ...baseConfig,
    livePaymentProvider: "x402-fetch",
    x402BuyerPrivateKeyConfigured: true,
    x402BuyerRpcUrl: "https://base.example/rpc"
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.runtime, "@x402/fetch");
});

test("paymentProviderReadiness accepts cdp-x402 only with CDP signing account configured", () => {
  const blocked = paymentProviderReadiness({
    ...baseConfig,
    livePaymentProvider: "cdp-x402",
    cdpApiKeyIdConfigured: true,
    cdpApiKeySecretConfigured: true,
    cdpWalletSecretConfigured: true
  });
  assert.equal(blocked.ready, false);
  assert.equal(blocked.runtime, "@coinbase/cdp-sdk + @x402/fetch");
  assert.ok(blocked.blockers.some((item) => item.id === "missing_cdp_evm_account"));

  const ready = paymentProviderReadiness({
    ...baseConfig,
    livePaymentProvider: "cdp-x402",
    cdpApiKeyIdConfigured: true,
    cdpApiKeySecretConfigured: true,
    cdpWalletSecretConfigured: true,
    cdpEvmAccountName: "trust402-buyer"
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.requiredSecrets.includes("CDP_WALLET_SECRET"), true);
  assert.equal(ready.cdpEvmAccountNameConfigured, true);
});

test("createPaidFetch routes external-adapter calls through a payment bridge", async () => {
  const calls = [];
  const paidFetch = await createPaidFetch({
    cfg: {
      ...baseConfig,
      livePaymentProvider: "external-adapter",
      livePaymentAdapterUrl: "https://pay.example/bridge"
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({
        ok: true,
        response: {
          status: 200,
          headers: {
            "content-type": "application/json",
            "payment-response": "bridge-paid"
          },
          body: {
            ok: true,
            tool: "paid.resource"
          }
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await paidFetch("https://resource.example/paid", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "secret"
    },
    body: JSON.stringify({ hello: "world" })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("payment-response"), "bridge-paid");
  assert.equal(calls[0].url, "https://pay.example/bridge");
  assert.equal(calls[0].body.request.url, "https://resource.example/paid");
  assert.equal(calls[0].body.request.headers.authorization, undefined);
});

test("createPaidFetch constructs x402-fetch adapter only from local buyer secrets", async () => {
  const previousKey = process.env.X402_BUYER_PRIVATE_KEY;
  process.env.X402_BUYER_PRIVATE_KEY = `0x${"1".repeat(64)}`;
  try {
    const paidFetch = await createPaidFetch({
      cfg: {
        ...baseConfig,
        livePaymentProvider: "x402-fetch",
        x402BuyerPrivateKeyConfigured: true,
        x402BuyerRpcUrl: "https://base.example/rpc"
      },
      fetchImpl: async () => new Response("{}", { status: 200 })
    });
    assert.equal(typeof paidFetch, "function");
  } finally {
    if (previousKey === undefined) delete process.env.X402_BUYER_PRIVATE_KEY;
    else process.env.X402_BUYER_PRIVATE_KEY = previousKey;
  }
});

test("createPaidFetch constructs cdp-x402 adapter from a CDP server account", async () => {
  const calls = [];
  class FakeCdpClient {
    constructor(options) {
      calls.push({ type: "client", options });
      this.evm = {
        getAccount: async (ref) => {
          calls.push({ type: "getAccount", ref });
          return {
            address: "0x1111111111111111111111111111111111111111",
            signTypedData: async () => "0xsignature"
          };
        }
      };
    }
  }
  class FakeX402Client {}

  const paidFetch = await createPaidFetch({
    cfg: {
      ...baseConfig,
      livePaymentProvider: "cdp-x402",
      cdpApiKeyIdConfigured: true,
      cdpApiKeySecretConfigured: true,
      cdpWalletSecretConfigured: true,
      cdpEvmAccountName: "trust402-buyer",
      x402BuyerRpcUrl: "https://base.example/rpc"
    },
    fetchImpl: async () => new Response("{}", { status: 200 }),
    modules: {
      cdpModule: { CdpClient: FakeCdpClient },
      x402FetchModule: {
        x402Client: FakeX402Client,
        wrapFetchWithPayment: (fetchImpl, client) => {
          calls.push({ type: "wrap", client });
          return fetchImpl;
        }
      },
      evmClientModule: {
        registerExactEvmScheme: (client, schemeConfig) => {
          calls.push({ type: "register", schemeConfig });
          return client;
        }
      }
    }
  });

  assert.equal(typeof paidFetch, "function");
  assert.deepEqual(calls.find((call) => call.type === "getAccount").ref, { name: "trust402-buyer" });
  const registration = calls.find((call) => call.type === "register").schemeConfig;
  assert.equal(registration.signer.address, "0x1111111111111111111111111111111111111111");
  assert.deepEqual(registration.networks, ["eip155:8453"]);
  assert.deepEqual(registration.schemeOptions, { rpcUrl: "https://base.example/rpc" });
});
