import { ApiError } from "./errors.js";
import { config } from "./config.js";

const EVM_PRIVATE_KEY_RE = /^0x[a-fA-F0-9]{64}$/;

export function paymentProviderRequiredSecrets(provider) {
  if (provider === "agentcash-mcp" || provider === "external-adapter") {
    return ["LIVE_PAYMENT_ADAPTER_URL"];
  }
  if (provider === "x402-fetch") {
    return ["X402_BUYER_PRIVATE_KEY", "X402_BUYER_RPC_URL"];
  }
  return [];
}

export function paymentBridgeContract(provider = "agentcash-mcp") {
  if (provider !== "agentcash-mcp" && provider !== "external-adapter") return null;
  return {
    provider,
    runtime: provider === "agentcash-mcp" ? "agentcash-bridge" : "external-adapter",
    endpointEnv: "LIVE_PAYMENT_ADAPTER_URL",
    method: "POST",
    requestShape: {
      service: "Trust402",
      provider,
      protocol: "x402",
      maxAmountUsd: "<LIVE_MAX_PER_CALL_USD>",
      network: "<X402_NETWORK>",
      request: {
        url: "<downstream x402 URL>",
        method: "<GET|POST|PUT|PATCH|DELETE>",
        headers: "<public headers only; auth/payment/secret headers stripped>",
        body: "<stringified public-safe request body>"
      }
    },
    responseShape: {
      response: {
        status: 200,
        headers: {
          "content-type": "application/json",
          "payment-response": "<optional public payment receipt header>"
        },
        body: "<downstream response body>"
      }
    },
    safety: {
      trust402SendsPrivateKeys: false,
      trust402SendsPaymentHeadersToBridge: false,
      trust402StripsSecretHeaders: true,
      maxBodyBytes: 100000,
      bridgeMustEnforceMaxAmountUsd: true
    }
  };
}

export function paymentProviderReadiness(runtimeConfig = config, options = {}) {
  const provider = runtimeConfig.livePaymentProvider || "disabled";
  const blockers = [];

  if (options.paidFetchInjected === true) {
    return providerStatus({
      provider,
      runtime: "injected-paid-fetch",
      ready: true,
      blockers,
      runtimeConfig
    });
  }

  if (provider === "external-adapter" || provider === "agentcash-mcp") {
    if (!runtimeConfig.livePaymentAdapterUrl) {
      blockers.push({
        id: "missing_payment_adapter_url",
        message: provider === "agentcash-mcp"
          ? "LIVE_PAYMENT_ADAPTER_URL is required for the AgentCash MCP bridge in server/runtime flows."
          : "LIVE_PAYMENT_ADAPTER_URL is required for external-adapter provider."
      });
    }
    return providerStatus({
      provider,
      runtime: provider === "agentcash-mcp" ? "agentcash-bridge" : "external-adapter",
      ready: blockers.length === 0,
      blockers,
      runtimeConfig
    });
  }

  if (provider === "x402-fetch") {
    if (!runtimeConfig.x402BuyerPrivateKeyConfigured) {
      blockers.push({
        id: "missing_x402_buyer_private_key",
        message: "X402_BUYER_PRIVATE_KEY is required for the in-process @x402/fetch buyer adapter."
      });
    }
    if (!runtimeConfig.x402BuyerRpcUrl) {
      blockers.push({
        id: "missing_x402_buyer_rpc_url",
        message: "X402_BUYER_RPC_URL is required for the in-process @x402/fetch buyer adapter."
      });
    }
    return providerStatus({
      provider,
      runtime: "@x402/fetch",
      ready: blockers.length === 0,
      blockers,
      runtimeConfig
    });
  }

  return providerStatus({
    provider,
    runtime: "not-configured",
    ready: false,
    blockers: [{
      id: "missing_payment_provider",
      message: "LIVE_PAYMENT_PROVIDER must be agentcash-mcp, x402-fetch, or external-adapter."
    }],
    runtimeConfig
  });
}

export async function createPaidFetch({ cfg = config, fetchImpl = globalThis.fetch, paidFetchImpl = null } = {}) {
  if (paidFetchImpl) return paidFetchImpl;

  const readiness = paymentProviderReadiness(cfg);
  if (!readiness.ready) {
    throw new ApiError(403, "payment_adapter_not_ready", "Live payment adapter is not ready.", {
      provider: readiness.provider,
      runtime: readiness.runtime,
      blockers: readiness.blockers
    });
  }

  if (cfg.livePaymentProvider === "external-adapter" || cfg.livePaymentProvider === "agentcash-mcp") {
    return (url, init = {}) => fetchViaPaymentBridge({ cfg, fetchImpl, url, init });
  }

  if (cfg.livePaymentProvider === "x402-fetch") {
    return createX402Fetch({ cfg, fetchImpl });
  }

  throw new ApiError(403, "unsupported_payment_provider", "Unsupported live payment provider.", {
    provider: cfg.livePaymentProvider
  });
}

async function fetchViaPaymentBridge({ cfg, fetchImpl, url, init }) {
  const response = await fetchImpl(cfg.livePaymentAdapterUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Trust402 payment bridge/0.1"
    },
    body: JSON.stringify({
      service: "Trust402",
      provider: cfg.livePaymentProvider,
      protocol: "x402",
      maxAmountUsd: cfg.liveMaxPerCallUsd,
      network: cfg.x402Network,
      request: {
        url: String(url),
        method: init.method || "GET",
        headers: publicHeaders(init.headers),
        body: bodyForBridge(init.body)
      }
    }),
    signal: AbortSignal.timeout(cfg.requestTimeoutMs || 6000)
  });
  const body = await responseJson(response);
  if (!response.ok) {
    throw new ApiError(response.status || 502, "payment_bridge_failed", "Payment bridge failed.", {
      provider: cfg.livePaymentProvider,
      status: response.status,
      bodySummary: summarizeBridgeBody(body)
    });
  }
  return responseFromBridgeBody(body);
}

async function createX402Fetch({ cfg, fetchImpl }) {
  const privateKey = String(process.env.X402_BUYER_PRIVATE_KEY || "").trim();
  if (!EVM_PRIVATE_KEY_RE.test(privateKey)) {
    throw new ApiError(403, "invalid_x402_buyer_private_key", "X402_BUYER_PRIVATE_KEY must be a 0x-prefixed 32-byte EVM private key.", {
      configured: Boolean(privateKey)
    });
  }

  const [
    fetchModule,
    evmClientModule,
    evmModule,
    viemModule,
    viemAccountsModule,
    viemChainsModule
  ] = await Promise.all([
    import("@x402/fetch"),
    import("@x402/evm/exact/client"),
    import("@x402/evm"),
    import("viem"),
    import("viem/accounts"),
    import("viem/chains")
  ]);

  const account = viemAccountsModule.privateKeyToAccount(privateKey);
  const chain = chainForNetwork(cfg.x402Network, viemChainsModule);
  const publicClient = viemModule.createPublicClient({
    chain,
    transport: viemModule.http(cfg.x402BuyerRpcUrl)
  });
  const signer = evmModule.toClientEvmSigner(account, publicClient);
  const client = new fetchModule.x402Client();
  evmClientModule.registerExactEvmScheme(client, {
    signer,
    networks: [cfg.x402Network]
  });

  return fetchModule.wrapFetchWithPayment(fetchImpl, client);
}

function providerStatus({ provider, runtime, ready, blockers, runtimeConfig }) {
  return {
    provider: provider && provider !== "disabled" ? provider : "not-configured",
    runtime,
    ready,
    adapterUrlConfigured: Boolean(runtimeConfig.livePaymentAdapterUrl),
    x402BuyerPrivateKeyConfigured: Boolean(runtimeConfig.x402BuyerPrivateKeyConfigured),
    x402BuyerRpcUrlConfigured: Boolean(runtimeConfig.x402BuyerRpcUrl),
    requiredSecrets: paymentProviderRequiredSecrets(provider),
    bridgeContract: paymentBridgeContract(provider),
    storesPrivatePayload: false,
    blockers
  };
}

function publicHeaders(headers) {
  const result = {};
  const source = new Headers(headers || {});
  for (const [key, value] of source.entries()) {
    if (/authorization|cookie|payment|signature|token|secret|api[_-]?key/i.test(key)) continue;
    result[key] = value;
  }
  return result;
}

function bodyForBridge(body) {
  if (body === undefined || body === null) return null;
  if (typeof body === "string") return body.slice(0, 100_000);
  return String(body).slice(0, 100_000);
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

function responseFromBridgeBody(body) {
  const response = body?.response && typeof body.response === "object" ? body.response : body || {};
  const status = Number.isInteger(response.status) ? response.status : 200;
  const headers = response.headers && typeof response.headers === "object" ? response.headers : {};
  const payload = response.body ?? response.data ?? body;
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload ?? {}), {
    status,
    headers
  });
}

function summarizeBridgeBody(body) {
  if (!body || typeof body !== "object") return body;
  return {
    ok: body.ok ?? null,
    status: body.status ?? body.response?.status ?? null,
    keys: Object.keys(body).slice(0, 20)
  };
}

function chainForNetwork(network, chains) {
  if (network === "eip155:8453") return chains.base;
  if (network === "eip155:84532") return chains.baseSepolia;
  throw new ApiError(403, "unsupported_x402_buyer_network", "The in-process x402-fetch adapter currently supports Base and Base Sepolia.", {
    network
  });
}
