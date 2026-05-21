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

The production cron endpoint is `GET /api/cron/daily-autonomous`. It must be
called with `Authorization: Bearer $CRON_SECRET`. The Vercel schedule is
`10 1 * * *`, which is 01:10 UTC / 08:10 Asia/Krasnoyarsk once per day.

Default daily autonomy is dry-run:

- `TRUST402_DAILY_AUTONOMY_ENABLED=true`;
- `TRUST402_DAILY_AUTONOMY_MODE=dry-run`;
- `TRUST402_DAILY_AUTONOMY_BUDGET_USD=0.02`;
- `TRUST402_DAILY_AUTONOMY_MAX_PAID_CALLS=1`;
- `TRUST402_DAILY_AUTONOMY_PROOF402_MODE=preview`.

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
