import { sha256Json } from "./hash.js";

export const COMPLETION_REQUIREMENTS = [
  {
    id: "git_vercel_auto_deploy",
    title: "Git/Vercel Auto-Deploy",
    workItem: "Connect private repo kfubtik/trust402 to push-triggered production deploy.",
    acceptance: [
      "Push to main creates a production Vercel deployment without manual vercel --prod.",
      "Production smoke, x402 smoke, and launch monitor pass after that Git-backed deployment."
    ],
    evidenceEnv: [
      "TRUST402_GIT_AUTO_DEPLOY_VERIFIED",
      "TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL",
      "TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA"
    ],
    auditStatusRequired: "verified"
  },
  {
    id: "external_x402_directories",
    title: "External x402 Directories",
    workItem: "Keep CDP Bazaar indexed and make Trust402 visible in at least one non-CDP directory.",
    acceptance: [
      "CDP Bazaar reports all Trust402 launch resources indexed.",
      "At least one non-CDP directory visibly lists Trust402 with public-safe listing copy."
    ],
    evidenceEnv: [
      "TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED",
      "TRUST402_CDP_BAZAAR_EVIDENCE_REF",
      "TRUST402_EXTERNAL_DIRECTORY_STATUS",
      "TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL",
      "TRUST402_EXTERNAL_DIRECTORY_NAME"
    ],
    auditStatusRequired: "verified"
  },
  {
    id: "unified_spend_policy",
    title: "Unified Spend Policy",
    workItem: "Expose one policy model for all future spend decisions.",
    acceptance: [
      "Per-call, per-job, daily cap, allowlist, denylist, approval threshold, emergency stop, and spent-today fields are visible.",
      "Dry-run and live-readiness profiles are machine-readable before any paid call."
    ],
    evidenceEnv: [],
    auditStatusRequired: "verified"
  },
  {
    id: "live_procurement",
    title: "Live Procurement",
    workItem: "Allow approved live purchases of downstream x402 resources through policy-gated execution.",
    acceptance: [
      "Only allowlisted HTTPS endpoints can be purchased.",
      "Every paid call stays inside per-call, per-job, and daily limits.",
      "Every live run returns a receipt and audit bundle."
    ],
    evidenceEnv: [
      "TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED",
      "TRUST402_LIVE_PROCUREMENT_EVIDENCE_REF"
    ],
    auditStatusRequired: "verified"
  },
  {
    id: "agentcash_wallet_binding",
    title: "AgentCash Wallet Binding",
    workItem: "Bind the local AgentCash wallet policy to Trust402-only operator spend.",
    acceptance: [
      ".local/trust402-agentcash-wallet.json is checked before any AgentCash spend.",
      "The wallet policy is ignored by Git and never appears in public API output.",
      "The wallet is reserved for Trust402 and approved origins only."
    ],
    evidenceEnv: [],
    auditStatusRequired: "verified"
  },
  {
    id: "agentcash_auto_refill",
    title: "AgentCash Auto-Refill",
    workItem: "Keep refill behind explicit provider, threshold, cap, operator key, and emergency stop policy.",
    acceptance: [
      "Threshold is 0.50 USD.",
      "Provider, amount, and daily cap are configured before live refill can be ready.",
      "Dry-run/live refill decision produces public-safe evidence."
    ],
    evidenceEnv: [
      "TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_OBSERVED",
      "TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_REF"
    ],
    auditStatusRequired: "verified"
  },
  {
    id: "paid_proof402_delegation",
    title: "Paid Proof402 Delegation",
    workItem: "Create paid Proof402 proof receipts only for approved hashes.",
    acceptance: [
      "Only sha256 hashes and public-safe metadata are sent.",
      "Private payloads are never sent to Proof402.",
      "Proof spend cap and operator authorization are enforced."
    ],
    evidenceEnv: [
      "TRUST402_PROOF402_PAID_SMOKE_OBSERVED",
      "TRUST402_PROOF402_EVIDENCE_REF"
    ],
    auditStatusRequired: "verified"
  },
  {
    id: "autonomous_job_flow",
    title: "Autonomous Job Flow",
    workItem: "Run goal to resource selection, quote, approval/dry-run, execution, receipts, proof, and final report.",
    acceptance: [
      "Default mode stays dry-run.",
      "Candidate discovery can select from trusted seed or supplied registry candidates before quote generation.",
      "Live mode uses the same spend policy as procurement.",
      "A bounded live autonomous job has public-safe evidence."
    ],
    evidenceEnv: [
      "TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED",
      "TRUST402_AUTONOMOUS_JOB_EVIDENCE_REF"
    ],
    auditStatusRequired: "verified"
  },
  {
    id: "monitoring_and_protection",
    title: "Monitoring And Protection",
    workItem: "Expose live spend gates, receipts, failed payments, balances/policy, and emergency stop state.",
    acceptance: [
      "Production monitor checks API, x402 challenge, Bazaar, and spend policy.",
      "Emergency stop and failed gates are machine-readable."
    ],
    evidenceEnv: [],
    auditStatusRequired: "verified"
  },
  {
    id: "final_verification",
    title: "Final Verification",
    workItem: "Run the complete final command set after every non-final requirement is verified.",
    acceptance: [
      "npm test, release check, Docker build, production smoke, x402 smoke, live paid smoke, Proof402 smoke, refill check, and directory checks are current.",
      "Final verifier produces a public-safe evidence ref."
    ],
    evidenceEnv: [
      "TRUST402_FINAL_VERIFICATION_OBSERVED",
      "TRUST402_FINAL_VERIFICATION_EVIDENCE_REF"
    ],
    auditStatusRequired: "verified"
  }
];

const OPERATOR_PINNED_CHECKLIST = [
  {
    id: "git_vercel_auto_deploy",
    item: "Git/Vercel auto-deploy",
    success: "Private repo kfubtik/trust402 is connected so a push to main creates the production deployment and production monitor passes without manual vercel --prod."
  },
  {
    id: "external_x402_directories",
    item: "External directories",
    success: "CDP Bazaar stays 10/10 indexed and at least one non-CDP x402 directory visibly lists Trust402 with public-safe listing copy."
  },
  {
    id: "unified_spend_policy",
    item: "Unified spend policy",
    success: "Per-call cap, per-job cap, daily cap, allowlist, denylist, approval threshold, emergency stop, and dry-run live profile are machine-readable before any spend."
  },
  {
    id: "live_procurement",
    item: "Live procurement",
    success: "Trust402 can buy an allowlisted x402 resource through the configured payment adapter, inside limits, and return receipts/audit evidence."
  },
  {
    id: "agentcash_wallet_binding",
    item: "AgentCash wallet binding",
    success: "The ignored local AgentCash wallet policy is checked before any paid operation and keeps the wallet reserved for Trust402-approved origins only."
  },
  {
    id: "agentcash_auto_refill",
    item: "AgentCash auto-refill",
    success: "Refill uses the approved provider, 0.50 USD threshold, amount, daily cap, emergency stop, dry-run decision, and live approval gates."
  },
  {
    id: "paid_proof402_delegation",
    item: "Paid Proof402 delegation",
    success: "Approved hashes are paid-notarized without private payloads, inside proof spend caps, and with receipt evidence."
  },
  {
    id: "autonomous_job_flow",
    item: "Autonomous job flow",
    success: "Goal to resource selection, quote, approval or dry-run, live execution, receipts, proof, and final report all work under policy."
  },
  {
    id: "monitoring_and_protection",
    item: "Monitoring and protection",
    success: "Production checks expose live spend gates, balance policy, receipts, failed payments, and emergency stop state."
  },
  {
    id: "final_verification",
    item: "Final verification",
    success: "Tests, release check, Docker build, production smoke, x402 smoke, live paid smoke, Proof402 smoke, refill check, and directory checks are current."
  }
];

export function completionPlan() {
  const planCore = {
    document: "docs/autonomous-completion-plan.md",
    pinnedAt: "2026-05-20",
    objective: "Trust402 autonomous buyer-agent success criteria",
    requirementIds: COMPLETION_REQUIREMENTS.map((item) => item.id),
    requirements: COMPLETION_REQUIREMENTS,
    operatorChecklist: OPERATOR_PINNED_CHECKLIST,
    successCriteria: [
      "Trust402 chooses x402 resources for a goal.",
      "Trust402 buys only approved resources.",
      "Trust402 stays within per-call, per-job, and daily limits.",
      "Trust402 keeps receipts and audit bundles.",
      "Trust402 creates Proof402 proof receipts for approved hashes.",
      "Trust402 monitors its AgentCash balance policy.",
      "Trust402 keeps auto-refill bound to an approved policy.",
      "Trust402 exposes all success gates through API checks.",
      "Trust402 final completion audit returns goalComplete=true only when every requirement is verified."
    ]
  };

  return {
    ok: true,
    tool: "completion.plan",
    generatedAt: new Date().toISOString(),
    planHash: sha256Json(planCore),
    ...planCore,
    evidenceRules: {
      sourceOfTruth: "/api/completion/audit",
      allAuditRequirementsMustBeVerified: true,
      manualExternalOrLiveEvidenceCannotBeInferred: true,
      implementedButBlockedDoesNotCountAsDone: true,
      operatorChecklistCannotBeWeakenedByImplementation: true
    },
    safety: {
      readOnly: true,
      sendsPaymentHeaders: false,
      mutatesWallet: false,
      setsEnvVars: false,
      includesSecretValues: false
    },
    links: {
      audit: "/api/completion/audit",
      unblockReport: "/api/operator/unblock-report",
      actionPack: "/api/operator/action-pack",
      liveWindowPlan: "/api/live/window-plan"
    }
  };
}
