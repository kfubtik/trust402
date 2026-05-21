# Trust402 GitHub Release Checklist

Use this checklist before release pushes and before any later public relaunch.

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

The repository is public at `https://github.com/kfubtik/trust402`. Push release
changes only after local checks pass.

Suggested repository description:

```text
Buyer-side trust and procurement agent for x402 resources.
```

Suggested topics:

```text
x402, agent, trust, procurement, micropayments
```

## Public Release Cleanup Gate

Keep the public working history intact. Do not delete workflow runs, rewrite
`main`, or force-push only to hide failed iteration checks.

Trust402 reached its first completed production freeze and public GitHub launch
on 2026-05-21. Use [public-release-cleanup.md](public-release-cleanup.md) as the
record of the completed cleanup gate.

For any future clean-history relaunch, run a separate operator-approved cleanup:

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
7. Change repository visibility only after the clean release commit is green
   and the operator confirms the public launch surface.

GitHub public history and workflow activity are visible to everyone. Treat any
future history rewrite or visibility change as a launch-reputation decision.

## Marketplace Metadata

Before submitting to a marketplace, check:

```powershell
npm run doctor
npm run marketplace:bundle
npm run bazaar:indexing:check:all -- https://trust402.aztecbeacon.uk --timeout-ms=10000 --limit=20
```

Production now has HTTPS `PUBLIC_BASE_URL`, reviewed `PAY_TO`, approved
CDP/facilitator credentials, successful paid settlement evidence, and current
CDP Bazaar `10/10` custom-domain evidence. Keep local default configs from
claiming marketplace readiness unless they carry matching current evidence.

Use [external-marketplace-listing.md](external-marketplace-listing.md) as the
public-safe payload for external directories after the user approves public
outreach.

## Launch Backlog

Track the remaining manual and spend-policy gates in
[launch-issues.md](launch-issues.md). These issues are intentionally separate
from the launch MVP because they either require third-party dashboard access or
explicit live-spend policy.

Current release tracks:

- Git-backed Vercel deploys are verified for the public repo;
- CDP Bazaar is verified `10/10`, and x402scan visibly lists Trust402;
- AgentCash auto-refill is configured as `manual-action`;
- live procurement and paid Proof402 delegation passed bounded production
  evidence smoke;
- daily autonomy is enabled in production through Vercel Cron with one paid
  call max, strict caps, and payment restricted to the Proof402, Action402, and
  Trust402 allowed origins;
- public release cleanup is complete for the first public launch.

## Launch Positioning

Launch as:

```text
Trust402: x402 endpoint trust checks and budgeted procurement plans.
```

Do not launch as a universal autonomous buyer until real settlement, receipts,
allowlists, and live-spend policy are implemented and tested.
