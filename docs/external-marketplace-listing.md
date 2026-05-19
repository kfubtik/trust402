# Trust402 External Marketplace Listing Pack

Use this pack when submitting or monitoring Trust402 across x402 directories
outside the CDP Bazaar indexing check.

## Current State

Production:

```text
https://trust402.vercel.app
```

Release marker:

```text
v0.1.0
```

CDP Bazaar state:

```text
10 of 10 paid launch resources indexed
status = all-indexed
```

Trust402 is ready to present as a production x402 service, but not as a
universal autonomous buyer. Live Trust402 procurement, paid Proof402 delegation,
and AgentCash auto-refill remain disabled until separately approved.

## Current External Directory Visibility

Last checked on 2026-05-19 at 12:04:53 +07:00 with:

```powershell
npm run directories:check -- https://trust402.vercel.app --timeout-ms=10000
```

Result:

```text
status = not-visible-yet
checked = 6
reachable = 4
visible = 0
notVisibleYet = 4
unreachable = 2
```

Interpretation:

- CDP Bazaar remains the authoritative discovery signal for Trust402 right now;
- Agentic.Market, x402Bazaar, RelAI market, and x402list were reachable but did
  not expose Trust402 in the fetched public HTML/search pages;
- x402scan and x402.org ecosystem were not reliably reachable within the
  10-second read-only check window;
- `not-visible-yet` is not proof of absence because several directories are
  client-rendered, asynchronously indexed, curated, or rate-limited.

## Directory Strategy

Run the read-only directory visibility monitor:

```powershell
npm run directories:check -- https://trust402.vercel.app --timeout-ms=10000
```

Use `--strict` only for a gate that should fail until at least one external
directory page contains Trust402. The script checks public pages only; it does
not submit forms, send payment headers, or use secrets.

### CDP Bazaar

Status: complete.

Action: keep the existing verification gate green.

```powershell
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
```

### Agentic.Market

Status: monitor.

Agentic.Market says services are indexed automatically when the CDP Facilitator
processes payment for an endpoint with Bazaar discovery metadata. There should
be no separate registration step for basic discovery.

Action:

- monitor `https://agentic.market` search for `Trust402` and
  `trust402.vercel.app`;
- keep Bazaar metadata, live x402 challenges, and real paid settlement receipts
  healthy;
- do not create a public marketing claim until Trust402 appears or the
  directory search behavior is confirmed after refresh.

Reference:

- https://www.coinbase.com/en-sg/developer-platform/discover/launches/agentic-market
- https://agentic.market/about

### x402.org Ecosystem

Status: curated manual submission.

The x402 ecosystem page is a curated directory with a contact link. Submit only
after the user approves public ecosystem outreach.

Action:

- use the short listing copy below;
- include production URL, OpenAPI URL, `.well-known/x402`, and the 10-resource
  pricing table;
- state that Trust402 is buyer-side trust/procurement infrastructure, not a
  custodial wallet or autonomous spend agent.

Reference:

- https://www.x402.org/ecosystem

### x402scan, x402.direct, x402bazaar, RelAI, x402list, Agent402

Status: monitor or submit when a safe form/API is available.

These directories may crawl x402 endpoints, aggregate indexed services, or
require a manual listing. Use this document as the public-safe payload.

Action:

- search each directory for `Trust402`, `trust402.vercel.app`, and the paid
  endpoint URLs;
- if a submission form exists, submit only public metadata from this file;
- never paste `.env`, CDP secrets, wallet policy files, private keys, payment
  headers, receipt files, or AgentCash internals.

Useful public URLs:

```text
https://trust402.vercel.app
https://trust402.vercel.app/openapi.json
https://trust402.vercel.app/.well-known/x402
https://trust402.vercel.app/api/resources
https://trust402.vercel.app/api/marketplace/bundle
https://trust402.vercel.app/api/settlement/status
https://trust402.vercel.app/api/launch/checklist
```

## Listing Copy

Name:

```text
Trust402
```

Tagline:

```text
Trust before you pay. Proof after you buy.
```

Short description:

```text
Buyer-side trust and procurement checks for x402 resources.
```

Long description:

```text
Trust402 helps autonomous agents and builders evaluate paid x402 endpoints
before spending. It exposes tools for unpaid x402 probing, resource scoring,
origin evaluation, seller readiness, candidate comparison, bounded procurement
plans, one-shot monitoring, badges, and diligence reports with hash-ready
evidence.
```

Category:

```text
Agent infrastructure
```

Suggested tags:

```text
x402, agent-infrastructure, trust, procurement, micropayments, due-diligence,
marketplace-readiness, receipts, base, usdc
```

Primary audience:

```text
AI agents, x402 buyers, x402 sellers, marketplace operators, agent developers.
```

Safety statement:

```text
Trust402 does not execute live buyer subcalls by default. It produces scores,
plans, quotes, checks, and evidence bundles. Live procurement and paid proof
delegation require explicit operator approval, spend caps, allowlists, and
receipt logging.
```

## Paid Launch Resources

| ID | Method | Path | Price | Purpose |
| --- | --- | --- | --- | --- |
| `trust.check_x402` | `POST` | `/api/trust/check-x402` | `$0.005` | Fast unpaid x402 endpoint probe and challenge summary. |
| `trust.score_resource` | `POST` | `/api/trust/score-resource` | `$0.01` | Score one x402 resource for trust, schema, price, discovery, and receipt readiness. |
| `trust.evaluate_origin` | `POST` | `/api/trust/evaluate-origin` | `$0.02` | Evaluate an origin/domain and its x402 discovery posture. |
| `seller.readiness` | `POST` | `/api/seller/readiness` | `$0.02` | Check whether a seller endpoint is ready for marketplace discovery. |
| `trust.compare_resources` | `POST` | `/api/trust/compare-resources` | `$0.03` | Rank candidate paid resources for a goal, budget, and risk policy. |
| `procurement.plan` | `POST` | `/api/procurement/plan` | `$0.02` | Create a bounded spend plan without spending money. |
| `procurement.quote` | `POST` | `/api/procurement/quote` | `$0.04` | Produce a concrete quote and approval payload for a multi-resource purchase path. |
| `monitor.snapshot` | `POST` | `/api/monitor/snapshot` | `$0.015` | Run a one-shot x402 payment-flow and trust drift snapshot without storing history. |
| `monitor.badge` | `POST` | `/api/monitor/badge` | `$0.02` | Generate a one-shot Trust402 badge payload from a snapshot. |
| `reports.x402_diligence` | `POST` | `/api/reports/x402-diligence` | `$0.08-$0.15` | Produce a full diligence report with hash-ready evidence. |

## Suggested Directory Submission

```text
Name: Trust402
Website: https://trust402.vercel.app
OpenAPI: https://trust402.vercel.app/openapi.json
x402 discovery: https://trust402.vercel.app/.well-known/x402
Marketplace bundle: https://trust402.vercel.app/api/marketplace/bundle
Category: Agent infrastructure
Networks: Base
Asset: USDC
Pricing: $0.005-$0.15 per call
Short description: Buyer-side trust and procurement checks for x402 resources.
Tags: x402, agent-infrastructure, trust, procurement, micropayments, due-diligence
```

## Verification Before Submission

Run:

```powershell
npm run release:check
npm run smoke -- https://trust402.vercel.app
npm run smoke:x402 -- https://trust402.vercel.app
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
npm run directories:check -- https://trust402.vercel.app --timeout-ms=10000
npx vercel@latest logs https://trust402.vercel.app --since 30m --level error
```

Expected:

```text
release check passed
production smoke passed
unpaid x402 smoke passed
routeSummary.expected = 10
routeSummary.indexed = 10
routeSummary.missing = []
external directory check completes read-only
Vercel production error logs are empty
```

## Public Gates

Do not submit to curated/public directories until these gates are true:

- the user approves public outreach;
- the GitHub repository visibility plan is clear;
- no local-only files are included in the payload;
- production x402 challenge and Bazaar indexing checks are green;
- no claim is made that Trust402 can autonomously spend buyer funds.

Future claims that require additional approval:

- live paid subcalls to third-party agents;
- paid Proof402 delegation;
- AgentCash auto-refill;
- subscription monitoring;
- custodial wallet or managed-buyer positioning.

## Completion Evidence

After a non-CDP directory visibly lists Trust402 or records a pending curated
review, record only public-safe evidence in production env:

```text
TRUST402_EXTERNAL_DIRECTORY_STATUS=visible
TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL=https://directory.example/trust402
TRUST402_EXTERNAL_DIRECTORY_NAME=Example x402 Directory
```

Use `pending-review` instead of `visible` only when the directory provides a
review/submission confirmation that can be referenced without exposing private
material. These flags do not submit listings; they only let
`/api/completion/audit` stop treating the external-directory requirement as an
unresolved blocker after real evidence exists.
