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

## Operator-Locked Success Contract

The operator-approved definition of success is exactly the sum of the ten items
below. `/api/completion/plan` exposes the same list as `operatorChecklist`, and
`/api/completion/audit` must keep `goalComplete=false` until every linked
requirement is verified in the current production runtime.

| Operator item | Requirement | Success condition |
| --- | --- | --- |
| Git/Vercel auto-deploy | `git_vercel_auto_deploy` | Push to `main` creates production deploy and production monitor passes without manual `vercel --prod`. |
| External directories | `external_x402_directories` | CDP Bazaar stays 10/10 indexed and at least one non-CDP x402 directory visibly lists Trust402. |
| Unified spend policy | `unified_spend_policy` | Per-call, per-job, daily cap, allowlist, denylist, approval threshold, emergency stop, and dry-run live profile are machine-readable before any spend. |
| Live procurement | `live_procurement` | Trust402 buys an allowlisted x402 resource through the configured payment adapter, inside limits, with receipts/audit evidence. |
| AgentCash wallet binding | `agentcash_wallet_binding` | The ignored local AgentCash wallet policy is checked before any paid operation and reserves the wallet for Trust402-approved origins only. |
| AgentCash auto-refill | `agentcash_auto_refill` | Refill uses the approved provider, `$0.50` threshold, amount, daily cap, emergency stop, dry-run decision, and live approval gates. |
| Paid Proof402 delegation | `paid_proof402_delegation` | Approved hashes are paid-notarized without private payloads, inside proof spend caps, with receipt evidence. |
| Autonomous job flow | `autonomous_job_flow` | Goal -> resource selection -> quote -> approval/dry-run -> live execution -> receipts -> proof -> final report works under policy. |
| Monitoring and protection | `monitoring_and_protection` | Production checks expose live spend gates, balance policy, receipts, failed payments, and emergency stop state. |
| Final verification | `final_verification` | Tests, release check, Docker build, production smoke, x402 smoke, live paid smoke, Proof402 smoke, refill check, and directory checks are current. |

## Pinned 2026-05-20 Execution Ledger

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
- set `TRUST402_CDP_BAZAAR_CHECK_STATUS=all-indexed`,
  `TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES=10`,
  `TRUST402_CDP_BAZAAR_INDEXED_RESOURCES=10`, and
  `TRUST402_CDP_BAZAAR_MISSING_RESOURCES=` from the same current check;
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
- `agentcash-mcp` and `external-adapter` live modes explicitly require
  `LIVE_PAYMENT_ADAPTER_URL`; `x402-fetch` explicitly requires
  `X402_BUYER_PRIVATE_KEY` and `X402_BUYER_RPC_URL`;
- `cdp-x402` explicitly requires CDP API credentials, `CDP_WALLET_SECRET`, and
  an existing `CDP_EVM_ACCOUNT_ADDRESS` or `CDP_EVM_ACCOUNT_NAME` so x402 buyer
  signing can happen without exporting a private key;
- `npm run payment:buyer-preflight` and `POST /api/payments/buyer-preflight`
  expose CDP buyer signer readiness and can operator-probe the existing CDP
  account without creating accounts or sending payment headers;
- `npm run payment:bridge-check` and `POST /api/payments/bridge-check` can
  dry-run-probe the configured bridge and require explicit no-payment evidence
  before live spend is enabled;
- bridge preflight requires an explicit dry-run/no-payment signal; a zero
  paid-subcall count alone is not accepted as proof;
- `npm run live:evidence-smoke -- --live ...` automatically runs the bridge
  preflight for bridge-backed providers and stops before paid execution if the
  bridge cannot prove dry-run/no-payment behavior;
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
- the configured payment bridge has passed a dry-run no-payment preflight;
- every paid call is within the per-call cap;
- total planned spend is within job and daily caps;
- every execution returns an audit/receipt bundle;
- downstream `payment-response` headers are recorded only as public-safe
  `sha256:` hashes, not as raw payment headers.

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
- downstream paid resource origins must also be present in the local allowed
  origins list before a live smoke can spend through the Trust402 wallet;
- the local policy never enters Git, API responses, or public logs;
- a read-only policy check explains whether live operator spend is blocked;
- a read-only MCP observation guard validates observed AgentCash accounts and
  settings against the local policy without calling AgentCash or sending payment
  headers.
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
- proof result is included in the receipt/audit bundle;
- Proof402 `payment-response` evidence is recorded only as a public-safe
  `sha256:` hash;
- `/api/receipts/notarize-result` returns a public-safe `receiptBundle` for
  preview, probe, and live Proof402 outcomes.
- `/api/proof402/preflight` and `npm run proof402:preflight` can prove before
  any paid proof that the exact `sha256:` hash is approved, the Proof402 quote
  is within cap, live policy is ready, and no private payload fields will be
  sent.

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
- `/api/registries/candidates` resolves explicit, registry-supplied, and
  trusted seed candidates without fetching external registries or spending;
- optional registry URL fetching is read-only, allowlisted, capped by JSON size,
  and never sends payment or secret headers;
- `/api/jobs/autonomous-run` can select a seed candidate when no manual
  `candidates` array is supplied;
- live mode delegates to the same spend policy as procurement;
- result hashes and receipt bundles are returned;
- when proof preview or paid proof is requested, the job returns both the final
  report `receiptBundle` and the Proof402 `proofReceiptBundle`;
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

The pinned plan and current audit are available from the production runtime:

```text
GET /api/completion/plan
GET /api/completion/audit
```

`/api/completion/plan` is the pinned machine-readable contract for every item
above. `/api/completion/audit` is the current production verdict against that
contract.

The same public-safe blocker view is also available from the production
runtime:

```text
GET /api/operator/unblock-report
POST /api/operator/unblock-report
```

Use `GET` for the current production policy state, or `POST` with candidate
budget fields to preview blockers for a proposed live evidence window. Both
forms are read-only and do not submit directory forms, mutate wallets, set env
vars, or send payment headers.

For external directory work, generate the read-only submission payload from the
production runtime:

```text
GET /api/directories/submission-pack
POST /api/directories/submission-pack
```

Or from the CLI, with the production API as source of truth and the intended
custom listing host as the public website:

```powershell
npm run directories:submission-pack -- https://trust402.vercel.app `
  --listing-base-url=https://trust402.dev `
  --user-approved-outreach
```

The pack includes listing copy, directory targets, custom-domain blockers, CDP
Bazaar readiness, evidence env names, and verification commands. It does not
submit forms, mutate wallets, set env vars, or send payment headers.

For the custom-domain step, generate the read-only activation plan:

```text
GET /api/domains/activation-pack
POST /api/domains/activation-pack
```

Or from the CLI after rechecking candidate availability:

```powershell
npm run domains:activation-pack -- https://trust402.vercel.app `
  --selected-domain=trust402.dev
```

The pack checks whether the current host still blocks external directories,
prepares `PUBLIC_BASE_URL`, Vercel verification commands, and directory
evidence fields, but it does not buy a domain, mutate Vercel, set env vars, or
claim availability/pricing without a fresh registrar/Vercel check.

For the Git/Vercel and custom-domain portion specifically, run:

```powershell
npm run deployment:preflight -- https://trust402.vercel.app
```

This preflight is read-only and records whether the GitHub Actions fallback is
ready to configure, which Vercel secret names are required, whether Vercel Git
App access is still blocked, and whether the current host satisfies the
custom-domain requirement.

Agents can request the same public-safe deployment profile through:

```text
GET /api/deployments/preflight
POST /api/deployments/preflight
```

The API form accepts public evidence such as `gitRemote`, `gitHead`,
`customDomain`, workflow snippets, GitHub run metadata, and Vercel deployment
metadata. It does not read secret values and does not mutate GitHub or Vercel.

For the GitHub Actions fallback, generate the read-only setup command pack:

```powershell
npm run deployment:github-actions-setup -- https://trust402.vercel.app
```

Agents can request the same setup pack through:

```text
GET /api/deployments/github-actions-setup
POST /api/deployments/github-actions-setup
```

This pack emits exact `gh secret set`, workflow trigger, and verification
commands for `.github/workflows/vercel-production-deploy.yml`. It uses local
`.vercel/project.json` in the CLI when present, keeps `VERCEL_TOKEN` as a
paste-only placeholder, and does not run GitHub/Vercel commands or print secret
values.

Then generate the read-only live-window plan for the exact approved resource,
budget, and provider:

```powershell
npm run live:window-plan -- https://trust402.vercel.app `
  --candidate-endpoint=https://proof402.vercel.app/api/proof/notarize `
  --candidate-price=0.005 `
  --proof-reserve-usd=0.005 `
  --max-total-usd=0.015 `
  --live-spent-today-usd=0
```

This command does not change `.local/trust402-agentcash-wallet.json`, does not
set Vercel environment variables, does not send payment headers, and does not
mutate the wallet. It returns a plan hash, public-safe Vercel env names/values,
the local policy patch to review, and the final `npm run live:evidence-smoke`
command for the approved smoke window.

Agents can request the same read-only plan through `POST /api/live/window-plan`.

If CDP Bazaar is missing one paid route while the server-side live payment
adapter is still blocked, the live-window plan also emits
`agentcashDirectSmoke`. This is a public-safe MCP action pack, not an executed
payment. It contains:

- `schemaCheck.input` for `mcp__agentcash__check_endpoint_schema`;
- `fetch.input` for `mcp__agentcash__fetch`, including the exact reviewed JSON
  body, `maxAmount`, Base network, and x402 protocol;
- the local AgentCash policy window that must be approved before execution;
- the Bazaar and completion commands to rerun after a successful paid receipt.

For the currently blocked CDP Bazaar route, generate the pack with:

```powershell
npm run live:window-plan -- https://trust402.vercel.app `
  --candidate-endpoint=https://trust402.vercel.app/api/trust/compare-resources `
  --candidate-price=0.03 `
  --max-total-usd=0.03 `
  --live-max-per-call=0.03 `
  --skip-proof
```

For the shorter local approval packet, use:

```powershell
npm run agentcash:direct-smoke-plan -- https://trust402.vercel.app
```

This prints the exact one-line approval text, the temporary local policy patch,
the unpaid AgentCash schema-check input, the paid AgentCash fetch input, stable
input hashes, and the restore-after-run policy values. It does not call
AgentCash, does not write `.local`, and does not spend.

After the exact one-line approval is supplied, the local policy window can be
opened and closed with:

```powershell
npm run agentcash:direct-smoke-window -- --status
npm run agentcash:direct-smoke-window -- --open --approval "<exact one-line approval>"
npm run agentcash:direct-smoke-window -- --close
```

The open command writes only `.local/trust402-agentcash-wallet.json` and an
ignored `.local/trust402-agentcash-direct-smoke-window.json` restore file. It
does not call AgentCash and does not pay. The close command restores the
original local policy from the ignored restore file and removes that state file.

The `fetch.input` in that output may help produce indexing evidence for
`trust.compare_resources`, but it remains out-of-band. It does not prove the
Trust402 runtime payment adapter and must not be used to mark
`live_procurement` verified by itself.

During the approved smoke window, prefer the one-shot local wrapper:

```powershell
$env:TRUST402_LIVE_SMOKE_WINDOW_APPROVED="true"
npm run live:smoke-window -- https://trust402.vercel.app `
  --live `
  --apply-local-policy `
  --candidate-endpoint=https://proof402.vercel.app/api/proof/notarize `
  --candidate-price=0.005 `
  --proof-reserve-usd=0.005 `
  --max-total-usd=0.015
```

It stages the approved local AgentCash policy patch, runs the bounded evidence
smoke, and restores the previous local policy in `finally` so the manual smoke
budget returns to its prior state after the run. Without `--live` and
`--apply-local-policy`, it is preview-only and writes nothing.
For the Proof402 candidate, the runner generates only `contentHash`, `label`,
`idempotencyKey`, and public-safe metadata; private payloads are not sent.

Before a paid Proof402 smoke, run the dedicated read-only preflight against the
approved hash and the current Proof402 quote:

```powershell
npm run proof402:preflight -- `
  --result-hash=sha256:<approved-result-hash> `
  --approved-hash=sha256:<approved-result-hash> `
  --price-usd=0.005 `
  --strict
```

The API equivalent is `POST /api/proof402/preflight`. It does not call
Proof402, does not send payment headers, and does not mutate the wallet.

During approved evidence collection, append `--write-evidence` to write a
local public-safe JSONL ledger under `.local/evidence-ledger/`. This ledger is
ignored by Git and stores hashes, stage statuses, and evidence refs only; it
does not store operator keys, private payloads, payment signatures, or wallet
secrets.

Before a live window, validate the ignored AgentCash policy in the matching
mode. The default check still requires the wallet to be locked down:

```powershell
npm run agentcash:policy
```

For an explicitly approved smoke window, use `live-window` with the expected
maximum spend and proof flag:

```powershell
npm run agentcash:policy -- --mode=live-window --include-proof --estimated-spend=0.02
```

For an approved refill policy, use `auto-refill`:

```powershell
npm run agentcash:policy -- --mode=auto-refill
```

These modes do not spend funds. They only prove whether the local policy shape
matches the requested live/refill window.

If AgentCash MCP accounts/settings are observed, validate that public output
through the Trust402 guard before treating it as wallet-binding evidence:

```powershell
npm run agentcash:mcp-observation -- `
  --accounts-json='[{"network":"base","address":"0x1111111111111111111111111111111111111111","balance":1.283}]' `
  --settings-json='{"maxAmount":0.01}'
```

The guard masks addresses and rejects mismatched wallets, non-Base funded
accounts, unsafe `maxAmount`, or balances below the local reserve.

For the full remaining-blocker checklist, export the public-safe operator
action pack:

```powershell
npm run completion:actions -- https://trust402.vercel.app `
  --candidate-endpoint=https://proof402.vercel.app/api/proof/notarize `
  --candidate-price=0.005 `
  --proof-reserve-usd=0.005 `
  --max-total-usd=0.015
```

Agents can request the same action pack through `POST /api/operator/action-pack`.
When a production URL is passed, the CLI reads the production API so evidence
matches the deployed runtime. Pass `--local` only when intentionally checking
the local `.env` state instead.

On this workstation the verifier auto-detects Docker Desktop at
`D:\Programs\Docker\resources\bin\docker.exe`. If Docker is installed elsewhere,
pass `--docker-bin=<path-to-docker.exe>` or set `TRUST402_DOCKER_BIN`.

## Current Safety Blockers

As of 2026-05-20, the local AgentCash policy keeps the default spend window
closed, has zero remaining manual smoke budget, and marks live procurement,
Proof402 delegation, and auto-refill as disabled until separate approval. Code
may implement and test gates, but real paid calls must remain blocked until
that policy changes. The policy checker now supports separate locked,
live-window, and auto-refill modes so an approved window can be validated
without weakening the default locked posture.
