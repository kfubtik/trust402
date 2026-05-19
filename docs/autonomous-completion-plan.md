# Trust402 Autonomous Completion Plan

This is the pinned completion plan for turning Trust402 from a production x402
trust MVP into a controlled autonomous buyer-agent.

Success means all sections below are either complete or explicitly blocked by a
third-party/manual approval that cannot be performed safely by code alone. Do
not close the plan by weakening spend safety.

## 1. Git/Vercel Auto-Deploy

Goal: connect the private repository `kfubtik/trust402` to the Vercel project.

Acceptance:

- a push to `main` creates a production deployment without `vercel --prod`;
- `https://trust402.vercel.app` remains the production alias;
- `npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --strict`
  passes after a Git-backed deploy.

Tracking: https://github.com/kfubtik/trust402/issues/5

## 2. External x402 Directories

Goal: list Trust402 outside CDP Bazaar where safe manual submission is allowed.

Acceptance:

- Trust402 remains 10/10 indexed in CDP Bazaar;
- at least one external directory shows Trust402 or records a pending curated
  review;
- no private keys, CDP secrets, AgentCash internals, payment headers, or paid
  receipts are submitted.

Tracking: https://github.com/kfubtik/trust402/issues/6

## 3. Unified Spend Policy

Goal: one policy model decides whether Trust402 may spend before any paid call.

Acceptance:

- per-call, per-job, and daily caps are enforced;
- registry allowlist and endpoint denylist are enforced;
- approval thresholds are enforced;
- emergency stop overrides every live path;
- `/api/policies/spend` exposes the current non-secret policy state.

Tracking: https://github.com/kfubtik/trust402/issues/8

## 4. Live Procurement

Goal: `/api/procurement/execute` can buy approved downstream x402 resources only
inside policy.

Acceptance:

- dry-run remains the default;
- live execution requires operator authorization;
- every selected endpoint is allowlisted and not denylisted;
- every paid call is within the per-call cap;
- total planned spend is within job and daily caps;
- every execution returns an audit/receipt bundle.

Tracking: https://github.com/kfubtik/trust402/issues/8

## 5. AgentCash Wallet Binding

Goal: Trust402 uses only its dedicated AgentCash policy for operator spend.

Acceptance:

- `.local/trust402-agentcash-wallet.json` is checked before any AgentCash spend;
- the wallet is reserved for Trust402 and approved origins only;
- the local policy never enters Git, API responses, or public logs;
- a read-only policy check explains whether live operator spend is blocked.

Tracking: https://github.com/kfubtik/trust402/issues/7

## 6. AgentCash Auto-Refill

Goal: refill logic exists only behind explicit provider, approval, caps, audit,
and emergency-stop rules.

Acceptance:

- planned threshold is `$0.50`;
- provider is configured before refill can be ready;
- refill amount and daily cap are enforced;
- dry-run refill monitor exists before live refill;
- `/api/agentcash/refill-check` and `npm run agentcash:refill-check` return a
  threshold/cap decision and receipt hash without mutating wallet balance;
- live refill is impossible unless `AGENTCASH_AUTO_REFILL_APPROVED=true` and
  `AGENTCASH_AUTO_REFILL_ENABLED=true`.

Tracking: https://github.com/kfubtik/trust402/issues/7

## 7. Paid Proof402 Delegation

Goal: Trust402 can produce a paid Proof402 proof receipt for approved hashes.

Acceptance:

- only `sha256:` hashes and public-safe metadata are sent;
- private payloads are never sent to Proof402;
- proof spend cap is enforced;
- paid proof requires operator authorization;
- proof result is included in the receipt/audit bundle.

Tracking: https://github.com/kfubtik/trust402/issues/9

## 8. Autonomous Job Flow

Goal: one workflow can turn a user goal and budget into a plan, quote,
execution audit, receipts, optional proof, and final report.

Acceptance:

- default mode is dry-run;
- live mode delegates to the same spend policy as procurement;
- result hashes and receipt bundles are returned;
- failures explain which gate blocked the run.

## 9. Monitoring And Protection

Goal: production checks show whether Trust402 is spending, where, and why.

Acceptance:

- launch monitor checks API, x402 challenge, CDP Bazaar, and spend policy;
- emergency stop is visible in policy output;
- failed payment/proof/refill gates are machine-readable;
- Vercel logs stay free of private material.

## Final Definition Of Done

Trust402 is complete when it can:

- choose x402 resources for a goal;
- buy only approved resources;
- stay within per-call, per-job, and daily limits;
- keep receipts and audit bundles;
- create Proof402 proof receipts for approved hashes;
- monitor its AgentCash balance policy;
- keep auto-refill bound to an approved policy;
- expose all of the above through API checks;
- expose a machine-readable completion audit that keeps unresolved manual,
  external, and live-spend blockers visible;
- pass local tests, release checks, Docker build, production smoke, x402 smoke,
  bounded live paid smoke, Proof402 paid smoke, refill check, and
  Bazaar/external-directory checks.

## Current Safety Blockers

As of 2026-05-19, the local AgentCash policy has zero remaining manual smoke
budget and marks live procurement, Proof402 delegation, and auto-refill as
disabled until separate approval. Code may implement and test gates, but real
paid calls must remain blocked until that policy changes.
