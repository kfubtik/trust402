import { x402SdkStatus } from "../src/x402SdkAdapter.js";

const report = await x402SdkStatus({ expressEntrypointConnected: true });
console.log(JSON.stringify(report, null, 2));

if (!report.installed) {
  process.exit(1);
}
