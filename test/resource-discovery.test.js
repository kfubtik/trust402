import test from "node:test";
import assert from "node:assert/strict";
import { discoverResourceCandidates } from "../src/resourceDiscovery.js";

test("discoverResourceCandidates returns trusted seed candidates without spending", async () => {
  const result = await discoverResourceCandidates({
    goal: "Create a proof-backed receipt.",
    budgetUsd: 0.02
  }, {
    config: {
      x402Network: "eip155:8453",
      x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  });

  assert.equal(result.tool, "registries.candidates");
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.safety.paidSubcallsMade, 0);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "proof402.notarize");
  assert.equal(result.candidates[0].requestBody.privatePayload, undefined);
  assert.match(result.candidates[0].requestBody.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.discoveryHash, /^sha256:[a-f0-9]{64}$/);
});

test("discoverResourceCandidates prefers explicit candidates without merging seed by default", async () => {
  const result = await discoverResourceCandidates({
    goal: "Cheap check",
    budgetUsd: 0.02,
    candidates: [
      {
        id: "freeish",
        endpoint: "https://candidate.example/freeish",
        priceUsd: 0.001,
        has402: true
      }
    ]
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "freeish");
  assert.equal(result.candidates[0].source, "input.candidates");
  assert.equal(result.summary.includeSeedRegistry, false);
});

test("discoverResourceCandidates can fetch an allowlisted registry without payment headers", async () => {
  const observed = [];
  const result = await discoverResourceCandidates({
    goal: "Find an allowlisted registry resource.",
    budgetUsd: 0.02,
    registryUrls: ["https://registry.example/catalog.json"],
    allowedRegistryOrigins: ["https://registry.example"]
  }, {
    config: {
      requestTimeoutMs: 100,
      maxJsonBytes: 10000,
      discoveryRegistryUrls: [],
      discoveryRegistryAllowlist: []
    },
    fetchImpl: async (url, init) => {
      observed.push({ url, init });
      return new Response(JSON.stringify({
        resources: [{
          id: "registry-proof",
          path: "/api/proof",
          method: "POST",
          priceUsd: 0.01,
          has402: true,
          hasInputSchema: true,
          hasOpenApi: true,
          hasWellKnown: true,
          payTo: "0x1111111111111111111111111111111111111111",
          network: "eip155:8453",
          asset: "USDC",
          description: "Registry supplied proof resource for Trust402 selection.",
          receiptReady: true
        }]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(observed.length, 1);
  assert.equal(observed[0].init.method, "GET");
  assert.deepEqual(Object.keys(observed[0].init.headers).sort(), ["accept", "user-agent"]);
  assert.equal(result.safety.fetchesExternalRegistries, true);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.summary.fetchedRegistryCandidates, 1);
  assert.equal(result.summary.includeSeedRegistry, false);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "registry-proof");
  assert.equal(result.candidates[0].endpoint, "https://registry.example/api/proof");
  assert.equal(result.candidates[0].source, "registry:https://registry.example");
  assert.equal(result.candidates[0].has402, true);
  assert.equal(result.candidates[0].hasOpenApi, true);
  assert.equal(result.candidates[0].hasWellKnown, true);
});

test("discoverResourceCandidates normalizes x402-list service rows", async () => {
  const result = await discoverResourceCandidates({
    goal: "Find random external Base agents.",
    budgetUsd: 0.02,
    registryUrls: ["https://x402-list.com/api/v1/services"],
    allowedRegistryOrigins: ["https://x402-list.com"],
    useSeedRegistry: false
  }, {
    config: {
      requestTimeoutMs: 100,
      maxJsonBytes: 10000,
      discoveryRegistryUrls: [],
      discoveryRegistryAllowlist: [],
      x402Network: "eip155:8453",
      x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    },
    fetchImpl: async () => new Response(JSON.stringify({
      data: [{
        slug: "askew",
        name: "Askew",
        description: "Security and DeFi intelligence for AI agents with live yield comparison and x402 payments.",
        base_url: "https://x402.askew.network",
        status: "online",
        endpoint_count: 5,
        min_price_usd: "0.0020000000",
        networks: ["BSE"],
        uptime_24h: 100
      }, {
        slug: "offline-agent",
        name: "Offline Agent",
        base_url: "https://offline.example",
        status: "offline",
        min_price_usd: "0.0010000000"
      }]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });

  assert.equal(result.summary.fetchedRegistryCandidates, 1);
  assert.equal(result.candidates[0].id, "Askew");
  assert.equal(result.candidates[0].endpoint, "https://x402.askew.network");
  assert.equal(result.candidates[0].priceUsd, 0.002);
  assert.equal(result.candidates[0].network, "eip155:8453");
  assert.equal(result.candidates[0].hasInputSchema, true);
});

test("discoverResourceCandidates normalizes CDP Bazaar search resources", async () => {
  const result = await discoverResourceCandidates({
    goal: "Find random CDP Bazaar agents.",
    budgetUsd: 0.02,
    registryUrls: ["https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=agent&network=eip155:8453&maxUsdPrice=0.02&limit=5"],
    allowedRegistryOrigins: ["https://api.cdp.coinbase.com"],
    useSeedRegistry: false,
    randomizeCandidates: true,
    randomSeed: "test-seed"
  }, {
    config: {
      requestTimeoutMs: 100,
      maxJsonBytes: 10000,
      discoveryRegistryUrls: [],
      discoveryRegistryAllowlist: [],
      x402Network: "eip155:8453",
      x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    },
    fetchImpl: async () => new Response(JSON.stringify({
      resources: [{
        resource: "https://api.example.com/agent",
        description: "Agent profile lookup with trust score and metadata for any ERC-8004 agent.",
        accepts: [{
          amount: "1000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          network: "eip155:8453",
          payTo: "0x1111111111111111111111111111111111111111"
        }],
        extensions: {
          bazaar: {
            schema: { type: "object", properties: {} }
          }
        }
      }]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });

  assert.equal(result.summary.fetchedRegistryCandidates, 1);
  assert.equal(result.candidates[0].endpoint, "https://api.example.com/agent");
  assert.equal(result.candidates[0].priceUsd, 0.001);
  assert.equal(result.candidates[0].payTo, "0x1111111111111111111111111111111111111111");
  assert.equal(result.candidates[0].hasInputSchema, true);
});

test("discoverResourceCandidates blocks unallowlisted registry URLs before fetch", async () => {
  const result = await discoverResourceCandidates({
    goal: "Blocked registry fetch.",
    budgetUsd: 0.001,
    registryUrls: ["https://untrusted.example/catalog.json"],
    useSeedRegistry: false
  }, {
    config: {
      requestTimeoutMs: 100,
      maxJsonBytes: 10000,
      discoveryRegistryUrls: [],
      discoveryRegistryAllowlist: []
    },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  assert.equal(result.safety.fetchesExternalRegistries, true);
  assert.equal(result.registryFetches[0].status, "blocked");
  assert.equal(result.registryFetches[0].reason, "registry_url_not_allowlisted");
  assert.ok(result.blockers.some((blocker) => blocker.id === "registry_url_not_allowlisted"));
});
