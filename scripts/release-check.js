import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { openApiSpec, x402WellKnown } from "../src/openapi.js";

const catalog = JSON.parse(readFileSync("marketplace/resources.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const workflow = readFileSync(".github/workflows/test.yml", "utf8");
const openapi = openApiSpec();
const wellKnown = x402WellKnown();

assert(packageJson.name === "trust402", "package name must be trust402");
assert(packageJson.private === false, "package private must be false before GitHub release");
assert(packageJson.license === "MIT", "package license must be MIT");
assert(packageJson.scripts?.test, "package must expose npm test");
assert(packageJson.scripts?.["privacy:check"], "package must expose npm run privacy:check");
assert(packageJson.scripts?.["release:check"], "package must expose npm run release:check");
assert(Array.isArray(packageJson.keywords) && packageJson.keywords.includes("x402"), "package keywords must include x402");
assert(existsSync("README.md"), "README.md must exist");
assert(existsSync("SECURITY.md"), "SECURITY.md must exist");
assert(existsSync("LICENSE"), "LICENSE must exist");
assert(existsSync("Dockerfile"), "Dockerfile must exist");
assert(existsSync(".dockerignore"), ".dockerignore must exist");
assert(existsSync("docs/deployment.md"), "deployment docs must exist");
assert(existsSync("docs/github-release-checklist.md"), "GitHub release checklist must exist");
assert(workflow.includes("docker build -t trust402:test ."), "CI must build the Docker image");
assert(workflow.includes("npm run smoke -- http://127.0.0.1:4032"), "CI must smoke test the Docker image");
assert(catalog.paidLaunchResources.length === 10, "expected 10 paid launch resources");
assert(catalog.laterResourcesToPreserve.length >= 2, "expected preserved later resources");
assert(catalog.safety.liveSpendDefault === false, "live spend must default to false");
assert(catalog.safety.storesPrivateKeys === false, "storesPrivateKeys must be false");
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/receipts/hash-result" && resource.priceUsd === 0),
  "free hash-result receipt helper must exist"
);
assert(
  catalog.freeResources.some((resource) => resource.path === "/api/procurement/execute" && resource.priceUsd === 0),
  "free dry-run execute helper must exist"
);
assert(openapi.paths?.["/api/receipts/hash-result"]?.post, "hash-result helper must be present in OpenAPI");
assert(
  !openapi.paths["/api/receipts/hash-result"].post["x-payment-info"],
  "hash-result helper must not require payment"
);
assert(openapi.paths?.["/api/procurement/execute"]?.post, "dry-run execute helper must be present in OpenAPI");
assert(
  !openapi.paths["/api/procurement/execute"].post["x-payment-info"],
  "dry-run execute helper must not require payment"
);

const ids = new Set();
const paths = new Set();
for (const resource of catalog.paidLaunchResources) {
  assert(!ids.has(resource.id), `${resource.id} id must be unique`);
  assert(!paths.has(resource.path), `${resource.path} path must be unique`);
  ids.add(resource.id);
  paths.add(resource.path);
  assert(resource.method === "POST", `${resource.id} must be POST`);
  assert(resource.path.startsWith("/api/"), `${resource.id} path must start with /api/`);
  assert(resource.status === "launch-mvp", `${resource.id} must be launch-mvp`);
  assert(openapi.paths?.[resource.path]?.post, `${resource.id} must be present in OpenAPI`);
  assert(openapi.paths[resource.path].post["x-payment-info"], `${resource.id} must expose x-payment-info`);
  assert(
    wellKnown.resources.some((entry) => entry.includes(resource.path)),
    `${resource.id} must be present in .well-known/x402`
  );
}

for (const resource of catalog.laterResourcesToPreserve) {
  assert(resource.status !== "launch-mvp", `${resource.id} later resource must not be launch-mvp`);
}

run("node", ["scripts/privacy-check.js"]);
run("node", ["--test", "test"]);

console.log("Trust402 release check passed.");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Release check failed: ${message}`);
    process.exit(1);
  }
}
