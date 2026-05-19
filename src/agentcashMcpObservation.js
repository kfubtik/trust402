import { readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";

export function agentcashMcpObservation(input = {}, options = {}) {
  const policyResult = options.localAgentcashPolicyResult || readLocalAgentcashPolicy({ cwd: options.cwd });
  const policy = policyResult.policy;
  const accounts = Array.isArray(input.accounts) ? input.accounts : [];
  const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
  const blockers = [];
  const warnings = [];

  if (!policyResult.present || !policy) {
    blockers.push(blocker("local_agentcash_policy_missing", ".local/trust402-agentcash-wallet.json is required before AgentCash MCP observations can approve wallet binding."));
  }

  if (accounts.length === 0) {
    return result({
      policyResult,
      accounts,
      settings,
      status: "observation-required",
      passed: false,
      blockers,
      warnings,
      nextActions: [
        "Run AgentCash account listing only after the local Trust402 policy has been reviewed, then pass the public accounts/settings output to this guard."
      ]
    });
  }

  const expectedAddress = normalizeAddress(policy?.wallet?.address);
  const expectedNetwork = policy?.wallet?.network || "base";
  const baseAccount = accounts.find((account) => normalizeNetwork(account.network) === expectedNetwork);
  const nonBaseFunded = accounts.filter((account) => normalizeNetwork(account.network) !== expectedNetwork && numberOrZero(account.balance) > 0);
  const observedMaxAmount = numberOrNull(settings.maxAmount);
  const policyMaxAmount = numberOrNull(policy?.limits?.agentcashGlobalMaxAmountUsd);
  const minimumReserveUsd = numberOrNull(policy?.limits?.minimumReserveUsd);
  const baseBalance = numberOrNull(baseAccount?.balance);

  if (!baseAccount) {
    blockers.push(blocker("agentcash_base_account_missing", "Observed AgentCash accounts do not include the policy network account."));
  } else if (policy) {
    const observedAddress = normalizeAddress(baseAccount.address);
    if (!expectedAddress || observedAddress !== expectedAddress) {
      blockers.push(blocker("agentcash_wallet_address_mismatch", "Observed AgentCash Base account address does not match the Trust402 local policy wallet address."));
    }
  }

  if (observedMaxAmount === null) {
    warnings.push("AgentCash settings.maxAmount was not observed; per-fetch cap cannot be confirmed.");
  } else if (policyMaxAmount !== null && observedMaxAmount > policyMaxAmount) {
    blockers.push(blocker("agentcash_max_amount_exceeds_policy", `AgentCash maxAmount ${observedMaxAmount} exceeds local policy cap ${policyMaxAmount}.`));
  }

  if (baseBalance !== null && minimumReserveUsd !== null && baseBalance < minimumReserveUsd) {
    blockers.push(blocker("agentcash_balance_below_reserve", "Observed AgentCash Base balance is below the local minimum reserve."));
  }

  if (nonBaseFunded.length > 0) {
    blockers.push(blocker("agentcash_non_base_balance_present", "Observed AgentCash funds exist outside the Trust402-approved Base network."));
  }

  return result({
    policyResult,
    accounts,
    settings,
    status: blockers.length === 0 ? "verified" : "blocked-policy",
    passed: blockers.length === 0,
    blockers,
    warnings,
    nextActions: blockers.length === 0
      ? ["AgentCash MCP public observation matches the Trust402 local wallet policy. Keep live spend disabled until the explicit smoke window is approved."]
      : blockers.map((item) => item.message)
  });
}

function result({ policyResult, accounts, settings, status, passed, blockers, warnings, nextActions }) {
  const baseAccount = accounts.find((account) => normalizeNetwork(account.network) === "base");
  const nonBaseFunded = accounts.filter((account) => normalizeNetwork(account.network) !== "base" && numberOrZero(account.balance) > 0);
  return {
    ok: true,
    tool: "agentcash.mcp_observation",
    generatedAt: new Date().toISOString(),
    status,
    passed,
    policy: policyResult.summary || {
      present: Boolean(policyResult.present),
      policyPath: policyResult.policyPath || ".local/trust402-agentcash-wallet.json"
    },
    observation: {
      accountsObserved: accounts.length,
      baseAccountObserved: Boolean(baseAccount),
      baseAddressPreview: maskAddress(baseAccount?.address),
      baseBalanceUsd: numberOrNull(baseAccount?.balance),
      nonBaseFundedNetworks: nonBaseFunded.map((account) => normalizeNetwork(account.network)),
      maxAmountUsd: numberOrNull(settings.maxAmount)
    },
    blockers,
    warnings,
    nextActions,
    safety: {
      readOnly: true,
      callsAgentcashMcp: false,
      sendsPaymentHeaders: false,
      paidSubcallsMade: 0,
      mutatesWallet: false,
      printsSecrets: false,
      printsPrivateKeys: false,
      storesPrivateKeys: false
    }
  };
}

function blocker(id, message) {
  return { id, message };
}

function normalizeAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNetwork(value) {
  return String(value || "").trim().toLowerCase();
}

function numberOrNull(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}

function maskAddress(value) {
  const raw = String(value || "");
  if (raw.length < 12) return raw ? "<observed>" : null;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}
