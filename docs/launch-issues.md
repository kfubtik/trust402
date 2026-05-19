# Trust402 Launch Issues

Created on 2026-05-18 in the private GitHub repository:
`kfubtik/trust402`.

This file mirrors the remote launch backlog so the release package carries the
same operational truth as GitHub. Keep it public-safe: issue text may mention
policy gates and public URLs, but never include API keys, wallet secrets,
payment headers, private receipts, or AgentCash internals.

The full final Definition of Done is pinned in
[autonomous-completion-plan.md](autonomous-completion-plan.md).

## Open Launch Backlog

| Issue | Track | Why it matters | Safe next step |
| --- | --- | --- | --- |
| [#5](https://github.com/kfubtik/trust402/issues/5) | Vercel Git auto-deploy | Production currently deploys through manual Vercel CLI runs. Git-backed deploys need the Vercel GitHub App to access the private repo. | Update the Vercel GitHub App installation, then verify a harmless Git-backed production deploy. |
| [#6](https://github.com/kfubtik/trust402/issues/6) | External x402 directories | CDP Bazaar is currently 9/10 and other directories are curated or delayed. | Submit the public-safe listing pack only where manual listing is allowed, and settle `procurement.plan` only after spend policy approval. |
| [#7](https://github.com/kfubtik/trust402/issues/7) | AgentCash auto-refill policy | The Trust402-reserved AgentCash wallet is funded and dry-run refill checks exist, but live auto-refill needs provider, caps, audit, and emergency-stop rules. | Approve the refill source, threshold, amount, cap, and log format before enabling live refill. |
| [#8](https://github.com/kfubtik/trust402/issues/8) | Live procurement policy | Trust402 can plan and quote, but should not autonomously buy downstream resources without spend controls. | Approve allowlists, per-call/job/day caps, receipt storage, and approval thresholds. |
| [#9](https://github.com/kfubtik/trust402/issues/9) | Paid Proof402 delegation policy | Trust402 can prepare Proof402-ready hashes, but paid delegation is intentionally disabled. | Approve which hashes can be notarized, proof spend caps, retry policy, and receipt fields. |
| [#10](https://github.com/kfubtik/trust402/issues/10) | Final autonomous buyer-agent plan | The full success criteria need one canonical tracking issue. | Keep `docs/autonomous-completion-plan.md` and this issue aligned until every safe gate is complete. |

## Current Safe State

- Production URL: `https://trust402.vercel.app`.
- CDP Bazaar indexing: 9/10 paid launch resources verified; `procurement.plan`
  is missing and costs `$0.02`, above the current `$0.01` AgentCash max.
- External directory visibility: monitored read-only; not required for launch
  health while CDP Bazaar remains indexed.
- Trust402 live procurement: disabled.
- Paid Proof402 delegation: disabled.
- AgentCash auto-refill: disabled; dry-run monitor is available through
  `npm run agentcash:refill-check` and `/api/agentcash/refill-check`.
- Planned auto-refill threshold: `$0.50`, still blocked until provider,
  explicit approval, caps, audit log, and emergency stop are defined.

## Regression Commands

Run after any production deployment:

```powershell
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000 --strict
```

Run before claiming external directory visibility:

```powershell
npm run directories:check -- https://trust402.vercel.app --timeout-ms=10000
```

Run before enabling any live-spend-adjacent feature:

```powershell
npm run privacy:check
npm run release:check
```
