# Trust402 Bazaar Indexing

Trust402 production is live at:

```text
https://trust402.vercel.app
```

The CDP Bazaar indexing check is read-only and never sends payment headers:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
```

## Current Production State

Last checked on 2026-05-19 at 16:59:16 +07:00.

Latest production deployment:

```text
dpl_HB7w9QUyYMvSZPeWFFZEgMvbt6SN
https://trust402-ee43soi18-sergo565456-2815s-projects.vercel.app
```

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
- `trust.compare_resources`
- `procurement.plan`
- `procurement.quote`
- `monitor.snapshot`
- `monitor.badge`
- `reports.x402_diligence`

## Resolved Indexing Blocker

`trust.compare_resources` was previously indexed, then temporarily dropped from
CDP Bazaar search results. The current production route is healthy and visible
again:

- `POST /api/trust/compare-resources` returns an unpaid HTTP 402 challenge;
- the challenge contains top-level `extensions.bazaar`;
- the Bazaar input schema now has explicit candidate fields such as
  `endpoint`, `priceUsd`, `hasInputSchema`, `hasOpenApi`, `hasWellKnown`, and
  `receiptReady`;
- `node --test test`, `node scripts/release-check.js`,
  `npm audit --omit=dev --audit-level=high`, and Docker build passed after the
  schema fix;
- `npm run bazaar:indexing:check:all -- https://trust402.vercel.app
  --timeout-ms=15000` returns `status = all-indexed`,
  `routeSummary.indexed = 10`, and `routeSummary.missing = []`.

Do not run an extra paid settle only to repair CDP Bazaar indexing while the
all-resource check remains green. Future paid smokes should be for live
procurement/proof evidence windows with explicit spend approval.

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

The CDP Bazaar portion of the completion gate is currently achieved. To recheck
the live state:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
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
