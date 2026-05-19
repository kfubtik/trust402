# Trust402 Resource Catalog

Trust402 should expose a suite of resources around one buyer problem:
safe selection and use of paid x402 tools.

The launch catalog should be focused. Keep the first paid set small enough that
buyers understand the ladder:

`quick check -> score -> compare/plan -> diligence report`

## Free Discovery Resources

### `GET /health`

Runtime status, version, mode, and whether live spend is enabled.

### `GET /openapi.json`

OpenAPI 3.1 contract for all resources.

### `GET /.well-known/x402`

Agent-readable x402 discovery document listing paid resources.

### `GET /api/capabilities`

Short machine-readable summary for agents and marketplaces.

### `GET /api/status`

Launch readiness, safety state, resource counts, and verification commands.

### `GET /api/launch/checklist`

Dry-run launch and public marketplace readiness checklist. This separates what
is ready now from what still blocks an external paid marketplace listing.

### `GET /api/marketplace/bundle`

Marketplace submission metadata, per-resource input/output examples, and Bazaar
extension drafts. This is free because it helps directories and autonomous
buyers understand what Trust402 exposes before any settlement is enabled.

### `GET /api/settlement/status`

Real x402 settlement readiness, blockers, route config drafts, and unpaid
challenge status.

Price: free.

Reason: buyers and directories should see whether Trust402 is merely exporting
metadata or has completed facilitator-backed settlement. This avoids claiming
marketplace readiness before a real paid smoke.

### `GET /api/settlement/preflight`

Operator preflight for one paid settlement smoke. It checks explicit real-mode
flags, CDP credential presence, the selected smoke resource, and the max spend
cap without exposing secret values or sending payment.

Price: free.

Reason: the first paid smoke is operationally sensitive. It should be planned
and bounded before any buyer wallet signs a payment.

### `GET /api/policies/spend`

Machine-readable spend policy gates for live procurement, paid Proof402
delegation, and AgentCash auto-refill. This endpoint is read-only: it does not
read private keys, send payment headers, mutate wallet balance, or make paid
subcalls.

Price: free.

Reason: future autonomous spend should be enabled from a policy checklist, not
from scattered env flags.

### `GET /api/completion/audit`

Requirement-by-requirement audit for the final autonomous buyer-agent plan. It
reports which criteria are verified, implemented but blocked, externally
blocked, missing, or still unverified.

Price: free.

Reason: final readiness should be machine-readable. This endpoint returns
`goalComplete=true` only when every requirement is verified; implemented but
blocked live paths, Git/Vercel auto-deploy blockers, or external directory
evidence gaps remain explicit blockers. Live procurement, paid Proof402,
AgentCash refill, autonomous job, and final verification requirements also need
public-safe smoke evidence refs before they can become verified.

### `GET/POST /api/directories/submission-pack`

Public-safe external directory submission payload for Trust402. It returns
listing copy, target directories, custom-domain blockers, CDP Bazaar readiness,
evidence env names, and verification commands.

Price: free.

Reason: directory submission should be agent-readable without leaking secrets or
accidentally submitting forms. This endpoint is read-only and never sends
payment headers, mutates wallets, sets env vars, or submits external forms.

### `GET/POST /api/domains/activation-pack`

Public-safe custom-domain activation plan for the external-directory blocker.
It returns the current host policy, candidate-domain policy checks, Vercel env
plan, verification commands, and evidence fields.

Price: free.

Reason: several directories reject `vercel.app` and similar free-hosting
domains. This endpoint makes the domain step agent-readable without buying a
domain, mutating Vercel, setting env vars, submitting directory forms, or
claiming unverified availability/pricing.

### `GET /api/resources`

Public catalog of Trust402 resources, prices, input schemas, and safety notes.

### `POST /api/receipts/hash-result`

Free helper that prepares a `sha256:` result hash and a dry-run receipt bundle
for later Proof402 delegation.

Price: free.

Reason: hashing alone is too simple to sell, but it makes the paid diligence
reports more credible and easier to connect to Proof402 later.

### `POST /api/receipts/notarize-result`

Free helper that builds the Proof402 notarization request for a `sha256:` result
hash. In `disabled` mode it only returns a preview. In `probe` mode it may make
an unpaid health/payment-challenge probe to Proof402, but it still does not send
payment headers or execute a paid proof call.

Price: free.

Reason: this is a trust bridge, not the paid proof product itself. It lets
buyers verify what would be sent to Proof402 while preserving live paid
delegation for a later approved profile.

### `POST /api/procurement/execute`

Dry-run helper that simulates controlled procurement execution and returns an
audit bundle without making paid subcalls.

Price: free while live spend is disabled.

Reason: buyers need to see exactly what would happen before trusting live
procurement.

### `POST /api/jobs/autonomous-run`

Dry-run-first autonomous workflow that turns a goal and candidate list into a
quote, execution audit, result hash, receipt bundle, and optional Proof402
preview. In live mode it uses the same spend policy, operator authorization,
allowlist, denylist, caps, and receipt rules as controlled procurement.

Price: free while live spend is disabled.

Reason: this is the top-level buyer-agent workflow. It must be inspectable and
dry-run-first before it can safely buy downstream resources.

### `POST /api/agentcash/refill-check`

AgentCash balance and refill-policy evaluator. It accepts a current balance,
compares it against the approved threshold, applies refill amount and daily cap,
and returns a decision hash plus dry-run receipt bundle.

Price: free.

Reason: auto-refill must be observable before it is live. This endpoint plans or
blocks refill actions without reading private keys, sending payment headers, or
mutating wallet balance. Live refill remains gated by approval, provider,
operator authorization, caps, and emergency stop.

Price: free while live spend is disabled.

Reason: this is the top-level agent workflow. It should be easy to inspect in
dry-run mode before any autonomous spending is approved.

## Paid Launch Resources

### 1. `POST /api/trust/check-x402`

Fast live probe for one endpoint.

Checks:

- endpoint reachability;
- `402 Payment Required` behavior;
- x402 version, scheme, network, asset, amount, and `payTo`;
- obvious schema or discovery links when present;
- price drift if the caller supplies an expected price.

Buyer gets:

- normalized x402 challenge summary;
- pass/fail checks;
- warnings;
- machine-readable recommendation.

Launch price: `$0.005`.

Why this price: it is a cheap entry point below the common `$0.01` utility API
price, useful for agents that need a quick pre-payment sanity check.

### 2. `POST /api/trust/score-resource`

Trust score for one x402 resource using supplied metadata plus optional probe
evidence.

Scores:

- price clarity;
- input schema quality;
- OpenAPI / AgentCard / Bazaar / `.well-known` discoverability;
- network and asset clarity;
- provider metadata;
- observed latency/uptime if supplied;
- proof/receipt readiness.

Buyer gets:

- score `0-100`;
- risk level;
- `use`, `test-first`, or `avoid-until-fixed`;
- missing fields;
- suggested fixes.

Launch price: `$0.01`.

### 3. `POST /api/trust/evaluate-origin`

Evaluates a whole origin/domain rather than one endpoint.

Checks:

- OpenAPI presence;
- `.well-known/x402` or AgentCard presence;
- resource count;
- schema coverage;
- price consistency;
- security metadata;
- public-safe docs;
- seller readiness signals.

Buyer gets:

- origin score;
- resource inventory;
- launch/readiness gaps;
- marketplace listing advice.

Launch price: `$0.02`.

### 4. `POST /api/seller/readiness`

Seller-side checklist for teams who want their x402 endpoint to rank and be
easy for autonomous buyers to use.

Checks:

- endpoint returns valid x402 challenge;
- OpenAPI route exists;
- `.well-known/x402` route exists;
- resource has a clear description;
- input schema is strict enough;
- examples exist;
- price is competitive;
- safety/trust docs exist.

Buyer gets:

- readiness score;
- missing launch assets;
- recommended tags;
- pricing advice;
- exact next checklist.

Launch price: `$0.02`.

### 5. `POST /api/trust/compare-resources`

Compares 2-10 candidate paid resources for a user goal and budget.

Buyer gets ranked options:

- best value;
- safest;
- cheapest;
- fastest if latency data is available;
- avoid list;
- evidence gaps;
- recommended purchase order.

Launch price: `$0.03`.

### 6. `POST /api/procurement/plan`

Creates a bounded spend plan without spending money.

Inputs:

- goal;
- max budget;
- max paid calls;
- risk tolerance;
- allowed registries;
- require proof receipts.

Output:

- route;
- per-call limits;
- stop conditions;
- evidence requirements;
- expected cost;
- approval payload for a future live run.

Launch price: `$0.02`.

### 7. `POST /api/procurement/quote`

Builds a concrete quote for a planned multi-resource purchase path without
spending.

Buyer gets:

- selected resources that fit score and budget policy;
- pass-through cost estimate;
- Trust402 fee estimate;
- quote hash;
- approval payload;
- receipt bundle for the quote.

Launch price: `$0.04`.

### 8. `POST /api/monitor/snapshot`

Runs a one-shot x402 payment-flow and trust drift snapshot.

Checks:

- endpoint probe result;
- current trust score;
- optional expected status;
- optional expected price;
- receipt-ready snapshot hash.

Launch price: `$0.015`.

Reason: this is not a subscription yet; it lets buyers test whether recurring
monitoring is valuable.

### 9. `POST /api/monitor/badge`

Generates a one-shot Trust402 badge payload from a snapshot.

Buyer gets:

- status label;
- score;
- color;
- snapshot hash;
- markdown badge string;
- receipt bundle.

Launch price: `$0.02`.

### 10. `POST /api/reports/x402-diligence`

Full report for an x402 endpoint or origin.

Combines:

- live x402 check;
- resource score;
- origin readiness;
- marketplace metadata;
- pricing analysis;
- risk notes;
- hash-ready evidence bundle.

Optional later integration can add Proof402 receipt links, but the launch
version should work without modifying Proof402.

Launch price: `$0.08-$0.15`.

Price rule:

- `$0.08` for endpoint-only report;
- `$0.12` for origin report with multiple resources;
- `$0.15` when comparing candidate resources and producing a procurement plan.

## Later Resources To Preserve

These are intentionally not launch resources. Keep them in the backlog so the
ideas are not lost, but do not implement them before the launch set proves
usage.

### `POST /api/procurement/execute` live mode

Executes approved paid subcalls inside a strict budget.

Later price:

- pass-through cost;
- plus 15%-25%;
- minimum Trust402 fee `$0.02`;
- hard max supplied by buyer.

Reason to wait: live spending needs hot-wallet policy, allowlists, receipts,
human approval thresholds, and a real buyer payment adapter. Supported runtime
paths are an external payment adapter, an AgentCash bridge via
`LIVE_PAYMENT_ADAPTER_URL`, or in-process `@x402/fetch` with secret buyer key
and RPC URL.

### `POST /api/receipts/notarize-result` live mode

Creates a paid Proof402 proof receipt for a purchased result hash.

Later price: pass-through proof cost plus `$0.005-$0.01`.

Reason to wait: paid Proof402 calls require explicit live spend policy, receipt
logging, operator approval, and the same live payment adapter used by
procurement.

## Pricing Anchors

Current x402 markets often price simple utility/data calls around
`$0.001-$0.01`, with richer generation or reports above that. Trust402 should
use cheap checks to pull agents into the workflow, then charge more for reports
that combine multiple checks into one decision.

Recommended launch ladder:

1. `$0.005` quick check.
2. `$0.01-$0.04` scoring, origin, seller, compare, plan, and quote tools.
3. `$0.08-$0.15` full diligence report.

## MVP Priority

Build first:

1. `check-x402`
2. `score-resource`
3. `evaluate-origin`
4. `seller-readiness`
5. `compare-resources`
6. `procurement-plan`
7. `procurement-quote`
8. `procurement-execute` dry-run
9. `monitor-snapshot`
10. `monitor-badge`
11. `x402-diligence`
12. `receipts-notarize-result` preview/probe

Build later:

1. `procurement-execute` live mode
2. `receipts-notarize-result` paid live mode
