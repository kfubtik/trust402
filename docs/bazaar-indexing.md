# Trust402 Bazaar Indexing

Trust402 production is live at:

```text
https://trust402.aztecbeacon.uk
```

The CDP Bazaar indexing check is read-only and never sends payment headers:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20 --concurrency=8
```

The route-by-route indexing plan is also read-only:

```powershell
npm run bazaar:indexing:plan -- https://trust402.aztecbeacon.uk --indexed=trust.compare_resources
```

## Current Production State

Last checked on 2026-05-20 at 17:19 +07:00 after route-by-route custom-domain
paid smokes for every missing paid launch resource.
`https://trust402.aztecbeacon.uk`.

Production alias:

```text
https://trust402.aztecbeacon.uk
```

Use `npm run deployment:preflight -- https://trust402.aztecbeacon.uk
--probe-vercel-api --vercel-scope sergo565456-2815s-projects` for the current
deployment id and commit SHA. The alias is the stable buyer-facing endpoint;
deployment URLs rotate after each production release.

- indexed resources: 10 of 10 exact custom-domain URLs;
- CDP Bazaar status: `all-indexed`;
- missing resources: none;
- latest custom-domain paid smoke: successful AgentCash x402 fetch against
  every paid launch route on `https://trust402.aztecbeacon.uk`;
- route-by-route missing-route spend after `trust.compare_resources`: `$0.30`;
- AgentCash global `maxAmount` was restored to `$0.01` after the route smokes;
- post-smoke AgentCash balance: `$0.953`, still above the `$0.50` reserve;
- current evidence ref:
  `sha256:7f8c5c87c60f6c63e9289b454d331d9481c780498c0d92395c19ca65f62c45af`;
- Trust402 live procurement: disabled;
- Proof402 paid delegation: disabled;
- live OpenAPI and unpaid x402 challenge expose custom-domain resource URLs.

Indexed right now on the custom-domain exact route check:

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

CDP Bazaar search still returns some historical `trust402.vercel.app` rows, but
the custom-domain all-resource check now verifies every paid launch URL on
`trust402.aztecbeacon.uk`.

## 2026-05-20 Custom-Domain Route Smoke Ledger

All entries below used AgentCash on Base USDC through one temporary local policy
window per route. Each window was closed immediately after the paid fetch, and
the local Trust402 wallet policy returned to locked mode.

| Resource | Max paid | Transaction |
| --- | --- | --- |
| `trust.compare_resources` | `$0.03` | `0xb447b8213c9641d200d656945e95b0f5fb5e3ac2565469179c8af742cb42d1df` |
| `trust.check_x402` | `$0.005` | `0x9fc2b06668a3a5eb25df7fa38fc4d245b62e47a7a8c90847f1c6cb06268312b1` |
| `trust.score_resource` | `$0.01` | `0x9860447fc39855c0bf93b43e222d67f3b9807642072639c10df0367feaef10a4` |
| `trust.evaluate_origin` | `$0.02` | `0x81e17cd1053a1b57391548baf9564e9a081c15cd85a89a64c6b9e48a97946c02` |
| `seller.readiness` | `$0.02` | `0xbb84eb1e5373ef84ea0c73281f08684d24548b3c650e785656b42c0a7e0b8ac7` |
| `procurement.plan` | `$0.02` | `0x67e8ff919148e28e4e648ee6a506a95cfeeaec946f1316b9fa6a7af6d7bad901` |
| `procurement.quote` | `$0.04` | `0x72bdcb93dfef59ae83c866bc4bf9428324517f15967c43462e3bd98f75f4009e` |
| `monitor.snapshot` | `$0.015` | `0xa420d6469c1c2b42c36b4b8113367838e06d5b7cdbf708f278768fb91c3550f4` |
| `monitor.badge` | `$0.02` | `0x6c828f10e7aac7e20db8001eab8557451a086b95350292c4219f5330e53dfc98` |
| `reports.x402_diligence` | `$0.15` | `0x59c54d9d89a27587d686524f7ce2814154700dd5c4745c1018b6c249ef9f8bff` |

## Historical Resolved Indexing Blocker

`trust.compare_resources` temporarily dropped from CDP Bazaar all-resource
search before the custom-domain switch, and the previous production origin was
later confirmed `10/10`. The production route itself remains healthy:

- `POST /api/trust/compare-resources` returns an unpaid HTTP 402 challenge;
- the challenge contains top-level `extensions.bazaar`;
- the Bazaar input schema now has explicit candidate fields such as
  `endpoint`, `priceUsd`, `hasInputSchema`, `hasOpenApi`, `hasWellKnown`, and
  `receiptReady`;
- `node --test test`, `node scripts/release-check.js`,
  `npm audit --omit=dev --audit-level=high`, and Docker build passed after the
  schema fix;
- the previous `trust402.vercel.app` route-count check returned
  `status = all-indexed`, `routeSummary.indexed = 10`, and
  `routeSummary.missing = []`;
- `npm run smoke:x402 -- https://trust402.aztecbeacon.uk /api/trust/compare-resources`
  passes, so the missing catalog row is not caused by a broken unpaid route.
- a direct unpaid 402 probe confirms the `PAYMENT-REQUIRED` header includes
  the `https://trust402.aztecbeacon.uk/api/trust/compare-resources` resource URL,
  Base USDC payment fields, and top-level `extensions.bazaar`.

CDP Bazaar discovery can be settle-driven and asynchronous. If this route drops
again, the safe recovery step is one bounded paid settle against
`https://trust402.aztecbeacon.uk/api/trust/compare-resources` with:

```text
TRUST402_PAID_SMOKE_RESOURCE_ID=trust.compare_resources
TRUST402_PAID_SMOKE_MAX_USD=0.03
```

Preview that exact window without changing `.env` or spending:

```powershell
npm run settlement:preflight -- --resource-id=trust.compare_resources --max-usd=0.03 --approved --real-settlement --paywall-mode=real
```

This exact recovery step was executed once on 2026-05-20 at 16:44 +07:00 and
settled successfully. Do not repeat it while
`.local/trust402-agentcash-wallet.json` reports zero
manual smoke budget or a global max below `$0.03`. The current local policy
blocks that spend until the operator explicitly approves a temporary smoke
window. The current evidence suggests this kind of settle can index the exact
route that was paid, but it does not automatically prove all other paid routes.

For the historical `1/10` state after only `trust.compare_resources` was
settled, the read-only indexing plan reported:

- starter batch: 8 remaining routes at or below `$0.05` each, max combined
  route spend `$0.15`;
- high-cost batch: `reports.x402_diligence`, max route spend `$0.15`;
- remaining all-route max: `$0.30`;
- every paid route required its own exact approval text, one open policy
  window, one AgentCash schema check, one paid fetch, and immediate window
  close.

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
      "endpoint": "https://trust402.aztecbeacon.uk/api/trust/score-resource",
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
      "endpoint": "https://trust402.aztecbeacon.uk/api/trust/check-x402",
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

Earlier paid smokes settled successfully. Only public transaction hashes are
recorded in this document; ignored local files may contain richer operator
evidence. The current custom-domain CDP Bazaar route-count evidence is:

```text
TRUST402_CDP_BAZAAR_EVIDENCE_REF=sha256:7f8c5c87c60f6c63e9289b454d331d9481c780498c0d92395c19ca65f62c45af
TRUST402_CDP_BAZAAR_CHECK_STATUS=all-indexed
TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES=10
TRUST402_CDP_BAZAAR_INDEXED_RESOURCES=10
TRUST402_CDP_BAZAAR_MISSING_RESOURCES=
```

## Completion Gate

The CDP Bazaar portion of the completion gate is complete for the custom-domain
exact resource URLs. Keep rechecking before public submissions or production
claims because external discovery surfaces can lag or regress.
To recheck the live state:

```powershell
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20 --concurrency=8
npm run smoke -- https://trust402.aztecbeacon.uk
npm run smoke:x402 -- https://trust402.aztecbeacon.uk
npx vercel@latest logs https://trust402.aztecbeacon.uk --since 30m --level error
npm run release:check
```

The target state is:

```text
routeSummary.expected = 10
routeSummary.indexed = 10
status = all-indexed
```
