# Trust402 Bazaar Indexing

Trust402 production is live at:

```text
https://trust402.vercel.app
```

The CDP Bazaar indexing check is read-only and never sends payment headers:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20 --concurrency=8
```

## Current Production State

Last checked on 2026-05-20 at 00:09:03 +07:00 after production commit
`04f0f73`.

Production alias:

```text
https://trust402.vercel.app
```

Use `npm run deployment:preflight -- https://trust402.vercel.app
--probe-vercel-api --vercel-scope sergo565456-2815s-projects` for the current
deployment id and commit SHA. The alias is the stable buyer-facing endpoint;
deployment URLs rotate after each production release.

- indexed resources: 10 of 10;
- CDP Bazaar status: `all-indexed`;
- missing resources: none;
- Trust402 live procurement: disabled;
- Proof402 paid delegation: disabled;
- live OpenAPI and unpaid x402 challenge expose the updated structured
  candidate schema for `trust.compare_resources`.

Indexed right now:

- `trust.check_x402`
- `trust.score_resource`
- `trust.evaluate_origin`
- `seller.readiness`
- `procurement.plan`
- `procurement.quote`
- `trust.compare_resources`
- `monitor.snapshot`
- `monitor.badge`
- `reports.x402_diligence`

## Resolved Indexing Blocker

`trust.compare_resources` temporarily dropped from CDP Bazaar search results,
but the current production checker verifies that it is indexed again. The
production route itself remains healthy:

- `POST /api/trust/compare-resources` returns an unpaid HTTP 402 challenge;
- the challenge contains top-level `extensions.bazaar`;
- the Bazaar input schema now has explicit candidate fields such as
  `endpoint`, `priceUsd`, `hasInputSchema`, `hasOpenApi`, `hasWellKnown`, and
  `receiptReady`;
- `node --test test`, `node scripts/release-check.js`,
  `npm audit --omit=dev --audit-level=high`, and Docker build passed after the
  schema fix;
- `npm run bazaar:indexing:check:all -- https://trust402.vercel.app
  --timeout-ms=15000 --limit=20 --concurrency=8` returns
  `status = all-indexed`, `routeSummary.indexed = 10`, and
  `routeSummary.missing = []`;
- `npm run smoke:x402 -- https://trust402.vercel.app /api/trust/compare-resources`
  passes, so the missing catalog row is not caused by a broken unpaid route.
- a direct unpaid 402 probe confirms the `PAYMENT-REQUIRED` header includes
  the `https://trust402.vercel.app/api/trust/compare-resources` resource URL,
  Base USDC payment fields, and top-level `extensions.bazaar`.

CDP Bazaar discovery can be settle-driven and asynchronous. If this route drops
again, the safe recovery step is one bounded paid settle against
`https://trust402.vercel.app/api/trust/compare-resources` with:

```text
TRUST402_PAID_SMOKE_RESOURCE_ID=trust.compare_resources
TRUST402_PAID_SMOKE_MAX_USD=0.03
```

Preview that exact window without changing `.env` or spending:

```powershell
npm run settlement:preflight -- --resource-id=trust.compare_resources --max-usd=0.03 --approved --real-settlement --paywall-mode=real
```

Do not run this while `.local/trust402-agentcash-wallet.json` reports zero
manual smoke budget or a global max below `$0.03`. The current local policy
blocks that spend until the operator explicitly approves a temporary smoke
window.

The read-only action pack for this no-Proof smoke window is:

```text
actionPackHash = sha256:0db1a554a12b5a04a930245577c12423ff8795e733bdd2df9685bd393e10a0f5
liveWindowPlan.status = ready-to-stage
liveWindowPlan.planHash = sha256:3cdbab6d847e0e7cb56f5d50cf06fe3942fbfc622a2ac0bb589f4ee4a71ade3a
estimatedMaxSpendUsd = 0.03
```

## Historical Final Paid Smoke Bodies

`POST /api/procurement/quote`

```json
{
  "goal": "Finish Trust402 marketplace indexing with bounded buyer-side diligence.",
  "budgetUsd": 0.25,
  "maxPaidCalls": 2,
  "riskTolerance": "low",
  "allowedRegistries": [
    "https://api.cdp.coinbase.com/platform/v2/x402/discovery"
  ],
  "candidates": [
    {
      "id": "trust402-score",
      "endpoint": "https://trust402.vercel.app/api/trust/score-resource",
      "priceUsd": 0.01,
      "has402": true,
      "hasInputSchema": true,
      "hasOpenApi": true,
      "hasWellKnown": true,
      "payTo": "0x3f4CEE4c6bad04FcCA3138dFFDEE579ddf17049B",
      "network": "eip155:8453",
      "asset": "USDC",
      "description": "Trust402 score-resource paid x402 endpoint with Bazaar metadata.",
      "receiptReady": true
    },
    {
      "id": "trust402-check",
      "endpoint": "https://trust402.vercel.app/api/trust/check-x402",
      "priceUsd": 0.005,
      "has402": true,
      "hasInputSchema": true,
      "hasOpenApi": true,
      "hasWellKnown": true,
      "payTo": "0x3f4CEE4c6bad04FcCA3138dFFDEE579ddf17049B",
      "network": "eip155:8453",
      "asset": "USDC",
      "description": "Trust402 check-x402 paid x402 endpoint for fast payment-flow probes.",
      "receiptReady": true
    }
  ]
}
```

Expected per-call payment limit: `$0.04`.

`POST /api/reports/x402-diligence`

Use [x402-diligence.json](../examples/x402-diligence.json).

Expected per-call payment limit: `$0.15`.

These paid smokes have already settled successfully. Receipts and transaction
hashes are stored only in ignored local `.tmp/` files.

## Completion Gate

The CDP Bazaar portion of the completion gate is currently achieved. To
recheck the live state:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20 --concurrency=8
npm run smoke -- https://trust402.vercel.app
npm run smoke:x402 -- https://trust402.vercel.app
npx vercel@latest logs https://trust402.vercel.app --since 30m --level error
npm run release:check
```

The target state is:

```text
routeSummary.expected = 10
routeSummary.indexed = 10
status = all-indexed
```
