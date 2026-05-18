import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { routeConfigFor, settlementStatus } from "./settlement.js";

const X402_PACKAGES = [
  "@x402/express",
  "@x402/core/server",
  "@x402/evm/exact/server",
  "@coinbase/x402"
];

export function x402RouteConfig(options = {}) {
  const runtimeConfig = options.config || config;
  const catalog = options.catalog || loadCatalog();
  return Object.fromEntries(
    (catalog.paidLaunchResources || []).map((resource) => [
      `${resource.method} ${resource.path}`,
      routeConfigFor(resource, runtimeConfig)
    ])
  );
}

export async function x402SdkStatus(options = {}) {
  const runtimeConfig = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const imports = await checkX402Imports();
  const settlement = settlementStatus({ config: runtimeConfig, catalog });
  const expressEntrypointConnected = options.expressEntrypointConnected === true;

  return {
    ok: true,
    tool: "settlement.sdk_status",
    generatedAt: new Date().toISOString(),
    installed: imports.every((item) => item.available),
    packages: imports,
    adapter: {
      supportedRuntime: "express-middleware",
      nativeHttpServerConnected: false,
      expressEntrypointConnected,
      reason: expressEntrypointConnected
        ? "Trust402 can route Vercel/serverless traffic through the Express x402 middleware when real settlement is explicitly enabled."
        : "Trust402 native node:http mode does not run the Express x402 middleware."
    },
    routeConfig: x402RouteConfig({ config: runtimeConfig, catalog }),
    settlementReadiness: settlement.readiness,
    blockers: expressEntrypointConnected
      ? settlement.blockers
      : [
          ...settlement.blockers,
          {
            id: "express_entrypoint_not_connected",
            scope: "real-settlement",
            message: "Route production traffic through the Express middleware bridge before TRUST402_PAYWALL_MODE=real."
          }
        ]
  };
}

export async function createX402ExpressMiddleware(options = {}) {
  const runtimeConfig = options.config || config;
  const catalog = options.catalog || loadCatalog();
  const settlement = settlementStatus({ config: runtimeConfig, catalog });

  if (!settlement.readiness.realSettlementReady) {
    throw new Error("Trust402 real settlement is not ready; inspect /api/settlement/status before creating middleware.");
  }

  const [
    expressModule,
    coreServerModule,
    evmServerModule
  ] = await Promise.all([
    import("@x402/express"),
    import("@x402/core/server"),
    import("@x402/evm/exact/server")
  ]);

  const facilitatorClient = await createFacilitatorClient(coreServerModule.HTTPFacilitatorClient, runtimeConfig);
  const resourceServer = new expressModule.x402ResourceServer(facilitatorClient)
    .register(runtimeConfig.x402Network, new evmServerModule.ExactEvmScheme());

  return expressModule.paymentMiddleware(
    x402RouteConfig({ config: runtimeConfig, catalog }),
    resourceServer,
    {
      appName: runtimeConfig.serviceName,
      testnet: runtimeConfig.x402Network !== "eip155:8453"
    },
    undefined,
    options.syncFacilitatorOnStart !== false
  );
}

async function checkX402Imports() {
  const results = [];
  for (const name of X402_PACKAGES) {
    try {
      await import(name);
      results.push({ name, available: true });
    } catch (error) {
      results.push({
        name,
        available: false,
        reason: error instanceof Error ? error.message : "import failed"
      });
    }
  }
  return results;
}

async function createFacilitatorClient(HTTPFacilitatorClient, runtimeConfig) {
  if (String(runtimeConfig.facilitatorUrl || "").includes("api.cdp.coinbase.com")) {
    const coinbase = await import("@coinbase/x402");
    if (coinbase.facilitator) {
      return new HTTPFacilitatorClient(coinbase.facilitator);
    }
  }

  return new HTTPFacilitatorClient({ url: runtimeConfig.facilitatorUrl });
}
