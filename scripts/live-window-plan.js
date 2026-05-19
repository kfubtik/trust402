#!/usr/bin/env node
import { readLocalAgentcashPolicy } from "../src/localAgentcashPolicy.js";
import { liveWindowPlan } from "../src/liveWindowPlan.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || process.env.PUBLIC_BASE_URL || "https://trust402.vercel.app";

const localPolicyResult = readLocalAgentcashPolicy();
const input = {
  baseUrl,
  candidateEndpoint: args.candidateEndpoint || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_ENDPOINT || "",
  candidatePriceUsd: args.candidatePrice || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_PRICE_USD || "",
  maxTotalUsd: args.maxTotalUsd || process.env.TRUST402_LIVE_EVIDENCE_MAX_TOTAL_USD || "",
  manualSmokeBudgetUsd: args.manualSmokeBudget || "",
  paymentProvider: args.paymentProvider || "",
  allowedRegistries: args.allowedRegistries || "",
  proofReserveUsd: args.proofReserveUsd || process.env.TRUST402_LIVE_EVIDENCE_PROOF_RESERVE_USD || "",
  lastVerifiedBalanceUsd: args.lastVerifiedBalance || args.lastVerifiedBalanceUsd || "",
  minimumReserveUsd: args.minimumReserve || args.minimumReserveUsd || "",
  liveMaxPerCallUsd: args.liveMaxPerCall || "",
  liveMaxPerJobUsd: args.liveMaxPerJob || "",
  liveDailyLimitUsd: args.liveDailyLimit || "",
  liveSpentTodayUsd: args.liveSpentTodayUsd || args.liveSpentToday || process.env.LIVE_SPENT_TODAY_USD || "",
  includeProof: args.skipProof !== true,
  includeAutonomous: args.includeAutonomous === true,
  includeAutoRefill: args.includeAutoRefill === true,
  refillProvider: args.refillProvider || "",
  refillAmountUsd: args.refillAmount || "",
  refillDailyCapUsd: args.refillDailyCap || ""
};
const defaultedFields = applyLocalPolicyDefaults(input, args, localPolicyResult);
const result = liveWindowPlan(input);

console.log(JSON.stringify({
  ...result,
  localPolicyContext: {
    present: localPolicyResult.present,
    policyPath: localPolicyResult.policyPath,
    defaultedFields,
    summary: localPolicyResult.summary
  }
}, null, 2));
if (args.strict === true && result.status !== "ready-to-stage") process.exit(1);

function applyLocalPolicyDefaults(input, args, localPolicyResult) {
  const policy = localPolicyResult.policy;
  const defaultedFields = [];
  if (!policy) return defaultedFields;

  if (!hasArg(args, "lastVerifiedBalance") && !hasArg(args, "lastVerifiedBalanceUsd")) {
    input.lastVerifiedBalanceUsd = policy.limits?.lastVerifiedBalanceUsd;
    defaultedFields.push("lastVerifiedBalanceUsd");
  }
  if (!hasArg(args, "minimumReserve") && !hasArg(args, "minimumReserveUsd")) {
    input.minimumReserveUsd = policy.limits?.minimumReserveUsd;
    defaultedFields.push("minimumReserveUsd");
  }
  return defaultedFields;
}

function parseArgs(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) {
      parsed._.push(item);
      continue;
    }
    const raw = item.slice(2);
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      parsed[toCamel(raw.slice(0, eq))] = raw.slice(eq + 1);
      continue;
    }
    const key = toCamel(raw);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function hasArg(args, key) {
  return args[key] !== undefined && args[key] !== null && args[key] !== "";
}
