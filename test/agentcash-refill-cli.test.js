import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";

test("agentcash refill CLI allows public dry-run when local policy is absent", () => {
  const cwd = mkdtempSync(join(tmpdir(), "trust402-refill-cli-"));
  try {
    const script = resolve("scripts/agentcash-refill-check.js");
    const result = spawnSync(process.execPath, [script, "--balance", "1.00"], {
      cwd,
      encoding: "utf8",
      env: process.env,
      shell: false
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.tool, "agentcash.refill_check");
    assert.equal(output.localPolicy.present, false);
    assert.equal(output.decision.action, "none");
    assert.equal(output.safety.mutatesWalletBalance, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
