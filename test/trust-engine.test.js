import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  checkX402,
  compareResources,
  evaluateOrigin,
  sellerReadiness,
  x402Diligence
} from "../src/trustEngine.js";

async function withMockOrigin(fn) {
  const server = createServer((req, res) => {
    if (req.url === "/api/paid") {
      res.statusCode = 402;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "10000",
            payTo: "0x1111111111111111111111111111111111111111"
          }
        ]
      }));
      return;
    }

    if (req.url === "/openapi.json") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        openapi: "3.1.0",
        info: {
          title: "Mock x402 Origin",
          version: "1.0.0",
          description: "Mock origin for Trust402 tests."
        },
        paths: {
          "/api/paid": {
            post: {
              "x-payment-info": {
                price: { mode: "fixed", amount: "0.01", currency: "USD" }
              },
              requestBody: {
                content: {
                  "application/json": {
                    schema: { type: "object" }
                  }
                }
              }
            }
          }
        },
        components: {
          securitySchemes: {
            x402: { type: "apiKey", in: "header", name: "X-Payment" }
          }
        }
      }));
      return;
    }

    if (req.url === "/.well-known/x402") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        version: 1,
        name: "Mock x402 Origin",
        resources: ["POST /api/paid"],
        instructions: "Pay with x402 after checking the challenge."
      }));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("checkX402 parses unpaid 402 challenge", async () => {
  await withMockOrigin(async (origin) => {
    const result = await checkX402({ endpoint: `${origin}/api/paid`, method: "POST" });
    assert.equal(result.ok, true);
    assert.equal(result.observed.status, 402);
    assert.equal(result.recommendation, "payment-flow-ready");
    assert.equal(result.x402.accepts[0].network, "eip155:8453");
  });
});

test("checkX402 strips payment and secret headers from unpaid probes", async () => {
  let capturedHeaders;
  const responseBody = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: "10000",
        payTo: "0x1111111111111111111111111111111111111111"
      }
    ]
  };

  const result = await checkX402(
    {
      endpoint: "https://example.com/api/paid",
      method: "GET",
      headers: {
        "X-Payment": "do-not-send",
        Authorization: "Bearer do-not-send",
        "X-Trace-Id": "trace-123"
      }
    },
    {
      fetchImpl: async (_url, options) => {
        capturedHeaders = options.headers;
        return new Response(JSON.stringify(responseBody), {
          status: 402,
          headers: { "content-type": "application/json" }
        });
      }
    }
  );

  assert.equal(capturedHeaders["X-Payment"], undefined);
  assert.equal(capturedHeaders.Authorization, undefined);
  assert.equal(capturedHeaders["X-Trace-Id"], "trace-123");
  assert.equal(result.policy.sentPaymentHeader, false);
  assert.deepEqual(result.policy.droppedSensitiveHeaders, ["X-Payment", "Authorization"]);
});

test("evaluateOrigin scores OpenAPI and well-known discovery", async () => {
  await withMockOrigin(async (origin) => {
    const result = await evaluateOrigin({ origin });
    assert.equal(result.ok, true);
    assert.equal(result.tool, "trust.evaluate_origin");
    assert.ok(result.score >= 80);
    assert.equal(result.discovery.openapi.pathCount, 1);
    assert.equal(result.discovery.wellKnown.resourceCount, 1);
  });
});

test("sellerReadiness returns checklist and tags", async () => {
  await withMockOrigin(async (origin) => {
    const result = await sellerReadiness({
      origin,
      endpoint: `${origin}/api/paid`,
      priceUsd: 0.01,
      has402: true,
      hasInputSchema: true,
      payTo: "0x1111111111111111111111111111111111111111",
      network: "eip155:8453",
      asset: "USDC",
      description: "Mock paid endpoint with structured output."
    });
    assert.equal(result.tool, "seller.readiness");
    assert.ok(result.recommendedTags.includes("x402"));
    assert.ok(Array.isArray(result.launchChecklist));
  });
});

test("compareResources ranks by trust and budget fit", () => {
  const result = compareResources({
    goal: "Choose a safe x402 resource.",
    budgetUsd: 0.02,
    candidates: [
      {
        id: "good",
        endpoint: "https://example.com/good",
        priceUsd: 0.01,
        has402: true,
        hasInputSchema: true,
        hasOpenApi: true,
        hasWellKnown: true,
        payTo: "0x1111111111111111111111111111111111111111",
        network: "eip155:8453",
        asset: "USDC",
        description: "Good structured endpoint for x402 buyers.",
        receiptReady: true
      },
      {
        id: "weak",
        endpoint: "https://example.com/weak",
        priceUsd: 0.04
      }
    ]
  });

  assert.equal(result.ranked[0].id, "good");
  assert.equal(result.recommendation.id, "good");
  assert.equal(result.avoid[0].id, "weak");
});

test("x402Diligence returns hash-ready evidence report", async () => {
  await withMockOrigin(async (origin) => {
    const result = await x402Diligence({
      origin,
      endpoint: `${origin}/api/paid`,
      method: "POST",
      priceUsd: 0.01,
      hasInputSchema: true,
      hasOpenApi: true,
      hasWellKnown: true,
      payTo: "0x1111111111111111111111111111111111111111",
      network: "eip155:8453",
      asset: "USDC",
      description: "Mock paid endpoint with structured output.",
      receiptReady: true
    });

    assert.equal(result.tool, "reports.x402_diligence");
    assert.match(result.evidenceHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(result.receiptBundle.resultHash, result.evidenceHash);
    assert.equal(result.receiptBundle.proofProvider, "Proof402");
    assert.equal(result.receiptBundle.delegation.paidProofCallMade, false);
    assert.equal(result.policy.liveSpendEnabled, false);
  });
});
