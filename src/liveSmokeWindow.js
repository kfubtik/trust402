import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./errors.js";
import { LOCAL_AGENTCASH_POLICY_PATH, readLocalAgentcashPolicy } from "./localAgentcashPolicy.js";
import { liveEvidenceSmoke } from "./liveEvidenceSmoke.js";
import { liveWindowPlan } from "./liveWindowPlan.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";

export async function liveSmokeWindow(input = {}, options = {}) {
  const cwd = options.cwd || process.cwd();
  const policyPath = input.policyPath || LOCAL_AGENTCASH_POLICY_PATH;
  const baseUrl = normalizeBaseUrl(input.baseUrl || DEFAULT_BASE_URL);
  const plan = liveWindowPlan({
    ...input,
    baseUrl,
    includeProof: input.includeProof !== false,
    includeAutonomous: input.includeAutonomous === true,
    includeAutoRefill: input.includeAutoRefill === true
  }, options);
  const policyResult = readLocalAgentcashPolicy({ cwd, policyPath });
  const preview = previewResult({ input, plan, policyResult, policyPath });

  if (input.live !== true || input.applyLocalPolicy !== true) {
    return preview;
  }

  const blockers = liveBlockers({ input, plan, policyResult });
  if (blockers.length > 0) {
    throw new ApiError(403, "live_smoke_window_blocked", "Live smoke window is blocked by local approval policy.", {
      blockers,
      planHash: plan.planHash,
      policyPath
    });
  }

  const absolutePolicyPath = safePolicyPath(cwd, policyPath);
  const originalPolicy = JSON.parse(readFileSync(absolutePolicyPath, "utf8"));
  const stagedPolicy = applyLocalPatch(originalPolicy, plan.localPolicyPatch);
  let restored = false;
  let smokeResult = null;

  try {
    writeJson(absolutePolicyPath, stagedPolicy);
    const run = options.liveEvidenceSmokeImpl || liveEvidenceSmoke;
    smokeResult = await run({
      ...input,
      baseUrl,
      mode: "live",
      live: true,
      approved: true,
      includeProof: input.includeProof !== false,
      includeAutonomous: input.includeAutonomous === true,
      includeRefill: input.includeRefill !== false
    }, {
      ...options,
      cwd
    });
  } finally {
    if (input.restoreAfter !== false) {
      writeJson(absolutePolicyPath, originalPolicy);
      restored = true;
    }
  }

  return {
    ok: true,
    tool: "live.smoke_window",
    generatedAt: new Date().toISOString(),
    status: "completed",
    baseUrl,
    planHash: plan.planHash,
    policyPath,
    stagedPolicySummary: summarizeStagedPolicy(stagedPolicy),
    restoredAfterRun: restored,
    smoke: smokeResult,
    safety: {
      appliedLocalPolicy: true,
      restoreAfterDefault: true,
      persistentPolicyAllowed: input.restoreAfter === false && input.allowPersistentPolicy === true,
      sendsPaymentHeadersFromRunner: false,
      mutatesWallet: true,
      mutatesWalletOnlyThroughLiveEvidenceSmoke: true,
      includesPrivateKeyMaterial: false
    }
  };
}

export function applyLocalPatch(policy, patch) {
  return {
    ...policy,
    restrictions: {
      ...(policy.restrictions || {}),
      ...(patch.restrictions || {})
    },
    limits: {
      ...(policy.limits || {}),
      ...(patch.limits || {}),
      autoRefill: {
        ...(policy.limits?.autoRefill || {}),
        ...(patch.limits?.autoRefill || {})
      }
    }
  };
}

function previewResult({ input, plan, policyResult, policyPath }) {
  const ready = plan.status === "ready-to-stage" && policyResult.present && policyResult.policy;
  return {
    ok: true,
    tool: "live.smoke_window",
    generatedAt: new Date().toISOString(),
    status: ready ? "ready-to-apply" : "blocked",
    planHash: plan.planHash,
    planStatus: plan.status,
    policyPath,
    localPolicyPresent: policyResult.present,
    localPolicySummary: policyResult.summary,
    blockers: [
      ...plan.blockers.map((message) => ({ id: "window_plan_blocker", message })),
      ...(policyResult.policy ? [] : [{ id: "local_policy_missing", message: `${policyPath} must exist before staging a live smoke window.` }])
    ],
    requiredApproval: "Set TRUST402_LIVE_SMOKE_WINDOW_APPROVED=true and pass --live --apply-local-policy for a bounded run.",
    command: plan.command,
    safety: {
      readOnly: true,
      writesLocalPolicy: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      includesPrivateKeyMaterial: false,
      restoreAfterDefault: true,
      liveRequested: input.live === true,
      applyLocalPolicyRequested: input.applyLocalPolicy === true
    }
  };
}

function liveBlockers({ input, plan, policyResult }) {
  const blockers = [];
  if (process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED !== "true" && input.approved !== true) {
    blockers.push("Set TRUST402_LIVE_SMOKE_WINDOW_APPROVED=true before applying a live smoke window.");
  }
  if (plan.status !== "ready-to-stage") {
    blockers.push(...plan.blockers.map((item) => `window_plan: ${item}`));
  }
  if (!policyResult.present || !policyResult.policy) {
    blockers.push(`${policyResult.policyPath || LOCAL_AGENTCASH_POLICY_PATH} must exist and parse before applying a live smoke window.`);
  }
  if (input.restoreAfter === false && input.allowPersistentPolicy !== true) {
    blockers.push("Persistent local policy changes require --allow-persistent-policy; default is restore-after-run.");
  }
  return blockers;
}

function safePolicyPath(cwd, policyPath) {
  const root = resolve(cwd);
  const absolutePath = resolve(cwd, policyPath || LOCAL_AGENTCASH_POLICY_PATH);
  const relativeOk = absolutePath.toLowerCase() === root.toLowerCase() ||
    absolutePath.toLowerCase().startsWith(`${root.toLowerCase()}\\`) ||
    absolutePath.toLowerCase().startsWith(`${root.toLowerCase()}/`);
  if (!relativeOk) {
    throw new ApiError(400, "unsafe_policy_path", "Local policy path must stay inside the Trust402 checkout.", {
      policyPath
    });
  }
  return absolutePath;
}

function writeJson(path, value) {
  const directory = dirname(path);
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function summarizeStagedPolicy(policy) {
  return {
    service: policy.service,
    status: policy.status,
    allowedOriginsCount: Array.isArray(policy.restrictions?.allowedOrigins) ? policy.restrictions.allowedOrigins.length : 0,
    trust402LiveProcurement: policy.restrictions?.trust402LiveProcurement || null,
    proof402Delegation: policy.restrictions?.proof402Delegation || null,
    agentcashGlobalMaxAmountUsd: policy.limits?.agentcashGlobalMaxAmountUsd ?? null,
    manualSmokeRemainingBudgetUsd: policy.limits?.manualSmokeRemainingBudgetUsd ?? null,
    autoRefillEnabled: policy.limits?.autoRefill?.enabled ?? null
  };
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("Use scripts/live-smoke-window.js instead.");
}
