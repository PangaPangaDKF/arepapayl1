# ArepaPay v2 — session context & main-brain handoff

Updated 2026-11-15 (D-017). **Read this first, then `START_HERE.md`, then `docs/AGENT_BOARD.md`.**

## 0. Your role this session (user directive, 2026-11-15)
You are the **main brain**: the primary decision-maker that **drives the build loop** end to end. The user's words:
*"you will be part of the main brain to take decisions for the loop."*

- Own the decisions and the cadence. Read the board, pick what moves a mission priority next, decide, build, verify, close out, repeat.
- The **BRAIN / LANDING lane split stays** as a way to organize work and keep an independent truth-check on public copy — but you
  are not waiting for another lane to tell you what to do. You set the direction.
- Being the main brain means **more judgment, not fewer rules.** Every law in §6 still holds. You never handle keys (N6), you
  never deploy before the gates are green (C9), and the user still owns money, DNS, secrets and the real-world pilot.
- Carry forward what the LANDING lane already learned and built (§4). The landing is done to v0; don't rediscover it.

## 1. What ArepaPay v2 is
Payments and banking for Venezuela on **its own permissioned Avalanche L1 (testnet)**. The **bank** runs the validators and the
**one** bridge to real USDT/USDC on C-Chain. **Merchants are the main customers and also the exchange houses**: they provide
liquidity and sell USDT/USDC to customers at the bank's official band rate; every sale is recorded in an FX ledger; reselling or
black-market exchange is forbidden (R12, D-014). Balances/transfers are **encrypted with eERC** — this hides *amounts and
balances, not who pays whom*; say so honestly. **KYC is mandatory for everyone.** A bank-style back office runs accounts, ledger,
limits and audit. It is **a light payments app and nothing more** (D-014) — raffles and WiFi vouchers were removed. Real money
only in a late **staged pilot** with caps (R1). Charter: `arepapay-mission`. Architecture: `docs/ARCHITECTURE.md`. Plan: `docs/PLAN.md`.

## 2. How to run the loop (every session)
1. Load `master-method`, then `arepapay-mission` (charter), then the skill for the area you touch (`arepapay-solidity`,
   `arepapay-eerc`, `arepapay-landing-design`, …).
2. Read `docs/AGENT_BOARD.md` (status, tasks, D-numbers — **reserve yours before writing it anywhere**), `docs/HANDOFF_LOOP.md`
   (newest entries) and this file.
3. `git status --short && git log --oneline -8`. A file you didn't change showing dirty = another terminal is mid-task; don't touch it.
4. **M0 before any non-trivial decision:** write belief + rule-ID + why, then act.
5. One coherent change → **verify** (`bash tests/check.sh` green, quote the output) → `docs/DECISIONS.md` entry (What/Why/Tool/
   Alternatives/Verify/Commit) → **Conventional Commit of your paths only** (never `git add -A`/stash/reset) → board `## Log` +
   `HANDOFF_LOOP` entry → bump the skill version + CHANGELOG with the lesson. If a prompt/skill could have prevented a mistake, fix it in the same commit.
6. Deploys and pushes stay gated (C9): only after gates are green. The user controls DNS, secrets and keys; you leave key/wallet
   steps as instructions under "Needs the user" (N6).

## 3. Current state (2026-11-15, HEAD ≈ `fa57b5a`)
- Phase 1 → 2. Nothing is deployed. No real money anywhere.
- Done: rails + method (D-002); architecture, encrypted consortium chain (D-005) + user correction to bank-run bridge / real
  collateral / mandatory KYC (D-007); Avalanche MCP + 16 avaxskills (D-006); **S1** private L1 on a local network (D-008);
  **Split Pay** option A contract + audit (D-010) and option C spec + eERC skill (D-011); **S2** eERC converter on chain 77077
  (D-012); **merchant-FX** model + R12 (D-014); `check.sh` now builds the landing and runs its gates (D-015); **stage-B Fuji**
  runbook for a public HTTPS RPC (D-016).
- **Landing v0 built and committed (D-013).** Domain **arepapay.site**, X **@ArepaPay**. Not deployed.

## 4. Landing knowledge (folded in from the LANDING lane)
- **Stack:** Next.js App Router **static export** in `landing/`. Build: `npm --prefix landing run build` → `landing/out/`. Source:
  `app/{layout,page,ui}.js`, `app/globals.css` (design tokens §3 of `arepapay-landing-design`), brand in `public/brand/`.
- **Gates (run after every build):** `node scripts/landing-check.mjs` (truth) and `node scripts/landing-probe.mjs` (390/360 px
  overflow; `--shot '#id' --out x.png --width 1280` for a screenshot). `--file <path>` runs the V9 negative test.
- **Preview — serve the export, not `next dev`.** `next dev` and `next build` share `landing/.next`; because `check.sh` now builds
  the landing (D-015), a concurrent build corrupts the dev cache and dev crashes with `Cannot find module './NNN.js'`. Serve the
  finished files instead:
  ```bash
  python3 -m http.server 3000 --bind 127.0.0.1 --directory /mnt/c/Users/dulbi/arepapay-v2/landing/out
  ```
- **Truth rules T1–T8** live in `arepapay-landing-design`. All landing copy is In development / Planned, future tense; disclaimer
  in hero + footer; a status label on every feature; no fake data/UI/contacts; chain addresses only from `config/`. The gate
  strips Next's inline RSC payload before text checks (it duplicates the page text). `tests/check.sh` builds + probes `landing/out/`.
- **Pending landing work:** **L4** (from D-014) — remove the raffles/WiFi "Recompensas" card, add a short **"Comercios como casas
  de cambio"** section (status Planeado: every sale recorded, official band rate, no resale). Then pre-launch polish: a cleaned
  **transparent logo** + crisp wordmark + a real **1200×630 OG** image + `favicon.ico` (today the icon/OG use the watermarked PNG).

## 5. Decision queue (chew these next; prioritize with the user)
**Security — surface to the user, do NOT do yourself (N6), still open from BRAIN turn 1:**
- U1 make the public `arepaAgent` GitHub repo private · U2 revoke the GitHub token in `/home/panga/arepapay-clean/.git/config` ·
  U3 move any funds off every v1 key (the v1 deployer key is public and burned).

**Build / product:**
- **B4** review the landing vs T1–T8 and pick the deploy target (static host serving `landing/out/`), then deploy to
  arepapay.site (needs DNS from the user).
- **L4** apply D-014 to the landing copy (above).
- **B7** `FxLedger` test-first + reconciliation simulator (`docs/features/MERCHANT_FX.md`).
- **B6** spike S6 bank-run ICTT bridge (Fuji USDC → L1) with the supply invariant.
- **B5** spikes S3 (Audit Council view key), S4 (Freeze Council), S5 (bank KYB onboarding).
- **B8** MetaMask-mobile test dApp — after Q18.

**Open questions for the user:** Q16, Q17, Q18 (public test network: Fuji L1 vs a tunnel), pilot partners (one bank, one
distributor). Phone proof-time is no longer blocking (user accepts slow proofs).

## 6. Laws you never break
M0 (say what we think + the rule + why) · N0 SPEND→GET and nerves N1–N7 · charter R1–R12 · public-truth T1–T8 · never handle
keys or seeds, never reuse a v1 key · own-lane paths only, reserve the D-number first, never `git add -A`/stash/reset, only
deploy after the gates are green · no caveman style · never claim done without quoted proof.
