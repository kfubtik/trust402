#!/usr/bin/env node
import { paymentBuyerPreflight } from "../src/paymentBuyerPreflight.js";

const args = parseArgs(process.argv.slice(2));

const result = await paymentBuyerPreflight({
  provider: args.provider || process.env.LIVE_PAYMENT_PROVIDER || "cdp-x402",
  probeCdp: args.probeCdp === true,
  cdpEvmAccountAddress: args.cdpEvmAccountAddress || "",
  cdpEvmAccountName: args.cdpEvmAccountName || ""
}, {
  operatorAuthorized: args.operatorApproved === true
});

console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.passed !== true) process.exit(1);

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
