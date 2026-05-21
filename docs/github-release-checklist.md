# Trust402 GitHub Release Checklist

Use this checklist before the private GitHub push and again before any later
public release.

## Required Checks

Run from `D:\Agents_402\trust402`:

```powershell
npm ci
npm audit --omit=dev --audit-level=high
npm run verify
npm run doctor
npm run settlement:preflight
npm run marketplace:bundle
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20
npm run directories:check -- https://trust402.aztecbeacon.uk --timeout-ms=10000
npm run launch:monitor -- https://trust402.aztecbeacon.uk --timeout-ms=10000
npm run smoke -- https://trust402.aztecbeacon.uk
npm run smoke:x402 -- https://trust402.aztecbeacon.uk
npm run smoke -- http://127.0.0.1:4032
npm run smoke:x402 -- http://127.0.0.1:4032
docker build -t trust402:local .
docker compose config
```

After pushing, run the manual GitHub Actions workflow `launch-monitor` against
`https://trust402.aztecbeacon.uk` when you want a remote production/Bazaar snapshot
from GitHub. It uses public URLs only and does not require secrets.

`smoke:x402` expects `TRUST402_PAYWALL_MODE=mock` or approved `real` mode. Do not
run it against default demo mode.

All required commands must pass before publishing; `smoke:x402` must pass before
claiming settlement readiness.

## Public-Safe Files

Keep these public:

- `README.md`
- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `.env.example`
- `.github/dependabot.yml`
- `.github/workflows/test.yml`
- `.github/workflows/launch-monitor.yml`
- `Dockerfile`
- `compose.yaml`
- `src/`
- `test/`
- `scripts/`
- `docs/`
- `examples/`
- `marketplace/resources.json`
- `package.json`

Never publish:

- `.env`
- `.agentcash/`
- `data/`
- wallet files;
- private keys;
- seed phrases;
- payment headers;
- paid smoke logs with account details.

## Remote Setup

Wait for final user confirmation before pushing. The first repository should
stay private; public release comes only after the user explicitly approves it.

Suggested repository description:

```text
Buyer-side trust and procurement agent for x402 resources.
```

Suggested topics:

```text
x402, agent, trust, procurement, micropayments
```

## Public Release Cleanup Gate

Keep the private working history intact while Trust402 is still being built. Do
not delete workflow runs, rewrite `main`, or force-push only to hide failed
iteration checks during active development.

Trust402 reached its first completed production freeze on 2026-05-21. Use
[public-release-cleanup.md](public-release-cleanup.md) as the active cleanup
gate before making the repository public.

Before changing `kfubtik/trust402` from private to public, run a separate
operator-approved public release cleanup:

1. Verify the product is complete against `docs/autonomous-completion-plan.md`
   and that the latest `main` commit has green GitHub Actions and Vercel checks.
2. Scrub public-safe files again with `npm run privacy:check` and
   `npm run release:check`.
3. Export or preserve any private development evidence the operator wants to
   keep before cleanup.
4. Create a clean public release commit, preferably from an orphan branch or a
   reviewed squash, with the message `Initial public release`.
5. Push the clean release history only after explicit operator approval for a
   history rewrite.
6. Run the full required checks against the clean release commit.
7. Change repository visibility to public only after the clean release commit is
   green and the operator confirms that old private workflow history should not
   be part of the public launch surface.

GitHub warns that when a private repository is made public, repository code,
activity, Actions history, and logs become visible to everyone. Treat that
visibility change as irreversible from a launch-reputation perspective: finish
the product first, then do the cleanup gate, then publish.

## Marketplace Metadata

Before submitting to a marketplace, check:

```powershell
npm run doctor
npm run marketplace:bundle
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20
```

`dryRunLaunchReady` may be `true` locally. `publicMarketplaceReady` should stay
`false` until the service has HTTPS `PUBLIC_BASE_URL`, a reviewed `PAY_TO`,
approved CDP/facilitator credentials, and a successful paid settlement smoke.

`/api/settlement/status` should show no blockers only after explicit operator
approval, CDP/facilitator setup, and a paid smoke plan. Marketplace indexing
readiness should still stay false until paid settlement evidence exists.
After the 2026-05-20 custom-domain switch, production CDP Bazaar search finds
Trust402 but exact launch resources are still reindexing from the old
`trust402.vercel.app` origin to `trust402.aztecbeacon.uk`. Local default
configs should not claim marketplace readiness without current `10/10`
custom-domain evidence and matching receipt evidence.

Use [external-marketplace-listing.md](external-marketplace-listing.md) as the
public-safe payload for external directories after the user approves public
outreach.

## Launch Backlog

Track the remaining manual and spend-policy gates in
[launch-issues.md](launch-issues.md). These issues are intentionally separate
from the launch MVP because they either require third-party dashboard access or
explicit live-spend policy.

Current release tracks:

- Git-backed Vercel deploys are verified for the private repo;
- CDP Bazaar is verified `10/10`, and x402scan visibly lists Trust402;
- AgentCash auto-refill is configured as `manual-action`;
- live procurement and paid Proof402 delegation passed a bounded production
  evidence smoke and returned to locked defaults;
- public release cleanup is the remaining repository-visibility gate.

## Launch Positioning

Launch as:

```text
Trust402: x402 endpoint trust checks and budgeted procurement plans.
```

Do not launch as a universal autonomous buyer until real settlement, receipts,
allowlists, and live-spend policy are implemented and tested.
