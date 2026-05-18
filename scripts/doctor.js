import { launchChecklist } from "../src/readiness.js";

const report = launchChecklist();
console.log(JSON.stringify(report, null, 2));

if (!report.readiness.dryRunLaunchReady) {
  process.exit(1);
}
