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
| [#5](https://github.com/kfubtik/trust402/issues/5) | Vercel Git auto-deploy | Production deploys through the Vercel GitHub App from `kfubtik/trust402` pushes. | Keep the production deploy evidence current after each release. |
| [#6](https://github.com/kfubtik/trust402/issues/6) | External x402 directories | The custom domain is attached. CDP Bazaar exact resource URLs are verified `10/10`; x402 List submission `a6c3be52-dbd9-4d86-999e-5b497443b357` is pending and probed 10 endpoints. Non-CDP directories do not visibly list Trust402 yet. | Keep monitoring x402 List and record a visible public listing URL before closing. |
| [#7](https://github.com/kfubtik/trust402/issues/7) | AgentCash auto-refill policy | The Trust402-reserved AgentCash wallet is funded, dry-run refill checks exist, and production policy uses `manual-action` provider so no runtime refill credentials are held. | Keep threshold/cap evidence current; use a separate approved adapter only if live automatic refill is later required. |
| [#8](https://github.com/kfubtik/trust402/issues/8) | Live procurement policy | Trust402 can plan and quote, but should not autonomously buy downstream resources without spend controls. | Approve allowlists, per-call/job/day caps, receipt storage, and approval thresholds. |
| [#9](https://github.com/kfubtik/trust402/issues/9) | Paid Proof402 delegation policy | Trust402 can prepare Proof402-ready hashes, but paid delegation is intentionally disabled. | Approve which hashes can be notarized, proof spend caps, retry policy, and receipt fields. |
| [#10](https://github.com/kfubtik/trust402/issues/10) | Final autonomous buyer-agent plan | The full success criteria need one canonical tracking issue. | Keep `docs/autonomous-completion-plan.md` and this issue aligned until every safe gate is complete. |

## Current Safe State

- Production URL: `https://trust402.aztecbeacon.uk`.
- Deployment mode: production now auto-deploys through the Vercel GitHub App
  from `kfubtik/trust402` pushes to `main`. The Git/Vercel auto-deploy
  requirement is verified in production audit.
- Historical manual production deployment evidence snapshot:
  `dpl_9oUMANMVV69eJqQTzgDyr3tq57WK`, aliased to
  `https://trust402.vercel.app` as of 2026-05-20 09:49 +07:00. This deploy
  includes commit `e613f801ac5cdd8d603e25dae78c0c3f5b5888d8`
  (`Add final verification deployment sync gate`). Treat the latest
  `deployment:preflight` output and `vercel inspect https://trust402.aztecbeacon.uk`
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
- CDP Bazaar indexing: after the latest production redeploy, a bounded paid
  retry against `trust.compare_resources`, and asynchronous CDP Bazaar recovery,
  `npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk
  --timeout-ms=10000 --limit=20 --concurrency=8` reports
  `all-indexed` with `10/10` exact custom-domain paid launch resources as
  of 2026-05-20 23:37 +07:00. Production env now records
  `TRUST402_CDP_BAZAAR_EVIDENCE_REF=sha256:81031dc6017d9df52399ff4be0c88bdeb30525bf89e32dc5e4f4ffd3e0d78795`,
  `TRUST402_CDP_BAZAAR_CHECK_STATUS=all-indexed`,
  `TRUST402_CDP_BAZAAR_EXPECTED_RESOURCES=10`,
  `TRUST402_CDP_BAZAAR_INDEXED_RESOURCES=10`, and
  `TRUST402_CDP_BAZAAR_MISSING_RESOURCES=` with no missing resources.
- AgentCash direct paid smoke: a one-shot x402 fetch against
  `https://trust402.aztecbeacon.uk/api/trust/compare-resources` succeeded for
  `$0.03` on 2026-05-20 at 16:44 +07:00. Public transaction hash:
  `0xb447b8213c9641d200d656945e95b0f5fb5e3ac2565469179c8af742cb42d1df`.
  The temporary local policy window was closed immediately after the fetch and
  `npm run agentcash:policy` reports locked mode again.
- AgentCash direct paid smoke retry: a second one-shot x402 fetch against
  `https://trust402.aztecbeacon.uk/api/trust/compare-resources` succeeded for
  `$0.03` on 2026-05-20 at 21:45 +07:00. Public transaction hash:
  `0xfe2c3ccdd70a78fe5602e3e49139a3da1b05d8188552104ee1baddffb442eeb1`.
  The temporary local policy window was closed immediately after the fetch,
  AgentCash `maxAmount` was restored to `$0.01`, and
  `npm run agentcash:policy` reports locked mode again. A follow-up CDP Bazaar
  check still reported `9/10`, so this is now treated as an async/external
  indexing blocker.
- Bazaar indexing plan: `node scripts/bazaar-indexing-plan.js
  https://trust402.aztecbeacon.uk --indexed=trust.compare_resources` was the
  read-only plan used for the now-completed remaining 9 route smokes. Starter
  route-by-route smokes were capped at `$0.15` combined, and
  `reports.x402_diligence` used a separate high-cost `$0.15` approval.
- 2026-05-20 route-by-route paid indexing smokes completed for the remaining
  nine routes with max spend `$0.30`: `trust.check_x402`
  (`0x9fc2b06668a3a5eb25df7fa38fc4d245b62e47a7a8c90847f1c6cb06268312b1`),
  `trust.score_resource`
  (`0x9860447fc39855c0bf93b43e222d67f3b9807642072639c10df0367feaef10a4`),
  `trust.evaluate_origin`
  (`0x81e17cd1053a1b57391548baf9564e9a081c15cd85a89a64c6b9e48a97946c02`),
  `seller.readiness`
  (`0xbb84eb1e5373ef84ea0c73281f08684d24548b3c650e785656b42c0a7e0b8ac7`),
  `procurement.plan`
  (`0x67e8ff919148e28e4e648ee6a506a95cfeeaec946f1316b9fa6a7af6d7bad901`),
  `procurement.quote`
  (`0x72bdcb93dfef59ae83c866bc4bf9428324517f15967c43462e3bd98f75f4009e`),
  `monitor.snapshot`
  (`0xa420d6469c1c2b42c36b4b8113367838e06d5b7cdbf708f278768fb91c3550f4`),
  `monitor.badge`
  (`0x6c828f10e7aac7e20db8001eab8557451a086b95350292c4219f5330e53dfc98`), and
  `reports.x402_diligence`
  (`0x59c54d9d89a27587d686524f7ce2814154700dd5c4745c1018b6c249ef9f8bff`).
- External directory visibility: monitored read-only; latest check found 13
  monitored directories, 10 reachable, 0 visible, 3 unreachable, and 0
  custom-domain-blocked as of 2026-05-21 11:37 +07:00. `x402-list.com`
  submission `a6c3be52-dbd9-4d86-999e-5b497443b357` is pending and its probe
  found 10 endpoints without errors.
- A repeated `x402-list.com` API submission attempt on 2026-05-21 at 12:01
  +07:00 was rejected by the directory's 7-day review throttle for
  `kfubtik00@gmail.com`; continue monitoring the existing pending submission
  instead of submitting duplicates.
- Local custom-domain readiness check now accepts both top-level
  `Payment-Required.resource.url` and `accepts[].resource` challenge formats.
  Latest local readiness evidence:
  `sha256:8da65381983fbc9998401cefba576d4ce29af40b3b4d6610c81ec055c0d54f8d`.
- Production gates: `node --test test` (187/187),
  `node scripts/release-check.js`, `node scripts/privacy-check.js`, production
  smoke, production x402 smoke, Docker build, AgentCash refill dry-run, launch
  monitor, completion audit, and external directory read-only check passed on
  2026-05-21. The final verifier now has all required command checks passing.
  Final verifier hash:
  `sha256:f87e4f41a5fd6128d4fef6a5674e0c2382214f9217be54ba69e0db51a1ea1960`.
  Docker Desktop is installed at `D:\Programs\Docker`; if the daemon is not
  running, start Docker Desktop and use a local `DOCKER_CONFIG` under `.tmp`.
  `final:verify` remains blocked because external-directory visibility,
  closed live-procurement policy, closed paid Proof402 policy, and autonomous
  live job evidence are still unresolved.
- AgentCash MCP observation: AgentCash settings were restored to cap requests
  at `$0.01` after the route smokes. Balance was `$0.953` after the `$0.30`
  route-indexing batch and `$0.948` after the later `$0.005` Proof402 direct
  smoke. Balance was `$0.918` after the latest `$0.03` compare-resources retry.
  The local Trust402 policy still keeps manual smoke
  budget at `$0` and leaves live procurement, paid Proof402 delegation, and
  auto-refill disabled until a bounded operator window is explicitly approved.
- Live evidence staging: production action pack now defaults the bounded
  downstream smoke to `https://proof402.vercel.app/api/proof/notarize` at
  `$0.005`, caps the combined procurement/proof window at `$0.015`, and marks
  the generated downstream request as hash-only/public-safe. The current
  configured production provider is `cdp-x402`; production has
  `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, and the
  `trust402-buyer` EVM account reference. The buyer address
  `0xaC451Dd067f0f246Fe59eA4a0707f1c99F11342B` currently has `2.118725` Base
  USDC, so the funding blocker is resolved; keep live spend behind a bounded
  staged window and current policy caps.
- Trust402 production `cdp-x402` live evidence smoke succeeded on 2026-05-21 at
  11:30 +07:00 inside the approved `$0.015` total spend cap. Opening
  deployment:
  `https://trust402-qj5v444zu-sergo565456-2815s-projects.vercel.app`.
  Closing deployment:
  `https://trust402-lj806gplc-sergo565456-2815s-projects.vercel.app`.
  Smoke evidence hash:
  `sha256:ccf853d3307b4e57bd0628d077b2d820953b042a1f3f5161d8c690da89c34d31`.
  Live procurement and paid Proof402 evidence ref:
  `sha256:3cd0cc03075c8e4a223e63af59a424d6af7b91a459df5bb32cf02ed051af274d`.
  AgentCash refill decision evidence ref:
  `sha256:6b97ce7e38c793d19af3880683cef074f9d215e5c0675546c1289f17b633c12c`.
  The window was closed immediately after evidence env refs were recorded:
  `LIVE_SPEND_ENABLED=false`, `PROOF402_DELEGATION_MODE=disabled`, and the
  operator key was rotated. Use `/api/policies/spend`, not `/health`, to verify
  a temporary live window; `/health` intentionally reports
  `liveSpendEnabled=false`.
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
- Proof402 direct paid smoke: a one-shot AgentCash x402 fetch against
  `https://proof402.vercel.app/api/proof/notarize` succeeded for `$0.005` on
  2026-05-20 at 17:47 +07:00. Public transaction hash:
  `0xf01fd6c543227924712cd26083a61c34c5222ee3fe674bfc82fed4e745a5292a`.
  Public proof id: `proof_4527023b4c7c1bf5c5b88e94`; verification endpoint
  returned `verified=true` for content hash
  `sha256:4af397d773634de7b4b2fd60c4a1bc07b53f4b198bd577d127f2524115c8c84a`.
  Evidence ref:
  `sha256:00d01bc39d1fe520dbeb6e76433554b2ccf163dc8e8f8c315a4b92cd7abefae8`.
  The temporary local policy window was closed immediately after the fetch,
  and AgentCash `maxAmount` was restored to `$0.01`. This proves an
  out-of-band paid Proof402 smoke; it does not prove Trust402's production
  payment adapter until `LIVE_PAYMENT_ADAPTER_URL` or `cdp-x402` is configured.
- Trust402 live procurement: disabled after the 2026-05-21 bounded smoke.
- Paid Proof402 delegation: disabled after the 2026-05-21 bounded smoke.
- AgentCash auto-refill policy: approved and enabled in production with
  provider `manual-action`, threshold `$0.50`, refill amount `$1.00`, and daily
  cap `$2.00`. Current-balance dry-run decision at `$0.948` produced
  decision hash
  `sha256:4256e1c5f5d3cb5fe69295e4216bf066326cbc2fd1e210854e57b0cca357c959`
  and audit bundle hash
  `sha256:905672508b62f7fc2551094ed1e720994650ecd6ee32ef84bf1fb300d475a5cf`.
  A below-threshold simulation at `$0.42` produced decision hash
  `sha256:99d853f0728e4586ba0ae3cfc9d42ce469ab666939b5b30c1729ac77030d8cb2`
  and audit bundle hash
  `sha256:a3c5299d48ec326f02727710b7cb9ba13552e65d1714d19c279860480369faf3`.
  Combined evidence ref:
  `sha256:e1a7d8f73f35e833405e9a53505552102427dcca324c8dc1e9c3347cf57547d7`.
  This mode creates an operator refill action when balance is below threshold;
  it does not mutate wallet balance by itself. The latest AgentCash balance is
  `$0.918`, still above threshold; refresh the dry-run evidence if this value
  becomes part of the final verification package.

## Regression Commands

Run after any production deployment:

```powershell
npm run launch:monitor -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --strict
```

Run before claiming external directory visibility:

```powershell
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000
```

Run before enabling any live-spend-adjacent feature:

```powershell
npm run privacy:check
npm run release:check
```
