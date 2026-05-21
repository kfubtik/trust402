import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createTrust402ExpressApp } from "../src/expressApp.js";
import { handleTrust402Entrypoint } from "../src/server.js";

async function withExpressApp(options, fn) {
  const app = await createTrust402ExpressApp(options);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function withServerlessEntrypoint(options, fn) {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => handleTrust402Entrypoint(req, res, options));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

test("Express entrypoint serves normal demo traffic", async () => {
  await withExpressApp({ config: testConfig() }, async (baseUrl) => {
    const landing = await request(baseUrl, "/");
    assert.equal(landing.response.status, 200);
    assert.match(landing.response.headers.get("content-type") || "", /text\/html/);
    assert.match(landing.body, /Trust before you pay/);

    const health = await request(baseUrl, "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, "Trust402");

    const score = await request(baseUrl, "/api/trust/score-resource", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://example.com/api/paid",
        priceUsd: 0.01,
        has402: true,
        hasInputSchema: true
      })
    });
    assert.equal(score.response.status, 200);
    assert.equal(score.body.tool, "trust.score_resource");
  });
});

test("Express real mode fails closed for protected routes when settlement is not ready", async () => {
  await withExpressApp({
    config: testConfig({
      paywallMode: "real",
      realSettlementEnabled: true,
      publicBaseUrl: "https://trust402.example",
      payTo: "0x1111111111111111111111111111111111111111",
      facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402"
    })
  }, async (baseUrl) => {
    const health = await request(baseUrl, "/health");
    assert.equal(health.response.status, 200);

    const protectedRoute = await request(baseUrl, "/api/trust/score-resource", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(protectedRoute.response.status, 503);
    assert.equal(protectedRoute.body.error.code, "real_settlement_not_ready");
    assert.ok(protectedRoute.body.error.details.blockers.some((item) => item.id === "cdp_credentials_configured"));
  });
});

test("Express real mode returns an unpaid x402 challenge when guards are satisfied", async () => {
  await withMockFacilitator(async (facilitatorUrl) => {
    await withExpressApp({
      config: testConfig({
        paywallMode: "real",
        realSettlementEnabled: true,
        publicBaseUrl: "https://trust402.example",
        payTo: "0x1111111111111111111111111111111111111111",
        facilitatorUrl
      })
    }, async (baseUrl) => {
      const protectedRoute = await request(baseUrl, "/api/trust/score-resource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });

      assert.equal(protectedRoute.response.status, 402);
      assert.ok(protectedRoute.response.headers.get("payment-required"));
    });
  });
});

test("Express real mode preserves forwarded HTTPS origin in x402 resource URL", async () => {
  await withMockFacilitator(async (facilitatorUrl) => {
    await withExpressApp({
      config: testConfig({
        paywallMode: "real",
        realSettlementEnabled: true,
        publicBaseUrl: "https://trust402.example",
        payTo: "0x1111111111111111111111111111111111111111",
        facilitatorUrl
      })
    }, async (baseUrl) => {
      const protectedRoute = await request(baseUrl, "/api/trust/score-resource", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-host": "trust402.example",
          "x-forwarded-proto": "https"
        },
        body: JSON.stringify({})
      });

      assert.equal(protectedRoute.response.status, 402);
      const paymentRequired = protectedRoute.response.headers.get("payment-required");
      assert.ok(paymentRequired);
      const challenge = JSON.parse(Buffer.from(paymentRequired, "base64url").toString("utf8"));
      assert.equal(challenge.resource.url, "https://trust402.example/api/trust/score-resource");
      assert.equal(challenge.extensions.bazaar.info.input.method, "POST");
    });
  });
});

test("serverless entrypoint routes real mode through x402 middleware", async () => {
  await withMockFacilitator(async (facilitatorUrl) => {
    await withServerlessEntrypoint({
      config: testConfig({
        paywallMode: "real",
        realSettlementEnabled: true,
        publicBaseUrl: "https://trust402.example",
        payTo: "0x1111111111111111111111111111111111111111",
        facilitatorUrl
      })
    }, async (baseUrl) => {
      const protectedRoute = await request(baseUrl, "/api/trust/score-resource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });

      assert.equal(protectedRoute.response.status, 402);
      assert.ok(protectedRoute.response.headers.get("payment-required"));
    });
  });
});

async function withMockFacilitator(fn) {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/supported") {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
        extensions: [],
        signers: {}
      }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
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

function testConfig(overrides = {}) {
  return {
    serviceName: "Trust402",
    version: "0.1.0",
    defaultMode: "dry-run",
    paywallMode: "demo",
    publicBaseUrl: "http://127.0.0.1:4032",
    x402Network: "eip155:8453",
    x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x0000000000000000000000000000000000000000",
    facilitatorUrl: "",
    cdpApiKeyIdConfigured: false,
    cdpApiKeySecretConfigured: false,
    realSettlementEnabled: false,
    successfulSettlementObserved: false,
    maxJsonBytes: 131072,
    ...overrides
  };
}
