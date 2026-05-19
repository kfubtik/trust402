# Trust402 Autonomous Completion Plan

This is the pinned completion plan for turning Trust402 from a production x402
trust MVP into a controlled autonomous buyer-agent.

Success means every section below is proven complete in the current production
state. Third-party/manual blockers must stay visible, but they are not success;
do not close the plan by weakening spend safety or by treating blocked live
paths as done.

## Pinned Source Of Truth

This file is the canonical Trust402 completion checklist. A requirement is done
only when its acceptance criteria and evidence fields are true in the current
production runtime. The completion audit must stay red if any required live
smoke, marketplace proof, external directory proof, wallet/refill proof, or
Git-backed deployment proof is missing.

Do not replace this plan with a weaker interpretation. If the implementation
changes, update this document, the machine-readable completion audit, and the
final verifier together.

## Pinned 2026-05-19 Execution Ledger

These are the exact work items pinned from the operator request. Each item maps
to one machine-readable completion audit requirement. The final success state is
all rows `verified` in the current production runtime, plus the final verifier
passing after live evidence is approved and collected.

| Work item | Audit requirement | Required success proof |
| --- | --- | --- |
| Git/Vercel auto-deploy | `git_vercel_auto_deploy` | Push to `main` creates a production Vercel deploy and monitor passes without manual `vercel --prod`. |
| External directories | `external_x402_directories` | CDP Bazaar remains 10/10 indexed and at least one non-CDP directory visibly lists Trust402. |
| Unified spend policy | `unified_spend_policy` | Per-call, per-job, daily caps, allowlist, denylist, approval threshold, emergency stop, and dry-run profile are visible through policy APIs. |
| Live procurement | `live_procurement` | Approved live run buys only allowlisted x402 resources inside limits and returns receipts/audit evidence. |
| AgentCash wallet binding | `agentcash_wallet_binding` | Local Trust402-only wallet policy is checked before any AgentCash spend and is never public. |
| AgentCash auto-refill | `agentcash_auto_refill` | Refill threshold, provider, amount, daily cap, emergency stop, dry-run/live decision, and evidence ref are approved and enforced. |
| Paid Proof402 delegation | `paid_proof402_delegation` | Approved hashes can be paid-notarized without private payloads, inside proof spend caps, with receipt evidence. |
| Autonomous job flow | `autonomous_job_flow` | Goal -> resource selection -> quote -> approval/dry-run -> live execution -> receipts -> proof -> final report works under policy. |
| Monitoring and protection | `monitoring_and_protection` | Production monitor exposes live spend gates, balances/policy, receipts, failed payments, and emergency stop state. |
| Final verification | `final_verification` | Tests, release check, Docker build, production smoke, x402 smoke, live paid smoke, Proof402 smoke, refill check, and directory checks are current. |

Nothing in this ledger is complete because code exists alone. The evidence must
be current, production-observed, public-safe, and visible through
`/api/completion/audit` and `npm run final:verify`.

## 1. Git/Vercel Auto-Deploy

Goal: connect the private repository `kfubtik/trust402` to the Vercel project.
The preferred path is the Vercel GitHub App integration. A GitHub Actions
fallback deploy is acceptable evidence only if a push to `main` creates a
production Vercel deployment and the workflow's smoke, x402 smoke, and launch
monitor checks pass.

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
- at least one external directory visibly shows Trust402;
- no private keys, CDP secrets, AgentCash internals, payment headers, or paid
  receipts are submitted.
- directories that require a custom domain, such as `x402-list.com`, stay
  blocked until Trust402 runs on an accepted production domain.

Completion evidence:

- set `TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED=true` only after the
  all-resource CDP Bazaar check reports 10/10 indexed;
- set `TRUST402_CDP_BAZAAR_EVIDENCE_REF` to the public-safe check hash, run
  URL, or other evidence ref for that 10/10 check;
- set `TRUST402_EXTERNAL_DIRECTORY_STATUS=visible`;
- set `TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL` to a public listing or search
  result where Trust402 is visible;
- set `TRUST402_EXTERNAL_DIRECTORY_NAME` to the non-CDP directory name.

Tracking: https://github.com/kfubtik/trust402/issues/6

## 3. Unified Spend Policy

Goal: one policy model decides whether Trust402 may spend before any paid call.

Acceptance:

- per-call, per-job, and daily caps are enforced;
- `LIVE_SPENT_TODAY_USD` is included in the live policy profile so the agent
  can prove remaining daily spend capacity before a paid call;
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
- use `npm run live:evidence-smoke -- --live ...` only during an approved
  bounded spend window; the runner refuses live mode without local approval,
  operator authorization, a real candidate endpoint, and a max-total cap.
- live evidence smoke also reads `.local/trust402-agentcash-wallet.json` before
  any live request and blocks if the Trust402 wallet policy is not explicitly
  approved for manual smoke, if the remaining manual budget is zero, or if the
  estimated spend would break the local cap/reserve.

Tracking: https://github.com/kfubtik/trust402/issues/8

## 5. AgentCash Wallet Binding

Goal: Trust402 uses only its dedicated AgentCash policy for operator spend.

Acceptance:

- `.local/trust402-agentcash-wallet.json` is checked before any AgentCash spend;
- the wallet is reserved for Trust402 and approved origins only;
- the local policy never enters Git, API responses, or public logs;
- a read-only policy check explains whether live operator spend is blocked.
- `src/localAgentcashPolicy.js` is the shared local policy guard used by the
  final live evidence runner.

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
- `npm run live:evidence-smoke -- --live ...` can produce this proof evidence
  after live Proof402 policy is ready; it sends only hashes and public-safe
  metadata.

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
- include `--include-autonomous-live` with `npm run live:evidence-smoke` only
  after budgeting for the second downstream paid call used by the autonomous
  workflow.

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

Before the approved final/live window, run the read-only operator unblock report:

```powershell
npm run completion:unblockers -- https://trust402.vercel.app
```

It consolidates Git/Vercel, custom-domain, external-directory, live spend,
Proof402, AgentCash refill, autonomous-job, and final-evidence blockers without
mutating wallets or sending payment headers.

For the Git/Vercel and custom-domain portion specifically, run:

```powershell
npm run deployment:preflight -- https://trust402.vercel.app
```

This preflight is read-only and records whether the GitHub Actions fallback is
ready to configure, which Vercel secret names are required, whether Vercel Git
App access is still blocked, and whether the current host satisfies the
custom-domain requirement.

Then generate the read-only live-window plan for the exact approved resource,
budget, and provider:

```powershell
npm run live:window-plan -- https://trust402.vercel.app `
  --candidate-endpoint=https://approved.example/paid `
  --candidate-price=0.01 `
  --max-total-usd=0.03 `
  --live-spent-today-usd=0
```

This command does not change `.local/trust402-agentcash-wallet.json`, does not
set Vercel environment variables, does not send payment headers, and does not
mutate the wallet. It returns a plan hash, public-safe Vercel env names/values,
the local policy patch to review, and the final `npm run live:evidence-smoke`
command for the approved smoke window.

Agents can request the same read-only plan through `POST /api/live/window-plan`.

During the approved smoke window, prefer the one-shot local wrapper:

```powershell
$env:TRUST402_LIVE_SMOKE_WINDOW_APPROVED="true"
npm run live:smoke-window -- https://trust402.vercel.app `
  --live `
  --apply-local-policy `
  --candidate-endpoint=https://approved.example/paid `
  --candidate-price=0.01 `
  --max-total-usd=0.03
```

It stages the approved local AgentCash policy patch, runs the bounded evidence
smoke, and restores the previous local policy in `finally` so the manual smoke
budget returns to its prior state after the run. Without `--live` and
`--apply-local-policy`, it is preview-only and writes nothing.

During approved evidence collection, append `--write-evidence` to write a
local public-safe JSONL ledger under `.local/evidence-ledger/`. This ledger is
ignored by Git and stores hashes, stage statuses, and evidence refs only; it
does not store operator keys, private payloads, payment signatures, or wallet
secrets.

For the full remaining-blocker checklist, export the public-safe operator
action pack:

```powershell
npm run completion:actions -- https://trust402.vercel.app `
  --candidate-endpoint=https://approved.example/paid `
  --candidate-price=0.01 `
  --max-total-usd=0.03
```

Agents can request the same action pack through `POST /api/operator/action-pack`.

On this workstation the verifier auto-detects Docker Desktop at
`D:\Programs\Docker\resources\bin\docker.exe`. If Docker is installed elsewhere,
pass `--docker-bin=<path-to-docker.exe>` or set `TRUST402_DOCKER_BIN`.

## Current Safety Blockers

As of 2026-05-19, the local AgentCash policy has zero remaining manual smoke
budget and marks live procurement, Proof402 delegation, and auto-refill as
disabled until separate approval. Code may implement and test gates, but real
paid calls must remain blocked until that policy changes.
