import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { config, isMockPaywallEnabled } from "./config.js";
import { agentcashRefillCheck } from "./agentcashRefill.js";
import { paidResourceByPath, publicResources } from "./catalog.js";
import { ApiError, errorBody } from "./errors.js";
import { autonomousRun } from "./autonomousJob.js";
import { marketplaceBundle } from "./marketplace.js";
import { monitorBadge, monitorSnapshot } from "./monitor.js";
import { capabilities, openApiSpec, x402WellKnown } from "./openapi.js";
import { completionAudit } from "./completionAudit.js";
import { spendPolicyStatus } from "./policies.js";
import { procurementExecute, procurementQuote } from "./procurement.js";
import { notarizeResult } from "./proof402Client.js";
import { launchChecklist } from "./readiness.js";
import { hashResult } from "./receipts.js";
import { paymentChallengeFor, settlementPreflight, settlementStatus } from "./settlement.js";
import { liveWindowPlan } from "./liveWindowPlan.js";
import { operatorActionPack } from "./operatorActionPack.js";
import { operatorUnblockReport } from "./operatorUnblockReport.js";
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
  ["POST /api/receipts/notarize-result", notarizeResult],
  ["POST /api/procurement/quote", procurementQuote],
  ["POST /api/procurement/execute", procurementExecute],
  ["POST /api/live/window-plan", liveWindowPlan],
  ["POST /api/operator/unblock-report", operatorUnblockReport],
  ["POST /api/operator/action-pack", operatorActionPack],
  ["POST /api/jobs/autonomous-run", autonomousRun],
  ["POST /api/agentcash/refill-check", agentcashRefillCheck],
  ["POST /api/monitor/snapshot", monitorSnapshot],
  ["POST /api/monitor/badge", monitorBadge],
  ["POST /api/trust/check-x402", checkX402],
  ["POST /api/trust/score-resource", scoreResource],
  ["POST /api/trust/evaluate-origin", evaluateOrigin],
  ["POST /api/seller/readiness", sellerReadiness],
  ["POST /api/trust/compare-resources", compareResources],
  ["POST /api/procurement/plan", procurementPlan],
  ["POST /api/reports/x402-diligence", x402Diligence]
]);

export function createTrust402Server() {
  return createServer(handleTrust402Request);
}

export async function handleTrust402Request(req, res) {
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
          launchChecklist: "/api/launch/checklist",
          marketplaceBundle: "/api/marketplace/bundle",
          settlementStatus: "/api/settlement/status",
          settlementPreflight: "/api/settlement/preflight",
          spendPolicy: "/api/policies/spend",
          completionAudit: "/api/completion/audit",
          liveWindowPlan: "/api/live/window-plan",
          operatorUnblockReport: "/api/operator/unblock-report",
          operatorActionPack: "/api/operator/action-pack",
          agentcashRefillCheck: "/api/agentcash/refill-check",
          autonomousRun: "/api/jobs/autonomous-run",
          resources: "/api/resources",
          proof402Preview: "/api/receipts/notarize-result",
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
        realSettlementEnabled: config.realSettlementEnabled,
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

    if (req.method === "GET" && path === "/api/launch/checklist") {
      return sendJson(res, 200, launchChecklist());
    }

    if (req.method === "GET" && path === "/api/marketplace/bundle") {
      return sendJson(res, 200, marketplaceBundle());
    }

    if (req.method === "GET" && path === "/api/settlement/status") {
      return sendJson(res, 200, settlementStatus());
    }

    if (req.method === "GET" && path === "/api/settlement/preflight") {
      return sendJson(res, 200, settlementPreflight());
    }

    if (req.method === "GET" && path === "/api/policies/spend") {
      return sendJson(res, 200, spendPolicyStatus());
    }

    if (req.method === "GET" && path === "/api/completion/audit") {
      return sendJson(res, 200, completionAudit());
    }

    if (req.method === "GET" && path === "/api/operator/unblock-report") {
      return sendJson(res, 200, operatorUnblockReport());
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
    if (resource && isMockPaywallEnabled() && !hasPaymentAttempt(req)) {
      return sendPaymentRequired(res, resource);
    }

    const body = await readJson(req);
    const result = await handler(body, { operatorAuthorized: isOperatorAuthorized(req) });
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return sendJson(res, status, errorBody(error));
  }
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
      readyForAutonomousDryRun: true,
      readyForOneShotMonitoring: true,
      readyForProof402Preview: Boolean(config.proof402BaseUrl),
      readyForLiveSpend: false,
      readyForProof402Delegation: false,
      readyForAgentCashAutoRefill: false,
      readyForAgentCashRefillDryRun: true,
      readyForRealX402Settlement: settlementStatus().readiness.realSettlementReady
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
      launchChecklist: "/api/launch/checklist",
      marketplaceBundle: "/api/marketplace/bundle",
      settlementStatus: "/api/settlement/status",
      settlementPreflight: "/api/settlement/preflight",
      spendPolicy: "/api/policies/spend",
      completionAudit: "/api/completion/audit",
      liveWindowPlan: "/api/live/window-plan",
      operatorUnblockReport: "/api/operator/unblock-report",
      operatorActionPack: "/api/operator/action-pack",
      agentcashRefillCheck: "/api/agentcash/refill-check",
      autonomousRun: "/api/jobs/autonomous-run",
      openapi: "/openapi.json",
      x402WellKnown: "/.well-known/x402",
      roadmap: "docs/mvp-roadmap.md",
      safetyPolicy: "docs/safety-policy.md"
    }
  };
}

function sendPaymentRequired(res, resource) {
  const challenge = paymentChallengeFor(resource);

  const encodedChallenge = Buffer.from(JSON.stringify(challenge)).toString("base64url");
  res.setHeader("PAYMENT-REQUIRED", encodedChallenge);
  return sendJson(res, 402, {
    ok: false,
    x402Version: challenge.x402Version,
    paymentRequired: challenge,
    accepts: challenge.accepts,
    error: {
      code: "payment_required",
      message: "x402 payment is required for this Trust402 resource in mock paywall mode.",
      details: {
        resource: resource.id,
        priceUsd: resource.priceUsd,
        mock: true,
        requiredHeader: "PAYMENT-SIGNATURE",
        legacyAcceptedHeaders: ["X-Payment", "X-Payment-Payload"]
      }
    }
  });
}

function hasPaymentAttempt(req) {
  return Boolean(
    req.headers["payment-signature"] ||
    req.headers["x-payment"] ||
    req.headers["x-payment-payload"]
  );
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

function isOperatorAuthorized(req) {
  if (!config.operatorApiKey) return false;
  const supplied = req.headers["x-trust402-operator-key"];
  return typeof supplied === "string" && supplied === config.operatorApiKey;
}

function setSecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("cross-origin-resource-policy", "same-origin");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,payment-signature,x-payment,x-payment-payload,x-trust402-operator-key");
  res.setHeader("access-control-expose-headers", "payment-required,payment-response");
}

let realEntrypointAppPromise;

export async function handleTrust402Entrypoint(req, res, options = {}) {
  const runtimeConfig = options.config || config;
  if (runtimeConfig.paywallMode !== "real") {
    return handleTrust402Request(req, res);
  }

  const { createTrust402ExpressApp } = await import("./expressApp.js");
  const appPromise = options.config
    ? createTrust402ExpressApp(options)
    : realEntrypointAppPromise ||
      (realEntrypointAppPromise = createTrust402ExpressApp({
        syncFacilitatorOnStart: options.syncFacilitatorOnStart
      }));

  const app = await appPromise;
  return app(req, res);
}

export async function startServer() {
  if (config.paywallMode === "real") {
    const { createTrust402ExpressApp } = await import("./expressApp.js");
    const app = await createTrust402ExpressApp();
    const server = app.listen(config.port, config.host, () => {
      console.log(`Trust402 listening on http://${config.host}:${config.port}`);
    });
    return server;
  }

  const server = createTrust402Server();
  server.listen(config.port, config.host, () => {
    console.log(`Trust402 listening on http://${config.host}:${config.port}`);
  });
  return server;
}

export default handleTrust402Entrypoint;

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
