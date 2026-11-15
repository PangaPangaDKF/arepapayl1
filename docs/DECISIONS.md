# ArepaPay v2 decisions (newest first) — why things are the way they are

Template: master-method TEMPLATES §1. Reserve the D-number on `docs/AGENT_BOARD.md` before writing it anywhere.

### D-003 · 2026-11-14 · LANDING lane skill and agent (Claude Opus 5.5, BRAIN lane)
- What: `.claude/skills/arepapay-landing-design/` (SKILL + STATE/RUNBOOK/CHANGELOG), `.claude/agents/arepapay-landing.md`.
- Why: user: "you have the control of the other agent and that agent will be on charge of make the landing page like we did on dogeon".
- Tool: adapted DOGEON `dogeon-landing-design` 2.1; truth rules rewritten for a regulated fintech (T6 status labels, T7 disclaimer, T8 no invented contacts).
- Alternatives rejected: BRAIN builds the landing itself — loses the independent truth reviewer and costs BRAIN tokens; reuse the DeepSeek landing — broken JSX, false claims, fake contacts.
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-002 · 2026-11-14 · Rails: two-lane method, charter, money nerves, gate (Claude Opus 5.5, BRAIN lane)
- What: repo `arepapay-v2`, START_HERE, CLAUDE/AGENTS, PLAN, board/handoff/decisions/lessons, skills `arepapay-{mission,brain,agent-sync,solidity}`, `tests/check.sh` (secret scan, rails, landing, forge), caveman plugin disabled in project settings, 20 third-party skills copied (list in `skills-lock.json`). User-level skill `master-method` created with the full method and its whys.
- Why: user: "get the knowledge of the skills used on dogeon … extract what is worth to copy and apply to this new project"; "those master skills and prompts are mine … a file explaining every single style and decision and why … always repeat what we think and why"; "don't use caveman".
- Tool: two research subagents (ArepaPay ground truth, DOGEON method), claims re-verified by BRAIN; DOGEON skills as templates.
- Alternatives rejected: continue in an old ArepaPay folder — 12 diverging copies, burned keys in history; copy all 50+ installed skills — game/Solana/caveman skills conflict with the charter.
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED; secret scan made to fail once on a planted key (V9).
- Commit: this commit.

### D-001 · 2026-11-14 · Direction: permissioned L1 + KYC + encrypted balances + bank-style management; rebuild, not migrate (user decision, recorded by BRAIN)
- What: ArepaPay v2 targets a permissioned Avalanche L1 on testnet with KYC-gated access, encrypted balances and a bank-style back office.
- Why: user: "he change from fuji testnet to a testnet l1 and also it is now a centralize dapp and a encrypted one with full bank manage and with kyc". Ground truth (`docs/research/arepapay_ground_truth.md` §4) showed those features were claims, not code, so v2 builds them for real.
- Alternatives rejected: keep v1's "no KYC, self-custody" pitch — contradicts the user's stated direction; patch v1 code — contracts lack fees and have money bugs, owner key is public.
- Open (needs the user): Q1–Q7 in `docs/PLAN.md` §2.
- Commit: this commit.
