import test from "node:test";
import assert from "node:assert/strict";
import { liveEvidenceSmoke } from "../src/liveEvidenceSmoke.js";

test("liveEvidenceSmoke dry-run produces staged evidence without approval", async () => {
  const calls = [];
  const result = await liveEvidenceSmoke({
    baseUrl: "https://trust402.example",
    includeAutonomous: true
  }, {
    fetchImpl: fakeFetch(calls)
  });

  assert.equal(result.mode, "dry-run");
  assert.equal(result.safety.liveApproved, false);
  assert.equal(result.evidenceRefs.dryRunOnly, true);
  assert.equal(result.suggestedEnv, null);
  assert.equal(result.stages.find((item) => item.id === "procurement_quote")?.details.selectedResources, 1);
  assert.ok(result.stages.some((item) => item.id === "procurement_execute" && item.status === "dry-run-complete"));
  assert.ok(result.stages.some((item) => item.id === "autonomous_job" && item.status === "dry-run-complete"));
  assert.equal(calls.some((call) => call.headers?.["x-trust402-operator-key"]), false);
});

test("liveEvidenceSmoke blocks live mode without local approval gates", async () => {
  await assert.rejects(
    liveEvidenceSmoke({
      baseUrl: "https://trust402.example",
      mode: "live",
      candidateEndpoint: "https://resource.example/paid",
      candidatePriceUsd: 0.01,
      maxTotalUsd: 0.05
    }, {
      fetchImpl: fakeFetch([])
    }),
    /Live evidence smoke is blocked/
  );
});

test("liveEvidenceSmoke live mode returns suggested evidence env refs", async () => {
  const calls = [];
  const result = await liveEvidenceSmoke({
    baseUrl: "https://trust402.example",
    mode: "live",
    approved: true,
    operatorKey: "test-operator",
    candidateEndpoint: "https://resource.example/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.05,
    includeAutonomous: true
  }, {
    fetchImpl: fakeFetch(calls)
  });

  assert.equal(result.mode, "live");
  assert.equal(result.evidenceRefs.liveProcurement, "sha256:live-execution");
  assert.equal(result.evidenceRefs.proof402, "sha256:live-proof");
  assert.equal(result.evidenceRefs.autonomousJob, "sha256:live-autonomous");
  assert.equal(result.suggestedEnv.TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED, "true");
  assert.equal(result.suggestedEnv.TRUST402_PROOF402_PAID_SMOKE_OBSERVED, "true");
  assert.equal(result.suggestedEnv.TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED, "true");
  assert.ok(calls.some((call) => call.headers?.["x-trust402-operator-key"] === "test-operator"));
});

function fakeFetch(calls) {
  return async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body ? JSON.parse(options.body) : null
    });
    const path = new URL(url).pathname;
    if (path === "/api/policies/spend") {
      return json({
        ok: true,
        readiness: {
          liveProcurementReady: true,
          proof402DelegationReady: true,
          agentcashAutoRefillReady: false
        }
      });
    }
    if (path === "/api/procurement/quote") {
      return json({
        ok: true,
        quoteId: "quote-1",
        quoteHash: "sha256:quote",
        quote: {
          goal: "smoke",
          selectedResources: [{ id: "resource", endpoint: "https://resource.example/paid", priceUsd: 0.01 }],
          estimatedTotalUsd: 0.02
        }
      });
    }
    if (path === "/api/procurement/execute") {
      const live = JSON.parse(options.body).mode === "live";
      return json({
        ok: true,
        mode: live ? "live" : "dry-run",
        executionHash: live ? "sha256:live-execution" : "sha256:dry-execution",
        paidSubcallsMade: live ? 1 : 0,
        result: { status: live ? "executed" : "not-executed" }
      });
    }
    if (path === "/api/receipts/notarize-result") {
      const live = JSON.parse(options.body).proof402Mode === "live";
      return json({
        ok: true,
        resultHash: live ? "sha256:live-proof" : "sha256:preview-proof",
        proofStatus: live ? "delegated" : "preview",
        delegation: {
          paidProofCallMade: live
        }
      });
    }
    if (path === "/api/jobs/autonomous-run") {
      const live = JSON.parse(options.body).mode === "live";
      return json({
        ok: true,
        mode: live ? "live" : "dry-run",
        resultHash: live ? "sha256:live-autonomous" : "sha256:dry-autonomous",
        execution: {
          paidSubcallsMade: live ? 1 : 0
        }
      });
    }
    if (path === "/api/agentcash/refill-check") {
      return json({
        ok: true,
        decisionHash: "sha256:refill-decision",
        decision: {
          action: "none",
          status: "balance-above-threshold",
          liveRefillExecuted: false
        }
      });
    }
    return json({ ok: false }, 404);
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
