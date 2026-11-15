# ArepaPay v2 agent board (mailbox for BRAIN and LANDING; append-only per lane)

## Status
2026-11-14 · Phase 1 rails committed by BRAIN. LANDING starts now on L1–L3 (landing v0). BRAIN waits on the user for Q1 (custody)
and U1–U3 (security), then runs spikes S1–S4. Nothing is deployed.
2026-11-15 · LANDING took the lane. Launch stack set to Next.js static export (D-004); `vercel-react-best-practices` loaded.
2026-11-15 · LANDING shipped the v0 (D-013): built in `landing/`, all 3 gates green, renders read. User gave domain
`arepapay.site` and X `@ArepaPay` — LANDING no longer blocked. BRAIN: confirm deploy target (B4) and repoint the check.sh
landing step (see Log). Not deployed yet (BRAIN owns deploy, C9).

## Tasks for BRAIN
- [x] B1 · (done D-006) Fetch and read L1 skills from avaxskills.com (subnet-deployment, subnet-evm-config, precompiles, validator-manager-contract, kyc-aml-integration, safe-multisig, upgradeable-contracts); install the useful ones into `.claude/skills/`, record sources in `skills-lock.json`.
- [x] B2 · (done D-008, 15/15) Spike S1 private permissioned L1 on local tmpnet · PLAN Phase 2, ARCHITECTURE L1.
- [x] B3 · (done D-012; phone measurement pending the user) Spike S2 eERC standalone + IssuerGateway on the S1 chain; measure proof time on a low-end Android · ARCHITECTURE L2.
- [ ] B6 · Spike S6 bank-run ICTT bridge (Fuji USDC → L1) with supply invariant · ARCHITECTURE L2.
- [ ] B5 · Spikes S3 (Audit Council view key), S4 (Freeze Council), S5 (bank KYB onboarding) · ARCHITECTURE L3–L4.
- [ ] B4 · Review LANDING's v0 against T1–T8 and decide the deploy target. Note (D-004): the stack is now a Next.js static export
  (`landing/out/`), so the target is a static host (Vercel static / `out/`). Confirm.

## Tasks for LANDING
> Copy update (D-007 supersedes D-005 where they differ): the bank runs the chain, its validators and **one bridge** for real USDT/USDC; merchants deposit their own collateral (self-custody); **KYC is mandatory for everyone**; liquidity is provable on C-Chain. Older note (D-005): truth sources now include `docs/ARCHITECTURE.md`. Key truths: merchants are the main customers; banks are the only ramps; the chain is private and never bridged; balances use eERC, which hides **amounts and balances, not who pays whom** (say so honestly); oversight is split between two multisig councils; everything is In development / Planned.
> Stack note (D-004): L1–L2 build on a Next.js App Router static export in `landing/`; the gates probe the exported
> `landing/out/**.html`. Blocked on the user for brand + domain before the L2 visual build.
- [x] L1 · (done D-013) Gates written: `scripts/landing-check.mjs` (zero deps, parses `config/`, enforces §5 over `landing/out/**.html`) and `scripts/landing-probe.mjs` (390/360 px iframe overflow + `--shot`). Proven to fail once on purpose (emoji + forbidden words + unlabeled feature → exit 1, V9).
- [x] L2 · (done D-013) Built as a **Next.js static export** (D-004 superseded the single-file plan): Spanish-first v0 in `landing/`, §3 tokens, every section from STATE §2, status labels (T6), disclaimer in hero + footer (T7), CTAs are in-page anchors, X `@ArepaPay` in footer. No addresses/numbers/screenshots/partner logos. 3 gates green; hero + "cómo funciona" 1280 px renders read.
- [x] L3 · (done D-013) Closed out: DECISIONS D-013, STATE/CHANGELOG/RUNBOOK/SKILL (v1.3), HANDOFF turn 2, committed landing-lane paths. See "Needs the user" and the BRAIN note below.

## D-numbers
| D | Lane | Title | Status |
|---|---|---|---|
| D-001 | BRAIN | Direction: permissioned L1 + KYC + encrypted + bank; rebuild | done |
| D-002 | BRAIN | Rails, master-method, gate | done |
| D-003 | BRAIN | LANDING lane skill and agent | done |
| D-004 | LANDING | Launch stack = Next.js static export; load vercel-react-best-practices | done |
| D-005 | BRAIN | Architecture: encrypted consortium chain (eERC + private RPC + multisig audit/freeze) | done |
| D-006 | BRAIN | Avalanche MCP + 16 avaxskills installed | done |
| D-007 | BRAIN | User correction: bank-run bridge + real USDT/USDC collateral, mandatory KYC, real IRL pilot | done |
| D-008 | BRAIN | Spike S1: bank's private L1 on local network | done |
| D-009 | BRAIN | Split-payment QR feature (multi-payer intent) design + prompt | done |
| D-010 | BRAIN | Split Pay option A: SplitPayEscrow contract + tests | done |
| D-011 | BRAIN | Split Pay option C: eERC knowledge skill + bank-escrow algorithm spec | done |
| D-012 | BRAIN | Spike S2: eERC converter on chain 77077 + Safe-as-account check | done |
| D-013 | LANDING | Landing v0: Next.js static-export scaffold + gates + Spanish v0 page | done |
| D-014 | BRAIN | Merchants as exchange houses + FX coordination ledger; raffles/WiFi removed; minimal payments app tested in MetaMask mobile browser | reserved |
| D-015 | BRAIN | check.sh landing stage → static export build + gates | reserved |
| D-016+ | | | Next free: reserve here first |

## Log
- 2026-11-15 · LANDING · D-013 landing v0 shipped: Next.js static export in `landing/`, gates `scripts/landing-{check,probe}.mjs` green (truth gate 0 problems, V9 negative test → exit 1, overflow 390/360 px clean), hero + cómo-funciona 1280 px renders read. `bash tests/check.sh` → ALL CHECKS PASSED. **BRAIN, two asks:** (1) repoint the check.sh landing step from `landing/index.html` to `npm --prefix landing ci && npm --prefix landing run build && node scripts/landing-check.mjs && node scripts/landing-probe.mjs`; (2) B4 — deploy target is a static host serving `landing/out/` (domain `arepapay.site`). Committed landing-lane paths only; not pushed (C9).
- 2026-11-15 · BRAIN · NOTE for LANDING: my commit eb1318d swept your uncommitted board line reserving D-013 (landing v0). Content unchanged, nothing reverted; your reservation is now committed. Sorry; L-005 added.
- 2026-11-15 · BRAIN · S2 done (D-012): eERC converter works on chain 77077; desktop transfer proof 4.4–7.6 s; phone measurement needed from the user; skill v1.1 corrections, L-004.
- 2026-11-15 · BRAIN · D-010 Split Pay A: 34 tests green, audit 0 crit/0 high/3 med fixed/2 low fixed/1 low accepted; S2 (D-012) running.
- 2026-11-15 · BRAIN · S1 done (D-008): local L1 chain 77077, `scripts/l1/s1-verify.sh` 15/15 PASS; Split Pay C spec + eERC skill (D-011); Split Pay A contract written, 28 tests green, independent audit running (D-010).
- 2026-11-15 · BRAIN · D-009 Split Pay design + prompt (docs/features/SPLIT_PAY.md, prompts/SPLIT_PAY_PROMPT.md); spike S1 (D-008) running.
- 2026-11-15 · BRAIN · D-007 user correction applied: ARCHITECTURE v1.1, charter v1.2, PLAN v1.2, L-003, master-method S8. `bash tests/check.sh` → ALL CHECKS PASSED.
- 2026-11-15 · BRAIN · D-005 architecture (encrypted consortium chain) + D-006 MCP/skills; market research in `docs/research/market_landscape.md`; PLAN v1.1, charter v1.1. `bash tests/check.sh` → ALL CHECKS PASSED.
- 2026-11-14 · BRAIN · rails committed (D-001..D-003); `bash tests/check.sh` → ALL CHECKS PASSED; LANDING tasks L1–L3 opened.
- 2026-11-14 · BRAIN · LANDING launched in herdr terminal `arepapay-landing` via `scripts/start-landing.sh` (login shell: the hc core PATH lacks nvm); it waits on the user's one-time folder-trust confirmation (`hc attach arepapay-landing`).
- 2026-11-15 · LANDING · took the lane (D-004): launch stack = Next.js static export; loaded `vercel-react-best-practices` into the agent; stopped idle duplicate terminal `t1b`; updated skill v1.1, STATE, CHANGELOG, DECISIONS, handoff. `bash tests/check.sh` → ALL CHECKS PASSED. Blocked on the user (brand+domain+contact). Note for BRAIN: when L2 ships, repoint the check.sh "landing gates" step from `landing/index.html` to `landing/out/` (B4).
