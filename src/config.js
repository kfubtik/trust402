import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

loadDotEnv();

export const config = {
  serviceName: process.env.TRUST402_SERVICE_NAME || "Trust402",
  version: process.env.npm_package_version || "0.1.0",
  host: process.env.HOST || "127.0.0.1",
  port: Number.parseInt(process.env.PORT || "4032", 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || vercelPublicBaseUrl() || "http://127.0.0.1:4032",
  defaultMode: process.env.TRUST402_MODE || "dry-run",
  paywallMode: process.env.TRUST402_PAYWALL_MODE || "demo",
  realSettlementEnabled: process.env.TRUST402_REAL_SETTLEMENT_ENABLED === "true",
  successfulSettlementObserved: process.env.TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED === "true",
  x402Network: process.env.X402_NETWORK || "eip155:8453",
  x402Asset: process.env.X402_ASSET || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: process.env.PAY_TO || "0x0000000000000000000000000000000000000000",
  facilitatorUrl: process.env.X402_FACILITATOR_URL || "",
  cdpApiKeyIdConfigured: Boolean(process.env.CDP_API_KEY_ID),
  cdpApiKeySecretConfigured: Boolean(process.env.CDP_API_KEY_SECRET),
  cdpWalletSecretConfigured: Boolean(process.env.CDP_WALLET_SECRET),
  paidSmokeApproved: process.env.TRUST402_PAID_SMOKE_APPROVED === "true",
  paidSmokeMaxUsd: Number.parseFloat(process.env.TRUST402_PAID_SMOKE_MAX_USD || "0"),
  paidSmokeResourceId: process.env.TRUST402_PAID_SMOKE_RESOURCE_ID || "trust.score_resource",
  operatorApiKey: process.env.TRUST402_OPERATOR_API_KEY || "",
  emergencyStop: process.env.TRUST402_EMERGENCY_STOP === "true" || process.env.LIVE_EMERGENCY_STOP === "true",
  liveSpendEnabled: process.env.LIVE_SPEND_ENABLED === "true",
  livePaymentProvider: process.env.LIVE_PAYMENT_PROVIDER || "disabled",
  livePaymentAdapterUrl: process.env.LIVE_PAYMENT_ADAPTER_URL || "",
  liveMaxPerCallUsd: Number.parseFloat(process.env.LIVE_MAX_PER_CALL_USD || "0"),
  liveMaxPerJobUsd: Number.parseFloat(process.env.LIVE_MAX_PER_JOB_USD || "0"),
  liveDailyLimitUsd: Number.parseFloat(process.env.LIVE_DAILY_LIMIT_USD || "0"),
  liveSpentTodayUsd: Number.parseFloat(process.env.LIVE_SPENT_TODAY_USD || "0"),
  liveApprovalThresholdUsd: Number.parseFloat(process.env.LIVE_APPROVAL_THRESHOLD_USD || "0"),
  liveAllowedRegistries: parseList(process.env.LIVE_ALLOWED_REGISTRIES || ""),
  liveEndpointDenylist: parseList(process.env.LIVE_ENDPOINT_DENYLIST || ""),
  liveReceiptLogMode: process.env.LIVE_RECEIPT_LOG_MODE || "response-only",
  x402BuyerPrivateKeyConfigured: Boolean(process.env.X402_BUYER_PRIVATE_KEY),
  x402BuyerRpcUrl: process.env.X402_BUYER_RPC_URL || "",
  cdpEvmAccountAddress: process.env.CDP_EVM_ACCOUNT_ADDRESS || "",
  cdpEvmAccountName: process.env.CDP_EVM_ACCOUNT_NAME || "",
  agentcashAutoRefillApproved: process.env.AGENTCASH_AUTO_REFILL_APPROVED === "true",
  agentcashAutoRefillEnabled: process.env.AGENTCASH_AUTO_REFILL_ENABLED === "true",
  agentcashAutoRefillProvider: process.env.AGENTCASH_AUTO_REFILL_PROVIDER || "",
  agentcashAutoRefillAdapterUrl: process.env.AGENTCASH_AUTO_REFILL_ADAPTER_URL || "",
  agentcashWalletBindingRequired: process.env.AGENTCASH_WALLET_BINDING_REQUIRED !== "false",
  agentcashNetwork: process.env.AGENTCASH_NETWORK || "base",
  agentcashAutoRefillThresholdUsd: Number.parseFloat(process.env.AGENTCASH_AUTO_REFILL_THRESHOLD_USD || "0.50"),
  agentcashAutoRefillAmountUsd: Number.parseFloat(process.env.AGENTCASH_AUTO_REFILL_AMOUNT_USD || "1.00"),
  agentcashAutoRefillDailyCapUsd: Number.parseFloat(process.env.AGENTCASH_AUTO_REFILL_DAILY_CAP_USD || "2.00"),
  proof402BaseUrl: process.env.PROOF402_BASE_URL || "",
  proof402DelegationMode: process.env.PROOF402_DELEGATION_MODE || "disabled",
  proof402MaxSpendUsd: Number.parseFloat(process.env.PROOF402_MAX_SPEND_USD || "0"),
  gitAutoDeployVerified: process.env.TRUST402_GIT_AUTO_DEPLOY_VERIFIED === "true",
  gitAutoDeployEvidenceUrl: process.env.TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL || "",
  gitAutoDeployCommitSha: process.env.TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA || "",
  cdpBazaarAllResourcesIndexed: process.env.TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED === "true",
  cdpBazaarEvidenceRef: process.env.TRUST402_CDP_BAZAAR_EVIDENCE_REF || "",
  externalDirectoryStatus: process.env.TRUST402_EXTERNAL_DIRECTORY_STATUS || "not-visible-yet",
  externalDirectoryEvidenceUrl: process.env.TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL || "",
  externalDirectoryName: process.env.TRUST402_EXTERNAL_DIRECTORY_NAME || "",
  liveProcurementSmokeObserved: process.env.TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED === "true",
  liveProcurementEvidenceRef: process.env.TRUST402_LIVE_PROCUREMENT_EVIDENCE_REF || "",
  proof402PaidSmokeObserved: process.env.TRUST402_PROOF402_PAID_SMOKE_OBSERVED === "true",
  proof402EvidenceRef: process.env.TRUST402_PROOF402_EVIDENCE_REF || "",
  agentcashAutoRefillEvidenceObserved: process.env.TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_OBSERVED === "true",
  agentcashAutoRefillEvidenceRef: process.env.TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_REF || "",
  autonomousJobSmokeObserved: process.env.TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED === "true",
  autonomousJobEvidenceRef: process.env.TRUST402_AUTONOMOUS_JOB_EVIDENCE_REF || "",
  finalVerificationObserved: process.env.TRUST402_FINAL_VERIFICATION_OBSERVED === "true",
  finalVerificationEvidenceRef: process.env.TRUST402_FINAL_VERIFICATION_EVIDENCE_REF || "",
  requestTimeoutMs: Number.parseInt(process.env.TRUST402_REQUEST_TIMEOUT_MS || "6000", 10),
  maxJsonBytes: Number.parseInt(process.env.TRUST402_MAX_JSON_BYTES || "131072", 10)
};

export function isMockPaywallEnabled() {
  return (process.env.TRUST402_PAYWALL_MODE || config.paywallMode) === "mock";
}

function loadDotEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = unquote(rawValue);
  }
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function vercelPublicBaseUrl() {
  if (!process.env.VERCEL_URL) return "";
  return `https://${process.env.VERCEL_URL}`;
}

function parseList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
