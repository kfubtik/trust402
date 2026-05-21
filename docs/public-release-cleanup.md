# Trust402 Public Release Cleanup

Created: 2026-05-21

Use this gate after the production freeze and before public launch. Trust402 was
made public on 2026-05-21 after the operator approved the visibility change and
the pre-public safety checks passed.

## Current Decision

- Do not rewrite, squash, or force-push `main` during active post-release work.
- Keep the public repository history intact unless the operator explicitly
  approves a later history rewrite.
- Treat `d3ae505` as the first public launch baseline.
- Treat `c2a6a84` as the first public post-launch daily-autonomy baseline.
- Preserve detailed live-spend evidence privately; publish only public-safe
  hashes, directory links, and high-level verification status unless the
  operator chooses an evidence-first release.

## Public Launch Evidence

- GitHub repository: `https://github.com/kfubtik/trust402`
- Visibility: `public`
- Public branch check: unauthenticated `git ls-remote` sees `main`
- Launch baseline commit: `d3ae50591323005867f955d7d4331a97757bb387`
- Daily-autonomy baseline commit: `c2a6a84c0e2b1c783fc93619462487242abd4256`
- Public release cleanup commit: `e7fdf1c8bac0c1ed6515eeb167147c717ba26d7e`
- Release tag: `v0.1.1`
- Production URL: `https://trust402.aztecbeacon.uk`
- Production runtime commit observed: `e7fdf1c8bac0c1ed6515eeb167147c717ba26d7e`
- Production smoke: passed
- Unpaid x402 smoke: passed
- CDP Bazaar: `10/10 all-indexed`
- External directory: x402scan visible at
  `https://www.x402scan.com/server/239600ba-27ae-44f1-92b0-8ea1c8fb8a14`
- Daily live autonomy: enabled through Vercel Cron with allowlisted paid origins
  and strict caps.
- GitHub random scheduler: intentionally inactive because no cron secret is
  stored in GitHub.

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

## Historical Cleanup Path

1. Run `npm run privacy:check` and `npm run release:check`.
2. Run the production checks from `docs/github-release-checklist.md`.
3. Resolve untracked release-scope files.
4. Create a reviewed clean public release branch or orphan commit.
5. Run the full verification suite against that clean release surface.
6. Push the clean branch and confirm GitHub Actions plus Vercel are green.
7. Change repository visibility to public only after explicit operator approval.

This path is now complete for the first public launch. Reuse it only for a later
clean-history relaunch.

## Do Not Publish

- `.env` or `.env.production.local`;
- `.local/` wallet binding files;
- CDP wallet secrets, API secrets, operator API keys, private keys, seed
  phrases, or payment headers;
- raw logs from live-spend windows;
- private browser/profile/account screenshots.
