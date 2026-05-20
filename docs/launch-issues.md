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
- Deployment mode: production now auto-deploys through the Vercel GitHub App
  from `kfubtik/trust402` pushes to `main`. The Git/Vercel auto-deploy
  requirement is verified in production audit.
- Recent manual production deployment evidence snapshot:
  `dpl_9oUMANMVV69eJqQTzgDyr3tq57WK`, aliased to
  `https://trust402.vercel.app` as of 2026-05-20 09:49 +07:00. This deploy
  includes commit `e613f801ac5cdd8d603e25dae78c0c3f5b5888d8`
  (`Add final verification deployment sync gate`). Treat the latest
  `deployment:preflight` output and `vercel inspect https://trust402.vercel.app`
  as the source of truth after any later deploy.
- The current deployed runtime includes the deployment-preflight requirement
  split from `2acd266590fafcba88fb5be028bd8b5f6190430b`, the deployment-lag
  ledger update from `7ab25d1f7d259e1e114f964aacd49da7c22ee2a3`, and the
  final-verifier deployment sync gate from
  `e613f801ac5cdd8d603e25dae78c0c3f5b5888d8`. Production has since advanced
  through a Git-backed deploy from `kfubtik/trust402` to
  `cf8bd96832c3fb38c0d3248381c054710278c1f9`
  (`Record Git auto deploy evidence`), exposed by `/health` and recorded in
  `TRUST402_GIT_AUTO_DEPLOY_*` production evidence env.
- The GitHub Actions fallback workflow now runs only by manual
  `workflow_dispatch`, writes
  `deployment-evidence.json` with schema
  `trust402.github_actions_deploy_evidence.v1` and uploads it as the
  `trust402-deployment-evidence` artifact after production smoke, x402 smoke,
  and launch monitor pass. After Actions secrets are configured, that artifact
  can supply an extra run URL and head SHA for `TRUST402_GIT_AUTO_DEPLOY_*`
  without running on every push.
- Source HEAD now also exposes public-safe deployment metadata from `/health`
  when the runtime provides `VERCEL_GIT_COMMIT_SHA`, and the final verifier
  compares that SHA to the local HEAD when available. Production will expose
  this after the next successful deploy.
- Final verification now includes a required `production_deployment_sync`
  check before production smoke. If production is behind the local verification
  contract, `production_smoke` is skipped as a deployment-lag blocker instead
  of being reported as an application smoke regression.
- CDP Bazaar indexing: 10/10 paid launch resources verified as of
  2026-05-20 04:41:54 +07:00. The checker now uses bounded concurrency so
  CDP discovery latency does not create false launch-monitor timeouts.
- External directory visibility: monitored read-only; latest final verifier
  checked 13 directories, found 10 reachable, 0 visible, 3 unreachable, and 1
  custom-domain-blocked as of 2026-05-20 09:52 +07:00.
- Production gates: `node --test test` (180/180), `node scripts/release-check.js`,
  smoke, x402 smoke, Docker build, launch monitor, deployment preflight,
  AgentCash refill dry-run, production deployment sync, and external directory
  read-only check passed as of 2026-05-20 09:52 +07:00. Recent final
  verification hash:
  `sha256:44e39d236930a87c2599113b4844d7eadc2b0e6ea3a5a696239f9186f94fe6f2`.
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
  the generated downstream request as hash-only/public-safe. The current
  configured production provider is `agentcash-mcp`, but it lacks
  `LIVE_PAYMENT_ADAPTER_URL`. The recommended shortest unblock path is
  `cdp-x402`: CDP API key fields are present, but production still lacks
  `CDP_WALLET_SECRET` and either `CDP_EVM_ACCOUNT_ADDRESS` or
  `CDP_EVM_ACCOUNT_NAME`.
- Trust402 live procurement responses now include a public-safe
  `trust402.procurement_audit.v1` `auditBundle` alongside `receiptBundle`.
  Downstream endpoint URLs are represented with origins and hashes, and any
  `payment-response` evidence is recorded only as `sha256:` hashes, never as
  raw payment headers.
- AgentCash refill checks now include a public-safe
  `trust402.agentcash_refill_audit.v1` `auditBundle` with threshold/cap state,
  adapter evidence hashes, local wallet-policy requirements, and no wallet
  secrets or raw adapter responses. Production dry-run audit hash observed:
  `sha256:478323725819162c98733c30879ffbf0578e22e584b181cfcab6d7726c8e62c0`.
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
