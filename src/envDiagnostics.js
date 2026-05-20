import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_ENV_DIAGNOSTIC_KEYS = [
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
  "CDP_WALLET_SECRET",
  "CDP_EVM_ACCOUNT_ADDRESS",
  "CDP_EVM_ACCOUNT_NAME",
  "LIVE_PAYMENT_PROVIDER",
  "LIVE_PAYMENT_ADAPTER_URL",
  "X402_BUYER_PRIVATE_KEY",
  "X402_BUYER_RPC_URL",
  "LIVE_SPEND_ENABLED",
  "LIVE_ALLOWED_REGISTRIES",
  "TRUST402_OPERATOR_API_KEY",
  "PROOF402_DELEGATION_MODE",
  "PROOF402_MAX_SPEND_USD",
  "AGENTCASH_AUTO_REFILL_APPROVED",
  "AGENTCASH_AUTO_REFILL_ENABLED",
  "AGENTCASH_AUTO_REFILL_PROVIDER"
];

export function localEnvDiagnostics(input = {}) {
  const envPath = input.path || ".env";
  const absolutePath = input.absolutePath || join(input.cwd || process.cwd(), envPath);
  const keys = input.keys || DEFAULT_ENV_DIAGNOSTIC_KEYS;
  const filePresent = input.text !== undefined || existsSync(absolutePath);
  const parsed = input.text !== undefined
    ? parseEnvFile(input.text)
    : filePresent
      ? parseEnvFile(readFileSync(absolutePath, "utf8"))
      : {};
  const keyStatus = Object.fromEntries(keys.map((key) => [key, statusFor(parsed, key)]));

  return {
    ok: true,
    tool: "local.env_diagnostics",
    generatedAt: new Date().toISOString(),
    path: envPath,
    present: filePresent,
    keys: keyStatus,
    readiness: {
      cdpX402Buyer: readinessFor(keyStatus, [
        "CDP_API_KEY_ID",
        "CDP_API_KEY_SECRET",
        "CDP_WALLET_SECRET"
      ], ["CDP_EVM_ACCOUNT_ADDRESS", "CDP_EVM_ACCOUNT_NAME"]),
      agentcashBridge: readinessFor(keyStatus, ["LIVE_PAYMENT_ADAPTER_URL"]),
      x402FetchBuyer: readinessFor(keyStatus, [
        "X402_BUYER_PRIVATE_KEY",
        "X402_BUYER_RPC_URL"
      ]),
      liveSpendPolicy: readinessFor(keyStatus, [
        "LIVE_SPEND_ENABLED",
        "LIVE_ALLOWED_REGISTRIES",
        "TRUST402_OPERATOR_API_KEY"
      ]),
      proof402Delegation: readinessFor(keyStatus, [
        "PROOF402_DELEGATION_MODE",
        "PROOF402_MAX_SPEND_USD"
      ]),
      agentcashAutoRefill: readinessFor(keyStatus, [
        "AGENTCASH_AUTO_REFILL_APPROVED",
        "AGENTCASH_AUTO_REFILL_ENABLED",
        "AGENTCASH_AUTO_REFILL_PROVIDER"
      ])
    },
    safety: {
      printsValues: false,
      printsLengths: false,
      sendsValues: false,
      storesValues: false,
      mutatesEnvFile: false,
      readsEnvFile: filePresent
    }
  };
}

export function runtimeEnvDiagnostics(runtimeConfig = {}) {
  const keyStatus = {
    CDP_API_KEY_ID: runtimeStatus(runtimeConfig.cdpApiKeyIdConfigured),
    CDP_API_KEY_SECRET: runtimeStatus(runtimeConfig.cdpApiKeySecretConfigured),
    CDP_WALLET_SECRET: runtimeStatus(runtimeConfig.cdpWalletSecretConfigured),
    CDP_EVM_ACCOUNT_ADDRESS: runtimeStatus(Boolean(runtimeConfig.cdpEvmAccountAddress)),
    CDP_EVM_ACCOUNT_NAME: runtimeStatus(Boolean(runtimeConfig.cdpEvmAccountName)),
    LIVE_PAYMENT_PROVIDER: runtimeStatus(isLivePaymentProvider(runtimeConfig.livePaymentProvider)),
    LIVE_PAYMENT_ADAPTER_URL: runtimeStatus(Boolean(runtimeConfig.livePaymentAdapterUrl)),
    X402_BUYER_PRIVATE_KEY: runtimeStatus(Boolean(runtimeConfig.x402BuyerPrivateKeyConfigured)),
    X402_BUYER_RPC_URL: runtimeStatus(Boolean(runtimeConfig.x402BuyerRpcUrl)),
    LIVE_SPEND_ENABLED: runtimeStatus(runtimeConfig.liveSpendEnabled === true),
    LIVE_ALLOWED_REGISTRIES: runtimeStatus(Array.isArray(runtimeConfig.liveAllowedRegistries) && runtimeConfig.liveAllowedRegistries.length > 0),
    TRUST402_OPERATOR_API_KEY: runtimeStatus(Boolean(runtimeConfig.operatorApiKey)),
    PROOF402_DELEGATION_MODE: runtimeStatus(runtimeConfig.proof402DelegationMode === "live"),
    PROOF402_MAX_SPEND_USD: runtimeStatus(Number(runtimeConfig.proof402MaxSpendUsd) > 0),
    AGENTCASH_AUTO_REFILL_APPROVED: runtimeStatus(runtimeConfig.agentcashAutoRefillApproved === true),
    AGENTCASH_AUTO_REFILL_ENABLED: runtimeStatus(runtimeConfig.agentcashAutoRefillEnabled === true),
    AGENTCASH_AUTO_REFILL_PROVIDER: runtimeStatus(Boolean(runtimeConfig.agentcashAutoRefillProvider))
  };

  return {
    ok: true,
    tool: "runtime.env_diagnostics",
    generatedAt: new Date().toISOString(),
    source: "runtime-config",
    present: true,
    keys: keyStatus,
    readiness: {
      cdpX402Buyer: readinessFor(keyStatus, [
        "CDP_API_KEY_ID",
        "CDP_API_KEY_SECRET",
        "CDP_WALLET_SECRET"
      ], ["CDP_EVM_ACCOUNT_ADDRESS", "CDP_EVM_ACCOUNT_NAME"]),
      agentcashBridge: readinessFor(keyStatus, ["LIVE_PAYMENT_ADAPTER_URL"]),
      x402FetchBuyer: readinessFor(keyStatus, [
        "X402_BUYER_PRIVATE_KEY",
        "X402_BUYER_RPC_URL"
      ]),
      liveSpendPolicy: readinessFor(keyStatus, [
        "LIVE_SPEND_ENABLED",
        "LIVE_ALLOWED_REGISTRIES",
        "TRUST402_OPERATOR_API_KEY"
      ]),
      proof402Delegation: readinessFor(keyStatus, [
        "PROOF402_DELEGATION_MODE",
        "PROOF402_MAX_SPEND_USD"
      ]),
      agentcashAutoRefill: readinessFor(keyStatus, [
        "AGENTCASH_AUTO_REFILL_APPROVED",
        "AGENTCASH_AUTO_REFILL_ENABLED",
        "AGENTCASH_AUTO_REFILL_PROVIDER"
      ])
    },
    safety: {
      printsValues: false,
      printsLengths: false,
      sendsValues: false,
      storesValues: false,
      mutatesEnvFile: false,
      readsEnvFile: false
    }
  };
}

function parseEnvFile(text) {
  const values = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = unquote(trimmed.slice(separator + 1).trim());
    if (key) values[key] = value;
  }
  return values;
}

function statusFor(values, key) {
  const present = Object.hasOwn(values, key);
  const value = present ? String(values[key] || "") : "";
  return {
    present,
    nonEmpty: present && value.length > 0,
    placeholderLike: present && isPlaceholderLike(value)
  };
}

function runtimeStatus(usable) {
  return {
    present: Boolean(usable),
    nonEmpty: Boolean(usable),
    placeholderLike: false
  };
}

function isLivePaymentProvider(value) {
  return ["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"].includes(value);
}

function readinessFor(status, requiredAll = [], requiredAny = []) {
  const missing = requiredAll.filter((key) => !isUsable(status[key]));
  const anyReady = requiredAny.length === 0 || requiredAny.some((key) => isUsable(status[key]));
  const missingAny = anyReady ? [] : requiredAny;
  return {
    ready: missing.length === 0 && missingAny.length === 0,
    missing,
    missingAny
  };
}

function isUsable(status) {
  return Boolean(status?.present && status.nonEmpty && !status.placeholderLike);
}

function isPlaceholderLike(value) {
  const normalized = String(value || "").trim();
  return /^<.*>$/.test(normalized) ||
    /^your[_-]/i.test(normalized) ||
    /paste|not[-_]?configured|replace[-_]?me|xxx/i.test(normalized);
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
