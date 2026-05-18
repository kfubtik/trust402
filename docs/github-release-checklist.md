# Trust402 GitHub Release Checklist

Use this checklist before creating the public repository.

## Required Checks

Run from `D:\Agents_402\trust402`:

```powershell
npm run verify
npm run smoke -- http://127.0.0.1:4032
```

Both commands must pass before publishing.

## Public-Safe Files

Keep these public:

- `README.md`
- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `.env.example`
- `.github/workflows/test.yml`
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

Wait for the owner/account decision before adding a GitHub remote.

Suggested repository description:

```text
Buyer-side trust and procurement agent for x402 resources.
```

Suggested topics:

```text
x402, agent, trust, procurement, micropayments
```

## Launch Positioning

Launch as:

```text
Trust402: x402 endpoint trust checks and budgeted procurement plans.
```

Do not launch as a universal autonomous buyer until real settlement, receipts,
allowlists, and live-spend policy are implemented and tested.
