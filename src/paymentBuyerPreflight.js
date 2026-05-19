import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";
import { paymentProviderReadiness } from "./paymentAdapters.js";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function paymentBuyerPreflight(input = {}, options = {}) {
  const cfg = options.config || config;
  const provider = String(input.provider || cfg.livePaymentProvider || "cdp-x402");
  const probeCdp = input.probeCdp === true;
  const accountRef = cdpAccountRef(input, cfg);
  const readiness = paymentProviderReadiness({
    ...cfg,
    livePaymentProvider: provider,
    cdpEvmAccountAddress: input.cdpEvmAccountAddress || cfg.cdpEvmAccountAddress,
    cdpEvmAccountName: input.cdpEvmAccountName || cfg.cdpEvmAccountName
  });
  const base = {
    ok: true,
    tool: "payments.buyer_preflight",
    generatedAt: new Date().toISOString(),
    provider,
    mode: probeCdp ? "cdp-account-probe" : "readiness-only",
    readiness,
    account: {
      configured: Boolean(accountRef),
      refKind: accountRef ? Object.keys(accountRef)[0] : null,
      addressConfigured: Boolean(input.cdpEvmAccountAddress || cfg.cdpEvmAccountAddress),
      nameConfigured: Boolean(input.cdpEvmAccountName || cfg.cdpEvmAccountName)
    },
    safety: {
      readOnly: true,
      createsCdpAccount: false,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      mutatesWallet: false,
      printsSecrets: false,
      printsPrivateKeys: false
    }
  };

  if (provider !== "cdp-x402") {
    return {
      ...base,
      status: "not-applicable",
      passed: false,
      blockers: [{
        id: "unsupported_buyer_preflight_provider",
        message: "Buyer preflight currently probes only LIVE_PAYMENT_PROVIDER=cdp-x402."
      }],
      nextActions: ["Use provider=cdp-x402 for CDP server-managed buyer signing, or use the existing bridge/x402-fetch checks."]
    };
  }

  if (!probeCdp) {
    return {
      ...base,
      status: readiness.ready ? "ready-to-probe" : "blocked-config",
      passed: readiness.ready,
      blockers: readiness.blockers,
      nextActions: readiness.ready
        ? ["Run with probeCdp=true and operator authorization to confirm the configured CDP account exists before any live spend window."]
        : readiness.blockers.map((item) => item.message)
    };
  }

  if (options.operatorAuthorized !== true) {
    throw new ApiError(403, "operator_not_authorized", "CDP buyer account probe requires x-trust402-operator-key.", {
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0
    });
  }
  if (!readiness.ready) {
    return {
      ...base,
      status: "blocked-config",
      passed: false,
      blockers: readiness.blockers,
      nextActions: readiness.blockers.map((item) => item.message)
    };
  }

  try {
    const cdp = await cdpClient(options.modules);
    const account = options.modules?.cdpAccount || await cdp.evm.getAccount(accountRef);
    return {
      ...base,
      status: "passed",
      passed: true,
      cdpProbe: {
        accountFound: true,
        addressPreview: previewAddress(account.address),
        addressHash: sha256Json({ address: String(account.address || "").toLowerCase() }),
        type: account.type || "evm-server"
      },
      blockers: [],
      nextActions: ["CDP buyer account exists. Keep live spend disabled until operator key, caps, allowlist, local wallet policy, and evidence window are approved."]
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      passed: false,
      cdpProbe: {
        accountFound: false,
        errorCode: error?.code || error?.name || "cdp_account_probe_failed"
      },
      blockers: [{
        id: "cdp_account_probe_failed",
        message: `CDP account probe failed: ${error.message}`
      }],
      nextActions: ["Verify CDP_WALLET_SECRET and the configured CDP_EVM_ACCOUNT_ADDRESS or CDP_EVM_ACCOUNT_NAME in the CDP project."]
    };
  }
}

async function cdpClient(modules = {}) {
  if (modules.cdpClient) return modules.cdpClient;
  const cdpModule = modules.cdpModule || await import("@coinbase/cdp-sdk");
  const CdpClient = modules.CdpClient || cdpModule.CdpClient;
  return new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET
  });
}

function cdpAccountRef(input, cfg) {
  const address = String(input.cdpEvmAccountAddress || cfg.cdpEvmAccountAddress || "").trim();
  if (address) {
    if (!EVM_ADDRESS_RE.test(address)) return { address };
    return { address };
  }
  const name = String(input.cdpEvmAccountName || cfg.cdpEvmAccountName || "").trim();
  if (name) return { name };
  return null;
}

function previewAddress(address) {
  const value = String(address || "");
  if (value.length < 12) return value ? "<configured>" : "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
