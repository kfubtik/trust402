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

External directory visibility is advisory. Those sites can be curated,
client-rendered, rate-limited, or asynchronously indexed.

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

Last checked on 2026-05-19 at 10:36:52 +07:00 with:

```powershell
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --skip-directories
```

Trust402's verified launch-monitor state is:

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
cdpBazaar.routeSummary.missing = [procurement.plan]
externalDirectories.status = skipped
```

That state is production-healthy for API/x402/spend safety, but launch
attention is still required because CDP Bazaar currently misses
`procurement.plan`. The missing route costs `$0.02`, while the local AgentCash
policy allows only `$0.01` per request and has zero remaining manual smoke
budget, so this route should not be paid-settled until the local spend policy is
explicitly updated.

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
