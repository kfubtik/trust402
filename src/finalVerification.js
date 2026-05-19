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
  const commandsPassed = failedRequired.length === 0;
  const readyForFinalEvidence = commandsPassed && nonFinalOpenRequirements.length === 0;
  const goalComplete = productionAudit?.goalComplete === true;
  const status = goalComplete
    ? "complete"
    : readyForFinalEvidence
      ? "ready-for-final-evidence"
      : "blocked";
  const evidenceSubject = {
    baseUrl,
    checks: normalizedChecks,
    requirementStatuses,
    productionGoalComplete: Boolean(productionAudit?.goalComplete),
    productionSummary: productionAudit?.summary || null
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
      productionGoalComplete: Boolean(productionAudit?.goalComplete)
    },
    blockers: [
      ...failedRequired.map((check) => ({
        id: check.id,
        status: check.status,
        nextAction: check.nextAction || "Inspect command output and rerun the check."
      })),
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
