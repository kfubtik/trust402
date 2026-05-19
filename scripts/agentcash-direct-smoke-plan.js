#!/usr/bin/env node
import { agentcashDirectSmokePlan } from "../src/agentcashDirectSmokePlan.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || process.env.PUBLIC_BASE_URL || "https://trust402.vercel.app";

const result = agentcashDirectSmokePlan({
  baseUrl,
  candidateEndpoint: args.candidateEndpoint || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_ENDPOINT,
  candidatePriceUsd: args.candidatePrice || args.candidatePriceUsd || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_PRICE_USD,
  maxAmountUsd: args.maxAmount || args.maxAmountUsd || args.maxTotalUsd,
  lastVerifiedBalanceUsd: args.lastVerifiedBalance || args.lastVerifiedBalanceUsd,
  minimumReserveUsd: args.minimumReserve || args.minimumReserveUsd
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "ready-for-explicit-paid-fetch-approval") process.exit(1);

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
