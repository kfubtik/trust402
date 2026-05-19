#!/usr/bin/env node
import { errorBody } from "../src/errors.js";
import { liveSmokeWindow } from "../src/liveSmokeWindow.js";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || args._.find((item) => /^https?:\/\//.test(item)) || process.env.PUBLIC_BASE_URL || "https://trust402.vercel.app";

try {
  const result = await liveSmokeWindow({
    baseUrl,
    live: args.live === true,
    applyLocalPolicy: args.applyLocalPolicy === true,
    approved: process.env.TRUST402_LIVE_SMOKE_WINDOW_APPROVED === "true",
    restoreAfter: args.keepLocalPolicy !== true,
    allowPersistentPolicy: args.allowPersistentPolicy === true,
    operatorKey: args.operatorKey || process.env.TRUST402_OPERATOR_API_KEY || "",
    candidateEndpoint: args.candidateEndpoint || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_ENDPOINT || "",
    candidateId: args.candidateId || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_ID || "",
    candidatePriceUsd: args.candidatePrice || process.env.TRUST402_LIVE_SMOKE_CANDIDATE_PRICE_USD || "",
    candidateContentHash: args.candidateContentHash || "",
    candidateLabel: args.candidateLabel || "",
    candidateIdempotencyKey: args.candidateIdempotencyKey || "",
    maxTotalUsd: args.maxTotalUsd || process.env.TRUST402_LIVE_EVIDENCE_MAX_TOTAL_USD || "",
    proofReserveUsd: args.proofReserveUsd || process.env.TRUST402_LIVE_EVIDENCE_PROOF_RESERVE_USD || "",
    liveSpentTodayUsd: args.liveSpentTodayUsd || process.env.LIVE_SPENT_TODAY_USD || "",
    paymentProvider: args.paymentProvider || "",
    includeProof: args.skipProof !== true,
    includeAutonomous: args.includeAutonomousLive === true,
    includeAutoRefill: args.includeAutoRefill === true,
    includeRefill: args.skipRefill !== true,
    includeRefillLive: args.includeRefillLive === true,
    agentcashBalanceUsd: args.agentcashBalance || process.env.TRUST402_AGENTCASH_BALANCE_USD || "",
    amountRefilledTodayUsd: args.refilledToday || ""
  }, {
    writeEvidenceLedger: args.writeEvidence === true || process.env.TRUST402_WRITE_EVIDENCE_LEDGER === "true",
    evidenceLedgerDir: args.evidenceDir || process.env.TRUST402_EVIDENCE_LEDGER_DIR || undefined
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify(errorBody(error), null, 2));
  process.exit(1);
}

function parseArgs(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) {
      parsed._.push(item);
      continue;
    }
    const raw = item.slice(2);
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      parsed[toCamel(raw.slice(0, eq))] = raw.slice(eq + 1);
      continue;
    }
    const key = toCamel(raw);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
