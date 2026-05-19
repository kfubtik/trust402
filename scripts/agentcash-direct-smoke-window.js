#!/usr/bin/env node
import { agentcashDirectSmokeWindow } from "../src/agentcashDirectSmokeWindow.js";

const args = parseArgs(process.argv.slice(2));
const mode = args.open === true ? "open" : args.close === true ? "close" : args.mode || "status";
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || process.env.PUBLIC_BASE_URL || "https://trust402.vercel.app";

try {
  const result = agentcashDirectSmokeWindow({
    mode,
    baseUrl,
    candidateEndpoint: args.candidateEndpoint || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_ENDPOINT,
    candidatePriceUsd: args.candidatePrice || args.candidatePriceUsd || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_PRICE_USD,
    maxAmountUsd: args.maxAmount || args.maxAmountUsd || args.maxTotalUsd,
    approval: args.approval,
    policyPath: args.policyPath,
    statePath: args.statePath,
    force: args.force === true
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error.status || error.code) {
    console.error(JSON.stringify({
      ok: false,
      code: error.code || "agentcash_direct_smoke_window_failed",
      message: error.message,
      details: error.details || null
    }, null, 2));
    process.exit(error.status === 409 ? 2 : 1);
  }
  throw error;
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
