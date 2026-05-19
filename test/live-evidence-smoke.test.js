import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("liveEvidenceSmoke can write a public-safe local evidence ledger", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "trust402-live-ledger-"));
  const result = await liveEvidenceSmoke({
    baseUrl: "https://trust402.example",
    includeAutonomous: false
  }, {
    fetchImpl: fakeFetch([]),
    cwd,
    writeEvidenceLedger: true,
    evidenceLedgerDir: ".local/evidence-ledger-test"
  });

  assert.equal(result.evidenceLedger.written, true);
  assert.match(result.evidenceLedger.recordHash, /^sha256:[a-f0-9]{64}$/);
  const line = readFileSync(join(cwd, result.evidenceLedger.ledgerPath), "utf8").trim();
  const record = JSON.parse(line);
  assert.equal(record.evidenceHash, result.evidenceHash);
  assert.equal(record.safety.includesSecretValues, false);
  assert.equal(JSON.stringify(record).includes("test-operator"), false);
});

test("liveEvidenceSmoke blocks live mode without runner approval gates", async () => {
  await assert.rejects(
    liveEvidenceSmoke({
      baseUrl: "https://trust402.example",
      mode: "live",
      candidateEndpoint: "https://resource.example/paid",
      candidatePriceUsd: 0.01,
      maxTotalUsd: 0.05
    }, {
      fetchImpl: fakeFetch([]),
      localAgentcashPolicyResult: approvedLocalPolicyResult()
    }),
    (error) => {
      assert.equal(error.code, "live_evidence_smoke_blocked");
      assert.ok(error.details.blockers.some((item) => item.includes("TRUST402_LIVE_EVIDENCE_SMOKE_APPROVED")));
      return true;
    }
  );
});

test("liveEvidenceSmoke blocks live mode when local AgentCash policy has no smoke budget", async () => {
  await assert.rejects(
    liveEvidenceSmoke({
      baseUrl: "https://trust402.example",
      mode: "live",
      approved: true,
      operatorKey: "test-operator",
      candidateEndpoint: "https://resource.example/paid",
      candidatePriceUsd: 0.01,
      maxTotalUsd: 0.05
    }, {
      fetchImpl: fakeFetch([]),
      localAgentcashPolicyResult: approvedLocalPolicyResult({ manualSmokeRemainingBudgetUsd: 0 })
    }),
    (error) => {
      assert.equal(error.code, "live_evidence_smoke_blocked");
      assert.ok(error.details.blockers.some((item) => item.includes("local_manual_smoke_budget_exhausted")));
      return true;
    }
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
    fetchImpl: fakeFetch(calls),
    localAgentcashPolicyResult: approvedLocalPolicyResult()
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

function approvedLocalPolicyResult(overrides = {}) {
  const manualSmokeRemainingBudgetUsd = overrides.manualSmokeRemainingBudgetUsd ?? 0.10;
  return {
    present: true,
    policyPath: ".local/trust402-agentcash-wallet.json",
    failures: [],
    policy: {
      service: "Trust402",
      status: "dedicated-for-trust402-operator-spend",
      wallet: {
        provider: "AgentCash",
        network: "base",
        address: "0x1111111111111111111111111111111111111111"
      },
      restrictions: {
        allowedProjectRoot: process.cwd(),
        allowedOrigins: [
          "https://trust402.example",
          "https://proof402.vercel.app"
        ],
        trust402LiveProcurement: "approved-for-manual-smoke",
        proof402Delegation: "approved-for-manual-smoke"
      },
      limits: {
        agentcashGlobalMaxAmountUsd: 0.10,
        manualSmokeRemainingBudgetUsd,
        lastVerifiedBalanceUsd: 1.20,
        minimumReserveUsd: 0.50,
        autoRefill: {
          enabled: false,
          futureThresholdUsd: 0.50
        }
      }
    }
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
