# Trust402 Deployment

Trust402 is a plain Node.js HTTP API with no runtime npm dependencies.

## Required Environment

```text
HOST=0.0.0.0
PORT=4032
PUBLIC_BASE_URL=https://your-domain.example
TRUST402_MODE=dry-run
TRUST402_PAYWALL_MODE=demo
```

Keep live spend disabled for the public MVP:

```text
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

Run:

```powershell
docker run --rm -p 4032:4032 --env PUBLIC_BASE_URL=http://127.0.0.1:4032 trust402
```

Check:

```powershell
npm run smoke -- http://127.0.0.1:4032
```

## Production Notes

- Do not mount `.env`, wallet files, or `.agentcash` into a public container.
- Keep `TRUST402_PAYWALL_MODE=demo` until real x402 settlement middleware is configured.
- Use `TRUST402_PAYWALL_MODE=mock` only for local 402 contract testing.
- Put the API behind HTTPS before submitting to x402 marketplaces.
- Set `PUBLIC_BASE_URL` to the final HTTPS origin so OpenAPI and `.well-known/x402` expose correct URLs.

## Live x402 Settlement

Live x402 settlement is intentionally not enabled in this repository yet.

Before enabling it, add:

- real resource-server middleware;
- facilitator configuration;
- pay-to wallet review;
- receipt logging;
- rollback plan;
- a paid smoke test with an explicit max-spend approval.
