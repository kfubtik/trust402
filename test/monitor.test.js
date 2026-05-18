import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { monitorBadge, monitorSnapshot } from "../src/monitor.js";

async function withMockEndpoint(fn) {
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

test("monitorSnapshot creates one-shot snapshot without storing history", async () => {
  await withMockEndpoint(async (origin) => {
    const result = await monitorSnapshot({
      endpoint: `${origin}/api/paid`,
      method: "POST",
      expectedStatus: 402,
      priceUsd: 0.01,
      hasInputSchema: true,
      hasOpenApi: true,
      hasWellKnown: true,
      payTo: "0x1111111111111111111111111111111111111111",
      network: "eip155:8453",
      asset: "USDC",
      description: "Mock endpoint for monitor snapshot tests.",
      receiptReady: true
    });

    assert.equal(result.tool, "monitor.snapshot");
    assert.equal(result.mode, "one-shot");
    assert.match(result.snapshotHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(result.policy.storesHistory, false);
    assert.equal(result.policy.paidSubcallsMade, 0);
  });
});

test("monitorBadge creates a badge payload from a snapshot", async () => {
  await withMockEndpoint(async (origin) => {
    const result = await monitorBadge({
      endpoint: `${origin}/api/paid`,
      method: "POST",
      label: "Trust402"
    });

    assert.equal(result.tool, "monitor.badge");
    assert.equal(result.mode, "one-shot");
    assert.match(result.badge.markdown, /Trust402/);
    assert.match(result.badgeHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(result.policy.storesHistory, false);
  });
});
