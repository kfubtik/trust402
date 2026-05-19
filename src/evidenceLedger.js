import { appendFileSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { sha256Json } from "./hash.js";

const DEFAULT_LEDGER_DIR = ".local/evidence-ledger";
const DEFAULT_LEDGER_FILE = "trust402-evidence.jsonl";
const SENSITIVE_KEY_RE = /(secret|token|private|password|authorization|operator.?key|payment.?signature|x.?payment|cookie)/i;

export function createEvidenceLedgerRecord(input = {}) {
  const result = input.result || {};
  const publicResult = sanitizePublic(result);
  const recordCore = {
    schema: "trust402.evidence_ledger.v1",
    source: input.source || publicResult.tool || "trust402",
    mode: publicResult.mode || input.mode || "unknown",
    baseUrl: publicResult.baseUrl || input.baseUrl || null,
    generatedAt: input.generatedAt || new Date().toISOString(),
    evidenceHash: publicResult.evidenceHash || input.evidenceHash || null,
    evidenceRefs: publicResult.evidenceRefs || {},
    suggestedEnv: publicResult.suggestedEnv || null,
    stages: Array.isArray(publicResult.stages)
      ? publicResult.stages.map((item) => ({
          id: item.id,
          status: item.status,
          hash: item.hash || null,
          details: sanitizePublic(item.details || {})
        }))
      : [],
    safety: {
      storesPrivatePayload: false,
      includesSecretValues: false,
      sendsPaymentHeadersFromLedger: false,
      ...sanitizePublic(publicResult.safety || {})
    }
  };
  return {
    ...recordCore,
    recordHash: sha256Json(recordCore)
  };
}

export function writeEvidenceLedgerRecord(record, options = {}) {
  const cwd = options.cwd || process.cwd();
  const ledgerDir = resolve(cwd, options.ledgerDir || DEFAULT_LEDGER_DIR);
  assertPathInsideCwd(cwd, ledgerDir);
  const ledgerPath = resolve(ledgerDir, options.ledgerFile || DEFAULT_LEDGER_FILE);
  assertPathInsideCwd(cwd, ledgerPath);
  mkdirSync(ledgerDir, { recursive: true });
  appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, "utf8");
  return {
    written: true,
    ledgerPath: relativeForOutput(cwd, ledgerPath),
    recordHash: record.recordHash
  };
}

export function appendEvidenceLedger(input = {}, options = {}) {
  const record = createEvidenceLedgerRecord(input);
  const write = writeEvidenceLedgerRecord(record, options);
  return {
    ...write,
    record
  };
}

export function sanitizePublic(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizePublic(item));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = sanitizePublic(raw);
  }
  return out;
}

function relativeForOutput(cwd, path) {
  const normalizedCwd = resolve(cwd);
  const normalizedPath = resolve(path);
  const rel = relative(normalizedCwd, normalizedPath);
  if (!rel.startsWith("..") && !isAbsolute(rel)) {
    return rel.replaceAll("\\", "/");
  }
  return join("...", normalizedPath.split(/[\\/]/).slice(-2).join("/")).replaceAll("\\", "/");
}

function assertPathInsideCwd(cwd, path) {
  const rel = relative(resolve(cwd), resolve(path));
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Evidence ledger path must stay inside the Trust402 workspace.");
  }
}
