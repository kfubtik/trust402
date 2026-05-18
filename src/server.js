import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { config, isMockPaywallEnabled } from "./config.js";
import { paidResourceByPath, publicResources } from "./catalog.js";
import { ApiError, errorBody } from "./errors.js";
import { capabilities, openApiSpec, x402WellKnown } from "./openapi.js";
import { procurementExecute, procurementQuote } from "./procurement.js";
import { hashResult } from "./receipts.js";
import {
  checkX402,
  compareResources,
  evaluateOrigin,
  procurementPlan,
  scoreResource,
  sellerReadiness,
  x402Diligence
} from "./trustEngine.js";

const routes = new Map([
  ["POST /api/receipts/hash-result", hashResult],
  ["POST /api/procurement/quote", procurementQuote],
  ["POST /api/procurement/execute", procurementExecute],
  ["POST /api/trust/check-x402", checkX402],
  ["POST /api/trust/score-resource", scoreResource],
  ["POST /api/trust/evaluate-origin", evaluateOrigin],
  ["POST /api/seller/readiness", sellerReadiness],
  ["POST /api/trust/compare-resources", compareResources],
  ["POST /api/procurement/plan", procurementPlan],
  ["POST /api/reports/x402-diligence", x402Diligence]
]);

export function createTrust402Server() {
  return createServer(async (req, res) => {
    try {
      setSecurityHeaders(res);
      if (req.method === "OPTIONS") return sendJson(res, 204, {});

      const url = new URL(req.url || "/", config.publicBaseUrl);
      const path = url.pathname;

      if (req.method === "GET" && path === "/") {
        return sendJson(res, 200, {
          ok: true,
          service: config.serviceName,
          tagline: "Trust before you pay. Proof after you buy.",
          links: {
            health: "/health",
            status: "/api/status",
            resources: "/api/resources",
            capabilities: "/api/capabilities",
            openapi: "/openapi.json",
            x402WellKnown: "/.well-known/x402"
          }
        });
      }

      if (req.method === "GET" && path === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: config.serviceName,
          version: config.version,
          mode: config.defaultMode,
          paywallMode: config.paywallMode,
          liveSpendEnabled: false,
          safety: {
            storesPrivateKeys: false,
            paidSubcallsEnabled: false,
            dryRunFirst: true
          }
        });
      }

      if (req.method === "GET" && path === "/api/resources") {
        return sendJson(res, 200, publicResources());
      }

      if (req.method === "GET" && path === "/api/capabilities") {
        return sendJson(res, 200, capabilities());
      }

      if (req.method === "GET" && path === "/api/status") {
        return sendJson(res, 200, statusSummary());
      }

      if (req.method === "GET" && path === "/openapi.json") {
        return sendJson(res, 200, openApiSpec());
      }

      if (req.method === "GET" && path === "/.well-known/x402") {
        return sendJson(res, 200, x402WellKnown());
      }

      const handler = routes.get(`${req.method} ${path}`);
      if (!handler) {
        throw new ApiError(404, "not_found", "Route not found.", { method: req.method, path });
      }

      const resource = paidResourceByPath(path);
      if (resource && isMockPaywallEnabled() && !req.headers["x-payment"]) {
        return sendPaymentRequired(res, resource);
      }

      const body = await readJson(req);
      const result = await handler(body);
      return sendJson(res, 200, result);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      return sendJson(res, status, errorBody(error));
    }
  });
}

function statusSummary() {
  const resources = publicResources();
  return {
    ok: true,
    service: config.serviceName,
    version: config.version,
    generatedAt: new Date().toISOString(),
    launchReadiness: {
      phase: "dry-run-public-mvp-with-receipts",
      readyForGitHub: true,
      readyForReceiptLayer: true,
      readyForControlledProcurementDryRun: true,
      readyForLiveSpend: false,
      readyForProof402Delegation: false,
      readyForRealX402Settlement: false
    },
    resources: {
      free: resources.freeResources.length,
      paidLaunch: resources.paidLaunchResources.length,
      preservedLater: resources.laterResourcesToPreserve.length
    },
    safety: resources.safety,
    checks: {
      privacyCheck: "npm run privacy:check",
      tests: "npm test",
      releaseCheck: "npm run release:check",
      smoke: "npm run smoke -- http://127.0.0.1:4032"
    },
    links: {
      resources: "/api/resources",
      capabilities: "/api/capabilities",
      openapi: "/openapi.json",
      x402WellKnown: "/.well-known/x402",
      roadmap: "docs/mvp-roadmap.md",
      safetyPolicy: "docs/safety-policy.md"
    }
  };
}

function sendPaymentRequired(res, resource) {
  const amount = priceToBaseUnits(resource.priceUsd);
  const challenge = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: config.x402Network,
        asset: config.x402Asset,
        amount,
        payTo: config.payTo,
        resource: `${config.publicBaseUrl}${resource.path}`,
        maxTimeoutSeconds: 300
      }
    ]
  };

  res.setHeader("payment-required", Buffer.from(JSON.stringify(challenge)).toString("base64url"));
  return sendJson(res, 402, {
    ok: false,
    error: {
      code: "payment_required",
      message: "x402 payment is required for this Trust402 resource in mock paywall mode.",
      details: {
        resource: resource.id,
        priceUsd: resource.priceUsd,
        mock: true
      }
    },
    accepts: challenge.accepts
  });
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > config.maxJsonBytes) {
      throw new ApiError(413, "payload_too_large", "JSON body is too large.", {
        maxJsonBytes: config.maxJsonBytes
      });
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.", {});
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(status === 204 ? "" : JSON.stringify(body, null, 2));
}

function setSecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("cross-origin-resource-policy", "same-origin");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-payment");
}

function priceToBaseUnits(priceUsd) {
  const price = typeof priceUsd === "object" ? priceUsd.max : priceUsd;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return "0";
  return String(Math.round(parsed * 1_000_000));
}

export function startServer() {
  const server = createTrust402Server();
  server.listen(config.port, config.host, () => {
    console.log(`Trust402 listening on http://${config.host}:${config.port}`);
  });
  return server;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) startServer();
