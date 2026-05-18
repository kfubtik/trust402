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
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
npm run directories:check -- https://trust402.vercel.app --timeout-ms=10000
npm run launch:monitor -- https://trust402.vercel.app --timeout-ms=10000
npm run smoke -- https://trust402.vercel.app
npm run smoke:x402 -- https://trust402.vercel.app
npm run smoke -- http://127.0.0.1:4032
npm run smoke:x402 -- http://127.0.0.1:4032
docker build -t trust402:local .
docker compose config
```

After pushing, run the manual GitHub Actions workflow `launch-monitor` against
`https://trust402.vercel.app` when you want a remote production/Bazaar snapshot
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

## Marketplace Metadata

Before submitting to a marketplace, check:

```powershell
npm run doctor
npm run marketplace:bundle
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
```

`dryRunLaunchReady` may be `true` locally. `publicMarketplaceReady` should stay
`false` until the service has HTTPS `PUBLIC_BASE_URL`, a reviewed `PAY_TO`,
approved CDP/facilitator credentials, and a successful paid settlement smoke.

`/api/settlement/status` should show no blockers only after explicit operator
approval, CDP/facilitator setup, and a paid smoke plan. Marketplace indexing
readiness should still stay false until paid settlement evidence exists.
Production CDP Bazaar indexing is currently verified for all 10 launch
resources, but local default configs should not claim readiness without the
matching environment and receipt evidence.

Use [external-marketplace-listing.md](external-marketplace-listing.md) as the
public-safe payload for external directories after the user approves public
outreach.

## Launch Positioning

Launch as:

```text
Trust402: x402 endpoint trust checks and budgeted procurement plans.
```

Do not launch as a universal autonomous buyer until real settlement, receipts,
allowlists, and live-spend policy are implemented and tested.
