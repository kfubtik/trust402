import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { agentcashDirectSmokeWindow } from "../src/agentcashDirectSmokeWindow.js";

const approvalText = "Разрешаю одноразовый AgentCash paid fetch для https://trust402.vercel.app/api/trust/compare-resources с maxAmount $0.03, временно открыть local policy window на $0.03 и после проверки снова закрыть бюджет.";
const TEST_AGENTCASH_BASE_ADDRESS = "0x1111111111111111111111111111111111111111";

test("agentcashDirectSmokeWindow status is read-only and reports a closed window", () => {
  const cwd = makePolicyWorkspace();
  try {
    const before = readPolicy(cwd);
    const result = agentcashDirectSmokeWindow({ mode: "status" }, { cwd, config: testConfig() });
    const after = readPolicy(cwd);

    assert.equal(result.status, "closed");
    assert.equal(result.safety.readOnly, true);
    assert.equal(result.safety.writesLocalPolicy, false);
    assert.deepEqual(after, before);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("agentcashDirectSmokeWindow refuses to open without exact approval", () => {
  const cwd = makePolicyWorkspace();
  try {
    assert.throws(
      () => agentcashDirectSmokeWindow({ mode: "open", approval: "yes" }, { cwd, config: testConfig() }),
      { code: "agentcash_direct_smoke_window_blocked" }
    );
    assert.equal(existsSync(join(cwd, ".local", "trust402-agentcash-direct-smoke-window.json")), false);
    assert.equal(readPolicy(cwd).limits.manualSmokeRemainingBudgetUsd, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("agentcashDirectSmokeWindow opens and closes a bounded local policy window", () => {
  const cwd = makePolicyWorkspace();
  try {
    const original = readPolicy(cwd);
    const open = agentcashDirectSmokeWindow({
      mode: "open",
      approval: approvalText
    }, { cwd, config: testConfig() });
    const staged = readPolicy(cwd);
    const statePath = join(cwd, ".local", "trust402-agentcash-direct-smoke-window.json");

    assert.equal(open.status, "open");
    assert.equal(open.safety.executesPayment, false);
    assert.equal(open.safety.callsAgentcashMcp, false);
    assert.equal(open.localPolicy.restrictions.trust402LiveProcurement, "approved-for-manual-smoke");
    assert.equal(staged.limits.manualSmokeRemainingBudgetUsd, "0.03");
    assert.equal(staged.limits.agentcashGlobalMaxAmountUsd, "0.03");
    assert.equal(existsSync(statePath), true);
    assert.match(open.openedWindow.paidFetchInputHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(open).includes(original.wallet.address), false);

    const close = agentcashDirectSmokeWindow({ mode: "close" }, { cwd, config: testConfig() });
    const restored = readPolicy(cwd);

    assert.equal(close.status, "closed");
    assert.equal(close.safety.restoredOriginalPolicy, true);
    assert.equal(existsSync(statePath), false);
    assert.deepEqual(restored, original);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("agentcashDirectSmokeWindow blocks a second open until the first is closed", () => {
  const cwd = makePolicyWorkspace();
  try {
    agentcashDirectSmokeWindow({ mode: "open", approval: approvalText }, { cwd, config: testConfig() });

    assert.throws(
      () => agentcashDirectSmokeWindow({ mode: "open", approval: approvalText }, { cwd, config: testConfig() }),
      { code: "agentcash_direct_smoke_window_blocked" }
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function makePolicyWorkspace() {
  const cwd = mkdtempSync(join(tmpdir(), "trust402-direct-window-"));
  mkdirSync(join(cwd, ".local"), { recursive: true });
  writeFileSync(join(cwd, ".local", "trust402-agentcash-wallet.json"), `${JSON.stringify(basePolicy(cwd), null, 2)}\n`, "utf8");
  return cwd;
}

function readPolicy(cwd) {
  return JSON.parse(readFileSync(join(cwd, ".local", "trust402-agentcash-wallet.json"), "utf8"));
}

function testConfig() {
  return {
    publicBaseUrl: "https://trust402.vercel.app",
    proof402BaseUrl: "https://proof402.vercel.app",
    livePaymentProvider: "disabled"
  };
}

function basePolicy(cwd) {
  return {
    service: "Trust402",
    status: "dedicated-for-trust402-operator-spend",
    wallet: {
      provider: "AgentCash",
      network: "base",
      address: TEST_AGENTCASH_BASE_ADDRESS
    },
    restrictions: {
      allowedProjectRoot: cwd,
      allowedOrigins: [
        "https://trust402.vercel.app",
        "https://proof402.vercel.app"
      ],
      trust402LiveProcurement: "disabled-until-separate-approval",
      proof402Delegation: "disabled-until-separate-approval"
    },
    limits: {
      agentcashGlobalMaxAmountUsd: 0.01,
      manualSmokeRemainingBudgetUsd: 0,
      lastVerifiedBalanceUsd: 1.283,
      minimumReserveUsd: 0.5,
      autoRefill: {
        enabled: false,
        futureThresholdUsd: 0.5
      }
    }
  };
}
