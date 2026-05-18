# Contributing

Thanks for helping make Trust402 sharper.

## Development

```powershell
cd D:\Agents_402\trust402
npm test
npm run privacy:check
npm run release:check
```

The project intentionally has no runtime npm dependencies in the current MVP.

## Scope Rules

- Keep work inside the `trust402` folder unless a maintainer explicitly asks
  for sibling product changes.
- Do not modify Proof402 or Action402 from this repository.
- Keep live spending disabled by default.
- Add tests for scoring, policy, and route behavior when changing API logic.
- Do not commit local wallet, payment, or canary files.

## Pull Requests

Before opening a PR:

1. Run `npm test`.
2. Run `npm run privacy:check`.
3. Run `npm run release:check`.
4. Confirm no `.env`, wallet files, logs, or AgentCash data are included.

## Product Direction

Trust402 should remain focused on one buyer problem:

`safe selection and use of paid x402 resources`

Avoid turning the launch MVP into a generic autonomous agent. Broader live
procurement comes later, after the trust tools prove useful.
