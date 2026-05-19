import test from "node:test";
import assert from "node:assert/strict";
import { hashResult } from "../src/receipts.js";
import { notarizeResult } from "../src/proof402Client.js";

test("hashResult creates a proof-ready dry-run receipt bundle", () => {
  const result = hashResult({
    subject: "sample",
    payload: { score: 88, recommendation: "use" }
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "receipts.hash_result");
  assert.match(result.resultHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.receiptBundle.resultHash, result.resultHash);
  assert.equal(result.receiptBundle.proofProvider, "Proof402");
  assert.equal(result.receiptBundle.policy.liveSpendEnabled, false);
  assert.equal(result.receiptBundle.delegation.paidProofCallMade, false);
});

test("hashResult warns when supplied hash does not match payload", () => {
  const result = hashResult({
    subject: "sample",
    resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    payload: { score: 1 }
  });

  assert.equal(result.resultHash, "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(result.consistency.matchesPayload, false);
  assert.equal(result.consistency.warnings.length, 1);
});

test("notarizeResult previews a Proof402 request without a paid proof call", async () => {
  const result = await notarizeResult(
    {
      subject: "sample",
      payload: { score: 88, recommendation: "use" },
      label: "Trust402 sample",
      metadata: {
        taskId: "task_123",
        apiKey: "do-not-forward"
      }
    },
    {
      config: testConfig({
        proof402BaseUrl: "https://proof402.vercel.app",
        proof402DelegationMode: "disabled"
      })
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.tool, "receipts.notarize_result");
  assert.equal(result.proofStatus, "preview-only");
  assert.equal(result.delegation.paidProofCallMade, false);
  assert.equal(result.delegation.unpaidProbeMade, false);
  assert.equal(result.proofRequest.url, "https://proof402.vercel.app/api/proof/notarize");
  assert.equal(result.proofRequest.body.contentHash, result.resultHash);
  assert.equal(result.proofRequest.body.metadata.taskId, "task_123");
  assert.equal(result.proofRequest.body.metadata.apiKey, undefined);
  assert.ok(result.consistency.warnings.some((warning) => warning.includes("metadata.apiKey")));
});

test("notarizeResult probe makes only unpaid Proof402 calls", async () => {
  const calls = [];
  const result = await notarizeResult(
    {
      resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      proof402Mode: "probe"
    },
    {
      config: testConfig({
        proof402BaseUrl: "https://proof402.vercel.app",
        proof402DelegationMode: "probe"
      }),
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        if (String(url).endsWith("/health")) {
          return jsonResponse(200, { ok: true, service: "Proof402" });
        }
        return jsonResponse(402, { ok: false, error: { code: "payment_required" } }, {
          "payment-required": "mock-challenge"
        });
      }
    }
  );

  assert.equal(result.delegation.mode, "probe");
  assert.equal(result.delegation.paidProofCallMade, false);
  assert.equal(result.delegation.unpaidProbeMade, true);
  assert.equal(result.delegation.probe.notarize.status, 402);
  assert.equal(result.delegation.probe.notarize.paymentRequiredHeaderPresent, true);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const headers = call.options.headers || {};
    assert.equal(headers.authorization, undefined);
    assert.equal(headers["payment-signature"], undefined);
    assert.equal(headers["x-payment"], undefined);
  }
});

test("notarizeResult blocks live paid Proof402 delegation", async () => {
  await assert.rejects(
    () => notarizeResult(
      {
        resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        proof402Mode: "live"
      },
      {
        config: testConfig({
          proof402BaseUrl: "https://proof402.vercel.app",
          proof402DelegationMode: "live",
          liveSpendEnabled: false,
          proof402MaxSpendUsd: 0
        })
      }
    ),
    /Live Proof402 delegation is blocked by policy/
  );
});

test("notarizeResult can complete live Proof402 delegation through injected paid fetch", async () => {
  const calls = [];
  const result = await notarizeResult(
    {
      resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      proof402Mode: "live",
      metadata: {
        taskId: "paid_proof_test"
      }
    },
    {
      operatorAuthorized: true,
      config: testConfig({
        proof402BaseUrl: "https://proof402.vercel.app",
        proof402DelegationMode: "live",
        liveSpendEnabled: true,
        proof402MaxSpendUsd: 0.01,
        livePaymentProvider: "external-adapter",
        livePaymentAdapterUrl: "https://pay.example/bridge",
        operatorApiKey: "test-operator"
      }),
      paidFetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        return jsonResponse(200, {
          ok: true,
          proofLink: "https://proof402.vercel.app/proof/mock-proof"
        }, {
          "payment-response": "mock-paid-proof"
        });
      }
    }
  );

  assert.equal(result.mode, "live");
  assert.equal(result.delegation.paidProofCallMade, true);
  assert.equal(result.delegation.paymentResponseObserved, true);
  assert.equal(result.proofLink, "https://proof402.vercel.app/proof/mock-proof");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers["x-trust402-max-amount-usd"], "0.01");
});

function testConfig(overrides = {}) {
  return {
    publicBaseUrl: "https://trust402.example",
    proof402BaseUrl: "",
    proof402DelegationMode: "disabled",
    proof402MaxSpendUsd: 0,
    liveSpendEnabled: false,
    livePaymentProvider: "disabled",
    operatorApiKey: "",
    emergencyStop: false,
    requestTimeoutMs: 100,
    ...overrides
  };
}

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}
