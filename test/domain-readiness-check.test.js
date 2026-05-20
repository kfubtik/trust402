import test from "node:test";
import assert from "node:assert/strict";
import { domainReadinessCheck } from "../src/domainReadinessCheck.js";

test("domainReadinessCheck verifies an attached custom domain without mutations", async () => {
  const result = await domainReadinessCheck({
    domain: "trust402.dev",
    expectedBaseUrl: "https://trust402.dev",
    timeoutMs: 1000
  }, {
    config: { publicBaseUrl: "https://trust402.vercel.app" },
    resolver: async () => ({
      cname: ["cname.vercel-dns.com"],
      a: [],
      aaaa: []
    }),
    fetch: readyFetch("https://trust402.dev")
  });

  assert.equal(result.status, "ready");
  assert.match(result.readinessHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.policy.acceptedByPolicy, true);
  assert.equal(result.checks.dns.ok, true);
  assert.equal(result.checks.health.body.service, "Trust402");
  assert.equal(result.checks.wellKnown.discovery.resourcesUseExpectedBaseUrl, true);
  assert.equal(result.checks.x402Challenge.httpStatus, 402);
  assert.equal(result.checks.x402Challenge.resourceUsesExpectedBaseUrl, true);
  assert.equal(result.safety.mutatesVercel, false);
  assert.equal(result.safety.setsEnv, false);
  assert.equal(result.safety.sendsPaymentHeaders, false);
  assert.equal(result.evidenceEnv.PUBLIC_BASE_URL, "https://trust402.dev");
});

test("domainReadinessCheck blocks stale PUBLIC_BASE_URL discovery", async () => {
  const result = await domainReadinessCheck({
    domain: "trust402.dev",
    expectedBaseUrl: "https://trust402.dev",
    timeoutMs: 1000
  }, {
    config: { publicBaseUrl: "https://trust402.vercel.app" },
    resolver: async () => ({ cname: ["cname.vercel-dns.com"], a: [], aaaa: [] }),
    fetch: readyFetch("https://trust402.vercel.app")
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((item) => item.id === "public_base_url_not_updated"));
  assert.ok(result.blockers.some((item) => item.id === "x402_challenge_resource_mismatch"));
});

test("domainReadinessCheck blocks free-hosting domains", async () => {
  const result = await domainReadinessCheck({
    domain: "trust402.vercel.app",
    skipDns: true
  }, {
    config: { publicBaseUrl: "https://trust402.vercel.app" },
    fetch: readyFetch("https://trust402.vercel.app")
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((item) => item.id === "custom_domain_free_hosting"));
});

function readyFetch(resourceBaseUrl) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/health") {
      return jsonResponse(200, { ok: true, service: "Trust402" });
    }
    if (parsed.pathname === "/.well-known/x402") {
      return jsonResponse(200, {
        resources: [`${resourceBaseUrl}/api/trust/score-resource`],
        endpoints: [{ path: "/api/trust/score-resource", url: `${resourceBaseUrl}/api/trust/score-resource` }],
        openapi: `${resourceBaseUrl}/openapi.json`
      });
    }
    if (parsed.pathname === "/api/trust/score-resource" && options.method === "POST") {
      return jsonResponse(402, {
        ok: false,
        x402Version: 2
      }, {
        "payment-required": Buffer.from(JSON.stringify({
          x402Version: 2,
          accepts: [{ resource: `${resourceBaseUrl}/api/trust/score-resource` }]
        })).toString("base64url")
      });
    }
    return jsonResponse(404, { ok: false });
  };
}

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    headers: new Headers({
      "content-type": "application/json",
      ...headers
    }),
    async text() {
      return JSON.stringify(body);
    }
  };
}
