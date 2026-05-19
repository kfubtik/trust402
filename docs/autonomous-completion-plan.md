# Trust402 Autonomous Completion Plan

This is the pinned completion plan for turning Trust402 from a production x402
trust MVP into a controlled autonomous buyer-agent.

Success means every section below is proven complete in the current production
state. Third-party/manual blockers must stay visible, but they are not success;
do not close the plan by weakening spend safety or by treating blocked live
paths as done.

## 1. Git/Vercel Auto-Deploy

Goal: connect the private repository `kfubtik/trust402` to the Vercel project.

Acceptance:

- a push to `main` creates a production deployment without `vercel --prod`;
- `https://trust402.vercel.app` remains the production alias;
- `npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --strict`
  passes after a Git-backed deploy.

Completion evidence:

- set `TRUST402_GIT_AUTO_DEPLOY_VERIFIED=true` only after a push-triggered
  production deployment is observed;
- set `TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL` to the Vercel deployment or
  GitHub check URL;
- set `TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA` to the commit that triggered that
  deployment.

Tracking: https://github.com/kfubtik/trust402/issues/5

## 2. External x402 Directories

Goal: list Trust402 outside CDP Bazaar where safe manual submission is allowed.

Acceptance:

- Trust402 remains 10/10 indexed in CDP Bazaar;
- at least one external directory shows Trust402 or records a pending curated
  review;
- no private keys, CDP secrets, AgentCash internals, payment headers, or paid
  receipts are submitted.
- directories that require a custom domain, such as `x402-list.com`, stay
  blocked until Trust402 runs on an accepted production domain.

Completion evidence:

- set `TRUST402_EXTERNAL_DIRECTORY_STATUS=visible` or `pending-review`;
- set `TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL` to a public listing, search
  result, or curated-review confirmation;
- set `TRUST402_EXTERNAL_DIRECTORY_NAME` to the non-CDP directory name.

Tracking: https://github.com/kfubtik/trust402/issues/6

## 3. Unified Spend Policy

Goal: one policy model decides whether Trust402 may spend before any paid call.

Acceptance:

- per-call, per-job, and daily caps are enforced;
- registry allowlist and endpoint denylist are enforced;
- approval thresholds are enforced;
- emergency stop overrides every live path;
- payment-provider readiness proves that live mode uses `@x402/fetch` or an
  approved payment bridge instead of plain `fetch`;
- `/api/policies/spend` exposes the current non-secret policy state.

Tracking: https://github.com/kfubtik/trust402/issues/8

## 4. Live Procurement

Goal: `/api/procurement/execute` can buy approved downstream x402 resources only
inside policy.

Acceptance:

- dry-run remains the default;
- live execution requires operator authorization;
- every selected endpoint is allowlisted and not denylisted;
- every paid call goes through the configured payment adapter;
- every paid call is within the per-call cap;
- total planned spend is within job and daily caps;
- every execution returns an audit/receipt bundle.

Completion evidence:

- set `TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED=true` only after a bounded
  live procurement smoke succeeds under the approved policy;
- set `TRUST402_LIVE_PROCUREMENT_EVIDENCE_REF` to a public-safe receipt hash,
  run URL, or reviewed evidence reference.

Tracking: https://github.com/kfubtik/trust402/issues/8

## 5. AgentCash Wallet Binding

Goal: Trust402 uses only its dedicated AgentCash policy for operator spend.

Acceptance:

- `.local/trust402-agentcash-wallet.json` is checked before any AgentCash spend;
- the wallet is reserved for Trust402 and approved origins only;
- the local policy never enters Git, API responses, or public logs;
- a read-only policy check explains whether live operator spend is blocked.

Tracking: https://github.com/kfubtik/trust402/issues/7

## 6. AgentCash Auto-Refill

Goal: refill logic exists only behind explicit provider, approval, caps, audit,
and emergency-stop rules.

Acceptance:

- planned threshold is `$0.50`;
- provider is configured before refill can be ready;
- refill amount and daily cap are enforced;
- dry-run refill monitor exists before live refill;
- `/api/agentcash/refill-check` and `npm run agentcash:refill-check` return a
  threshold/cap decision and receipt hash without mutating wallet balance;
- live refill is impossible unless `AGENTCASH_AUTO_REFILL_APPROVED=true` and
  `AGENTCASH_AUTO_REFILL_ENABLED=true`.

Completion evidence:

- set `TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_OBSERVED=true` only after the
  approved refill policy has produced a reviewed dry-run/live decision;
- set `TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_REF` to the public-safe decision
  hash or reviewed evidence reference.

Tracking: https://github.com/kfubtik/trust402/issues/7

## 7. Paid Proof402 Delegation

Goal: Trust402 can produce a paid Proof402 proof receipt for approved hashes.

Acceptance:

- only `sha256:` hashes and public-safe metadata are sent;
- private payloads are never sent to Proof402;
- proof spend cap is enforced;
- paid proof requires operator authorization;
- proof result is included in the receipt/audit bundle.

Completion evidence:

- set `TRUST402_PROOF402_PAID_SMOKE_OBSERVED=true` only after an approved paid
  Proof402 smoke succeeds for an approved hash;
- set `TRUST402_PROOF402_EVIDENCE_REF` to the public-safe proof/receipt
  reference.

Tracking: https://github.com/kfubtik/trust402/issues/9

## 8. Autonomous Job Flow

Goal: one workflow can turn a user goal and budget into a plan, quote,
execution audit, receipts, optional proof, and final report.

Acceptance:

- default mode is dry-run;
- live mode delegates to the same spend policy as procurement;
- result hashes and receipt bundles are returned;
- failures explain which gate blocked the run.

Completion evidence:

- set `TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED=true` only after a bounded live
  autonomous job succeeds under the approved policy;
- set `TRUST402_AUTONOMOUS_JOB_EVIDENCE_REF` to a public-safe run or receipt
  reference.

## 9. Monitoring And Protection

Goal: production checks show whether Trust402 is spending, where, and why.

Acceptance:

- launch monitor checks API, x402 challenge, CDP Bazaar, and spend policy;
- emergency stop is visible in policy output;
- failed payment/proof/refill gates are machine-readable;
- Vercel logs stay free of private material.

## Final Definition Of Done

Trust402 is complete when it can:

- choose x402 resources for a goal;
- buy only approved resources;
- stay within per-call, per-job, and daily limits;
- keep receipts and audit bundles;
- create Proof402 proof receipts for approved hashes;
- monitor its AgentCash balance policy;
- keep auto-refill bound to an approved policy;
- expose all of the above through API checks;
- expose a machine-readable completion audit that keeps unresolved manual,
  external, and live-spend blockers visible;
- pass local tests, release checks, Docker build, production smoke, x402 smoke,
  bounded live paid smoke, Proof402 paid smoke, refill check, and
  Bazaar/external-directory checks.

After the full command set above passes, set:

```text
TRUST402_FINAL_VERIFICATION_OBSERVED=true
TRUST402_FINAL_VERIFICATION_EVIDENCE_REF=<public-safe final verification ref>
```

Use the read-only verifier to produce the evidence ref:

```powershell
npm run final:verify -- https://trust402.vercel.app --timeout-ms=10000
```

## Current Safety Blockers

As of 2026-05-19, the local AgentCash policy has zero remaining manual smoke
budget and marks live procurement, Proof402 delegation, and auto-refill as
disabled until separate approval. Code may implement and test gates, but real
paid calls must remain blocked until that policy changes.
