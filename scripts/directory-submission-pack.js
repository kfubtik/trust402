#!/usr/bin/env node
import { config } from "../src/config.js";
import { directorySubmissionPack } from "../src/directorySubmissionPack.js";

const args = parseArgs(process.argv.slice(2));
const targetUrl = args.apiBaseUrl || args._.find((item) => /^https?:\/\//.test(item)) || "";
const apiBaseUrl = targetUrl || config.publicBaseUrl || "https://trust402.vercel.app";
const listingBaseUrl = args.listingBaseUrl || args.baseUrl || apiBaseUrl;
const payload = {
  baseUrl: listingBaseUrl,
  userApprovedOutreach: args.userApprovedOutreach === true
};

if (targetUrl && args.local !== true) {
  const result = await postRemoteJson(apiBaseUrl, "/api/directories/submission-pack", payload);
  console.log(JSON.stringify({
    ...result,
    remoteContext: {
      baseUrl: apiBaseUrl.replace(/\/$/, ""),
      source: "/api/directories/submission-pack"
    }
  }, null, 2));
  if (args.strict === true && result.status !== "ready-to-submit") process.exit(1);
  process.exit(0);
}

const result = directorySubmissionPack(payload, { config });
console.log(JSON.stringify(result, null, 2));
if (args.strict === true && result.status !== "ready-to-submit") process.exit(1);

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
  return value;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
