import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dailyAutonomyRun } from "../src/dailyAutonomy.js";

const baseConfig = {
  publicBaseUrl: "https://trust402.example",
  proof402BaseUrl: "https://proof402.vercel.app",
  proof402DelegationMode: "preview",
  proof402MaxSpendUsd: 0,
  liveSpendEnabled: false,
  livePaymentProvider: "disabled",
  liveMaxPerCallUsd: 0,
  liveMaxPerJobUsd: 0,
  liveDailyLimitUsd: 0,
  liveSpentTodayUsd: 0,
  liveAllowedRegistries: [],
  liveEndpointDenylist: [],
  x402Network: "eip155:8453",
  x402Asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  requestTimeoutMs: 100,
  maxJsonBytes: 10000,
  discoveryRegistryUrls: [],
  discoveryRegistryAllowlist: []
};

test("dailyAutonomyRun stays disabled until explicitly enabled", async () => {
  const result = await dailyAutonomyRun({}, {
    config: {
      ...baseConfig,
      dailyAutonomyEnabled: false,
      dailyAutonomyMode: "dry-run",
      dailyAutonomyLiveApproved: false
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "cron.daily_autonomy");
  assert.equal(result.status, "disabled");
  assert.equal(result.paidSubcallsMade, 0);
  assert.equal(result.safety.mutatesWallet, false);
});

test("dailyAutonomyRun executes a dry-run autonomous job with proof preview", async () => {
  const result = await dailyAutonomyRun({}, {
    cronAuthorized: true,
    config: {
      ...baseConfig,
      dailyAutonomyEnabled: true,
      dailyAutonomyMode: "dry-run",
      dailyAutonomyLiveApproved: false,
      dailyAutonomyBudgetUsd: 0.02,
      dailyAutonomyMaxPaidCalls: 1,
      dailyAutonomyIncludeProofPreview: true,
      dailyAutonomyProof402Mode: "preview"
    }
  });

  assert.equal(result.status, "executed");
  assert.equal(result.requestedMode, "dry-run");
  assert.equal(result.effectiveMode, "dry-run");
  assert.equal(result.paidSubcallsMade, 0);
  assert.equal(result.run.mode, "dry-run");
  assert.equal(result.run.proof.delegation.paidProofCallMade, false);
  assert.match(result.resultHash, /^sha256:[a-f0-9]{64}$/);
});

test("dailyAutonomyRun falls back to dry-run when live is requested without approval", async () => {
  const result = await dailyAutonomyRun({}, {
    config: {
      ...baseConfig,
      dailyAutonomyEnabled: true,
      dailyAutonomyMode: "live",
      dailyAutonomyLiveApproved: false,
      dailyAutonomyBudgetUsd: 0.02,
      dailyAutonomyMaxPaidCalls: 1,
      liveSpendEnabled: false
    }
  });

  assert.equal(result.status, "executed");
  assert.equal(result.requestedMode, "live");
  assert.equal(result.effectiveMode, "dry-run");
  assert.equal(result.safety.requestedLiveFallsBackToDryRun, true);
  assert.ok(result.liveBlockers.some((blocker) => blocker.id === "cron_not_authorized"));
  assert.ok(result.liveBlockers.some((blocker) => blocker.id === "daily_live_not_approved"));
  assert.ok(result.liveBlockers.some((blocker) => blocker.id === "live_spend_disabled"));
  assert.equal(result.paidSubcallsMade, 0);
});

test("vercel cron is wired to the daily autonomy endpoint", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/cron/daily-autonomous"));
  assert.ok(vercel.crons.some((cron) => cron.schedule === "10 1 * * *"));
});
