import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyLocalPatch, liveSmokeWindow } from "../src/liveSmokeWindow.js";

test("applyLocalPatch stages only the approved smoke window fields", () => {
  const patched = applyLocalPatch(basePolicy(), {
    restrictions: {
      trust402LiveProcurement: "approved-for-manual-smoke",
      allowedOrigins: ["https://trust402.vercel.app"]
    },
    limits: {
      agentcashGlobalMaxAmountUsd: "0.03",
      manualSmokeRemainingBudgetUsd: "0.03",
      autoRefill: {
        enabled: false,
        futureThresholdUsd: 0.5
      }
    }
  });

  assert.equal(patched.wallet.address, basePolicy().wallet.address);
  assert.equal(patched.restrictions.trust402LiveProcurement, "approved-for-manual-smoke");
  assert.deepEqual(patched.restrictions.allowedOrigins, ["https://trust402.vercel.app"]);
  assert.equal(patched.limits.manualSmokeRemainingBudgetUsd, "0.03");
  assert.equal(patched.limits.autoRefill.enabled, false);
});

test("liveSmokeWindow previews without writing local policy", async () => {
  const cwd = makePolicyWorkspace();
  try {
    const before = readPolicy(cwd);
    const result = await liveSmokeWindow({
      baseUrl: "https://trust402.vercel.app",
      candidateEndpoint: "https://trust402.vercel.app/api/trust/compare-resources",
      candidatePriceUsd: 0.03,
      maxTotalUsd: 0.03,
      includeProof: false
    }, { cwd });
    const after = readPolicy(cwd);

    assert.equal(result.status, "ready-to-apply");
    assert.equal(result.safety.readOnly, true);
    assert.equal(result.safety.writesLocalPolicy, false);
    assert.deepEqual(after, before);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("liveSmokeWindow uses local AgentCash balance and reserve when planning", async () => {
  const cwd = makePolicyWorkspace({
    limits: {
      lastVerifiedBalanceUsd: 0.52,
      minimumReserveUsd: 0.5
    }
  });
  try {
    const result = await liveSmokeWindow({
      baseUrl: "https://trust402.vercel.app",
      candidateEndpoint: "https://trust402.vercel.app/api/trust/compare-resources",
      candidatePriceUsd: 0.03,
      maxTotalUsd: 0.03,
      includeProof: false
    }, { cwd });

    assert.equal(result.status, "blocked");
    assert.ok(result.blockers.some((item) => item.message.includes("minimum reserve")));
    assert.equal(result.localPolicySummary.limits.lastVerifiedBalanceUsd, 0.52);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("liveSmokeWindow applies local policy during run and restores it after", async () => {
  const cwd = makePolicyWorkspace();
  const originalEnv = process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED;
  process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED = "true";
  try {
    const original = readPolicy(cwd);
    let stagedDuringRun = null;
    const result = await liveSmokeWindow({
      baseUrl: "https://trust402.vercel.app",
      live: true,
      applyLocalPolicy: true,
      operatorKey: "test-operator-key",
      candidateEndpoint: "https://trust402.vercel.app/api/trust/compare-resources",
      candidatePriceUsd: 0.03,
      maxTotalUsd: 0.03,
      includeProof: false
    }, {
      cwd,
      liveEvidenceSmokeImpl: async () => {
        stagedDuringRun = readPolicy(cwd);
        return {
          ok: true,
          mode: "live",
          evidenceHash: "sha256:window",
          evidenceRefs: {
            liveProcurement: "sha256:procurement",
            dryRunOnly: false
          }
        };
      }
    });
    const restored = readPolicy(cwd);

    assert.equal(result.status, "completed");
    assert.equal(result.restoredAfterRun, true);
    assert.equal(stagedDuringRun.restrictions.trust402LiveProcurement, "approved-for-manual-smoke");
    assert.equal(stagedDuringRun.limits.manualSmokeRemainingBudgetUsd, "0.03");
    assert.deepEqual(restored, original);
  } finally {
    if (originalEnv === undefined) delete process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED;
    else process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED = originalEnv;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("liveSmokeWindow blocks live apply without explicit smoke-window approval", async () => {
  const cwd = makePolicyWorkspace();
  const originalEnv = process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED;
  delete process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED;
  try {
    await assert.rejects(
      liveSmokeWindow({
        baseUrl: "https://trust402.vercel.app",
        live: true,
        applyLocalPolicy: true,
        operatorKey: "test-operator-key",
        candidateEndpoint: "https://trust402.vercel.app/api/trust/compare-resources",
        candidatePriceUsd: 0.03,
        maxTotalUsd: 0.03,
        includeProof: false
      }, { cwd }),
      { code: "live_smoke_window_blocked" }
    );
  } finally {
    if (originalEnv === undefined) delete process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED;
    else process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED = originalEnv;
    rmSync(cwd, { recursive: true, force: true });
  }
});

function makePolicyWorkspace(overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "trust402-smoke-window-"));
  mkdirSync(join(cwd, ".local"), { recursive: true });
  writeFileSync(join(cwd, ".local", "trust402-agentcash-wallet.json"), `${JSON.stringify(basePolicy(cwd, overrides), null, 2)}\n`, "utf8");
  return cwd;
}

function readPolicy(cwd) {
  return JSON.parse(readFileSync(join(cwd, ".local", "trust402-agentcash-wallet.json"), "utf8"));
}

function basePolicy(cwd = process.cwd(), overrides = {}) {
  const limits = {
    agentcashGlobalMaxAmountUsd: 0.01,
    manualSmokeRemainingBudgetUsd: 0,
    lastVerifiedBalanceUsd: 1,
    minimumReserveUsd: 0.5,
    autoRefill: {
      enabled: false,
      futureThresholdUsd: 0.5
    },
    ...(overrides.limits || {})
  };
  return {
    service: "Trust402",
    status: "dedicated-for-trust402-operator-spend",
    wallet: {
      provider: "AgentCash",
      network: "base",
      address: "0x1111111111111111111111111111111111111111"
    },
    restrictions: {
      allowedProjectRoot: cwd,
      allowedOrigins: [
        "https://trust402.vercel.app"
      ],
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    },
    limits
  };
}
