# Security Policy

Trust402 is a dry-run-first trust and procurement planning agent for x402
resources.

## Supported Status

Current version: `0.1.0`

The current public MVP does not execute live paid subcalls and does not require
private keys.

## Reporting

Please report security issues privately before public disclosure. Do not include
private keys, seed phrases, payment headers, customer payloads, or wallet files
in an issue or pull request.

## Current Safety Boundaries

Trust402 currently:

- does not store private keys;
- does not ask for seed phrases;
- does not execute live procurement;
- does not send paid x402 requests to third-party services;
- does not call Proof402 automatically;
- keeps `procurement/plan` in plan-only mode;
- treats `.env`, `data/`, wallet files, `.agentcash/`, and logs as local-only.

## Future Live Spend Requirements

Live procurement must not be enabled unless all of these exist:

- explicit live-spend environment flag;
- hot wallet separated from revenue wallet;
- per-call limit;
- per-job limit;
- daily limit;
- registry allowlist;
- endpoint denylist;
- receipt log;
- human approval threshold;
- proof receipt for final reports.

## Local-Only Files

Never commit:

- `.env`;
- wallet files;
- seed phrases;
- private keys;
- AgentCash local data;
- payment headers;
- paid smoke logs with account details;
- API keys;
- proxy credentials.
