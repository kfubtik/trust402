# Trust402 Visibility Growth Plan

This plan pins the next growth track for making Trust402 easier to discover,
understand, and hire from public x402 surfaces.

## Current Baseline

- Production origin: `https://trust402.aztecbeacon.uk`
- Canonical public repo: `https://github.com/kfubtik/trust402`
- CDP Bazaar state: custom-domain resources are expected to stay indexed 10/10.
- Primary positioning: buyer-side trust, procurement, and evidence agent for
  x402 resources.
- Safety default: live spend remains policy-gated, capped, allowlisted, and
  disabled outside approved windows.

## Goal

Turn Trust402 from a valid x402 endpoint into a visible market utility:

- buyers can understand the product in less than 10 seconds;
- agents can copy a concrete paid-call recipe;
- public directories and crawlers see one canonical origin;
- daily public output gives the project a reason to be revisited;
- paid resources are focused around the three clearest buyer jobs.

## Phase 1 - Public Trust402 Radar

Build a public `Trust402 Radar` surface that ranks and explains x402 resources.

Scope:

- public radar page or route linked from the landing page;
- list of checked x402 resources;
- risk score, price, status, last checked time, and evidence/proof references;
- no private payloads, wallet data, payment headers, or secrets;
- clear distinction between observed data, dry-run checks, and live paid
  receipts.

Success:

- a visitor can inspect the market without reading API docs first;
- each listed resource has a reasoned trust/status explanation;
- the page is crawlable and usable as directory/listing evidence.

## Phase 2 - Focus The Paid Product Line

Promote three primary paid resources and treat the rest as supporting API
surface.

Primary offers:

- `$0.005` quick x402 endpoint check;
- `$0.01-$0.02` resource score;
- `$0.08-$0.15` x402 diligence report.

Scope:

- landing page pricing copy focuses on these three jobs;
- OpenAPI and catalog still expose all supported resources;
- resource cards explain input, output, price, and why an agent would pay.

Success:

- buyers see one cheap entry point, one decision score, and one deeper report;
- the product is not diluted by too many equally promoted endpoints.

## Phase 3 - Hire Trust402 Block

Add an obvious buyer/action block to the landing page.

Scope:

- "Hire Trust402" section above or near the first paid-resource explanation;
- copy-paste `curl` or x402 buyer example for the quick check;
- expected request body, response shape, and price;
- links to `.well-known/x402`, OpenAPI, GitHub, and directory profile.

Success:

- a technical buyer can execute the first paid call without guessing;
- non-technical directory reviewers can understand the value quickly.

## Phase 4 - Daily Public Radar Digest

Create a daily public digest that leaves a useful public trail.

Scope:

- daily digest generated from safe checks;
- pseudo-random resource selection from allowlisted or public-safe sources;
- digest includes resource URL, check type, score summary, timestamp, and
  evidence refs;
- live paid checks stay behind the existing spend policy and caps;
- if live spend is not approved, publish dry-run/probe-only results.

Success:

- Trust402 produces fresh public evidence without exposing secrets;
- crawlers, directories, and users have a reason to revisit;
- daily activity is useful, not just random paid traffic.

## Phase 5 - Canonical Origin Cleanup

Resolve the split between `trust402.aztecbeacon.uk` and historical
`trust402.vercel.app` discovery signals.

Scope:

- keep `trust402.aztecbeacon.uk` as the canonical public origin;
- preserve old Vercel endpoints only if removing them would break existing
  users or x402 discovery;
- add canonical links and clear copy where browser pages are served;
- monitor CDP Bazaar search for duplicate rows and quality signals.

Success:

- public docs, directory submissions, landing copy, and GitHub all point to the
  custom domain;
- old-origin calls do not confuse the main market story.

## Phase 6 - External Directory Refresh

Resubmit or refresh external listings after the Radar surface is live.

Targets:

- CDP Bazaar / Coinbase x402 discovery;
- x402scan;
- x402.org ecosystem;
- Agentic.Market;
- x402Bazaar;
- x402 List;
- x402list.fun;
- Orbis API Marketplace;
- RelAI market;
- other monitored x402 directories when they expose a safe listing path.

Scope:

- update listing copy around `Trust402 Radar`;
- include production URL, OpenAPI, `.well-known/x402`, GitHub, pricing, and
  public evidence links;
- do not submit forms with personal data unless the operator approves it;
- keep directory checks read-only unless outreach is explicitly approved.

Success:

- CDP Bazaar remains 10/10 indexed;
- at least one non-CDP directory visibly lists Trust402;
- external listings point to the custom domain and not stale Vercel URLs.

## Safety Rules

- No arbitrary paid calls to unknown agents.
- No daily live spend outside allowlists, per-call caps, per-job caps, daily
  caps, and operator-approved windows.
- No private payloads in Radar pages, digests, listings, or proofs.
- No wallet secrets, API keys, payment headers, or raw payment evidence in the
  repository.
- Proof and receipt references must be public-safe hashes or redacted bundles.

## Definition Of Done

This visibility track is complete when:

- the landing page has a clear `Hire Trust402` path;
- the Radar page or digest is public and linked from the landing page;
- the three primary paid offers are easy to understand and call;
- canonical-origin checks favor `https://trust402.aztecbeacon.uk`;
- CDP Bazaar still reports all launch resources indexed;
- at least one non-CDP directory visibly lists Trust402;
- production checks and smoke tests still pass after the changes.

Current completion evidence, 2026-06-01:

- Radar HTML/JSON is live at `https://trust402.aztecbeacon.uk/radar` and
  `https://trust402.aztecbeacon.uk/radar.json`;
- landing, OpenAPI, directory profile, sitemap, and marketplace bundle link the
  Radar/Hire surfaces;
- browser-confirmed x402scan evidence:
  `https://www.x402scan.com/server/239600ba-27ae-44f1-92b0-8ea1c8fb8a14`;
- final verifier completed with
  `sha256:df71aa5b21f99a1059b72a14c19f17c200771272049427a7e37f8341f8c2b585`.
