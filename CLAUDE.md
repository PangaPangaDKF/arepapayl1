# ArepaPay v2 — project memory for Claude Code

> New session? Read `START_HERE.md` first and pick a lane (BRAIN or LANDING) or ask the user.
> Keep this file accurate and short; update it in the same commit as any architecture change.

## 0. Session protocol
1. Load `master-method` (the user's method: M0, beliefs, rules with their why), then `arepapay-mission` (charter), then your lane skill.
2. One task per session. Plan mode for anything touching more than one area.
3. After every verified change: closeout (master-method §5.4): DECISIONS entry, docs/STATE, Conventional Commit of your paths.
4. If a prompt or skill could have prevented a mistake this session, improve it in the same commit.

## 1. What this is
ArepaPay v2: payments and banking for Venezuela on a permissioned Avalanche L1 (testnet). KYC gates access via the chain
allowlist; balances are encrypted (eERC, pending spike S2); a backend keeps a double-entry ledger and a back office; merchants
bridge cash bolívares and USDT. Status: **Phase 1 (rails)**. No product code yet.

## 2. Stack and constraints (change only with a D-entry)
- Contracts: Solidity + Foundry, OpenZeppelin v5 pinned, custom errors, events, SafeERC20 (`contracts/`).
- Chain: Avalanche L1 via avalanche-cli, Subnet-EVM, PoA ValidatorManager, precompiles txAllowList + contractDeployerAllowList +
  feeManager, native minter **off**. Chain params and addresses only in generated `config/` files.
- Backend: Node/TypeScript + Postgres (`backend/`). App: React PWA (`app/`), v1 design system. Landing: single-file HTML (`landing/`).
- EVM only: **never** generate Rust, Anchor, Solana or `@solana/web3.js` code.
- Secrets: never in the repo; deploy keys via Foundry encrypted keystore in the user's shell.

## 3. Layout
`docs/` (PLAN, AGENT_BOARD, HANDOFF_LOOP, DECISIONS, LESSONS, research/, audits/) · `config/` · `contracts/` · `backend/` · `app/`
· `landing/` · `scripts/` · `tests/check.sh` · `.claude/agents/` · `.claude/skills/`.

## 4. How to verify
`bash tests/check.sh` must print `ALL CHECKS PASSED`. Stages grow with the code: secret scan, rails present, landing truth (once
`landing/` exists), then forge tests, backend tests, drift guard.
