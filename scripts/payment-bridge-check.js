#!/usr/bin/env node
import { config } from "../src/config.js";
import { paymentBridgeCheck } from "../src/paymentBridgeCheck.js";

const args = parseArgs(process.argv.slice(2));

const result = await paymentBridgeCheck({
  provider: args.provider || process.env.LIVE_PAYMENT_PROVIDER || "agentcash-mcp",
  adapterUrl: args.adapterUrl || process.env.LIVE_PAYMENT_ADAPTER_URL || "",
  candidateEndpoint: args.candidateEndpoint || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_ENDPOINT || "https://proof402.vercel.app/api/proof/notarize",
  method: args.method || "POST",
  maxAmountUsd: args.maxAmountUsd || process.env.LIVE_MAX_PER_CALL_USD || "0.01",
  body: args.body || undefined
}, {
  config,
  requireOperator: false,
  allowCustomAdapterUrl: true,
  allowLocalhost: args.allowLocalhost === true
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "passed") process.exit(1);

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
