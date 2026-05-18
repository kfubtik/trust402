const baseUrl = (process.argv[2] || "http://127.0.0.1:4032").replace(/\/+$/, "");
const path = process.argv[3] || "/api/trust/score-resource";

const response = await fetch(`${baseUrl}${path}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    endpoint: "https://example.com/api/paid",
    priceUsd: 0.01,
    has402: true,
    hasInputSchema: true
  })
});

if (response.status !== 402) {
  const text = await response.text();
  console.error(`Expected 402 Payment Required, got ${response.status}: ${text}`);
  process.exit(1);
}

const text = await response.text();
let body = {};
try {
  body = text ? JSON.parse(text) : {};
} catch {
  body = {};
}

const paymentRequired = response.headers.get("payment-required");
if (!body.accepts && !body.error && !paymentRequired) {
  console.error("402 response did not include x402 challenge details in JSON body or PAYMENT-REQUIRED header.");
  process.exit(1);
}

if (paymentRequired) {
  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64url").toString("utf8"));
  if (decoded.x402Version !== 2) {
    console.error(`Expected x402Version=2, got ${decoded.x402Version}`);
    process.exit(1);
  }
  if (!Array.isArray(decoded.accepts) || decoded.accepts.length === 0) {
    console.error("PAYMENT-REQUIRED header did not include accepts.");
    process.exit(1);
  }
  const hasPaymentTarget = decoded.accepts.some(
    (item) => item.network && item.payTo && (item.resource || decoded.resource?.url)
  );
  if (!hasPaymentTarget) {
    console.error("PAYMENT-REQUIRED did not include network, payTo, and resource URL.");
    process.exit(1);
  }
}

console.log(`Trust402 unpaid x402 smoke passed for ${baseUrl}${path}`);
