# Trust402 External Marketplace Listing Pack

Use this pack when submitting or monitoring Trust402 across x402 directories
outside the CDP Bazaar indexing check.

## Current State

Production:

```text
https://trust402.aztecbeacon.uk
```

Release marker:

```text
v0.1.1
```

CDP Bazaar state:

```text
10 of 10 paid launch resources indexed on the custom-domain URLs
status = all-indexed
missing =
evidence = sha256:7f8c5c87c60f6c63e9289b454d331d9481c780498c0d92395c19ca65f62c45af
latest evidence = sha256:81031dc6017d9df52399ff4be0c88bdeb30525bf89e32dc5e4f4ffd3e0d78795
```

Trust402 is live as a production x402 service on the Cloudflare-backed custom
domain. CDP Bazaar search now finds every paid resource URL on
`trust402.aztecbeacon.uk`; some historical `trust402.vercel.app` rows may still
appear in search results. Live Trust402 procurement, paid Proof402 delegation,
and AgentCash refill checks are enabled only through policy/operator gates,
caps, allowlists, and receipt/audit evidence.

## Current External Directory Visibility

Last checked on 2026-05-21 at 19:23 +07:00 with:

```powershell
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=15000 --concurrency=4 --x402scan-origin-id=239600ba-27ae-44f1-92b0-8ea1c8fb8a14
```

Result:

```text
status = visible-in-some-directories
checked = 13
reachable = 11
visible = 1
notVisibleYet = 10
unreachable = 2
customDomainBlocked = 0
visible_directory = x402scan
evidence_url = https://www.x402scan.com/server/239600ba-27ae-44f1-92b0-8ea1c8fb8a14
```

x402 List API submission was sent on 2026-05-20 at 21:33 +07:00 with public
metadata only:

```text
submission_id = a6c3be52-dbd9-4d86-999e-5b497443b357
status = pending
probe_result.endpoints_found = 10
probe_result.errors = []
contact_email = kfubtik00@gmail.com
```

Repeated x402 List submission attempt on 2026-05-21 at 12:01 +07:00 was
rejected by the directory review throttle:

```text
HTTP 303 /submit?error=Please wait 7 days between submissions.
reason = previous submission from this email is still within the review window
```

Interpretation:

- the custom-domain blocker is removed for monitored directories;
- CDP Bazaar remains the authoritative x402 discovery signal, and exact
  resources for the custom-domain origin are currently verified `10/10`;
- x402scan now visibly lists Trust402 on a public server page and its public
  registration API reports all 10 paid launch routes as registered;
- x402 List has a pending review submission that successfully probed 10
  endpoints, and the directory currently blocks another submission from
  `kfubtik00@gmail.com` until its 7-day review window expires; this does not
  complete the external-directory requirement until a public listing/search
  result visibly shows Trust402;
- Agentic.Market, x402scan, x402Bazaar, x402.org ecosystem, RelAI market,
  x402list.fun, Orbis API Marketplace, World.fun x402 Market, x402agency,
  Agent Bazaar, the402, x402-list.com, and Agora402 are monitored for public
  Trust402 visibility;
- x402scan's visible server page is reachable, while some x402scan index pages,
  x402.org ecosystem, and Agora402 were not reliably reachable within the
  read-only script timeout window;
- `not-visible-yet` is not proof of absence because several directories are
  client-rendered, asynchronously indexed, curated, or rate-limited.

## Directory Strategy

Run the read-only directory visibility monitor:

```powershell
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

Pass the x402scan origin id when verifying the current visible listing:

```powershell
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=15000 --concurrency=4 --x402scan-origin-id=239600ba-27ae-44f1-92b0-8ea1c8fb8a14
```

Use `--strict` only for a gate that should fail until at least one external
directory page contains Trust402. The script checks public pages only; it does
not submit forms, send payment headers, or use secrets.

Generate the machine-readable public-safe submission pack:

```powershell
Invoke-RestMethod -Method Get -Uri https://trust402.aztecbeacon.uk/api/directories/submission-pack
```

The custom domain is already attached. Use the readiness check when validating
DNS/HTTPS/x402 state, and keep the activation pack only for future domain
changes:

```powershell
Invoke-RestMethod -Method Post -Uri https://trust402.aztecbeacon.uk/api/domains/readiness-check `
  -ContentType application/json `
  -Body '{"domain":"trust402.aztecbeacon.uk","expectedBaseUrl":"https://trust402.aztecbeacon.uk"}'
```

Use `POST /api/directories/submission-pack` with `baseUrl` and
`userApprovedOutreach` when planning a custom-domain submission window. The
endpoint is read-only; it does not submit directory forms or set evidence env.
The domain activation pack is also read-only: it does not buy domains, mutate
Vercel, set env vars, or claim availability/pricing without a fresh check. When
fresh public-safe registrar evidence is supplied, the pack includes the
availability, price, purchase URL, and `activationPackHash` so the operator can
verify the exact domain plan later.

### CDP Bazaar

Status: custom-domain all-resource indexing verified.

Action: keep this evidence current before external submissions and rerun the
all-resource check if any paid launch route, price, or production origin
changes.

```powershell
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20
```

### Agentic.Market

Status: monitor.

Agentic.Market says services are indexed automatically when the CDP Facilitator
processes payment for an endpoint with Bazaar discovery metadata. There should
be no separate registration step for basic discovery.

Action:

- monitor `https://agentic.market` search for `Trust402` and
  `trust402.aztecbeacon.uk`;
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

### Monitored Directories

Status: monitor or submit when a safe form/API is available.

These directories may crawl x402 endpoints, aggregate indexed services, or
require a manual listing. Use this document as the public-safe payload.

Current monitor set:

- Agentic.Market
- x402scan
- x402Bazaar
- x402.org ecosystem
- RelAI market
- x402list.fun
- Orbis API Marketplace
- World.fun x402 Market
- x402agency
- Agent Bazaar
- the402
- x402 List
- Agora402

Action:

- search each directory for `Trust402`, `trust402.aztecbeacon.uk`, and the paid
  endpoint URLs;
- if a submission form exists, submit only public metadata from this file;
- never paste `.env`, CDP secrets, wallet policy files, private keys, payment
  headers, receipt files, or AgentCash internals.

### x402 List (`x402-list.com`)

Status: manual review, custom domain now available, contact email required.

`x402-list.com` exposes a submit page and API, but its public requirements say
that `vercel.app`, `workers.dev`, `ngrok`, `trycloudflare`, and similar
free-hosting/dev-tunnel domains are not accepted. Trust402 now runs on
`trust402.aztecbeacon.uk`, so this path is no longer blocked by the production
host policy.

Action:

- run `npm run domains:readiness-check -- https://trust402.aztecbeacon.uk --domain=trust402.aztecbeacon.uk`;
- rerun `npm run smoke:x402 -- https://trust402.aztecbeacon.uk`;
- rerun `npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000`;
- submit only the public-safe listing fields from this file while CDP Bazaar
  exact-resource indexing remains verified `10/10`.

The programmatic submission endpoint is documented as:

```text
POST https://x402-list.com/api/v1/submit
```

Required fields include `url`, `email`, `notes`, and `endpoint_paths`. Do not
submit until the operator provides an email address approved for public
directory review.

Active custom domain configured on 2026-05-20:

| Domain | DNS | Vercel | Production env |
| --- | --- | --- | --- |
| `trust402.aztecbeacon.uk` | A `76.76.21.21`, DNS-only in Cloudflare | attached to project `trust402` | `PUBLIC_BASE_URL=https://trust402.aztecbeacon.uk` |

The earlier `trust402.org` / `trust402.dev` purchase candidates are kept as
historical research only. Do not buy another domain unless this Cloudflare
subdomain is rejected by a target directory.

Read-only readiness check for the active domain:

```powershell
npm run domains:readiness-check -- https://trust402.aztecbeacon.uk `
  --domain=trust402.aztecbeacon.uk
```

Latest custom-domain CDP Bazaar all-resource evidence:

```text
sha256:81031dc6017d9df52399ff4be0c88bdeb30525bf89e32dc5e4f4ffd3e0d78795
```

Latest local custom-domain readiness evidence:

```text
sha256:8da65381983fbc9998401cefba576d4ce29af40b3b4d6610c81ec055c0d54f8d
```

Useful public URLs:

```text
https://trust402.aztecbeacon.uk
https://trust402.aztecbeacon.uk/openapi.json
https://trust402.aztecbeacon.uk/.well-known/x402
https://trust402.aztecbeacon.uk/.well-known/x402.json
https://trust402.aztecbeacon.uk/.well-known/agent.json
https://trust402.aztecbeacon.uk/.well-known/agent-services.json
https://trust402.aztecbeacon.uk/.well-known/ai-plugin.json
https://trust402.aztecbeacon.uk/.well-known/mcp.json
https://trust402.aztecbeacon.uk/llms.txt
https://trust402.aztecbeacon.uk/robots.txt
https://trust402.aztecbeacon.uk/sitemap.xml
https://trust402.aztecbeacon.uk/api/resources
https://trust402.aztecbeacon.uk/api/marketplace/bundle
https://trust402.aztecbeacon.uk/api/settlement/status
https://trust402.aztecbeacon.uk/api/launch/checklist
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
Website: https://trust402.aztecbeacon.uk
OpenAPI: https://trust402.aztecbeacon.uk/openapi.json
x402 discovery: https://trust402.aztecbeacon.uk/.well-known/x402
x402 discovery JSON: https://trust402.aztecbeacon.uk/.well-known/x402.json
Agent manifest: https://trust402.aztecbeacon.uk/.well-known/agent.json
Agent services: https://trust402.aztecbeacon.uk/.well-known/agent-services.json
LLM summary: https://trust402.aztecbeacon.uk/llms.txt
Sitemap: https://trust402.aztecbeacon.uk/sitemap.xml
Marketplace bundle: https://trust402.aztecbeacon.uk/api/marketplace/bundle
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
npm run smoke -- https://trust402.aztecbeacon.uk
npm run smoke:x402 -- https://trust402.aztecbeacon.uk
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000
npx vercel@latest logs https://trust402.aztecbeacon.uk --since 30m --level error
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

After CDP Bazaar reindexes the new exact resource URLs and a non-CDP directory
visibly lists Trust402, record only public-safe evidence in production env:

```text
TRUST402_CDP_BAZAAR_ALL_RESOURCES_INDEXED=true
TRUST402_CDP_BAZAAR_CHECK_STATUS=all-indexed
TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES=10
TRUST402_CDP_BAZAAR_INDEXED_RESOURCES=10
TRUST402_CDP_BAZAAR_MISSING_RESOURCES=
TRUST402_CDP_BAZAAR_EVIDENCE_REF=sha256:<cdp-bazaar-10-of-10-check>
TRUST402_EXTERNAL_DIRECTORY_STATUS=visible
TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL=https://directory.example/trust402
TRUST402_EXTERNAL_DIRECTORY_NAME=Example x402 Directory
```

Do not use `pending-review` to close this requirement. Review/submission
confirmations are useful notes, but the completion audit stays blocked until
CDP Bazaar is verified 10/10 and a public directory page or search result
visibly shows Trust402. These flags do not submit listings; they only let
`/api/completion/audit` stop treating the external-directory requirement as
unresolved after visible evidence exists.
