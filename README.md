# Trust402

Trust402 is a buyer-side trust and procurement agent for the x402 economy.

It helps autonomous agents decide which paid x402 resources to use, how much
they are allowed to spend, what evidence they received, and how to prove the
result without leaking private payloads.

Tagline:

```text
Trust before you pay. Proof after you buy.
```

## Current Status

This repository contains a working public MVP API. Production serves from
`https://trust402.aztecbeacon.uk`, CDP Bazaar indexes all 10 custom-domain paid
resources, and x402scan visibly lists Trust402. The GitHub repository is public
at `https://github.com/kfubtik/trust402`.

Trust402's own live procurement and paid Proof402 delegation are implemented
behind spend-policy gates. Production now runs an operator-approved daily
autonomy window that may spend only against allowlisted origins, with strict
per-call, per-job, and daily caps. Production can also run a guarded real x402
Express middleware bridge for paid launch resources.

Implemented:

- free discovery endpoints;
- ten paid launch resources from the resource catalog;
- unpaid x402 endpoint probing;
- resource scoring;
- origin discovery evaluation;
- seller readiness checks;
- resource comparison;
- procurement planning;
- controlled procurement quotes;
- dry-run procurement execution audits;
- one-shot monitor snapshots and badge payloads;
- x402 diligence reports with a `sha256:` evidence hash;
- dry-run receipt bundles for Proof402-ready result hashes;
- Proof402 request preview/probe helper without paid delegation;
- real x402 settlement readiness endpoint and unpaid challenge smoke script;
- paid settlement smoke preflight endpoint and script;
- operator-gated payment bridge dry-run preflight plus live evidence runner enforcement;
- scheduled daily autonomy through Vercel Cron, with pseudo-random target
  selection and allowlisted live procurement;
- x402 SDK adapter/check plus an Express middleware bridge for future live settlement;
- optional mock 402 paywall for local payment-flow testing;
- tests and smoke script.

Still locked outside approved policy windows:

- arbitrary live paid subcalls to unknown agents;
- random external paid calls outside `LIVE_ALLOWED_REGISTRIES`;
- paid Proof402 receipt delegation outside the configured proof cap;
- AgentCash refill execution beyond the approved manual-action policy.

Those paths require explicit operator-approved spend windows, allowlists,
receipts, and caps before any wallet mutation.

## Run

```powershell
cd D:\Agents_402\trust402
npm ci
npm test
npm run verify
npm run dev
```

Docker:

```powershell
docker build -t trust402 .
docker run --rm -p 4032:4032 --env PUBLIC_BASE_URL=http://127.0.0.1:4032 trust402
```

Docker Compose:

```powershell
docker compose up --build
```

Open:

```text
http://127.0.0.1:4032/
http://127.0.0.1:4032/health
http://127.0.0.1:4032/api/status
http://127.0.0.1:4032/api/launch/checklist
http://127.0.0.1:4032/api/marketplace/bundle
http://127.0.0.1:4032/api/settlement/status
http://127.0.0.1:4032/api/policies/spend
http://127.0.0.1:4032/api/completion/plan
http://127.0.0.1:4032/api/completion/audit
http://127.0.0.1:4032/api/deployments/preflight
http://127.0.0.1:4032/api/domains/activation-pack
http://127.0.0.1:4032/api/directories/submission-pack
http://127.0.0.1:4032/api/jobs/autonomous-run
http://127.0.0.1:4032/api/agentcash/refill-check
http://127.0.0.1:4032/api/payments/bridge-check
http://127.0.0.1:4032/api/resources
http://127.0.0.1:4032/openapi.json
http://127.0.0.1:4032/.well-known/x402
```

Smoke test against a running server:

```powershell
npm run smoke -- http://127.0.0.1:4032
```

Check settlement SDK installation and route config drafts:

```powershell
npm run settlement:check
```

Check whether the operator config is ready for one paid settlement smoke. This
does not send payment:

```powershell
npm run settlement:preflight
```

Use `npm run settlement:preflight -- --strict` when you want the command to
exit non-zero until every paid-smoke guard is satisfied.

Check whether CDP Bazaar has externally indexed Trust402 after a successful
settle. This is read-only and never sends payment:

```powershell
npm run bazaar:indexing:check -- https://trust402.aztecbeacon.uk
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20
```

See [docs/bazaar-indexing.md](docs/bazaar-indexing.md) for the current
production indexing state and verification commands.

Check external directory visibility without submitting forms:

```powershell
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

Generate public-safe directory submission copy, target blockers, and evidence
env names without submitting forms:

```powershell
Invoke-RestMethod -Method Get -Uri https://trust402.aztecbeacon.uk/api/directories/submission-pack
npm run directories:submission-pack -- https://trust402.aztecbeacon.uk `
  --listing-base-url=https://trust402.aztecbeacon.uk `
  --user-approved-outreach
```

The custom domain is already attached. Verify it without mutating Vercel or
submitting directory forms:

```powershell
Invoke-RestMethod -Method Post -Uri https://trust402.aztecbeacon.uk/api/domains/readiness-check `
  -ContentType application/json `
  -Body '{"domain":"trust402.aztecbeacon.uk","expectedBaseUrl":"https://trust402.aztecbeacon.uk"}'
npm run domains:readiness-check -- https://trust402.aztecbeacon.uk `
  --domain=trust402.aztecbeacon.uk
```

Generate the Git/Vercel/custom-domain preflight pack without mutating GitHub or
Vercel:

```powershell
Invoke-RestMethod -Method Post -Uri https://trust402.aztecbeacon.uk/api/deployments/preflight `
  -ContentType application/json `
  -Body '{"customDomain":"trust402.aztecbeacon.uk","gitRemote":"https://github.com/kfubtik/trust402.git","gitHead":"43b96cf"}'
```

Generate the exact GitHub Actions setup command pack for the fallback
production deploy workflow. It prints secret names and local project ids, never
secret values:

```powershell
npm run deployment:github-actions-setup -- https://trust402.aztecbeacon.uk
Invoke-RestMethod -Method Post -Uri https://trust402.aztecbeacon.uk/api/deployments/github-actions-setup `
  -ContentType application/json `
  -Body '{"vercelProject":{"projectName":"trust402","projectId":"prj_...","orgId":"team_..."}}'
```

See [docs/external-marketplace-listing.md](docs/external-marketplace-listing.md)
for public-safe listing copy and directory submission gates.

Run the combined production launch monitor:

```powershell
npm run launch:monitor -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

See [docs/launch-monitoring.md](docs/launch-monitoring.md) for status meanings
and faster modes.

Operational launch backlog:

```text
docs/launch-issues.md
docs/autonomous-completion-plan.md
docs/visibility-growth-plan.md
```

## Modes

Default mode is dry-run:

```text
TRUST402_MODE=dry-run
TRUST402_PAYWALL_MODE=demo
```

Mock paywall mode returns `402 Payment Required` for paid launch resources until
the caller supplies a modern `PAYMENT-SIGNATURE` header. It also accepts legacy
`X-Payment` and `X-Payment-Payload` headers for local compatibility tests:

```text
TRUST402_PAYWALL_MODE=mock
```

Mock paywall mode is for local contract testing only. It is not real settlement.

Check an unpaid x402 challenge against mock or future real mode:

```powershell
$env:TRUST402_PAYWALL_MODE="mock"
npm run dev
npm run smoke:x402 -- http://127.0.0.1:4032
```

Real mode is fail-closed for protected POST resources. If
`TRUST402_PAYWALL_MODE=real` is set before all settlement guards pass, protected
routes return `503 real_settlement_not_ready` rather than running for free. Real
mode requires at least:

```text
TRUST402_PAYWALL_MODE=real
TRUST402_REAL_SETTLEMENT_ENABLED=true
PUBLIC_BASE_URL=https://your-public-origin.example
PAY_TO=0x...
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

Do not set `TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=true` until one paid smoke
has actually settled and the receipt has been reviewed.

For the one approved smoke window only, also set:

```text
TRUST402_PAID_SMOKE_APPROVED=true
TRUST402_PAID_SMOKE_MAX_USD=0.01
TRUST402_PAID_SMOKE_RESOURCE_ID=trust.score_resource
```

## Free Discovery Resources

```text
GET /health
GET /openapi.json
GET /.well-known/x402
GET /api/capabilities
GET /api/status
GET /api/launch/checklist
GET /api/marketplace/bundle
GET /api/settlement/status
GET /api/settlement/preflight
GET /api/policies/spend
GET /api/completion/plan
GET /api/completion/audit
GET /api/deployments/preflight
POST /api/deployments/preflight
GET /api/deployments/github-actions-setup
POST /api/deployments/github-actions-setup
GET /api/domains/activation-pack
POST /api/domains/activation-pack
GET /api/directories/submission-pack
POST /api/directories/submission-pack
GET /api/resources
POST /api/receipts/hash-result
POST /api/receipts/notarize-result
POST /api/procurement/execute
POST /api/live/window-plan
GET /api/operator/unblock-report
POST /api/operator/unblock-report
POST /api/operator/action-pack
GET /api/operator/readiness
POST /api/operator/readiness
POST /api/jobs/autonomous-run
GET /api/registries/candidates
POST /api/registries/candidates
POST /api/agentcash/refill-check
POST /api/payments/bridge-check
```

## Paid Launch Resources

| Resource | Purpose | Launch price |
| --- | --- | ---: |
| `POST /api/trust/check-x402` | Fast unpaid x402 challenge probe | `$0.005` |
| `POST /api/trust/score-resource` | Score one paid resource | `$0.01` |
| `POST /api/trust/evaluate-origin` | Score an origin/domain discovery posture | `$0.02` |
| `POST /api/seller/readiness` | Seller checklist for marketplace readiness | `$0.02` |
| `POST /api/trust/compare-resources` | Rank 2-10 candidate resources | `$0.03` |
| `POST /api/procurement/plan` | Bounded spend plan without spending | `$0.02` |
| `POST /api/procurement/quote` | Concrete quote and approval payload | `$0.04` |
| `POST /api/monitor/snapshot` | One-shot x402 trust/drift snapshot | `$0.015` |
| `POST /api/monitor/badge` | One-shot Trust402 badge payload | `$0.02` |
| `POST /api/reports/x402-diligence` | Full x402 endpoint/origin diligence report | `$0.08-$0.15` |

## Example Calls

Score a resource:

```powershell
$body = Get-Content .\examples\score-resource.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/trust/score-resource -ContentType application/json -Body $body
```

Create a procurement plan:

```powershell
$body = Get-Content .\examples\procurement-plan.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/procurement/plan -ContentType application/json -Body $body
```

Create a procurement quote:

```powershell
$body = Get-Content .\examples\procurement-quote.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/procurement/quote -ContentType application/json -Body $body
```

Simulate controlled execution:

```powershell
$body = Get-Content .\examples\procurement-execute-dry-run.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/procurement/execute -ContentType application/json -Body $body
```

Run the autonomous dry-run workflow:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/registries/candidates -ContentType application/json -Body '{"goal":"Create a proof-backed receipt.","budgetUsd":0.02}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/registries/candidates -ContentType application/json -Body '{"goal":"Find a safe x402 proof resource.","budgetUsd":0.02,"registryUrls":["https://registry.example/catalog.json"],"allowedRegistryOrigins":["https://registry.example"]}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/jobs/autonomous-run -ContentType application/json -Body '{"mode":"dry-run","goal":"Choose and audit one safe x402 resource.","budgetUsd":0.25,"maxPaidCalls":1,"includeProofPreview":true}'
```

Check AgentCash refill policy without mutating wallet balance:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/agentcash/refill-check -ContentType application/json -Body '{"mode":"dry-run","currentBalanceUsd":0.42,"amountRefilledTodayUsd":0}'
```

The response includes a versioned public-safe `auditBundle` with the refill
decision hash, threshold/cap state, adapter evidence hashes, and wallet-policy
requirements; it does not include wallet secrets or raw adapter responses.

Check a candidate payment bridge in dry-run mode before using it for live
procurement:

```powershell
npm run payment:bridge-check -- --adapter-url=https://<bridge-host>/pay --strict
```

Plan the buyer payment route before opening a live window. The live-window and
operator action-pack outputs include `paymentProviderAlternatives` for
`agentcash-mcp`, `cdp-x402`, `x402-fetch`, and `external-adapter`; these list
required secret names and preflight commands without printing secret values:

```powershell
npm run live:window-plan -- https://trust402.aztecbeacon.uk --payment-provider=cdp-x402 --candidate-endpoint=https://proof402.vercel.app/api/proof/notarize --candidate-price=0.005 --max-total-usd=0.015
npm run payment:buyer-preflight -- --provider=cdp-x402 --strict
```

Create a monitor snapshot:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/monitor/snapshot -ContentType application/json -Body '{"endpoint":"https://example.com/api/paid","method":"GET","expectedStatus":402}'
```

Create a badge payload:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/monitor/badge -ContentType application/json -Body '{"endpoint":"https://example.com/api/paid"}'
```

Compare candidate resources:

```powershell
$body = Get-Content .\examples\compare-resources.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/trust/compare-resources -ContentType application/json -Body $body
```

Prepare a dry-run receipt bundle:

```powershell
$body = Get-Content .\examples\hash-result.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/receipts/hash-result -ContentType application/json -Body $body
```

Preview a Proof402 notarization request without paying:

```powershell
$body = Get-Content .\examples\notarize-result.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/receipts/notarize-result -ContentType application/json -Body $body
```

Preflight a paid Proof402 proof before any live call:

```powershell
npm run proof402:preflight -- --result-hash=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --approved-hash=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --price-usd=0.005
```

Create an x402 diligence report:

```powershell
$body = Get-Content .\examples\x402-diligence.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/reports/x402-diligence -ContentType application/json -Body $body
```

Export marketplace metadata:

```powershell
npm run marketplace:bundle
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:4032/api/marketplace/bundle
```

Check asynchronous CDP Bazaar discovery visibility:

```powershell
npm run bazaar:indexing:check -- https://trust402.aztecbeacon.uk
```

Inspect real-settlement blockers:

```powershell
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:4032/api/settlement/status
```

Inspect the paid-smoke preflight without spending:

```powershell
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:4032/api/settlement/preflight
```

Inspect live-spend policy gates without spending:

```powershell
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:4032/api/policies/spend
```

Run the completion audit without pretending blocked live/manual items are done:

```powershell
npm run completion:audit
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:4032/api/completion/plan
Invoke-RestMethod -Method Get -Uri http://127.0.0.1:4032/api/completion/audit
```

`/api/completion/plan` is the pinned machine-readable contract for the final
Trust402 build. `/api/completion/audit` is the current runtime verdict against
that contract.

`goalComplete=true` is reserved for the state where every requirement is
`verified`; implemented-but-blocked paths do not count as completion.

Manual or external requirements become `verified` only when public-safe
evidence env vars are set, such as `TRUST402_GIT_AUTO_DEPLOY_VERIFIED=true` with
a deployment evidence URL. The external-directory requirement needs both
`TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED=true` with a public-safe 10/10 CDP
Bazaar evidence ref, `TRUST402_CDP_BAZAAR_CHECK_STATUS=all-indexed`,
expected/indexed resource counts, zero missing resources, and
`TRUST402_EXTERNAL_DIRECTORY_STATUS=visible` with a non-CDP directory evidence
URL.

Live buyer-agent requirements also require public-safe evidence refs:
`TRUST402_LIVE_PROCUREMENT_SMOKE_OBSERVED`,
`TRUST402_PROOF402_PAID_SMOKE_OBSERVED`,
`TRUST402_AGENTCASH_AUTO_REFILL_EVIDENCE_OBSERVED`,
`TRUST402_AUTONOMOUS_JOB_SMOKE_OBSERVED`, and
`TRUST402_FINAL_VERIFICATION_OBSERVED`.

Run the read-only final verifier to collect the current command evidence and a
public-safe verification hash:

```powershell
npm run final:verify -- https://trust402.aztecbeacon.uk --skip-docker --skip-directories
```

On this Windows workstation, use the installed Docker Desktop binary for the
full Docker gate:

```powershell
npm run final:verify -- https://trust402.aztecbeacon.uk --docker-bin=D:\Programs\Docker\resources\bin\docker.exe
```

Plan an approved live evidence window without spending:

```powershell
npm run live:window-plan -- https://trust402.aztecbeacon.uk `
  --candidate-endpoint=https://approved.example/paid `
  --candidate-price=0.01 `
  --max-total-usd=0.03
```

Write a public-safe local evidence ledger during dry-run or approved live
evidence collection:

```powershell
npm run live:evidence-smoke -- https://trust402.aztecbeacon.uk --write-evidence
```

Ledger entries go under `.local/evidence-ledger/`, which is ignored by Git.
They contain hashes, stage status, and public-safe evidence refs, not operator
keys, payment signatures, private payloads, or wallet secrets.

In live mode, bridge-backed providers must pass `/api/payments/bridge-check`
first. If the bridge does not explicitly confirm dry-run/no-payment behavior,
the runner stops before procurement, Proof402 delegation, or autonomous live
job execution.

For an approved one-shot live smoke window, use the guarded wrapper so the
local AgentCash policy patch is restored after the run:

```powershell
$env:TRUST402_LIVE_SMOKE_WINDOW_APPROVED="true"
npm run live:smoke-window -- https://trust402.aztecbeacon.uk `
  --live `
  --apply-local-policy `
  --candidate-endpoint=https://approved.example/paid `
  --candidate-price=0.01 `
  --max-total-usd=0.03
```

Without `--live` and `--apply-local-policy`, the wrapper is preview-only and
writes nothing.

Export the public-safe operator action pack for all remaining blockers:

```powershell
npm run completion:actions -- https://trust402.aztecbeacon.uk `
  --candidate-endpoint=https://approved.example/paid `
  --candidate-price=0.01 `
  --max-total-usd=0.03
```

Check Git/Vercel auto-deploy and custom-domain readiness without mutating either
service:

```powershell
npm run deployment:preflight -- https://trust402.aztecbeacon.uk
npm run deployment:preflight -- https://trust402.aztecbeacon.uk --probe-github-cli
npm run deployment:preflight -- https://trust402.aztecbeacon.uk --probe-vercel-api --vercel-scope <vercel-scope>
npm run deployment:github-actions-setup -- https://trust402.aztecbeacon.uk
```

The optional probes check GitHub CLI auth/workflow evidence and sanitized Vercel
deployment metadata. They never print secret values or mutate either service.
The setup pack turns the same blocker into concrete `gh secret set`, workflow
trigger, and verification commands while keeping `VERCEL_TOKEN` as a local
paste-only placeholder.

Check the local Trust402-only AgentCash policy without spending:

```powershell
npm run agentcash:policy
npm run agentcash:direct-smoke-plan -- https://trust402.aztecbeacon.uk
npm run agentcash:direct-smoke-window -- --status
npm run agentcash:refill-check
npm run agentcash:refill-check -- --balance 0.42
```

`agentcash:direct-smoke-plan` emits the exact one-shot AgentCash MCP schema
check and paid fetch inputs for the current Bazaar missing route. It is
read-only: it does not call AgentCash, write `.local`, or spend.
`agentcash:direct-smoke-window` can open and close the temporary local
AgentCash policy window after the exact approval phrase is supplied; status mode
is read-only.

## Safety

Trust402 is allowed to reason about spending before it is allowed to spend.

MVP guarantees:

- live spend is policy-gated and capped in production;
- private keys and wallet secrets are never stored in tracked files;
- paid subcalls can be made only from approved live windows, with allowlists,
  caps, receipts, and operator/cron authorization;
- `/api/procurement/execute` is dry-run by default and cannot enter live mode
  unless operator authorization, caps, allowlists, and a real payment adapter
  are all configured;
- `/api/jobs/autonomous-run` is dry-run by default and uses the same operator
  and spend-policy gates as live procurement. Before quote generation it can
  resolve explicit, registry-supplied, and trusted seed candidates through
  `/api/registries/candidates`;
- `/api/registries/candidates` can perform local candidate resolution and
  optional read-only allowlisted registry JSON fetches: no payment headers, no
  secret headers, no wallet mutation, and no paid subcalls;
- `/api/agentcash/refill-check` can plan refill actions in dry-run mode but
  cannot mutate wallet balance without approved provider, operator key, caps,
  and emergency-stop checks;
- `/api/receipts/notarize-result` never makes a paid Proof402 call in the MVP;
- `/api/settlement/status` does not claim marketplace indexing readiness until explicit config and paid smoke evidence exist;
- `/api/settlement/preflight` can plan one paid smoke but never sends payment;
- `/api/completion/audit` keeps final success criteria machine-readable and
  marks live/manual/external blockers as unresolved until real evidence exists;
- `/api/completion/plan` pins the autonomous buyer-agent success contract and
  evidence env requirements without sending payment headers or mutating state;
- `/api/deployments/preflight` makes Git/Vercel/custom-domain deployment
  blockers machine-readable without reading secret values or mutating GitHub or
  Vercel;
- `/api/deployments/github-actions-setup` emits public-safe GitHub Actions setup
  and verification commands without running them or printing secret values;
- `/api/domains/activation-pack` plans custom-domain activation but never buys a
  domain, mutates Vercel, sets env vars, or claims availability/pricing without
  supplied fresh public-safe evidence;
- `/api/domains/readiness-check` verifies DNS, HTTPS health, x402 discovery,
  and unpaid x402 challenge for an attached custom domain without mutating
  Vercel, setting env vars, submitting directory forms, or sending payment
  headers;
- `/api/directories/submission-pack` builds public-safe listing payloads and
  directory blockers but never submits forms or sets evidence env;
- `bazaar:indexing:check` only reads public CDP discovery endpoints and never sends payment;
- real paywall mode fails closed for protected routes when settlement guards are incomplete;
- unpaid probes strip `PAYMENT-SIGNATURE`, `X-Payment`, `Authorization`, cookie, and proxy authorization headers;
- `procurement/plan` is plan-only;
- diligence reports include hash-ready evidence but do not call Proof402 yet;
- `.env`, wallet files, local data, and AgentCash material are ignored.

Future live procurement must require:

- hot-wallet profile;
- AgentCash auto-refill provider and stop rule if refill is enabled;
- operator API key for every live execution;
- emergency stop remaining false;
- per-call limit;
- per-job limit;
- daily limit;
- current spent-today value (`LIVE_SPENT_TODAY_USD`) so remaining daily
  capacity is enforced before each approved live job;
- registry allowlist;
- endpoint denylist;
- receipt log;
- payment adapter: `external-adapter`, AgentCash bridge, or in-process
  `@x402/fetch` with local/Vercel-secret buyer credentials;
- dry-run payment bridge preflight confirming no paid subcalls before live mode;
- human approval above threshold.

## Project Files

- `src/server.js` - HTTP API, mock paywall, and real-mode startup switch.
- `src/expressApp.js` - Express entrypoint bridge for Vercel and real x402 middleware.
- `src/trustEngine.js` - checks, scoring, planning, and report logic.
- `src/procurement.js` - quote and policy-gated procurement execution logic.
- `src/paymentAdapters.js` - buyer-side payment adapter readiness and bridge logic.
- `src/paymentBridgeCheck.js` - operator-gated dry-run preflight for payment bridge safety.
- `src/autonomousJob.js` - dry-run-first autonomous job orchestration.
- `src/agentcashDirectSmokePlan.js` - read-only AgentCash MCP one-shot smoke approval packet.
- `src/agentcashDirectSmokeWindow.js` - local open/close guard for the AgentCash direct smoke policy window.
- `src/agentcashRefill.js` - AgentCash refill policy decision and adapter-gated live action.
- `src/evidenceLedger.js` - local public-safe JSONL ledger for evidence hashes and refs.
- `src/liveWindowPlan.js` - read-only live evidence window planner.
- `src/operatorActionPack.js` - public-safe action pack for remaining completion blockers.
- `src/operatorReadiness.js` - public-safe readiness profile that combines
  env diagnostics, local AgentCash policy, and manual live-evidence gates.
- `src/deploymentPreflight.js` - public-safe Git/Vercel/custom-domain preflight profile.
- `src/githubActionsSetupPack.js` - public-safe GitHub Actions setup command pack.
- `src/domainActivationPack.js` - public-safe custom-domain activation pack.
- `src/directorySubmissionPack.js` - public-safe external directory submission pack.
- `src/monitor.js` - one-shot monitor snapshot and badge logic.
- `src/proof402Client.js` - Proof402 request preview/probe logic with adapter-gated live calls.
- `src/settlement.js` - real x402 settlement readiness and unpaid challenge metadata.
- `src/x402SdkAdapter.js` - disabled-by-default x402 SDK adapter used by the Express bridge.
- `src/policies.js` - machine-readable spend policy gates and launch issue links.
- `src/completionAudit.js` - final buyer-agent requirement audit and blockers.
- `src/completionPlan.js` - pinned autonomous buyer-agent success contract.
- `src/marketplace.js` - marketplace submission bundle and Bazaar extension drafts.
- `src/openapi.js` - OpenAPI, capabilities, and `.well-known/x402`.
- `src/readiness.js` - dry-run launch and public marketplace readiness checks.
- `src/receipts.js` - dry-run receipt bundles and Proof402-ready hashes.
- `marketplace/resources.json` - machine-readable launch and backlog catalog.
- `docs/resource-catalog.md` - human-readable resource catalog and prices.
- `docs/safety-policy.md` - live-spend and secret-handling policy.
- `docs/mvp-roadmap.md` - build phases.
- `docs/deployment.md` - Docker and production environment notes.
- `docs/bazaar-indexing.md` - CDP Bazaar indexing runbook and verification state.
- `docs/external-marketplace-listing.md` - public-safe listing copy and directory submission plan.
- `docs/launch-monitoring.md` - combined production launch monitoring runbook.
- `docs/launch-issues.md` - tracked manual launch and live-spend policy gates.
- `docs/autonomous-completion-plan.md` - final autonomous buyer-agent completion plan.
- `compose.yaml` - local Docker Compose service with dry-run defaults.
- `docs/github-release-checklist.md` - public release checklist.
- `scripts/check-bazaar-indexing.js` - read-only CDP Bazaar visibility check.
- `scripts/check-external-directories.js` - read-only external directory visibility check.
- `scripts/env-doctor.js` - local `.env` shape checker that reports only
  `present`, `nonEmpty`, and `placeholderLike` flags, never values or lengths.
- `scripts/check-agentcash-policy.js` - local Trust402-only AgentCash policy check.
- `scripts/agentcash-direct-smoke-plan.js` - local approval packet for a bounded AgentCash direct smoke.
- `scripts/agentcash-direct-smoke-window.js` - local status/open/close helper for that approved direct smoke window.
- `scripts/agentcash-refill-check.js` - local AgentCash refill dry-run monitor.
- `scripts/completion-audit.js` - local or production completion audit runner.
- `scripts/final-verification.js` - final evidence collector for tests, Docker,
  production smoke, x402, launch monitor, directories, and completion audit.
- `scripts/live-window-plan.js` - read-only live-window staging plan for
  approved x402 spend evidence.
- `scripts/operator-action-pack.js` - public-safe operator action pack exporter;
  with a URL it reads the production API unless `--local` is passed.
- `scripts/operator-readiness.js` - operator readiness profile for env, wallet
  policy, payment runtime, external directory, and final evidence gates; with a
  URL it reads the production API unless `--local` is passed, and appends local
  workstation probes separately.
- `scripts/operator-unblock-check.js` - public-safe unblock report runner; with
  a URL it reads the production API unless `--local` is passed. Exposed as
  both `npm run completion:unblockers` and `npm run operator:unblock-report`.
- `scripts/launch-monitor.js` - combined production API, x402, Bazaar, and directory monitor.
- `test/` - API and engine tests.
