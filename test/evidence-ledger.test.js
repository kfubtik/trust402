import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvidenceLedger, createEvidenceLedgerRecord } from "../src/evidenceLedger.js";

test("createEvidenceLedgerRecord redacts secret-like keys and keeps public evidence refs", () => {
  const record = createEvidenceLedgerRecord({
    source: "test",
    result: {
      tool: "live.evidence_smoke",
      mode: "live",
      baseUrl: "https://trust402.example",
      evidenceHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evidenceRefs: {
        liveProcurement: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      operatorKey: "should-not-leak",
      stages: [
        {
          id: "procurement_execute",
          status: "live-complete",
          hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          details: {
            authorization: "Bearer secret",
            paidSubcallsMade: 1
          }
        }
      ]
    }
  });

  assert.match(record.recordHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(record.evidenceRefs.liveProcurement.startsWith("sha256:"), true);
  assert.equal(record.stages[0].details.authorization, "[redacted]");
  assert.equal(JSON.stringify(record).includes("should-not-leak"), false);
});

test("appendEvidenceLedger writes jsonl under the requested local directory", () => {
  const cwd = mkdtempSync(join(tmpdir(), "trust402-ledger-"));
  const result = appendEvidenceLedger({
    source: "test",
    result: {
      tool: "live.evidence_smoke",
      mode: "dry-run",
      baseUrl: "https://trust402.example",
      evidenceHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evidenceRefs: { dryRunOnly: true }
    }
  }, {
    cwd,
    ledgerDir: ".local/evidence-ledger-test"
  });

  assert.equal(result.written, true);
  assert.equal(result.ledgerPath, ".local/evidence-ledger-test/trust402-evidence.jsonl");
  const line = readFileSync(join(cwd, result.ledgerPath), "utf8").trim();
  const parsed = JSON.parse(line);
  assert.equal(parsed.recordHash, result.recordHash);
  assert.equal(parsed.evidenceRefs.dryRunOnly, true);
});

test("appendEvidenceLedger rejects paths outside the workspace", () => {
  const cwd = mkdtempSync(join(tmpdir(), "trust402-ledger-"));
  assert.throws(() => appendEvidenceLedger({
    source: "test",
    result: {
      tool: "live.evidence_smoke",
      mode: "dry-run",
      evidenceHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  }, {
    cwd,
    ledgerDir: "../outside-trust402"
  }), /must stay inside/);
});
