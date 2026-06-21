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

The controlled reindex/evidence window plan is read-only and is the preferred
operator runbook when CDP Bazaar shows route-level drift:

```powershell
npm run bazaar:reindex-window -- https://trust402.aztecbeacon.uk
```

Production exposes the same public-safe plan at:

```text
https://trust402.aztecbeacon.uk/api/bazaar/reindex-window
```

## Current Production State

Last checked on 2026-05-20 at 23:37 +07:00 after the latest production
redeploy, public-safe Vercel evidence correction, and asynchronous CDP Bazaar
reindex recovery.
`https://trust402.aztecbeacon.uk`.

Production alias:

```text
https://trust402.aztecbeacon.uk
```

Use `npm run deployment:preflight -- https://trust402.aztecbeacon.uk
--probe-vercel-api --vercel-scope <vercel-scope>` for the current
deployment id and commit SHA. The alias is the stable buyer-facing endpoint;
deployment URLs rotate after each production release.

- indexed resources: 10 of 10 exact custom-domain URLs;
- CDP Bazaar status: `all-indexed`;
- missing resources: none;
- latest custom-domain paid smoke: successful AgentCash x402 fetch against
  `https://trust402.aztecbeacon.uk/api/trust/compare-resources`; a later
  read-only CDP Bazaar check now reports all ten exact custom-domain routes;
- route-by-route missing-route spend after `trust.compare_resources`: `$0.30`;
- AgentCash global `maxAmount` was restored to `$0.01` after the route smokes,
  the later Proof402 direct smoke, and the latest compare-resources retry;
- post-route-smoke AgentCash balance: `$0.953`; after the later `$0.005`
  Proof402 direct smoke the verified balance was `$0.948`; after the latest
  `$0.03` compare-resources retry the verified balance was `$0.918`, still
  above the `$0.50` reserve;
- current evidence ref:
  `sha256:81031dc6017d9df52399ff4be0c88bdeb30525bf89e32dc5e4f4ffd3e0d78795`;
- Trust402 live procurement: disabled;
- Proof402 paid delegation: disabled;
- live OpenAPI and unpaid x402 challenge expose custom-domain resource URLs.

Fresh read-only refresh on 2026-06-21:

- production smoke passed against `https://trust402.aztecbeacon.uk`;
- unpaid x402 smoke passed against `https://trust402.aztecbeacon.uk`;
- completion audit still reports all ten launch requirements verified from its
  configured evidence bundle;
- live CDP Bazaar all-resource check currently reports `partially-indexed`
  with 2 of 10 exact custom-domain routes indexed;
- current exact-route missing resources:
  `trust.score_resource`, `trust.evaluate_origin`, `seller.readiness`,
  `procurement.plan`, `procurement.quote`, `monitor.snapshot`,
  `monitor.badge`, and `reports.x402_diligence`;
- `final:verify` is therefore still blocked by live external visibility checks
  even though the core production and unpaid x402 routes respond correctly;
- no paid calls were made during this refresh.

Treat older `all-indexed` claims as historical evidence until the route-level
CDP Bazaar check returns `all-indexed` again.

Indexed right now on the custom-domain exact route check:

- `trust.check_x402`
- `trust.compare_resources`

CDP Bazaar search still returns some historical `trust402.vercel.app` rows,
including old compare-resources matches. The current custom-domain
all-resource check verifies the exact
`trust402.aztecbeacon.uk/api/trust/compare-resources` URL again.

## Controlled Reindex Window

Use `bazaar.reindex_window` instead of random daily spending when the goal is
to recover route-level CDP Bazaar visibility.

The window is intentionally route-by-route:

1. Run the read-only all-resource check and confirm the route is still missing.
2. Pick exactly one `batches.starter.routeIds` item from
   `/api/bazaar/reindex-window`.
3. Stage only that route's `requiredTemporaryPolicyWindow.vercelEnv` in Vercel
   production.
4. Run the route's provider preflight command.
5. Run the generated `commands.liveEvidenceSmoke` command only during the
   approved spend window.
6. Immediately restore the previous Vercel env snapshot or apply
   `closeWindowEnv`.
7. Re-run `npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk
   --timeout-ms=10000 --limit=20 --concurrency=8`.

For the 2026-06-21 drift, the default selected routes are:

- starter batch: `trust.score_resource`, `trust.evaluate_origin`,
  `seller.readiness`, `procurement.plan`, `procurement.quote`,
  `monitor.snapshot`, `monitor.badge`;
- high-cost batch: `reports.x402_diligence`.

The starter batch max route spend is `$0.145` and the high-cost report route
is `$0.15`, for `$0.295` maximum route spend if all eight routes are retried.
Do not run the whole set as one open budget. Open one temporary policy window
per route and close it immediately after the smoke.

Proof402 is disabled by default in this recovery plan. That keeps spend focused
on the route settlement that CDP Bazaar uses for indexing evidence. Add
`--include-proof` only with a separate approval for the extra per-route proof
reserve.

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

The recovery step was retried once on 2026-05-20 at 21:45 +07:00 after the
latest production redeploy because the route regressed to `9/10`. The paid
fetch succeeded with transaction
`0xfe2c3ccdd70a78fe5602e3e49139a3da1b05d8188552104ee1baddffb442eeb1`,
AgentCash balance moved from `$0.948` to `$0.918`, and the local policy window
was closed. A follow-up CDP Bazaar read-only check still reported
`partially-indexed` with `trust.compare_resources` missing, so treat this as an
async/external indexing blocker rather than a failed Trust402 route.

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
TRUST402_CDP_BAZAAR_EVIDENCE_REF=sha256:81031dc6017d9df52399ff4be0c88bdeb30525bf89e32dc5e4f4ffd3e0d78795
TRUST402_CDP_BAZAAR_CHECK_STATUS=all-indexed
TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES=10
TRUST402_CDP_BAZAAR_INDEXED_RESOURCES=10
TRUST402_CDP_BAZAAR_MISSING_RESOURCES=
```

## Completion Gate

The CDP Bazaar portion of the completion gate is currently green at `10/10`.
Keep rechecking before public submissions or production claims because external
discovery surfaces can lag or regress.
The later Proof402 direct paid smoke evidence ref is
`sha256:00d01bc39d1fe520dbeb6e76433554b2ccf163dc8e8f8c315a4b92cd7abefae8`;
that smoke is independent of CDP Bazaar indexing.
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
