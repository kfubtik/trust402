import { sha256Json } from "./hash.js";

export function finalVerificationReport({
  baseUrl,
  checks,
  productionAudit,
  includeDetails = false
}) {
  const normalizedChecks = checks.map((check) => ({
    id: check.id,
    status: check.status,
    required: check.required,
    skipped: check.skipped,
    exitCode: check.exitCode ?? null,
    durationMs: check.durationMs ?? null
  }));
  const requirementStatuses = Object.fromEntries(
    (productionAudit?.requirements || []).map((item) => [item.id, item.status])
  );
  const failedRequired = checks.filter((check) => check.required && check.status !== "passed");
  const nonFinalOpenRequirements = Object.entries(requirementStatuses)
    .filter(([id, status]) => id !== "final_verification" && status !== "verified")
    .map(([id, status]) => ({ id, status }));
  const finalRequirementStatus = requirementStatuses.final_verification || "missing";
  const externalEvidence = externalEvidenceFromChecks(checks);
  const externalBlockers = externalEvidenceBlockers(externalEvidence);
  const commandsPassed = failedRequired.length === 0;
  const externalEvidenceReady = externalBlockers.length === 0;
  const readyForFinalEvidence = commandsPassed &&
    nonFinalOpenRequirements.length === 0 &&
    externalEvidenceReady;
  const goalComplete = productionAudit?.goalComplete === true && externalEvidenceReady;
  const status = goalComplete
    ? "complete"
    : readyForFinalEvidence
      ? "ready-for-final-evidence"
      : "blocked";
  const hashChecks = normalizedChecks.map(({ durationMs, ...check }) => check);
  const evidenceSubject = {
    baseUrl,
    checks: hashChecks,
    requirementStatuses,
    productionGoalComplete: goalComplete,
    productionSummary: productionAudit?.summary || null,
    externalEvidence
  };
  const verificationHash = sha256Json(evidenceSubject);

  return {
    ok: true,
    tool: "final.verification",
    generatedAt: new Date().toISOString(),
    status,
    baseUrl,
    verificationHash,
    summary: {
      commandsPassed,
      checks: checks.length,
      passed: checks.filter((check) => check.status === "passed").length,
      failedRequired: failedRequired.length,
      skipped: checks.filter((check) => check.skipped).length,
      nonFinalOpenRequirements: nonFinalOpenRequirements.length,
      finalRequirementStatus,
      productionGoalComplete: goalComplete,
      externalEvidenceBlockers: externalBlockers.length,
      cdpBazaarStatus: externalEvidence?.cdpBazaar?.status || "not-observed",
      externalDirectoryStatus: externalEvidence?.externalDirectories?.status || "not-observed"
    },
    blockers: [
      ...failedRequired.map((check) => ({
        id: check.id,
        status: check.status,
        nextAction: check.nextAction || "Inspect command output and rerun the check."
      })),
      ...externalBlockers,
      ...nonFinalOpenRequirements.map((item) => ({
        id: item.id,
        status: item.status,
        nextAction: "Resolve this requirement in /api/completion/audit before recording final verification evidence."
      }))
    ],
    suggestedEnv: readyForFinalEvidence && !goalComplete
      ? {
          TRUST402_FINAL_VERIFICATION_OBSERVED: "true",
          TRUST402_FINAL_VERIFICATION_EVIDENCE_REF: verificationHash
        }
      : null,
    checks: checks.map((check) => publicCheck(check, includeDetails)),
    productionAudit: productionAudit
      ? {
          goalComplete: productionAudit.goalComplete,
          summary: productionAudit.summary,
          blockers: productionAudit.blockers || []
        }
      : null,
    externalEvidence,
    notes: [
      "This verifier is read-only except for local command side effects such as Docker build cache.",
      "It does not send payment headers, submit directory forms, mutate wallets, or set environment variables.",
      "Set final verification env vars only after every non-final completion requirement is verified."
    ]
  };
}

function publicCheck(check, includeDetails) {
  const result = {
    id: check.id,
    label: check.label,
    status: check.status,
    required: check.required,
    skipped: check.skipped,
    exitCode: check.exitCode ?? null,
    durationMs: check.durationMs ?? null
  };
  if (check.reason) result.reason = check.reason;
  if (check.nextAction) result.nextAction = check.nextAction;
  if (includeDetails) {
    result.stdout = trim(check.stdout);
    result.stderr = trim(check.stderr);
  }
  return result;
}

function trim(value) {
  return String(value || "").slice(0, 4000);
}

function externalEvidenceFromChecks(checks) {
  const launchMonitor = parseJsonOutput(checks.find((check) => check.id === "launch_monitor")?.stdout);
  const directoryCheck = parseJsonOutput(checks.find((check) => check.id === "external_directories")?.stdout);
  const explicitDirectoryEvidence = parseJsonOutput(checks.find((check) => check.id === "external_directory_evidence")?.stdout);
  const cdpBazaar = launchMonitor?.summary?.cdpBazaar || null;
  const explicitDirectoryVisible = explicitDirectoryEvidence?.status === "visible-in-some-directories";
  const externalDirectories = explicitDirectoryVisible
    ? {
        status: explicitDirectoryEvidence.status,
        summary: explicitDirectoryEvidence.summary || null,
        visible: explicitDirectoryEvidence.summary?.visible ?? 1,
        checked: explicitDirectoryEvidence.summary?.checked ?? 1,
        evidence: explicitDirectoryEvidence.evidence || null,
        evidenceSource: explicitDirectoryEvidence.source || "operator-provided"
      }
    : directoryCheck
    ? {
        status: directoryCheck.status || directoryCheck.summary?.status || null,
        summary: directoryCheck.summary || null,
        visible: directoryCheck.summary?.visible ?? null,
        checked: directoryCheck.summary?.checked ?? null
      }
    : launchMonitor?.summary?.externalDirectories || null;

  if (!cdpBazaar && !externalDirectories) return null;
  return {
    source: "final-verification-checks",
    cdpBazaar,
    externalDirectories
  };
}

function externalEvidenceBlockers(externalEvidence) {
  const blockers = [];
  const cdpBazaar = externalEvidence?.cdpBazaar;
  if (cdpBazaar && cdpBazaar.status !== "all-indexed") {
    blockers.push({
      id: "cdp_bazaar_indexing",
      status: cdpBazaar.status || "not-all-indexed",
      nextAction: cdpBazaar.routeSummary?.missing?.length
        ? `Resolve CDP Bazaar missing routes: ${cdpBazaar.routeSummary.missing.join(", ")}.`
        : "Rerun CDP Bazaar indexing check and resolve missing route visibility."
    });
  }

  const externalDirectories = externalEvidence?.externalDirectories;
  if (externalDirectories && externalDirectories.status !== "visible-in-some-directories") {
    blockers.push({
      id: "external_directory_visibility",
      status: externalDirectories.status || "not-visible",
      nextAction: "Get at least one non-CDP directory to visibly list Trust402, then rerun directory checks."
    });
  }
  return blockers;
}

function parseJsonOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
