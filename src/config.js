export const config = {
  serviceName: process.env.TRUST402_SERVICE_NAME || "Trust402",
  version: process.env.npm_package_version || "0.1.0",
  host: process.env.HOST || "127.0.0.1",
  port: Number.parseInt(process.env.PORT || "4032", 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://127.0.0.1:4032",
  defaultMode: process.env.TRUST402_MODE || "dry-run",
  paywallMode: process.env.TRUST402_PAYWALL_MODE || "demo",
  x402Network: process.env.X402_NETWORK || "eip155:8453",
  x402Asset: process.env.X402_ASSET || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: process.env.PAY_TO || "0x0000000000000000000000000000000000000000",
  requestTimeoutMs: Number.parseInt(process.env.TRUST402_REQUEST_TIMEOUT_MS || "6000", 10),
  maxJsonBytes: Number.parseInt(process.env.TRUST402_MAX_JSON_BYTES || "131072", 10)
};

export function isMockPaywallEnabled() {
  return (process.env.TRUST402_PAYWALL_MODE || config.paywallMode) === "mock";
}
