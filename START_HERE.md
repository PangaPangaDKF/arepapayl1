# START HERE — any agent opening ArepaPay v2

ArepaPay v2 is a rebuild of ArepaPay as a permissioned Avalanche L1 (testnet) with KYC, encrypted balances and a bank-style back
office. Plan: `docs/PLAN.md`. What v1 really was: `docs/research/arepapay_ground_truth.md`.
Two Claude Code lanes work it in turns. **Pick one before you touch anything. If you are not sure which, ask the user.**

| If your task is… | You are | Load first | Start the session with |
|---|---|---|---|
| Contracts, L1 config, backend, app, tests, spikes, audits, subagents, **any deploy** | **BRAIN** | `master-method`, `arepapay-brain` | `claude --agent arepapay-brain` |
| Only the landing page (`landing/`, `scripts/landing-*.mjs`) | **LANDING** | `master-method`, `arepapay-landing-design` | `claude --agent arepapay-landing` |
| Anything else or ambiguous | Ask the user in one line | — | — |

## Then, in this order
1. `docs/AGENT_BOARD.md`: status, your tasks, D-numbers (reserve yours **before** you write it anywhere).
2. Your lane skill's `references/STATE.md`.
3. `git status --short && git log --oneline -8`. Files you don't own are dirty → the other lane is mid-task: don't touch them.
4. `CLAUDE.md` and the charter skill `arepapay-mission`.

## Laws every agent keeps
- **M0:** say what we think, which rule applies and why, then follow it.
- **N0 SPEND → GET** and the nerves N1–N7 (`arepapay-solidity`); **R1–R8** (`arepapay-mission`); **T1–T8** for anything public.
- Never handle keys or seeds; never reuse a v1 key (they are burned).
- Own-lane paths only, `git add <paths>` (never `-A`), reserve D-numbers first, only BRAIN deploys.
- Every verified change: `bash tests/check.sh` green → `docs/DECISIONS.md` entry → Conventional Commit.
- No caveman style.
