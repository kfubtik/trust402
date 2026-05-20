#!/usr/bin/env node
import { config } from "../src/config.js";
import { domainActivationPack } from "../src/domainActivationPack.js";

const args = parseArgs(process.argv.slice(2));
const targetUrl = args.apiBaseUrl || args._.find((item) => /^https?:\/\//.test(item)) || "";
const apiBaseUrl = targetUrl || config.publicBaseUrl || "https://trust402.vercel.app";
const payload = {
  baseUrl: args.currentBaseUrl || args.baseUrl || apiBaseUrl,
  selectedDomain: args.selectedDomain || args.domain,
  candidateDomains: args.candidateDomains,
  vercelProjectName: args.vercelProjectName,
  selectedDomainAvailable: args.selectedDomainAvailable,
  selectedDomainPriceUsd: args.selectedDomainPriceUsd,
  selectedDomainPeriodYears: args.selectedDomainPeriodYears,
  selectedDomainPurchaseUrl: args.selectedDomainPurchaseUrl,
  selectedDomainAvailabilityMessage: args.selectedDomainAvailabilityMessage,
  availabilityCheckedAt: args.availabilityCheckedAt,
  availabilitySource: args.availabilitySource,
  domainAvailability: parseJsonArg(args.domainAvailabilityJson)
};

if (targetUrl && args.local !== true) {
  const result = await postRemoteJson(apiBaseUrl, "/api/domains/activation-pack", payload);
  console.log(JSON.stringify({
    ...result,
    remoteContext: {
      baseUrl: apiBaseUrl.replace(/\/$/, ""),
      source: "/api/domains/activation-pack"
    }
  }, null, 2));
  if (args.strict === true && result.status !== "ready-to-attach") process.exit(1);
  process.exit(0);
}

const result = domainActivationPack(payload, { config });
console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "ready-to-attach") process.exit(1);

async function postRemoteJson(base, path, body) {
  const url = `${String(base).replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`${url} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return JSON.parse(text);
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
      const key = toCamel(raw.slice(0, eq));
      parsed[key] = key === "domainAvailabilityJson" ? raw.slice(eq + 1) : parseValue(raw.slice(eq + 1));
      continue;
    }
    const key = toCamel(raw);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = key === "domainAvailabilityJson" ? next : parseValue(next);
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function parseValue(value) {
  if (typeof value === "string" && value.includes(",") && !/^https?:\/\//.test(value)) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return value;
}

function parseJsonArg(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Invalid --domain-availability-json: ${error.message}`);
    process.exit(1);
  }
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
