import { settlementPreflight } from "../src/settlement.js";

const report = settlementPreflight();
console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--strict") && !report.readiness.paidSmokeReady) {
  process.exit(1);
}
