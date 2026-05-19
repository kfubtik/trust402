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
| [#6](https://github.com/kfubtik/trust402/issues/6) | External x402 directories | CDP Bazaar is currently 10/10, but non-CDP directories are curated, delayed, client-rendered, or custom-domain gated and do not visibly list Trust402 yet. | Attach a custom domain, rerun x402/directory checks, and submit the public-safe listing pack only where manual listing is allowed. |
| [#7](https://github.com/kfubtik/trust402/issues/7) | AgentCash auto-refill policy | The Trust402-reserved AgentCash wallet is funded and dry-run refill checks exist, but live auto-refill needs provider, caps, audit, and emergency-stop rules. | Approve the refill source, threshold, amount, cap, and log format before enabling live refill. |
| [#8](https://github.com/kfubtik/trust402/issues/8) | Live procurement policy | Trust402 can plan and quote, but should not autonomously buy downstream resources without spend controls. | Approve allowlists, per-call/job/day caps, receipt storage, and approval thresholds. |
| [#9](https://github.com/kfubtik/trust402/issues/9) | Paid Proof402 delegation policy | Trust402 can prepare Proof402-ready hashes, but paid delegation is intentionally disabled. | Approve which hashes can be notarized, proof spend caps, retry policy, and receipt fields. |
| [#10](https://github.com/kfubtik/trust402/issues/10) | Final autonomous buyer-agent plan | The full success criteria need one canonical tracking issue. | Keep `docs/autonomous-completion-plan.md` and this issue aligned until every safe gate is complete. |

## Current Safe State

- Production URL: `https://trust402.vercel.app`.
- Deployment mode: production is still updated through manual Vercel CLI runs.
  The latest `deployment:preflight` must confirm the production deployment
  commit matches the current repository HEAD; push-triggered Git/Vercel
  auto-deploy evidence is still not verified.
- Recent manual production deployment evidence snapshot:
  `dpl_BpPzYqpZToX1cuyK3k4fVzWVxwDH` from commit
  `4b77712b88ee73d9f4466f400fb9311cd8e62b90`; preflight confirmed it matched
  repository HEAD as of 2026-05-20 04:44:09 +07:00. Treat the latest
  `deployment:preflight` output as the source of truth after any later deploy.
- CDP Bazaar indexing: 10/10 paid launch resources verified as of
  2026-05-20 04:41:54 +07:00. The checker now uses bounded concurrency so
  CDP discovery latency does not create false launch-monitor timeouts.
- External directory visibility: monitored read-only; latest check found 0/8
  visible, 6 reachable, and 2 timeout/unreachable directories as of
  2026-05-20 04:48:43 +07:00; one directory requires a custom domain before
  submission.
- Production gates: `npm test` (156/156), `npm run release:check`, smoke,
  x402 smoke, Docker build, launch monitor, deployment preflight, AgentCash
  refill dry-run, and external directory read-only check passed as of
  2026-05-20 04:48:43 +07:00. Recent final verification hash:
  `sha256:301ce6f31b220fc1b53900a177b1bd24a94a43debb215f097769b34887bd3273`.
  `final:verify` remains blocked because Git/Vercel auto-deploy,
  external-directory visibility, live procurement, paid Proof402 delegation,
  AgentCash auto-refill, and autonomous live job evidence are still unresolved.
- AgentCash MCP observation: AgentCash settings currently cap requests at
  `$0.01`; the local Trust402 policy still keeps manual smoke budget at `$0`
  and leaves live procurement, paid Proof402 delegation, and auto-refill
  disabled until a bounded operator window is explicitly approved.
- Live evidence staging: production action pack now defaults the bounded
  downstream smoke to `https://proof402.vercel.app/api/proof/notarize` at
  `$0.005`, caps the combined procurement/proof window at `$0.015`, and marks
  the generated downstream request as hash-only/public-safe. The default
  `agentcash-mcp` payment provider requires `LIVE_PAYMENT_ADAPTER_URL` for the
  payment bridge plus `TRUST402_OPERATOR_API_KEY`. A `cdp-x402` provider is now
  available for CDP-managed buyer signing without exporting a private key, but
  it still requires an approved live window, operator key, caps, allowlist, and
  existing `CDP_EVM_ACCOUNT_ADDRESS` or `CDP_EVM_ACCOUNT_NAME`.
- Payment bridge preflight now requires an explicit dry-run/no-payment signal
  from the bridge. A bare `paidSubcallsMade=0` is logged but does not pass the
  preflight by itself.
- Operator unblock/action reports now pass the planned downstream
  `candidateEndpoint` into the local AgentCash policy check, so a live smoke
  window is blocked unless the Trust402 wallet allowlist includes the resource
  origin that would be purchased.
- Local AgentCash policy checks now have explicit guard modes: default locked
  mode, `live-window` for approved bounded smoke windows, and `auto-refill` for
  approved refill policies. This keeps the default zero-budget posture strict
  while allowing a reviewed window to be validated before any paid call.
- Proof402 paid endpoint contract: `/api/proof/notarize` requires
  `contentHash`, `label`, and `idempotencyKey`; price observed through
  AgentCash schema discovery is `$0.005` on Base USDC. Trust402 sends only
  hashes and public-safe metadata.
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
