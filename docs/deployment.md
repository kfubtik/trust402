# Trust402 Deployment

Trust402 is a Node.js HTTP API with a guarded Express bridge for real x402
settlement. Default deployments run in dry-run/demo mode.

## Required Environment

```text
HOST=0.0.0.0
PORT=4032
PUBLIC_BASE_URL=https://your-domain.example
TRUST402_MODE=dry-run
TRUST402_PAYWALL_MODE=demo
TRUST402_REAL_SETTLEMENT_ENABLED=false
```

Keep live spend disabled for the public MVP:

```text
PROOF402_BASE_URL=https://proof402.vercel.app
PROOF402_DELEGATION_MODE=disabled
PROOF402_MAX_SPEND_USD=0
```

## Docker

The GitHub Actions workflow builds the Docker image and runs a container smoke
test on every push. It also runs a high-severity production dependency audit:

```powershell
npm audit --omit=dev --audit-level=high
```

Dependabot monitors npm and GitHub Actions dependencies weekly and opens PRs
instead of changing production automatically.

Build:

```powershell
docker build -t trust402 .
```

On this Windows workstation Docker Desktop is installed under `D:\Programs\Docker`.
If the current shell does not know `docker`, either open a fresh terminal or use:

```powershell
$env:PATH = "D:\Programs\Docker\resources\bin;$env:PATH"
& "D:\Programs\Docker\resources\bin\docker.exe" build -t trust402 .
```

Run:

```powershell
docker run --rm -p 4032:4032 --env PUBLIC_BASE_URL=http://127.0.0.1:4032 trust402
```

Run with Docker Compose:

```powershell
docker compose up --build
```

Check:

```powershell
npm run smoke -- http://127.0.0.1:4032
npm run settlement:check
npm run settlement:preflight
npm run doctor
npm run marketplace:bundle
npm run bazaar:indexing:check -- https://trust402.vercel.app
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
```

Use `npm run settlement:preflight -- --strict` only for the approved paid-smoke
window, when a non-zero exit should block the smoke.

## Production Notes

- Do not mount `.env`, wallet files, or `.agentcash` into a public container.
- Keep `compose.yaml` on dry-run defaults unless you are doing an approved local settlement test.
- Keep `TRUST402_PAYWALL_MODE=demo` until CDP credentials and a paid smoke budget are approved. After production real mode is approved, keep Trust402 live procurement and Proof402 delegation disabled unless separately approved.
- Live buyer mode needs a payment adapter in addition to spend caps. Do not
  mark `LIVE_SPEND_ENABLED=true` ready with plain `fetch`; use an
  `external-adapter`, an AgentCash bridge URL, or `@x402/fetch` with secret
  buyer key and RPC URL.
- Set `LIVE_SPENT_TODAY_USD` before any approved live buyer window. Trust402
  subtracts that from `LIVE_DAILY_LIMIT_USD` and blocks purchases that would
  exceed the remaining daily capacity.
- Use `TRUST402_PAYWALL_MODE=mock` only for local 402 contract testing.
- Use `npm run smoke:x402 -- <base-url>` against mock mode or approved real mode to verify unpaid `402 Payment Required` challenges without settling a payment.
- Put the API behind HTTPS before submitting to x402 marketplaces.
- Set `PUBLIC_BASE_URL` to the final HTTPS origin so OpenAPI and `.well-known/x402` expose correct URLs.
- Use `/api/launch/checklist` or `npm run doctor` before marketplace submission.
- Use `/api/marketplace/bundle` or `npm run marketplace:bundle` to inspect Bazaar-style resource metadata before submitting anywhere.
- Use `/api/settlement/preflight` or `npm run settlement:preflight` before the one approved paid smoke.
- Use `npm run bazaar:indexing:check -- https://trust402.vercel.app` after a successful paid smoke to check asynchronous CDP Bazaar visibility.
- Use `npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20` before public launch claims about every paid resource.
- See `docs/bazaar-indexing.md` for the current production indexing state and completion gate.

## Vercel

Current production URL:

```text
https://trust402.vercel.app
```

The safe default environment profile is:

```text
PUBLIC_BASE_URL=https://trust402.vercel.app
PROOF402_BASE_URL=https://proof402.vercel.app
PROOF402_DELEGATION_MODE=disabled
PROOF402_MAX_SPEND_USD=0
TRUST402_REAL_SETTLEMENT_ENABLED=false
TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=false
```

For the approved production real-settlement profile, the same URL uses:

```text
TRUST402_PAYWALL_MODE=real
TRUST402_REAL_SETTLEMENT_ENABLED=true
TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=true
TRUST402_PAID_SMOKE_APPROVED=false
TRUST402_PAID_SMOKE_MAX_USD=0
```

CDP secrets must stay in Vercel environment variables or local `.env`; never
commit them. Keep these local placeholders for preparation:

```text
PAY_TO=
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
```

Live procurement/proof buyer credentials are separate from seller settlement
credentials. Keep these empty unless an approved buyer-spend window exists:

```text
LIVE_PAYMENT_PROVIDER=disabled
LIVE_PAYMENT_ADAPTER_URL=
X402_BUYER_PRIVATE_KEY=
X402_BUYER_RPC_URL=
CDP_EVM_ACCOUNT_ADDRESS=
CDP_EVM_ACCOUNT_NAME=
```

`LIVE_PAYMENT_PROVIDER=cdp-x402` uses `@coinbase/cdp-sdk` plus
`@x402/fetch` with a CDP server-managed EVM account. It requires
`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, and either
`CDP_EVM_ACCOUNT_ADDRESS` or `CDP_EVM_ACCOUNT_NAME`. Trust402 fetches an
existing account with `cdp.evm.getAccount(...)`; it does not create a CDP
account implicitly during a paid request. `X402_BUYER_RPC_URL` is optional for
RPC backfill when x402 extensions need on-chain reads.

Before any `cdp-x402` live window, check the buyer signer without paying:

```powershell
npm run payment:buyer-preflight -- --provider=cdp-x402 --strict
```

That command is read-only and only checks configured secret/account gates. To
confirm the account exists in CDP, add `--probe-cdp --operator-approved`; the
API equivalent is `POST /api/payments/buyer-preflight` with the operator key.
The probe calls `cdp.evm.getAccount(...)` only, never creates accounts, never
sends payment headers, and prints only address previews/hashes.

When `LIVE_PAYMENT_PROVIDER=agentcash-mcp` or `external-adapter`,
`LIVE_PAYMENT_ADAPTER_URL` is required. Trust402 posts a public-safe bridge
request to that URL and expects the bridge to perform the paid x402 fetch while
enforcing `maxAmountUsd`. The bridge request shape is:

```json
{
  "service": "Trust402",
  "provider": "agentcash-mcp",
  "protocol": "x402",
  "mode": "dry-run",
  "dryRun": true,
  "maxAmountUsd": "<LIVE_MAX_PER_CALL_USD>",
  "network": "<X402_NETWORK>",
  "request": {
    "url": "<downstream x402 URL>",
    "method": "POST",
    "headers": "<public headers only>",
    "body": "<stringified public-safe request body>"
  }
}
```

Trust402 strips auth, cookie, payment, signature, token, secret, and API-key
headers before calling the bridge. It does not send private keys or payment
headers to the bridge.

For preflight, the bridge must explicitly prove dry-run/no-payment behavior by
returning `dryRun=true`, `mode=dry-run`, `safety.dryRunOnly=true`,
`payment.paid=false`, or `response.paymentMade=false`. A bare
`paidSubcallsMade=0` is tracked, but it is not enough by itself to pass the
preflight.

Before any live spend window, run a dry-run bridge preflight. The local CLI can
check a candidate URL directly:

```powershell
npm run payment:bridge-check -- --adapter-url=https://<bridge-host>/pay --strict
```

The production API form is operator-gated and only uses the configured
`LIVE_PAYMENT_ADAPTER_URL`; it never accepts arbitrary public probe targets:

```powershell
Invoke-RestMethod -Method Post `
  -Uri https://trust402.vercel.app/api/payments/bridge-check `
  -Headers @{"x-trust402-operator-key"="<operator-key>"} `
  -ContentType application/json `
  -Body '{"provider":"agentcash-mcp","candidateEndpoint":"https://proof402.vercel.app/api/proof/notarize","maxAmountUsd":0.01}'
```

### Git-backed Deploys

Manual Vercel CLI production deploys work:

```powershell
npx vercel@latest --prod --yes
```

Git-backed auto-deploy is still a Vercel/GitHub integration permission issue,
not a Trust402 code issue. The current private GitHub remote is:

```text
https://github.com/kfubtik/trust402.git
```

This command currently fails until the Vercel GitHub App has access to that
private repository:

```powershell
npx vercel@latest git connect https://github.com/kfubtik/trust402.git --non-interactive
```

Expected failure while access is missing:

```text
Failed to connect kfubtik/trust402 to project. Make sure there aren't any
typos and that you have access to the repository if it's private.
```

Fix in Vercel/GitHub UI:

- keep the GitHub repository private;
- open the Vercel project `trust402`;
- connect the Git repository or update the Vercel GitHub App installation;
- grant access to `kfubtik/trust402`;
- rerun the `vercel git connect` command above.

After a push-triggered production deployment is observed, record only
public-safe evidence in Vercel production env:

```text
TRUST402_GIT_AUTO_DEPLOY_VERIFIED=true
TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL=https://vercel.com/.../deployments/...
TRUST402_GIT_AUTO_DEPLOY_COMMIT_SHA=<commit-sha>
```

Those flags do not enable deployment by themselves. They only let
`/api/completion/audit` verify the Git/Vercel requirement after the real
integration has been proven.

The same read-only profile is exposed for agents at:

```text
GET /api/deployments/preflight
POST /api/deployments/preflight
```

It accepts public evidence such as `customDomain`, `gitRemote`, `gitHead`,
workflow snippets, GitHub run metadata, and Vercel deployment metadata. It does
not read secret values and does not mutate GitHub or Vercel.

### GitHub Actions Fallback Deploy

If the Vercel GitHub App cannot access the private repository yet, the repo also
contains a fallback production deploy workflow:

```text
.github/workflows/vercel-production-deploy.yml
```

It runs on every push to `main` and on manual `workflow_dispatch`. It does not
store Vercel credentials in the repository. Add these GitHub repository secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Use the values from the linked local project for the two IDs and create the
token in Vercel with the least scope that can deploy this project. The workflow
will fail closed if any secret is missing.

The fallback workflow performs:

```text
npm test
npm run privacy:check
npm audit --omit=dev --audit-level=high
npx vercel@latest pull --yes --environment=production
npx vercel@latest build --prod
npx vercel@latest deploy --prebuilt --prod
npm run smoke
npm run smoke:x402
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --skip-directories --strict
```

This fallback can produce the Git/Vercel evidence required by
`/api/completion/audit` if a push to `main` creates a production deployment and
the workflow checks pass. Record the workflow run URL or Vercel deployment URL
in `TRUST402_GIT_AUTO_DEPLOY_EVIDENCE_URL`.

## Operator Unblock Check

Use this read-only command before an approved final/live window:

```powershell
npm run completion:unblockers -- https://trust402.vercel.app
```

It does not set secrets, mutate wallets, submit directory forms, or send payment
headers. It summarizes the remaining manual blockers for Git/Vercel auto-deploy,
custom domain and external directory evidence, live procurement, paid Proof402,
AgentCash refill, autonomous-job evidence, and final verification evidence.

## Live Evidence Smoke Runner

Trust402 includes a local runner for the final live evidence window:

```powershell
npm run live:evidence-smoke -- https://trust402.vercel.app
```

Without `--live`, it is dry-run only. For live mode it refuses to run unless all
local runner gates are present:

```powershell
$env:TRUST402_LIVE_EVIDENCE_SMOKE_APPROVED='true'
$env:TRUST402_OPERATOR_API_KEY='<operator key already configured in Vercel>'
npm run live:evidence-smoke -- https://trust402.vercel.app `
  --live `
  --candidate-endpoint=https://proof402.vercel.app/api/proof/notarize `
  --candidate-price=0.005 `
  --proof-reserve-usd=0.005 `
  --max-total-usd=0.015
```

Add `--include-autonomous-live` only after budgeting for a second downstream
paid call. The runner never prints the operator key, never sends payment headers
itself, and only records public-safe hashes/evidence refs. If live policy and
receipts are valid, it suggests the `TRUST402_*_EVIDENCE_REF` environment
values that can be reviewed before adding them to production.
For the Proof402 candidate, the downstream procurement request contains only a
generated `contentHash`, `label`, `idempotencyKey`, and public-safe metadata.

Before the live window, verify the exact approved proof candidate in read-only
mode:

```powershell
npm run proof402:preflight -- `
  --result-hash=sha256:<approved-result-hash> `
  --approved-hash=sha256:<approved-result-hash> `
  --price-usd=0.005 `
  --strict
```

The matching API is `POST /api/proof402/preflight`. It does not call Proof402,
does not send payment headers, and does not mutate the AgentCash wallet.

When the configured live payment provider uses a bridge, such as `agentcash-mcp`
or `external-adapter`, the runner calls `/api/payments/bridge-check` before any
live procurement or paid Proof402 call. The live run stops unless that dry-run
preflight proves no payment headers were sent and no paid subcalls happened.

Before any live request, the runner also reads
`.local/trust402-agentcash-wallet.json`. Live mode is blocked unless that local
policy explicitly approves the manual smoke window and the estimated spend fits
the local remaining budget, global cap, and minimum reserve. The current local
policy intentionally has `manualSmokeRemainingBudgetUsd=0`, so live evidence
smoke remains blocked until a new approved spend window is recorded locally.

To keep a local public-safe evidence trail, add `--write-evidence`:

```powershell
npm run live:evidence-smoke -- https://trust402.vercel.app --write-evidence
```

The runner appends JSONL entries under `.local/evidence-ledger/`. Those entries
are ignored by Git and include only evidence hashes, stage status, public-safe
evidence refs, and redacted safety summaries. They do not store operator keys,
payment signatures, private payloads, wallet secrets, or payment headers.

## Live Window Planner

Before changing local policy or production env for a live window, generate a
read-only staging plan:

```powershell
npm run live:window-plan -- https://trust402.vercel.app `
  --candidate-endpoint=https://proof402.vercel.app/api/proof/notarize `
  --candidate-price=0.005 `
  --proof-reserve-usd=0.005 `
  --max-total-usd=0.015 `
  --live-spent-today-usd=0
```

The planner proposes:

- non-secret Vercel env values for live procurement, Proof402, and optional
  AgentCash auto-refill;
- a local `.local/trust402-agentcash-wallet.json` policy patch to review;
- the exact `npm run live:evidence-smoke` command for the approved window;
- blockers when the endpoint, budget, provider, balance, or reserve is unsafe.

It is intentionally read-only: no wallet mutation, no env writes, no payment
headers, and no secret output.

After the plan is approved, prefer the guarded smoke-window wrapper:

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

It stages the local policy patch, runs the bounded evidence smoke, and restores
the previous `.local/trust402-agentcash-wallet.json` in `finally`. Without
`--live` and `--apply-local-policy`, it only previews the same plan.

The same planner is exposed as a free API helper for agents:

```text
POST /api/live/window-plan
```

For all remaining operator blockers at once, use:

```powershell
npm run completion:actions -- https://trust402.vercel.app
```

or call the free API helper:

```text
POST /api/operator/action-pack
```

## Deployment Preflight

Use the read-only deployment preflight before trying to close Git/Vercel
auto-deploy or external-directory requirements:

```powershell
npm run deployment:preflight -- https://trust402.vercel.app
```

It checks the local Vercel project link, Git remote, GitHub Actions fallback
workflow, launch-monitor workflow, expected Vercel secret names, and whether
the current host is a custom production domain. It does not read secret values,
connect GitHub, mutate Vercel, or submit directory forms.

Optional read-only probes can make that check stronger when the local CLIs are
authenticated:

```powershell
npm run deployment:preflight -- https://trust402.vercel.app --probe-github-cli
npm run deployment:preflight -- https://trust402.vercel.app --probe-vercel-api --vercel-scope sergo565456-2815s-projects
```

The GitHub probe checks CLI auth, secret names, workflow visibility, and recent
deploy workflow runs. The Vercel probe checks only sanitized project metadata:
env key names, latest production deployment id/url, ready state, and Git commit
metadata. Neither probe prints secret values or mutates GitHub/Vercel.

It returns public-safe action groups for Git/Vercel auto-deploy, custom domain,
external directory evidence, live procurement, paid Proof402, AgentCash refill,
autonomous job evidence, and final verification evidence. It does not set env
vars, submit directory forms, write local policy, mutate wallets, or include
secret values.

The action pack also includes `evidenceCollection`: a single ordered evidence
plan with `nextBlockingActionId`, `blockingActionIds`, public-safe
`evidenceEnvPlan`, verification commands, and local-only evidence commands such
as `npm run agentcash:policy`. Do not set any `TRUST402_*_OBSERVED=true` value
until the corresponding action reports `ready` and the verification command has
produced a reviewed public-safe evidence reference.

`npm run agentcash:policy` defaults to the locked posture and fails if a local
manual spend budget or auto-refill is left enabled. For a reviewed temporary
window, pass an explicit guard mode instead:

```powershell
npm run agentcash:policy -- --mode=live-window --include-proof --estimated-spend=0.02
npm run agentcash:policy -- --mode=auto-refill
```

Those modes are validation-only. They do not send payment headers, mutate
AgentCash, or change the ignored local policy.

If AgentCash MCP output is collected, validate the public observation through
Trust402 before using it as live-spend evidence:

```powershell
npm run agentcash:mcp-observation -- `
  --accounts-json='[{"network":"base","address":"0xf2aB09D8146f453CA86486afEA15D6747B72D0D7","balance":1.283}]' `
  --settings-json='{"maxAmount":0.01}'
```

This guard does not call AgentCash MCP by itself. It only checks the observed
accounts/settings against `.local/trust402-agentcash-wallet.json`, masks wallet
addresses in output, and fails if the Base address, per-fetch max amount,
minimum reserve, or approved network policy does not match.

## Live x402 Settlement

The Express middleware bridge protects paid launch resources when
`TRUST402_PAYWALL_MODE=real` and every `/api/settlement/status` guard passes.
If real mode is requested before the guards pass, protected POST routes fail
closed with `503 real_settlement_not_ready`.

Before enabling it, prepare:

- facilitator configuration;
- pay-to wallet review;
- receipt logging;
- rollback plan;
- a paid smoke test with an explicit max-spend approval.

Use this endpoint to inspect blockers:

```text
GET /api/settlement/status
```

For Base mainnet through CDP, the expected facilitator value is:

```text
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
```

For CDP-backed settlement, configure these as environment variables, never in
tracked files:

```text
TRUST402_PAYWALL_MODE=real
TRUST402_REAL_SETTLEMENT_ENABLED=true
PAY_TO=0x...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
TRUST402_PAID_SMOKE_APPROVED=true
TRUST402_PAID_SMOKE_MAX_USD=0.01
```

Keep `TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=false` until the paid smoke
returns a reviewed settlement receipt. After the receipt is reviewed and the
flag is true, close the smoke window again:

```text
TRUST402_PAID_SMOKE_APPROVED=false
TRUST402_PAID_SMOKE_MAX_USD=0
```
