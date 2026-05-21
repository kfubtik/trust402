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
  discoveryRegistryAllowlist: [],
  dailyAutonomyTargetWeights: "proof402=4,action402=4,trust402=3,external=1",
  dailyAutonomyExternalChance: 0,
  dailyAutonomyExternalRegistryUrls: [],
  dailyAutonomyExternalRegistryAllowlist: []
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
  assert.ok(["proof402", "action402", "trust402"].includes(result.interactionProfile.effectiveKnownTarget));
  assert.equal(result.interactionProfile.candidates.length, 1);
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

test("dailyAutonomyRun executes exactly one pseudo-random slot per date", async () => {
  const config = {
    ...baseConfig,
    dailyAutonomyEnabled: true,
    dailyAutonomyMode: "dry-run",
    dailyAutonomyLiveApproved: false,
    dailyAutonomyBudgetUsd: 0.02,
    dailyAutonomyMaxPaidCalls: 1,
    dailyAutonomyIncludeProofPreview: true,
    dailyAutonomyProof402Mode: "preview"
  };
  const morning = await dailyAutonomyRun({ slot: "morning" }, {
    cronAuthorized: true,
    now: "2026-05-21T00:00:00.000Z",
    config
  });
  const evening = await dailyAutonomyRun({ slot: "evening" }, {
    cronAuthorized: true,
    now: "2026-05-21T00:00:00.000Z",
    config
  });

  assert.deepEqual(new Set([morning.status, evening.status]), new Set(["executed", "skipped"]));
  const executed = [morning, evening].find((result) => result.status === "executed");
  const skipped = [morning, evening].find((result) => result.status === "skipped");
  assert.equal(executed.randomSchedule.selectedSlot, skipped.randomSchedule.selectedSlot);
  assert.equal(skipped.paidSubcallsMade, 0);
});

test("dailyAutonomyRun can focus Action402 as a known ecosystem agent", async () => {
  const result = await dailyAutonomyRun({}, {
    cronAuthorized: true,
    now: "2026-05-21T00:00:00.000Z",
    config: {
      ...baseConfig,
      dailyAutonomyEnabled: true,
      dailyAutonomyMode: "dry-run",
      dailyAutonomyLiveApproved: false,
      dailyAutonomyBudgetUsd: 0.02,
      dailyAutonomyMaxPaidCalls: 1,
      dailyAutonomyIncludeProofPreview: true,
      dailyAutonomyProof402Mode: "preview",
      dailyAutonomyTargetWeights: "action402=1",
      dailyAutonomyExternalChance: 0
    }
  });

  assert.equal(result.interactionProfile.primaryTarget, "action402");
  assert.equal(result.interactionProfile.candidates[0].id, "action402.execute_webhook");
  assert.equal(result.run.quote.quote.selectedResources[0].id, "action402.execute_webhook");
});

test("dailyAutonomyRun can include external registry discovery only through allowlisted config", async () => {
  const result = await dailyAutonomyRun({}, {
    cronAuthorized: true,
    now: "2026-05-21T00:00:00.000Z",
    config: {
      ...baseConfig,
      dailyAutonomyEnabled: true,
      dailyAutonomyMode: "dry-run",
      dailyAutonomyLiveApproved: false,
      dailyAutonomyBudgetUsd: 0.02,
      dailyAutonomyMaxPaidCalls: 1,
      dailyAutonomyIncludeProofPreview: true,
      dailyAutonomyProof402Mode: "preview",
      dailyAutonomyTargetWeights: "external=1",
      dailyAutonomyExternalChance: 1,
      dailyAutonomyExternalRegistryUrls: ["https://registry.example/resources.json"],
      dailyAutonomyExternalRegistryAllowlist: ["https://registry.example"]
    },
    fetchImpl: async () => new Response(JSON.stringify({
      paidLaunchResources: [{
        id: "external-agent",
        path: "/api/paid",
        method: "POST",
        priceUsd: 0.01,
        description: "External allowlisted x402 agent resource for occasional daily discovery.",
        payTo: "0x1111111111111111111111111111111111111111"
      }]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });

  assert.equal(result.interactionProfile.primaryTarget, "external");
  assert.equal(result.interactionProfile.externalSelected, true);
  assert.equal(result.interactionProfile.externalRegistryConfigured, true);
  assert.equal(result.run.discovery.summary.fetchedRegistryCandidates, 1);
});

test("vercel cron is wired to two pseudo-random daily autonomy slots", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/cron/daily-autonomous/morning"));
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/cron/daily-autonomous/evening"));
  assert.ok(vercel.crons.some((cron) => cron.schedule === "10 1 * * *"));
  assert.ok(vercel.crons.some((cron) => cron.schedule === "47 13 * * *"));
});
