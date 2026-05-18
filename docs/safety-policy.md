# Trust402 Safety Policy

Trust402 is allowed to reason about spending before it is allowed to spend.

## Default Mode

Default mode is `dry-run`.

In dry-run mode Trust402 may:

- inspect public endpoints;
- parse OpenAPI, AgentCard, Bazaar, and `.well-known` documents;
- score supplied metadata;
- produce spend plans;
- estimate costs;
- create local reports.

In dry-run mode Trust402 must not:

- send paid x402 requests;
- forward `X-Payment`, `Authorization`, cookie, or proxy authorization headers in unpaid probes;
- move funds;
- store private keys;
- ask for customer private keys;
- write wallet material to tracked files.

## Live Spend Requirements

Live spend can only exist in a separate operator profile with all of these:

- explicit `LIVE_SPEND_ENABLED=true`;
- separate hot wallet;
- max spend per job;
- max spend per call;
- daily max spend;
- registry allowlist;
- endpoint denylist;
- receipt log;
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
