# Trust402 Deployment

Trust402 is a Node.js HTTP API with a guarded Express bridge for real x402
settlement. Default deployments run in dry-run/demo mode.

## Required Environment

```text
HOST=0.0.0.0
PORT=4032
PUBLIC_BASE_URL=https://your-domain.example
TRUST402_MODE=dry-run
TRUST402_PAYWALL_MODE=demo
TRUST402_REAL_SETTLEMENT_ENABLED=false
```

Keep live spend disabled for the public MVP:

```text
PROOF402_BASE_URL=https://proof402.vercel.app
PROOF402_DELEGATION_MODE=disabled
PROOF402_MAX_SPEND_USD=0
```

## Docker

The GitHub Actions workflow builds the Docker image and runs a container smoke
test on every push.

Build:

```powershell
docker build -t trust402 .
```

On this Windows workstation Docker Desktop is installed under `D:\Programs\Docker`.
If the current shell does not know `docker`, either open a fresh terminal or use:

```powershell
$env:PATH = "D:\Programs\Docker\resources\bin;$env:PATH"
& "D:\Programs\Docker\resources\bin\docker.exe" build -t trust402 .
```

Run:

```powershell
docker run --rm -p 4032:4032 --env PUBLIC_BASE_URL=http://127.0.0.1:4032 trust402
```

Run with Docker Compose:

```powershell
docker compose up --build
```

Check:

```powershell
npm run smoke -- http://127.0.0.1:4032
npm run settlement:check
npm run settlement:preflight
npm run doctor
npm run marketplace:bundle
npm run bazaar:indexing:check -- https://trust402.vercel.app
npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20
```

Use `npm run settlement:preflight -- --strict` only for the approved paid-smoke
window, when a non-zero exit should block the smoke.

## Production Notes

- Do not mount `.env`, wallet files, or `.agentcash` into a public container.
- Keep `compose.yaml` on dry-run defaults unless you are doing an approved local settlement test.
- Keep `TRUST402_PAYWALL_MODE=demo` until CDP credentials and a paid smoke budget are approved. After production real mode is approved, keep Trust402 live procurement and Proof402 delegation disabled unless separately approved.
- Use `TRUST402_PAYWALL_MODE=mock` only for local 402 contract testing.
- Use `npm run smoke:x402 -- <base-url>` against mock mode or approved real mode to verify unpaid `402 Payment Required` challenges without settling a payment.
- Put the API behind HTTPS before submitting to x402 marketplaces.
- Set `PUBLIC_BASE_URL` to the final HTTPS origin so OpenAPI and `.well-known/x402` expose correct URLs.
- Use `/api/launch/checklist` or `npm run doctor` before marketplace submission.
- Use `/api/marketplace/bundle` or `npm run marketplace:bundle` to inspect Bazaar-style resource metadata before submitting anywhere.
- Use `/api/settlement/preflight` or `npm run settlement:preflight` before the one approved paid smoke.
- Use `npm run bazaar:indexing:check -- https://trust402.vercel.app` after a successful paid smoke to check asynchronous CDP Bazaar visibility.
- Use `npm run bazaar:indexing:check:all -- https://trust402.vercel.app --timeout-ms=10000 --limit=20` before public launch claims about every paid resource.
- See `docs/bazaar-indexing.md` for the current production indexing state and completion gate.

## Vercel

Current production URL:

```text
https://trust402.vercel.app
```

The safe default environment profile is:

```text
PUBLIC_BASE_URL=https://trust402.vercel.app
PROOF402_BASE_URL=https://proof402.vercel.app
PROOF402_DELEGATION_MODE=disabled
PROOF402_MAX_SPEND_USD=0
TRUST402_REAL_SETTLEMENT_ENABLED=false
TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=false
```

For the approved production real-settlement profile, the same URL uses:

```text
TRUST402_PAYWALL_MODE=real
TRUST402_REAL_SETTLEMENT_ENABLED=true
TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=true
TRUST402_PAID_SMOKE_APPROVED=false
TRUST402_PAID_SMOKE_MAX_USD=0
```

CDP secrets must stay in Vercel environment variables or local `.env`; never
commit them. Keep these local placeholders for preparation:

```text
PAY_TO=
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
```

## Live x402 Settlement

The Express middleware bridge protects paid launch resources when
`TRUST402_PAYWALL_MODE=real` and every `/api/settlement/status` guard passes.
If real mode is requested before the guards pass, protected POST routes fail
closed with `503 real_settlement_not_ready`.

Before enabling it, prepare:

- facilitator configuration;
- pay-to wallet review;
- receipt logging;
- rollback plan;
- a paid smoke test with an explicit max-spend approval.

Use this endpoint to inspect blockers:

```text
GET /api/settlement/status
```

For Base mainnet through CDP, the expected facilitator value is:

```text
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
```

For CDP-backed settlement, configure these as environment variables, never in
tracked files:

```text
TRUST402_PAYWALL_MODE=real
TRUST402_REAL_SETTLEMENT_ENABLED=true
PAY_TO=0x...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
TRUST402_PAID_SMOKE_APPROVED=true
TRUST402_PAID_SMOKE_MAX_USD=0.01
```

Keep `TRUST402_SUCCESSFUL_SETTLEMENT_OBSERVED=false` until the paid smoke
returns a reviewed settlement receipt. After the receipt is reviewed and the
flag is true, close the smoke window again:

```text
TRUST402_PAID_SMOKE_APPROVED=false
TRUST402_PAID_SMOKE_MAX_USD=0
```
