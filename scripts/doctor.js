import { launchChecklist } from "../src/readiness.js";
import { localEnvDiagnostics } from "../src/envDiagnostics.js";

const report = launchChecklist();
console.log(JSON.stringify({
  ...report,
  localEnv: localEnvDiagnostics()
}, null, 2));

if (!report.readiness.dryRunLaunchReady) {
  process.exit(1);
}
