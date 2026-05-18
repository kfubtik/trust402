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

Status: mock-paywall MVP complete; real x402 settlement is intentionally not
enabled yet.

Exposed launch resources:

- `/api/trust/check-x402`
- `/api/trust/score-resource`
- `/api/trust/evaluate-origin`
- `/api/seller/readiness`
- `/api/trust/compare-resources`
- `/api/procurement/plan`
- `/api/reports/x402-diligence`

Added:

- mock x402 paywall for local contract testing;
- public docs;
- marketplace metadata;
- dry-run examples.

Verification:

- paid routes return 402 in mock paywall mode;
- OpenAPI describes all paid resources;
- `.well-known/x402` lists all paid resources;
- privacy and release checks guard local-only files.

## Phase 3 - Receipt Layer

Status: next.

Integrate with Proof402 as an external dependency, not by modifying Proof402.

Implement:

- hash final report;
- call Proof402 only when configured;
- store proof links;
- return receipt bundle.

Verification:

- dry-run receipt output;
- optional paid proof smoke with max spend approval.

## Phase 4 - Controlled Procurement

Status: later, disabled until real usage proves demand.

Implement live paid subcalls only after policy is proven.

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

- `/api/procurement/quote`
- `/api/procurement/execute`
- `/api/receipts/notarize-result`
- `/api/monitor/snapshot`
- `/api/monitor/badge`
- free helper or SDK example for result hashing

## Launch Wedge

Launch as:

`Trust402: x402 endpoint trust checks and budgeted procurement plans.`

Avoid launching as:

`Universal autonomous agent.`

The broader autonomous buyer agent can emerge after the trust tools are useful.
