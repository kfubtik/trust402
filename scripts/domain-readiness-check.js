#!/usr/bin/env node
import { config } from "../src/config.js";
import { domainReadinessCheck } from "../src/domainReadinessCheck.js";

const args = parseArgs(process.argv.slice(2));
const apiBaseUrl = (args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || config.publicBaseUrl || "https://trust402.vercel.app").replace(/\/+$/, "");
const payload = {
  domain: args.domain || args.customDomain || args.selectedDomain,
  baseUrl: args.expectedBaseUrl || args.domainBaseUrl,
  expectedBaseUrl: args.expectedBaseUrl,
  timeoutMs: args.timeoutMs,
  skipDns: args.skipDns
};

if (args.local !== true) {
  const result = await postRemoteJson(apiBaseUrl, "/api/domains/readiness-check", payload);
  console.log(JSON.stringify({
    ...result,
    remoteContext: {
      baseUrl: apiBaseUrl,
      source: "/api/domains/readiness-check"
    }
  }, null, 2));
} else {
  const result = await domainReadinessCheck(payload, { config });
  console.log(JSON.stringify(result, null, 2));
}

async function postRemoteJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
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
      parsed[toCamel(raw.slice(0, eq))] = parseValue(raw.slice(eq + 1));
      continue;
    }
    const key = toCamel(raw);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = parseValue(next);
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  return value;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
