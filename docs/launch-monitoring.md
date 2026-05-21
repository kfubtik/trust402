# Trust402 Launch Monitoring

Use the production launch monitor after deployments and before making public
directory claims.

```powershell
npm run launch:monitor -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

The monitor is read-only. It never sends payment headers, never settles a paid
call, and never submits external marketplace forms.

## What It Checks

- production API readiness;
- catalog status is `production-mvp`;
- production settlement readiness has no blockers;
- unpaid x402 challenge on a protected paid route;
- spend policy gates remain closed for unapproved live buyer spend;
- CDP Bazaar all-resource visibility;
- external directory visibility.

## Status Meanings

`healthy-visible` means production is healthy, CDP Bazaar is indexed, and at
least one external directory page contains Trust402.

`healthy-cdp-indexed` means production is healthy and CDP Bazaar is indexed, but
external directory visibility has not appeared yet or was skipped.

`needs-attention` means at least one required production or CDP Bazaar check
failed.

External directory visibility is advisory for production health because those
sites can be curated, client-rendered, rate-limited, or asynchronously indexed.
It is still required for the final autonomous completion audit.

## Useful Modes

Fast production API and x402 check only:

```powershell
npm run launch:monitor -- https://trust402.aztecbeacon.uk --skip-bazaar --skip-directories
```

Include full raw child-check payloads for deep debugging:

```powershell
npm run launch:monitor -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --include-raw
```

Fail non-zero if required checks fail:

```powershell
npm run launch:monitor -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --strict
```

## GitHub Workflow

The public repository includes a manual workflow:

```text
.github/workflows/launch-monitor.yml
```

Use GitHub Actions -> `launch-monitor` -> Run workflow. The default run checks
production API readiness, unpaid x402 challenge, CDP Bazaar, and external
directories. Set `include_external_directories=false` for a faster production
and CDP Bazaar gate.

The workflow does not need secrets. It calls only public production URLs and
public directory pages.

## Current Custom-Domain Baseline

Last checked on 2026-05-21 after the repository was made public and production
was serving commit `d3ae50591323005867f955d7d4331a97757bb387` with:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20 --concurrency=8
npm run smoke -- https://trust402.aztecbeacon.uk
npm run smoke:x402 -- https://trust402.aztecbeacon.uk
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

Trust402's verified production/discovery state is:

```text
status = needs-attention
api.status = healthy
api.catalogStatus = production-mvp
api.paidLaunchResources = 10
api.anyLiveSpendReady = true only when production uses the approved
manual-action auto-refill policy and buyer spend remains gated; false in
local/default locked mode.
api.autoRefillReady = true when production uses the approved manual-action
auto-refill policy; false in local/default locked mode.
x402Challenge.status = challenge-ready
x402Challenge.httpStatus = 402
cdpBazaar.status = all-indexed
cdpBazaar.routeSummary.expected = 10
cdpBazaar.routeSummary.indexed = 10
cdpBazaar.routeSummary.missing = []
externalDirectories.status = not-visible-yet
externalDirectories.visible = 0
externalDirectories.checked = 13
```

That state is production-healthy for API/x402/spend safety, but launch
attention is required until the production runtime is redeployed with the
updated CDP Bazaar env evidence and at least one non-CDP external directory
visibly lists Trust402.

The earlier final verifier passed local release checks, Docker build,
production smoke, production x402 smoke, AgentCash refill dry-run, external
directory read-only check, launch monitor, and production completion audit on
the previous production origin. Re-run final verification only after the
custom-domain deploy/env evidence is live.

## AgentCash Refill Check

Use the refill dry-run monitor to inspect the AgentCash threshold decision
without mutating wallet balance:

```powershell
npm run agentcash:refill-check
npm run agentcash:refill-check -- --balance 0.42
```

The production API equivalent is:

```powershell
Invoke-RestMethod -Method Post -Uri https://trust402.aztecbeacon.uk/api/agentcash/refill-check -ContentType application/json -Body '{"mode":"dry-run","currentBalanceUsd":0.42,"amountRefilledTodayUsd":0}'
```

Live refill still requires explicit approval, provider config, operator
authorization, caps, and emergency stop remaining false.

## Completion Audit

Use the completion audit to see which final buyer-agent criteria are verified,
implemented-but-blocked, externally blocked, missing, or unverified:

```powershell
npm run completion:audit
npm run completion:audit -- https://trust402.aztecbeacon.uk
```

The API form is:

```powershell
Invoke-RestMethod -Method Get -Uri https://trust402.aztecbeacon.uk/api/completion/audit
```

The audit intentionally returns `goalComplete=false` until Git/Vercel
auto-deploy, non-CDP external directory visibility, live procurement, paid
Proof402 delegation, AgentCash auto-refill evidence, and final paid-smoke
evidence are actually proven.

## Final Verification Evidence

Use the final verifier after blockers are resolved, or as a read-only snapshot
of what still blocks completion:

```powershell
npm run final:verify -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

On this Windows workstation, pass the Docker Desktop binary explicitly so the
Docker credential helper directory is available to the verifier:

```powershell
npm run final:verify -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --docker-bin=D:\Programs\Docker\resources\bin\docker.exe
```

If CDP discovery is slow, the Bazaar checker supports bounded concurrency:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=15000 --limit=20 --concurrency=8
```

Useful safe modes:

```powershell
npm run final:verify -- https://trust402.aztecbeacon.uk --skip-docker --skip-directories
npm run final:verify -- https://trust402.aztecbeacon.uk --with-vercel-logs --include-details
```

The verifier runs local release checks, optional Docker build, production
smoke, unpaid x402 smoke, AgentCash refill dry-run, launch monitor, optional
external directory visibility, production completion audit, and optional Vercel
error-log inspection. It prints a `verificationHash`; only when every non-final
requirement is already verified does it suggest
`TRUST402_FINAL_VERIFICATION_OBSERVED=true`.
