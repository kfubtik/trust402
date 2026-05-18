const baseUrl = (process.argv[2] || "http://127.0.0.1:4032").replace(/\/$/, "");

async function main() {
  const health = await getJson("/health");
  assert(health.ok === true, "/health ok mismatch");
  assert(health.liveSpendEnabled === false, "/health must keep liveSpendEnabled=false");

  const resources = await getJson("/api/resources");
  assert(resources.paidLaunchResources?.length === 7, "/api/resources expected 7 launch resources");

  const status = await getJson("/api/status");
  assert(status.launchReadiness?.readyForGitHub === true, "/api/status readyForGitHub mismatch");
  assert(status.launchReadiness?.readyForLiveSpend === false, "/api/status readyForLiveSpend must be false");

  const openapi = await getJson("/openapi.json");
  assert(openapi.openapi === "3.1.0", "/openapi.json version mismatch");
  assert(openapi.paths?.["/api/trust/check-x402"]?.post, "/openapi missing check-x402");
  assert(openapi.paths?.["/api/receipts/hash-result"]?.post, "/openapi missing hash-result");

  const score = await postJson("/api/trust/score-resource", {
    endpoint: "https://example.com/api/paid",
    priceUsd: 0.01,
    has402: true,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true,
    payTo: "0x1111111111111111111111111111111111111111",
    network: "eip155:8453",
    asset: "USDC",
    description: "Structured paid x402 resource for autonomous agents.",
    receiptReady: true
  });
  assert(score.recommendation === "use", "/api/trust/score-resource expected use");

  const plan = await postJson("/api/procurement/plan", {
    goal: "Buy the safest x402 endpoint intelligence resource.",
    budgetUsd: 0.25,
    maxPaidCalls: 5,
    riskTolerance: "low"
  });
  assert(plan.policy?.mode === "plan-only", "/api/procurement/plan must be plan-only");

  const receipt = await postJson("/api/receipts/hash-result", {
    subject: "smoke result",
    payload: { recommendation: "use", score: 88 }
  });
  assert(receipt.receiptBundle?.delegation?.paidProofCallMade === false, "/api/receipts/hash-result must not call Proof402");

  console.log(`Trust402 smoke passed for ${baseUrl}`);
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return parseJson(response, path);
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseJson(response, path);
}

async function parseJson(response, path) {
  const body = await response.json();
  assert(response.ok, `${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
