import express from "express";
import { paidResourceByPath } from "./catalog.js";
import { config } from "./config.js";
import { errorBody } from "./errors.js";
import { handleTrust402Request } from "./server.js";
import { settlementStatus } from "./settlement.js";
import { createX402ExpressMiddleware } from "./x402SdkAdapter.js";

export async function createTrust402ExpressApp(options = {}) {
  const runtimeConfig = options.config || config;
  const catalog = options.catalog;
  const settlement = settlementStatus({ config: runtimeConfig, catalog });
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(canonicalForwardedHost(runtimeConfig));

  const realMiddleware = await realSettlementMiddleware({
    config: runtimeConfig,
    catalog,
    settlement,
    syncFacilitatorOnStart: options.syncFacilitatorOnStart
  });

  app.use(async (req, res, next) => {
    if (runtimeConfig.paywallMode !== "real") return next();
    if (!isPaidRoute(req)) return next();
    if (!realMiddleware) {
      return sendRealSettlementNotReady(res, settlement);
    }
    return realMiddleware(req, res, next);
  });

  app.use((req, res) => handleTrust402Request(req, res));
  app.use((error, _req, res, _next) => sendExpressError(res, error));

  return app;
}

function canonicalForwardedHost(runtimeConfig) {
  const publicHost = publicBaseHost(runtimeConfig.publicBaseUrl);
  return (req, _res, next) => {
    const forwardedHost = firstHeaderValue(req.headers["x-forwarded-host"]);
    if (forwardedHost && publicHost && forwardedHost.toLowerCase() === publicHost.toLowerCase()) {
      req.headers.host = forwardedHost;
    }
    next();
  };
}

async function realSettlementMiddleware(options) {
  if (options.config.paywallMode !== "real") return null;
  if (!options.settlement.readiness.realSettlementReady) return null;
  return createX402ExpressMiddleware(options);
}

function isPaidRoute(req) {
  return req.method === "POST" && Boolean(paidResourceByPath(req.path));
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  if (typeof value !== "string") return "";
  return value.split(",")[0].trim();
}

function publicBaseHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function sendRealSettlementNotReady(res, settlement) {
  res.status(503).json({
    ok: false,
    error: {
      code: "real_settlement_not_ready",
      message:
        "Trust402 real x402 settlement is not ready. Inspect /api/settlement/status before retrying.",
      details: {
        readiness: settlement.readiness,
        blockers: settlement.blockers
      }
    }
  });
}

function sendExpressError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  res.status(status).json(errorBody(error));
}
