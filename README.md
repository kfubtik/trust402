# Trust402

Trust402 is a buyer-side trust and procurement agent for the x402 economy.

It helps autonomous agents decide which paid x402 resources to use, how much
they are allowed to spend, what evidence they received, and how to prove the
result without leaking private payloads.

Tagline:

```text
Trust before you pay. Proof after you buy.
```

## Current Status

This folder contains a working dry-run MVP API.

Implemented:

- free discovery endpoints;
- seven launch resources from the resource catalog;
- unpaid x402 endpoint probing;
- resource scoring;
- origin discovery evaluation;
- seller readiness checks;
- resource comparison;
- procurement planning;
- x402 diligence reports with a `sha256:` evidence hash;
- optional mock 402 paywall for local payment-flow testing;
- tests and smoke script.

Not implemented yet:

- real x402 settlement middleware;
- live paid subcalls to other agents;
- wallet funding or hot-wallet execution;
- Proof402 receipt delegation.

Those are intentionally later phases.

## Run

```powershell
cd D:\Agents_402\trust402
npm test
npm run verify
npm run dev
```

Open:

```text
http://127.0.0.1:4032/
http://127.0.0.1:4032/health
http://127.0.0.1:4032/api/status
http://127.0.0.1:4032/api/resources
http://127.0.0.1:4032/openapi.json
http://127.0.0.1:4032/.well-known/x402
```

Smoke test against a running server:

```powershell
npm run smoke -- http://127.0.0.1:4032
```

## Modes

Default mode is dry-run:

```text
TRUST402_MODE=dry-run
TRUST402_PAYWALL_MODE=demo
```

Mock paywall mode returns `402 Payment Required` for paid launch resources until
the caller supplies an `X-Payment` header:

```text
TRUST402_PAYWALL_MODE=mock
```

Mock paywall mode is for local contract testing only. It is not real settlement.

## Free Discovery Resources

```text
GET /health
GET /openapi.json
GET /.well-known/x402
GET /api/capabilities
GET /api/status
GET /api/resources
```

## Paid Launch Resources

| Resource | Purpose | Launch price |
| --- | --- | ---: |
| `POST /api/trust/check-x402` | Fast unpaid x402 challenge probe | `$0.005` |
| `POST /api/trust/score-resource` | Score one paid resource | `$0.01` |
| `POST /api/trust/evaluate-origin` | Score an origin/domain discovery posture | `$0.02` |
| `POST /api/seller/readiness` | Seller checklist for marketplace readiness | `$0.02` |
| `POST /api/trust/compare-resources` | Rank 2-10 candidate resources | `$0.03` |
| `POST /api/procurement/plan` | Bounded spend plan without spending | `$0.02` |
| `POST /api/reports/x402-diligence` | Full x402 endpoint/origin diligence report | `$0.08-$0.15` |

## Example Calls

Score a resource:

```powershell
$body = Get-Content .\examples\score-resource.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/trust/score-resource -ContentType application/json -Body $body
```

Create a procurement plan:

```powershell
$body = Get-Content .\examples\procurement-plan.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/procurement/plan -ContentType application/json -Body $body
```

Compare candidate resources:

```powershell
$body = Get-Content .\examples\compare-resources.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4032/api/trust/compare-resources -ContentType application/json -Body $body
```

## Safety

Trust402 is allowed to reason about spending before it is allowed to spend.

MVP guarantees:

- live spend is disabled;
- no private keys are required;
- no paid subcalls are made;
- unpaid probes strip `X-Payment`, `Authorization`, cookie, and proxy authorization headers;
- `procurement/plan` is plan-only;
- diligence reports include hash-ready evidence but do not call Proof402 yet;
- `.env`, wallet files, local data, and AgentCash material are ignored.

Future live procurement must require:

- hot-wallet profile;
- per-call limit;
- per-job limit;
- daily limit;
- registry allowlist;
- endpoint denylist;
- receipt log;
- human approval above threshold.

## Project Files

- `src/server.js` - HTTP API and mock paywall.
- `src/trustEngine.js` - checks, scoring, planning, and report logic.
- `src/openapi.js` - OpenAPI, capabilities, and `.well-known/x402`.
- `marketplace/resources.json` - machine-readable launch and backlog catalog.
- `docs/resource-catalog.md` - human-readable resource catalog and prices.
- `docs/safety-policy.md` - live-spend and secret-handling policy.
- `docs/mvp-roadmap.md` - build phases.
- `docs/github-release-checklist.md` - public release checklist.
- `test/` - API and engine tests.
