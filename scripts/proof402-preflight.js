#!/usr/bin/env node
import { proof402Preflight } from "../src/proof402Preflight.js";

const args = parseArgs(process.argv.slice(2));

const input = {
  subject: args.subject,
  resultHash: args.resultHash || args.hash,
  approvedHash: args.approvedHash,
  approvedHashes: parseList(args.approvedHashes),
  quotedPriceUsd: args.priceUsd ?? args.quotedPriceUsd,
  paymentQuote: parseJsonArg(args.quoteJson || args.paymentQuoteJson),
  metadata: parseJsonArg(args.metadataJson),
  label: args.label,
  idempotencyKey: args.idempotencyKey
};

const result = proof402Preflight(prune(input));
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

function parseList(value) {
  if (!value) return undefined;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonArg(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Invalid JSON argument: ${error.message}`);
    process.exit(2);
  }
}

function prune(value) {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined));
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
