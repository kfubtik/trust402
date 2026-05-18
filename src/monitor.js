import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";
import { receiptBundle } from "./receipts.js";
import { checkX402, evaluateOrigin, scoreResource } from "./trustEngine.js";

export async function monitorSnapshot(input = {}, options = {}) {
  const endpoint = stringOrNull(input.endpoint || input.url);
  const origin = stringOrNull(input.origin);
  if (!endpoint && !origin) {
    throw new ApiError(400, "invalid_input", "monitor snapshot requires endpoint or origin.", {
      endpoint: "Provide endpoint and/or origin."
    });
  }

  const endpointCheck = endpoint
    ? await checkX402({
        endpoint,
        method: input.method || "GET",
        expectedPriceUsd: input.expectedPriceUsd,
        timeoutMs: input.timeoutMs
      }, options)
    : null;
  const resourceScore = endpoint
    ? scoreResource({
        ...input,
        endpoint,
        observed: endpointCheck?.observed,
        x402: endpointCheck?.x402,
        has402: endpointCheck?.observed?.status === 402
      })
    : null;
  const originScore = origin ? await evaluateOrigin({ origin }, options) : null;
  const snapshotCore = {
    endpoint,
    origin,
    checkedAt: new Date().toISOString(),
    endpointCheck,
    resourceScore,
    originScore,
    drift: driftSignals({ input, endpointCheck, resourceScore, originScore }),
    badge: badgeFromScores([resourceScore?.score, originScore?.score])
  };
  const snapshotHash = sha256Json(snapshotCore);

  return {
    ok: true,
    tool: "monitor.snapshot",
    mode: "one-shot",
    ...snapshotCore,
    snapshotHash,
    receiptBundle: receiptBundle({
      subject: endpoint || origin,
      resultHash: snapshotHash,
      payloadHash: snapshotHash,
      purpose: "x402 monitor snapshot"
    }),
    policy: {
      liveSpendEnabled: false,
      storesHistory: false,
      paidSubcallsMade: 0
    }
  };
}

export async function monitorBadge(input = {}, options = {}) {
  const snapshot = input.snapshot?.snapshotHash
    ? input.snapshot
    : await monitorSnapshot(input, options);
  const badge = {
    label: input.label || "Trust402",
    subject: snapshot.endpoint || snapshot.origin || input.subject || "x402 resource",
    status: snapshot.badge.status,
    color: snapshot.badge.color,
    score: snapshot.badge.score,
    checkedAt: snapshot.checkedAt,
    snapshotHash: snapshot.snapshotHash,
    markdown: `![Trust402 ${snapshot.badge.status}](https://img.shields.io/badge/Trust402-${encodeURIComponent(snapshot.badge.status)}-${snapshot.badge.color})`
  };
  const badgeHash = sha256Json(badge);

  return {
    ok: true,
    tool: "monitor.badge",
    mode: "one-shot",
    badge,
    badgeHash,
    receiptBundle: receiptBundle({
      subject: badge.subject,
      resultHash: badgeHash,
      payloadHash: badgeHash,
      purpose: "x402 trust badge snapshot"
    }),
    policy: {
      liveSpendEnabled: false,
      storesHistory: false,
      paidSubcallsMade: 0
    }
  };
}

function driftSignals({ input, endpointCheck, resourceScore, originScore }) {
  const signals = [];
  if (input.expectedStatus && endpointCheck?.observed?.status !== input.expectedStatus) {
    signals.push({
      id: "status_changed",
      severity: "high",
      message: `Expected HTTP ${input.expectedStatus}, observed ${endpointCheck?.observed?.status}.`
    });
  }
  if (input.expectedPriceUsd && resourceScore?.context?.priceUsd && resourceScore.context.priceUsd !== input.expectedPriceUsd) {
    signals.push({
      id: "price_changed",
      severity: "medium",
      message: "Supplied price differs from expectedPriceUsd."
    });
  }
  if (resourceScore?.recommendation === "avoid-until-fixed" || originScore?.recommendation === "avoid-until-fixed") {
    signals.push({
      id: "trust_regression",
      severity: "high",
      message: "Current trust score recommends avoiding this resource until fixed."
    });
  }
  if (signals.length === 0) {
    signals.push({
      id: "no_drift_detected",
      severity: "info",
      message: "No configured drift condition was detected in this one-shot snapshot."
    });
  }
  return signals;
}

function badgeFromScores(scores) {
  const numericScores = scores.filter((score) => typeof score === "number" && Number.isFinite(score));
  const score = numericScores.length
    ? Math.round(numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length)
    : 0;
  if (score >= 82) return { status: "trusted", color: "brightgreen", score };
  if (score >= 60) return { status: "test-first", color: "yellow", score };
  return { status: "needs-fix", color: "red", score };
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
