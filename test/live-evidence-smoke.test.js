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

test("liveEvidenceSmoke builds Proof402 candidate body without private payload", async () => {
  const calls = [];
  const result = await liveEvidenceSmoke({
    baseUrl: "https://trust402.example",
    candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
    candidatePriceUsd: 0.005,
    proofReserveUsd: 0.005,
    maxTotalUsd: 0.015,
    includeAutonomous: false
  }, {
    fetchImpl: fakeFetch(calls)
  });

  assert.equal(result.mode, "dry-run");
  const executeCall = calls.find((call) => new URL(call.url).pathname === "/api/procurement/execute");
  const resource = executeCall.body.quote.quote.selectedResources[0];
  assert.equal(resource.id, "proof402.notarize");
  assert.equal(resource.requestBody.label, "Trust402 live procurement smoke");
  assert.match(resource.requestBody.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(resource.requestBody.idempotencyKey, /^trust402-live-smoke-/);
  assert.equal(resource.requestBody.metadata.privatePayload, false);
  assert.equal(JSON.stringify(resource.requestBody).includes("private payload"), false);
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
  assert.ok(result.stages.some((item) => item.id === "payment_bridge_preflight" && item.status === "passed"));
  assert.equal(result.stages.find((item) => item.id === "procurement_execute")?.details.settlementEvidenceComplete, true);
  assert.equal(result.stages.find((item) => item.id === "autonomous_job")?.details.settlementEvidenceComplete, true);
  assert.equal(result.safety.paymentBridgePreflightRequired, true);
  assert.equal(result.safety.paymentBridgePreflightPassed, true);
  assert.ok(calls.some((call) => new URL(call.url).pathname === "/api/payments/bridge-check"));
  assert.ok(calls.some((call) => call.headers?.["x-trust402-operator-key"] === "test-operator"));
});

test("liveEvidenceSmoke does not suggest live evidence env without call-level settlement evidence", async () => {
  const result = await liveEvidenceSmoke({
    baseUrl: "https://trust402.example",
    mode: "live",
    approved: true,
    operatorKey: "test-operator",
    candidateEndpoint: "https://resource.example/paid",
    candidatePriceUsd: 0.01,
    maxTotalUsd: 0.05,
    includeProof: false,
    includeAutonomous: true
  }, {
    fetchImpl: fakeFetch([], {
      liveExecutionCalls: [],
      liveAutonomousCalls: []
    }),
    localAgentcashPolicyResult: approvedLocalPolicyResult()
  });

  assert.equal(result.mode, "live");
  assert.equal(result.evidenceRefs.liveProcurement, null);
  assert.equal(result.evidenceRefs.autonomousJob, null);
  assert.equal(result.suggestedEnv, null);
  assert.equal(result.stages.find((item) => item.id === "procurement_execute")?.details.settlementEvidenceComplete, false);
  assert.equal(result.stages.find((item) => item.id === "autonomous_job")?.details.settlementEvidenceComplete, false);
  assert.ok(result.nextActions.some((item) => item.includes("Live procurement evidence was not produced")));
});

test("liveEvidenceSmoke blocks live mode when bridge preflight cannot prove dry-run safety", async () => {
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
      fetchImpl: fakeFetch([], {
        bridgePreflight: {
          ok: true,
          status: "failed",
          passed: false,
          blockers: [{ id: "payment_bridge_dry_run_not_confirmed", message: "No dry-run confirmation." }]
        }
      }),
      localAgentcashPolicyResult: approvedLocalPolicyResult()
    }),
    (error) => {
      assert.equal(error.code, "payment_bridge_preflight_failed");
      assert.ok(error.details.blockers.some((item) => item.id === "payment_bridge_dry_run_not_confirmed"));
      return true;
    }
  );
});

function fakeFetch(calls, behavior = {}) {
  return async (url, requestOptions = {}) => {
    calls.push({
      url: String(url),
      method: requestOptions.method || "GET",
      headers: requestOptions.headers || {},
      body: requestOptions.body ? JSON.parse(requestOptions.body) : null
    });
    const path = new URL(url).pathname;
    if (path === "/api/policies/spend") {
      return json({
        ok: true,
        readiness: {
          liveProcurementReady: true,
          proof402DelegationReady: true,
          agentcashAutoRefillReady: false
        },
        policies: {
          liveProcurement: {
            controls: {
              paymentAdapter: {
                provider: "agentcash-mcp",
                adapterUrlConfigured: true,
                bridgeContract: {
                  provider: "agentcash-mcp",
                  endpointEnv: "LIVE_PAYMENT_ADAPTER_URL"
                }
              }
            }
          }
        }
      });
    }
    if (path === "/api/payments/bridge-check") {
      return json(behavior.bridgePreflight || {
        ok: true,
        tool: "payments.bridge_check",
        status: "passed",
        passed: true,
        provider: "agentcash-mcp",
        bridgeRequestHash: "sha256:bridge-preflight",
        readiness: { adapterUrlConfigured: true },
        safety: {
          paidSubcallsMade: 0,
          sendsPaymentHeaders: false
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
      const live = JSON.parse(requestOptions.body).mode === "live";
      const liveCalls = behavior.liveExecutionCalls ?? [{
        id: "resource",
        endpoint: "https://resource.example/paid",
        paymentResponseObserved: true,
        paymentResponseHash: "sha256:paid-procurement"
      }];
      return json({
        ok: true,
        mode: live ? "live" : "dry-run",
        executionHash: live ? "sha256:live-execution" : "sha256:dry-execution",
        paidSubcallsMade: live ? 1 : 0,
        result: {
          status: live ? "executed" : "not-executed",
          calls: live ? liveCalls : []
        }
      });
    }
    if (path === "/api/receipts/notarize-result") {
      const live = JSON.parse(requestOptions.body).proof402Mode === "live";
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
      const live = JSON.parse(requestOptions.body).mode === "live";
      const liveCalls = behavior.liveAutonomousCalls ?? [{
        id: "resource",
        endpoint: "https://resource.example/paid",
        paymentResponseObserved: true,
        paymentResponseHash: "sha256:paid-autonomous"
      }];
      return json({
        ok: true,
        mode: live ? "live" : "dry-run",
        resultHash: live ? "sha256:live-autonomous" : "sha256:dry-autonomous",
        execution: {
          mode: live ? "live" : "dry-run",
          paidSubcallsMade: live ? 1 : 0,
          result: {
            calls: live ? liveCalls : []
          }
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
          "https://proof402.vercel.app",
          "https://resource.example"
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
