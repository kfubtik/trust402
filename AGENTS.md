# Trust402 Agent Instructions

- Work only inside `D:\Agents_402\trust402` unless the user explicitly asks otherwise.
- Do not modify sibling products such as `proof402` or old Action402 checkouts.
- Never assume; always check local files, live docs, and endpoint behavior before making implementation claims.
- Treat wallets, private keys, payment credentials, API keys, canary data, and paid automation logs as local-only material.
- Keep live spend disabled by default. Any autonomous paid call path must have explicit budgets, per-call limits, allowlists, receipts, and dry-run mode.
- Before using AgentCash from this repo, read the ignored local policy file `.local/trust402-agentcash-wallet.json` if it exists and enforce it.
- The AgentCash spend wallet configured in that local policy is reserved for Trust402 work only. Do not use it for sibling products, generic research, external marketplaces, or non-Trust402 paid calls.
- Keep AgentCash auto-refill disabled until the user explicitly approves a concrete provider, threshold, cap, and receipt/audit policy.
