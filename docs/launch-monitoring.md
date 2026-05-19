# Trust402 Launch Monitoring

Use the production launch monitor after deployments and before making public
directory claims.

```powershell
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000
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
npm run launch:monitor -- https://trust402.vercel.app --skip-bazaar --skip-directories
```

Include full raw child-check payloads for deep debugging:

```powershell
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --include-raw
```

Fail non-zero if required checks fail:

```powershell
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --strict
```

## GitHub Workflow

The private repository includes a manual workflow:

```text
.github/workflows/launch-monitor.yml
```

Use GitHub Actions -> `launch-monitor` -> Run workflow. The default run checks
production API readiness, unpaid x402 challenge, CDP Bazaar, and external
directories. Set `include_external_directories=false` for a faster production
and CDP Bazaar gate.

The workflow does not need secrets. It calls only public production URLs and
public directory pages.

## Latest Verified Baseline

Last checked on 2026-05-19 at 17:38:58 +07:00 after production commit
`02b1fee` with:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=15000
npm run smoke -- https://trust402.vercel.app
npm run smoke:x402 -- https://trust402.vercel.app /api/trust/compare-resources
npm run directories:check -- https://trust402.vercel.app --timeout-ms=15000
npm run final:verify -- https://trust402.vercel.app --timeout-ms=15000 --docker-bin=D:\Programs\Docker\resources\bin\docker.exe
```

Trust402's verified production/discovery state is:

```text
status = needs-attention
api.status = healthy
api.catalogStatus = production-mvp
api.paidLaunchResources = 10
api.anyLiveSpendReady = false
api.autoRefillReady = false
x402Challenge.status = challenge-ready
x402Challenge.httpStatus = 402
cdpBazaar.status = partially-indexed
cdpBazaar.routeSummary.expected = 10
cdpBazaar.routeSummary.indexed = 9
cdpBazaar.routeSummary.missing = [trust.compare_resources]
externalDirectories.status = not-visible-yet
externalDirectories.visible = 0
externalDirectories.checked = 8
finalVerification.status = blocked
finalVerification.commandsPassed = false
finalVerification.nonFinalOpenRequirements = 6
finalVerification.verificationHash = sha256:3349957abf236fcc9f7c28cb088d86e096537d22ee3d44f0e17cc2ee918b58a7
```

That state is production-healthy for API/x402/spend safety, but launch
attention is required for CDP Bazaar 10/10 visibility, non-CDP external
directory visibility, and intentionally closed live-spend gates.

The latest final verifier passed local release checks, Docker build,
production smoke, production x402 smoke, AgentCash refill dry-run, external
directory read-only check, and production completion audit. The only failing
required command gate was the launch monitor because CDP Bazaar still reports
`trust.compare_resources` missing.

## AgentCash Refill Check

Use the refill dry-run monitor to inspect the AgentCash threshold decision
without mutating wallet balance:

```powershell
npm run agentcash:refill-check
npm run agentcash:refill-check -- --balance 0.42
```

The production API equivalent is:

```powershell
Invoke-RestMethod -Method Post -Uri https://trust402.vercel.app/api/agentcash/refill-check -ContentType application/json -Body '{"mode":"dry-run","currentBalanceUsd":0.42,"amountRefilledTodayUsd":0}'
```

Live refill still requires explicit approval, provider config, operator
authorization, caps, and emergency stop remaining false.

## Completion Audit

Use the completion audit to see which final buyer-agent criteria are verified,
implemented-but-blocked, externally blocked, missing, or unverified:

```powershell
npm run completion:audit
npm run completion:audit -- https://trust402.vercel.app
```

The API form is:

```powershell
Invoke-RestMethod -Method Get -Uri https://trust402.vercel.app/api/completion/audit
```

The audit intentionally returns `goalComplete=false` until Git/Vercel
auto-deploy, non-CDP external directory visibility, live procurement, paid
Proof402 delegation, and final paid-smoke evidence are actually proven.

## Final Verification Evidence

Use the final verifier after blockers are resolved, or as a read-only snapshot
of what still blocks completion:

```powershell
npm run final:verify -- https://trust402.vercel.app --timeout-ms=10000
```

On this Windows workstation, pass the Docker Desktop binary explicitly so the
Docker credential helper directory is available to the verifier:

```powershell
npm run final:verify -- https://trust402.vercel.app --timeout-ms=10000 --docker-bin=D:\Programs\Docker\resources\bin\docker.exe
```

Useful safe modes:

```powershell
npm run final:verify -- https://trust402.vercel.app --skip-docker --skip-directories
npm run final:verify -- https://trust402.vercel.app --with-vercel-logs --include-details
```

The verifier runs local release checks, optional Docker build, production
smoke, unpaid x402 smoke, AgentCash refill dry-run, launch monitor, optional
external directory visibility, production completion audit, and optional Vercel
error-log inspection. It prints a `verificationHash`; only when every non-final
requirement is already verified does it suggest
`TRUST402_FINAL_VERIFICATION_OBSERVED=true`.
