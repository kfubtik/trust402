# Trust402 Public Release Cleanup

Created: 2026-05-21

Use this gate after the production freeze and before changing
`kfubtik/trust402` from private to public. The goal is to keep the working
private history intact while producing a clean public launch surface.

## Current Decision

- Do not rewrite, squash, or force-push `main` during active post-release work.
- Keep the private repository private until the operator explicitly approves
  the visibility change.
- Prepare a clean public release commit or orphan branch only after the final
  cleanup audit is green.
- Preserve detailed live-spend evidence privately; publish only public-safe
  hashes, directory links, and high-level verification status unless the
  operator chooses an evidence-first release.

## Cleanup Audit Snapshot

The latest tracked-file audit checked:

- `.env`, `.env.*`, `.local/`, `.vercel/`, `node_modules/`, wallet JSON files,
  logs, and temporary data paths are ignored;
- no tracked private env files were found;
- no tracked GitHub tokens, OpenAI-style API keys, PEM private keys, or raw
  payment headers were found;
- tracked docs contain public chain transaction hashes used as payment evidence;
- tracked docs previously contained an exact CDP buyer account and Vercel
  preview deployment URLs; these should stay in private evidence rather than
  public launch notes;
- the public contact email is operator-approved for external directories.

## Public Release Scrub Rules

Before the clean public commit, scrub or review:

- real wallet/account addresses and balances;
- Vercel team/project slugs and preview deployment URLs;
- failed private iteration notes that do not help users understand the product;
- raw paid-smoke logs, raw AgentCash responses, and payment headers;
- local machine paths when they are not needed for user-facing setup;
- any evidence table that exposes more operational detail than the launch needs.

Keep:

- product docs, API docs, examples, marketplace metadata, and tests;
- public production URL `https://trust402.aztecbeacon.uk`;
- public x402scan listing link;
- final verifier hash and production freeze status;
- placeholder env names in `.env.example`;
- high-level spend policy and safety docs.

## Safe Cleanup Path

1. Run `npm run privacy:check` and `npm run release:check`.
2. Run the production checks from `docs/github-release-checklist.md`.
3. Resolve untracked release-scope files.
4. Create a reviewed clean public release branch or orphan commit.
5. Run the full verification suite against that clean release surface.
6. Push the clean branch and confirm GitHub Actions plus Vercel are green.
7. Change repository visibility to public only after explicit operator approval.

## Do Not Publish

- `.env` or `.env.production.local`;
- `.local/` wallet binding files;
- CDP wallet secrets, API secrets, operator API keys, private keys, seed
  phrases, or payment headers;
- raw logs from live-spend windows;
- private browser/profile/account screenshots.

