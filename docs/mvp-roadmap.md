# Trust402 MVP Roadmap

## Phase 0 - Product Shell

Status: complete.

Deliverables:

- product strategy;
- resource catalog;
- safety policy;
- machine-readable resource draft.

## Phase 1 - Read-Only Trust Engine

Status: complete for dry-run MVP.

Implemented:

- live x402 check for `check-x402`;
- static and evidence-based scorer for `score-resource`;
- origin discovery parser;
- seller readiness checker;
- resource comparison engine;
- procurement plan generator;
- diligence report generator;
- OpenAPI and `.well-known/x402`.

No live payments.

Verification:

- unit tests for scoring;
- sample reports;
- local API server and smoke test.

## Phase 2 - Public x402 MVP

Status: mock-paywall MVP, settlement-readiness status, guarded Express
settlement bridge, production real-mode x402 route protection, and one
reviewed paid-smoke set are complete. Trust402 live procurement remains
disabled.

Exposed launch resources:

- `/api/trust/check-x402`
- `/api/trust/score-resource`
- `/api/trust/evaluate-origin`
- `/api/seller/readiness`
- `/api/trust/compare-resources`
- `/api/procurement/plan`
- `/api/procurement/quote`
- `/api/monitor/snapshot`
- `/api/monitor/badge`
- `/api/reports/x402-diligence`

Added:

- mock x402 paywall for local contract testing;
- x402 v2-compatible `PAYMENT-REQUIRED` mock challenge and `PAYMENT-SIGNATURE` unlock path;
- public docs;
- marketplace metadata;
- dry-run examples.
- `/api/settlement/status` for real-settlement blockers and route config drafts;
- `npm run smoke:x402` for unpaid challenge verification in mock or future real mode.
- `npm run settlement:check` for x402 SDK import checks and route config drafts.
- `/api/settlement/preflight` and `npm run settlement:preflight` for one paid-smoke readiness check without sending payment.
- `/api/policies/spend` for read-only live procurement, Proof402 delegation,
  and AgentCash auto-refill policy gates.
- `/api/agentcash/refill-check` for dry-run AgentCash threshold/refill decisions
  with receipt hashes and live action gates.
- `src/expressApp.js` bridge for Vercel/serverless and real-mode Express middleware.
- fail-closed protected routes when `TRUST402_PAYWALL_MODE=real` is requested
  before all settlement guards pass.

Verification:

- paid routes return 402 in mock paywall mode;
- mock paywall strips and accepts the expected modern payment headers in tests;
- OpenAPI describes all paid resources;
- `.well-known/x402` lists all paid resources;
- privacy and release checks guard local-only files.
- release checks assert Trust402 does not claim settlement readiness by default.
- x402 SDK dependencies are installed, and the Express settlement entrypoint is
  connected behind explicit real-mode flags.

Done in production:

- CDP env was configured outside tracked files;
- the final all-resource paid-smoke set ran with bounded per-call limits;
- settlement receipt evidence is stored only in ignored local `.tmp/`;
- CDP Bazaar indexes all 10 paid launch resources;
- marketplace indexing readiness is true only after paid settlement evidence
  exists.

## Phase 3 - Receipt Layer

Status: dry-run helper plus Proof402 preview/probe complete; live Proof402
delegation still disabled.

Integrate with Proof402 as an external dependency, not by modifying Proof402.

Implemented:

- hash final report;
- return receipt bundle;
- free `/api/receipts/hash-result` helper;
- free `/api/receipts/notarize-result` preview/probe helper;
- diligence reports include Proof402-ready receipt bundles.

Still later:

- paid Proof402 call only after approved live spend policy;
- store proof links;
- optional paid proof smoke with max spend approval.

Verification:

- dry-run receipt output;
- tests for receipt hash helper;
- tests for Proof402 request preview/probe helper;
- no paid proof call is made in MVP.

## Phase 4 - Controlled Procurement

Status: dry-run quote and execution audit complete; live spending remains
disabled until explicit operator approval.

Implemented:

- `/api/procurement/quote` quote-only resource;
- selected-resource policy;
- pass-through and Trust402 fee estimates;
- approval payload;
- `/api/procurement/execute` dry-run audit;
- `/api/jobs/autonomous-run` dry-run-first top-level workflow;
- `npm run agentcash:refill-check` and `/api/agentcash/refill-check` dry-run
  refill monitor;
- live execution skeleton with operator authorization, allowlist, denylist,
  caps, approval, and receipt bundles.

Live paid subcalls now have a policy-gated skeleton with injected paid-fetch
tests. They remain blocked in production until operator authorization,
allowlists, caps, receipt logging, and local AgentCash policy are approved.

Required:

- hot wallet profile;
- allowlist;
- max spend per call;
- max spend per job;
- approval threshold;
- receipt log;
- audit report.

Do not build this before Phase 1 and Phase 2 have usage.

Backlog resources to preserve for later:

- `/api/procurement/execute` live mode
- `/api/receipts/notarize-result`
- free helper or SDK example for result hashing

## Phase 5 - One-Shot Monitoring

Status: complete for launch MVP.

Implemented:

- `/api/monitor/snapshot`;
- `/api/monitor/badge`;
- no subscription billing;
- no stored history;
- receipt bundles for snapshots and badges.

Later:

- recurring checks;
- hosted badge pages;
- historical uptime/trust charts;
- subscription packages only after repeated one-shot usage.

## Phase 6 - Launch Readiness

Status: complete for dry-run launch.

Implemented:

- `/api/launch/checklist`;
- `npm run doctor`;
- production blockers for localhost `PUBLIC_BASE_URL`, zero `PAY_TO`, and disabled real settlement;
- release check guard that dry-run launch is ready while public marketplace readiness remains false until deployment and settlement are configured.

## Phase 7 - Marketplace Metadata

Status: complete for dry-run metadata export and production CDP Bazaar
indexing. External catalog visibility is checked separately as a regression
gate.

Implemented:

- `/api/marketplace/bundle`;
- `npm run marketplace:bundle`;
- per-resource input/output examples;
- Bazaar extension drafts for all 10 paid launch resources;
- explicit CDP Bazaar blocker until real x402 settlement succeeds through the facilitator.
- settlement status is included in the marketplace bundle so listing blockers
  are visible to directories and agent buyers.
- dynamic per-resource listing blockers that disappear only in a real
  settlement-ready production environment.
- `npm run bazaar:indexing:check` for read-only CDP discovery visibility checks.
- `npm run bazaar:indexing:check:all` verified all 10 production paid launch
  resources as indexed.

## Phase 8 - Service Packaging

Status: complete for local Docker operation.

Implemented:

- Docker image healthcheck;
- `compose.yaml` with dry-run defaults;
- release guards for Compose and Docker healthcheck configuration.

## Launch Wedge

Launch as:

`Trust402: x402 endpoint trust checks and budgeted procurement plans.`

Avoid launching as:

`Universal autonomous agent.`

The broader autonomous buyer agent can emerge after the trust tools are useful.
