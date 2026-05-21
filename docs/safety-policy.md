# Trust402 Safety Policy

Trust402 is allowed to reason about spending before it is allowed to spend.

## Default Mode

Default mode is `dry-run`.

In dry-run mode Trust402 may:

- inspect public endpoints;
- parse OpenAPI, AgentCard, Bazaar, and `.well-known` documents;
- score supplied metadata;
- produce spend plans;
- produce procurement quotes;
- simulate procurement execution;
- create one-shot monitor snapshots and badge payloads;
- estimate costs;
- create local reports;
- prepare result hashes and receipt bundles.
- preview Proof402 notarization requests for `sha256:` hashes.
- optionally make unpaid Proof402 health/payment-challenge probes when
  `PROOF402_DELEGATION_MODE=probe`.
- expose settlement-readiness metadata and unpaid x402 challenge tests.
- expose a paid-smoke preflight that checks readiness without sending payment.
- run the daily autonomy cron in dry-run mode and produce an autonomous
  discovery, quote, audit, receipt, and Proof402 preview.

In dry-run mode Trust402 must not:

- send paid x402 requests;
- claim real x402 settlement readiness before a successful paid smoke;
- run protected resources for free when real paywall mode was requested but settlement guards are incomplete;
- execute procurement live;
- create recurring paid monitors;
- call Proof402 as a paid delegation target;
- send private payloads to Proof402;
- forward `PAYMENT-SIGNATURE`, `X-Payment`, `Authorization`, cookie, or proxy authorization headers in unpaid probes;
- move funds;
- store private keys;
- ask for customer private keys;
- write wallet material to tracked files.

## Daily Autonomy

Trust402 may take initiative on a schedule, but the schedule is not allowed to
silently bypass spend policy.

The production cron endpoints are:

- `GET /api/cron/daily-autonomous/morning` at `10 1 * * *`
  (01:10 UTC / 08:10 Asia/Krasnoyarsk);
- `GET /api/cron/daily-autonomous/evening` at `47 13 * * *`
  (13:47 UTC / 20:47 Asia/Krasnoyarsk).

Both must be called with `Authorization: Bearer $CRON_SECRET`. Trust402 picks
one slot per date with deterministic pseudo-random jitter and skips the other
slot. This gives daily randomized timing within the Vercel Hobby limit of two
daily cron jobs. For arbitrary minute-level randomness, use an external
scheduler or Vercel Pro hourly cron.

Default daily autonomy is dry-run:

- `TRUST402_DAILY_AUTONOMY_ENABLED=true`;
- `TRUST402_DAILY_AUTONOMY_MODE=dry-run`;
- `TRUST402_DAILY_AUTONOMY_BUDGET_USD=0.15`;
- `TRUST402_DAILY_AUTONOMY_MAX_PAID_CALLS=1`;
- `TRUST402_DAILY_AUTONOMY_PROOF402_MODE=preview`.
- `TRUST402_DAILY_AUTONOMY_TARGET_WEIGHTS=proof402=4,action402=4,trust402=3,external=1`.

The daily autonomy budget is the quote/decision budget. Actual live payments
are still constrained by `LIVE_MAX_PER_CALL_USD`, `LIVE_MAX_PER_JOB_USD`, and
`LIVE_DAILY_LIMIT_USD`.

Daily target selection prioritizes known internal ecosystem agents:

- Proof402 notarization;
- Action402 bounded webhook/API execution;
- Trust402 x402 endpoint checks and diligence;
- external registries only at a low configured weight/chance.

External discovery uses public read-only catalogs by default:

- `https://x402-list.com/api/v1/services`;
- `https://api.cdp.coinbase.com/platform/v2/x402/discovery/search`.

The CDP search query is selected from
`TRUST402_DAILY_AUTONOMY_EXTERNAL_QUERIES`. Additional external catalogs may be
configured with `TRUST402_DAILY_AUTONOMY_EXTERNAL_REGISTRY_URLS`, but their
origins must also be listed in
`TRUST402_DAILY_AUTONOMY_EXTERNAL_REGISTRY_ALLOWLIST`.

Random external live payment is blocked unless all live spend gates pass,
`TRUST402_DAILY_AUTONOMY_RANDOM_EXTERNAL_LIVE_APPROVED=true`, and the selected
paid endpoint origin is still covered by `LIVE_ALLOWED_REGISTRIES`.

For more random wake timing than Vercel Hobby allows, the repository includes a
GitHub Actions scheduler at `.github/workflows/random-daily-autonomy.yml`. It
runs hourly, picks one UTC hour per day plus a random delay inside the hour, and
calls `GET /api/cron/daily-autonomous` only when the GitHub secret
`TRUST402_CRON_SECRET` matches the production `CRON_SECRET`.

Daily live interaction with other agents additionally requires:

- `TRUST402_DAILY_AUTONOMY_MODE=live`;
- `TRUST402_DAILY_AUTONOMY_LIVE_APPROVED=true`;
- a valid `CRON_SECRET`;
- explicit `LIVE_SPEND_ENABLED=true`;
- live caps, allowlists, denylist, and real payment provider;
- Proof402 live mode only if paid proof spending is separately approved.

If daily live mode is requested while any live blocker remains, the cron falls
back to dry-run and reports the blocker list instead of spending.

## Live Spend Requirements

Live spend can only exist in a separate operator profile with all of these:

- explicit `LIVE_SPEND_ENABLED=true`;
- separate hot wallet;
- max spend per job;
- max spend per call;
- daily max spend;
- current daily spend input (`LIVE_SPENT_TODAY_USD`) so the remaining daily
  capacity is checked before each live job;
- registry allowlist;
- endpoint denylist;
- receipt log;
- a real payment adapter, not plain `fetch`:
  `external-adapter`, AgentCash bridge through `LIVE_PAYMENT_ADAPTER_URL`, or
  in-process `@x402/fetch` with either a secret buyer key/RPC URL or a
  CDP-managed EVM account through `LIVE_PAYMENT_PROVIDER=cdp-x402`;
- proof receipt for final output;
- human approval above threshold.

## Suggested Limits

Initial limits:

- max per call: `$0.05`;
- max per job: `$0.25`;
- max per day: `$2.00`;
- human approval threshold: `$0.25`;
- allowed registries: manually configured list only.

These are product defaults, not final economics.

## Secret Handling

Never commit:

- private keys;
- seed phrases;
- wallet JSON;
- payment headers;
- AgentCash local data;
- paid smoke logs that expose sensitive account details;
- API keys;
- proxy credentials.

Use `.env.example` for names only. Real values stay in local `.env`.

## Receipt Policy

Every live procurement job should produce:

- spend summary;
- list of resources called;
- response hashes;
- skipped candidates and reasons;
- proof links for final report hash;
- error log without private payloads.

## Stop Conditions

Trust402 must stop instead of spending when:

- estimated cost exceeds budget;
- endpoint score is below policy minimum;
- endpoint has no input schema;
- endpoint lacks a clear x402 challenge;
- result cannot be verified or hashed;
- registry is not allowlisted;
- caller requests private-key handling in a public service flow.
- real paywall mode is requested before `/api/settlement/status` has no blockers.
