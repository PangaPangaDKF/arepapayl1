# ArepaPay v2 decisions (newest first) — why things are the way they are

Template: master-method TEMPLATES §1. Reserve the D-number on `docs/AGENT_BOARD.md` before writing it anywhere.

### D-006 · 2026-11-15 · Avalanche MCP + 16 avaxskills (Claude Opus 5.5, BRAIN lane)
- What: `.mcp.json` with `avalanche` (community, avalanche-mcp.dev, repo Eelvanpsd/Avalanche-mcp@a1ff0a0) and `avalanche-official` (Ava Labs hosted build.avax.network/api/mcp); 16 `avax-*` skills from avaxskills.com (precompiles, subnet-deployment, subnet-evm-config, validator-manager-contract, validator-management, safe-multisig, kyc-aml-integration, avalanche-sdk, upgradeable-contracts, avalanche-l1-economics, tmpnet, avacloud-indexing, event-driven-backend, account-abstraction, contract-verification, local-dev-environment).
- Why: user: "this is the mcp, the avalanche dev repo … and the skills".
- Tool: cloned and grepped the MCP source (no signing, no wallet client, no key handling; exec/fs writes only in the dev index builder; hosted mode proxies to Ava Labs' official MCP); fetched each skill and scanned for injected agent instructions (none; only official installer docs).
- Alternatives rejected: run the MCP locally from source — extra install of third-party code for no gain while it is read-only; the hosted endpoint sees our doc queries only (no secrets).
- Notes: skills load env-var private keys in examples; `arepapay-solidity` N6 (encrypted keystore) overrides. MCP servers appear in the next session (`/mcp` to verify).
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: e35c379.

### D-005 · 2026-11-15 · Architecture: encrypted consortium chain (Claude Opus 5.5, BRAIN lane)
- What: `docs/ARCHITECTURE.md`; PLAN v1.1 (spikes S1–S5, Q1/Q3/Q4 resolved, Q8–Q11 added); charter v1.1 (role line, R9 never bridged, R10 split oversight, scope).
- Why: user: "i want it with sdk encrypted chain … a multisig system for data cooperation because banks need privacy and customers too, they can freeze funds and watch who has your money if you get hacked … you can't track trxs like in a normal evm … centralized privacy … a centralized banking chain for micro and small business … banks will be the ramps … it always will be a private chain for merchants".
- Tool: eERC source read (`EncryptedERC.sol`: amounts/balances encrypted, from/to public, single owner-set auditor, owner-only mint, token-level blacklist); market research subagent (`docs/research/market_landscape.md`), key claims re-checked by BRAIN (OFAC GL 57, Drex shutdown, Kontigo bank ramps).
- Alternatives rejected: see ARCHITECTURE §3 (public chain + eERC; signed ledger first — kept as fallback; Canton/Besu; single auditor key; clawback power).
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED (docs only).
- Open (needs the user): Q8–Q11, pilot partners (one bank, one distributor).
- Commit: this commit.

### D-004 · 2026-11-15 · Landing launch stack = Next.js static export; load vercel-react-best-practices (Claude Opus 4.8, LANDING lane)
- What: the launch landing is built as a Next.js (App Router) app with static export (`output: 'export'`) in `landing/`,
  superseding the single-file/no-framework practice (`arepapay-landing-design` §4). Added `vercel-react-best-practices` to the
  `arepapay-landing` agent's skills. Stopped the idle duplicate landing terminal `t1b` (turn 0) to avoid a two-agent collision (C1).
- Why: user (2026-11-15): "i will buy a domain and we will use it to launch the project, follow the best practices for a front end
  dev"; chose Next.js; "add the skills that we already have and used and built to this new session". Static export gives
  first-class SEO/OpenGraph/Twitter-card and image optimization for a public launch while still emitting plain HTML the gates probe.
- Tool: master-method (S2 recommendation, M0), `vercel-react-best-practices`; Next `output: 'export'`.
- Alternatives rejected: single-file HTML (board L2) — lighter but weaker SEO/OG/social and image handling for a real launch;
  plain React/Vite (the app's stack) — no first-class metadata/OG or static export.
- Verify: pending — landing not built yet. `bash tests/check.sh` → ALL CHECKS PASSED after this doc/skill change (no code touched).
- Open (needs the user): brand logo + exact palette (from their X account) + X link; domain; footer contact channel. Deploy
  target is BRAIN's call — flagged as board task B4.
- Commit: this commit.

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
