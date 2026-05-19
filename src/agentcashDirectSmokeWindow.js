import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ApiError } from "./errors.js";
import { agentcashDirectSmokePlan } from "./agentcashDirectSmokePlan.js";
import { sha256Json } from "./hash.js";
import { applyLocalPatch } from "./liveSmokeWindow.js";
import { LOCAL_AGENTCASH_POLICY_PATH, readLocalAgentcashPolicy, summarizePolicy } from "./localAgentcashPolicy.js";

const DEFAULT_STATE_PATH = ".local/trust402-agentcash-direct-smoke-window.json";

export function agentcashDirectSmokeWindow(input = {}, options = {}) {
  const cwd = options.cwd || process.cwd();
  const mode = input.mode || (input.open ? "open" : input.close ? "close" : "status");
  const policyPath = input.policyPath || LOCAL_AGENTCASH_POLICY_PATH;
  const statePath = input.statePath || DEFAULT_STATE_PATH;
  const absolutePolicyPath = safePath(cwd, policyPath);
  const absoluteStatePath = safePath(cwd, statePath);
  const policyResult = readLocalAgentcashPolicy({ cwd, policyPath });
  const plan = agentcashDirectSmokePlan(input, {
    ...options,
    cwd,
    localAgentcashPolicyResult: policyResult
  });
  const state = readState(absoluteStatePath);

  if (mode === "status") {
    return statusResult({ plan, policyResult, state, policyPath, statePath });
  }

  if (mode === "open") {
    return openWindow({
      input,
      cwd,
      plan,
      policyResult,
      policyPath,
      statePath,
      absolutePolicyPath,
      absoluteStatePath,
      state
    });
  }

  if (mode === "close") {
    return closeWindow({
      cwd,
      policyPath,
      statePath,
      absolutePolicyPath,
      absoluteStatePath,
      state
    });
  }

  throw new ApiError(400, "unsupported_agentcash_direct_smoke_window_mode", "Mode must be status, open, or close.", {
    mode
  });
}

function statusResult({ plan, policyResult, state, policyPath, statePath }) {
  return {
    ok: true,
    tool: "agentcash.direct_smoke_window",
    generatedAt: new Date().toISOString(),
    mode: "status",
    status: state ? "open" : "closed",
    policyWindowReady: plan.policyWindowReady,
    planStatus: plan.status,
    planHash: plan.planHash,
    policyPath,
    statePath,
    localPolicy: policyResult.summary,
    openWindow: state ? publicState(state) : null,
    approval: plan.approval,
    nextActions: state
      ? [
          "Run the unpaid schema check and approved paid fetch while this local policy window is open.",
          "Run npm run agentcash:direct-smoke-window -- --close immediately after the paid fetch or any failure."
        ]
      : plan.nextActions,
    safety: {
      readOnly: true,
      writesLocalPolicy: false,
      callsAgentcashMcp: false,
      executesPayment: false,
      printsPrivateKeys: false
    }
  };
}

function openWindow({
  input,
  cwd,
  plan,
  policyResult,
  policyPath,
  statePath,
  absolutePolicyPath,
  absoluteStatePath,
  state
}) {
  const blockers = [];
  if (state && input.force !== true) blockers.push("A direct smoke policy window is already open; close it before opening another.");
  if (!policyResult.present || !policyResult.policy) blockers.push(`${policyPath} must exist and parse before opening a direct smoke policy window.`);
  if (!approvalMatches(input, plan)) blockers.push("Exact one-line approval text is required before opening a direct smoke policy window.");
  if (plan.targetResource?.id !== "trust402.compare_resources") blockers.push("The current direct smoke window helper is scoped to trust402.compare_resources.");

  if (blockers.length > 0) {
    throw new ApiError(403, "agentcash_direct_smoke_window_blocked", "AgentCash direct smoke policy window is blocked.", {
      blockers,
      planHash: plan.planHash,
      policyPath,
      statePath
    });
  }

  const originalPolicy = policyResult.policy;
  const stagedPolicy = applyLocalPatch(originalPolicy, plan.requiredLocalPolicyPatch);
  const nextState = {
    openedAt: new Date().toISOString(),
    service: "Trust402",
    purpose: "one-shot-agentcash-direct-smoke",
    cwd: resolve(cwd),
    policyPath,
    statePath,
    planHash: plan.planHash,
    approvalHash: sha256Json({
      approval: plan.approval.oneLineApproval,
      target: plan.candidateEndpoint,
      maxAmount: plan.mcpCallOrder?.[1]?.input?.maxAmount
    }),
    schemaCheckInputHash: plan.mcpCallOrder?.[0]?.inputHash || null,
    paidFetchInputHash: plan.mcpCallOrder?.[1]?.inputHash || null,
    originalPolicyHash: sha256Json(originalPolicy),
    stagedPolicyHash: sha256Json(stagedPolicy),
    originalPolicy
  };

  writeJson(absolutePolicyPath, stagedPolicy);
  writeJson(absoluteStatePath, nextState);
  const after = readLocalAgentcashPolicy({ cwd, policyPath });

  return {
    ok: true,
    tool: "agentcash.direct_smoke_window",
    generatedAt: new Date().toISOString(),
    mode: "open",
    status: "open",
    policyPath,
    statePath,
    planHash: plan.planHash,
    openedWindow: publicState(nextState),
    localPolicy: after.summary,
    mcpCallOrder: plan.mcpCallOrder,
    closeCommand: "npm run agentcash:direct-smoke-window -- --close",
    safety: {
      readOnly: false,
      writesLocalPolicy: true,
      writesStateFile: true,
      callsAgentcashMcp: false,
      executesPayment: false,
      printsPrivateKeys: false,
      restoreRequired: true
    }
  };
}

function closeWindow({ cwd, policyPath, statePath, absolutePolicyPath, absoluteStatePath, state }) {
  if (!state?.originalPolicy) {
    throw new ApiError(409, "agentcash_direct_smoke_window_not_open", "No direct smoke policy window state exists to close.", {
      statePath
    });
  }

  writeJson(absolutePolicyPath, state.originalPolicy);
  unlinkSync(absoluteStatePath);
  const after = readLocalAgentcashPolicy({ cwd, policyPath });

  return {
    ok: true,
    tool: "agentcash.direct_smoke_window",
    generatedAt: new Date().toISOString(),
    mode: "close",
    status: "closed",
    policyPath,
    statePath,
    closedWindow: publicState(state),
    localPolicy: after.summary,
    safety: {
      readOnly: false,
      writesLocalPolicy: true,
      removesStateFile: true,
      callsAgentcashMcp: false,
      executesPayment: false,
      printsPrivateKeys: false,
      restoredOriginalPolicy: true
    }
  };
}

function approvalMatches(input, plan) {
  const approval = input.approval || process.env.TRUST402_AGENTCASH_DIRECT_SMOKE_APPROVAL || "";
  return approval === plan.approval?.oneLineApproval;
}

function readState(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function publicState(state) {
  return {
    openedAt: state.openedAt,
    service: state.service,
    purpose: state.purpose,
    planHash: state.planHash,
    approvalHash: state.approvalHash,
    schemaCheckInputHash: state.schemaCheckInputHash,
    paidFetchInputHash: state.paidFetchInputHash,
    originalPolicyHash: state.originalPolicyHash,
    stagedPolicyHash: state.stagedPolicyHash,
    originalPolicySummary: state.originalPolicy ? summarizePolicy(state.originalPolicy, { policyPath: state.policyPath }) : null
  };
}

function safePath(cwd, value) {
  const root = resolve(cwd);
  const absolutePath = resolve(cwd, value);
  const rootLower = root.toLowerCase();
  const absoluteLower = absolutePath.toLowerCase();
  if (
    absoluteLower !== rootLower &&
    !absoluteLower.startsWith(`${rootLower}\\`) &&
    !absoluteLower.startsWith(`${rootLower}/`)
  ) {
    throw new ApiError(400, "unsafe_agentcash_window_path", "AgentCash direct smoke window paths must stay inside the Trust402 checkout.", {
      path: value
    });
  }
  return absolutePath;
}

function writeJson(path, value) {
  const directory = dirname(path);
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
