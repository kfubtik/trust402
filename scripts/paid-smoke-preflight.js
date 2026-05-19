import { settlementPreflight } from "../src/settlement.js";
import { config } from "../src/config.js";

const runtimeConfig = {
  ...config,
  paidSmokeResourceId: valueArg("--resource-id") || config.paidSmokeResourceId,
  paidSmokeMaxUsd: numberArg("--max-usd", config.paidSmokeMaxUsd),
  paidSmokeApproved: process.argv.includes("--approved") || config.paidSmokeApproved
};

const report = settlementPreflight({ config: runtimeConfig });
console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--strict") && !report.readiness.paidSmokeReady) {
  process.exit(1);
}

function valueArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function numberArg(name, fallback) {
  const value = valueArg(name);
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
