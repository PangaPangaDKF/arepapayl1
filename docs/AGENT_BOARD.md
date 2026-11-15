# ArepaPay v2 agent board (mailbox for BRAIN and LANDING; append-only per lane)

## Status
2026-11-14 · Phase 1 rails committed by BRAIN. LANDING starts now on L1–L3 (landing v0). BRAIN waits on the user for Q1 (custody)
and U1–U3 (security), then runs spikes S1–S4. Nothing is deployed.
2026-11-15 · LANDING took the lane. Launch stack set to Next.js static export (D-004); `vercel-react-best-practices` loaded.
L1–L3 now target that stack. LANDING blocked on the user for brand (logo+palette from X), domain and contact before the visual
build. BRAIN: please confirm the deploy target (B4).

## Tasks for BRAIN
- [x] B1 · (done D-006) Fetch and read L1 skills from avaxskills.com (subnet-deployment, subnet-evm-config, precompiles, validator-manager-contract, kyc-aml-integration, safe-multisig, upgradeable-contracts); install the useful ones into `.claude/skills/`, record sources in `skills-lock.json`.
- [ ] B2 · Spike S1 private permissioned L1 on local tmpnet · PLAN Phase 2, ARCHITECTURE L1.
- [ ] B3 · Spike S2 eERC standalone + IssuerGateway on the S1 chain; measure proof time on a low-end Android · ARCHITECTURE L2.
- [ ] B5 · Spikes S3 (Audit Council view key), S4 (Freeze Council), S5 (bank KYB onboarding) · ARCHITECTURE L3–L4.
- [ ] B4 · Review LANDING's v0 against T1–T8 and decide the deploy target. Note (D-004): the stack is now a Next.js static export
  (`landing/out/`), so the target is a static host (Vercel static / `out/`). Confirm.

## Tasks for LANDING
> Copy update (D-005): truth sources now include `docs/ARCHITECTURE.md`. Key truths: merchants are the main customers; banks are the only ramps; the chain is private and never bridged; balances use eERC, which hides **amounts and balances, not who pays whom** (say so honestly); oversight is split between two multisig councils; everything is In development / Planned.
> Stack note (D-004): L1–L2 build on a Next.js App Router static export in `landing/`; the gates probe the exported
> `landing/out/**.html`. Blocked on the user for brand + domain before the L2 visual build.
- [ ] L1 · Write the gates. Files: `scripts/landing-check.mjs` (zero deps, rules in `arepapay-landing-design` §5) and `scripts/landing-probe.mjs` (390/360 px iframe overflow probe and `--shot '#id' --out <png>` at 1280 px; reference implementations at `/mnt/c/Users/dulbi/dogeon/scripts/landing-check.mjs` and `landing-probe.mjs`, read-only). Prove `landing-check.mjs` fails once on purpose (plant an emoji and a forbidden word in a temp copy) before trusting it. Verify: both scripts exit 0 on the finished page.
- [ ] L2 · Build `landing/index.html` v0: Spanish first, single file, design tokens and sections exactly as in `arepapay-landing-design` §3 and `references/STATE.md` §2. Every feature section carries a status label (T6). Disclaimer in hero and footer (T7). No contacts, addresses, numbers, screenshots or partner logos (T2–T4, T8). CTAs are in-page anchors only. Truth sources: `docs/PLAN.md`, `.claude/skills/arepapay-mission/SKILL.md`, `docs/research/arepapay_ground_truth.md` §2 and §4. Verify: the 3 gates green and one 1280 px render of hero + one section read by you.
- [ ] L3 · Close out with RULE L0 (reserve your D-number below first), report under `## Log` and in `docs/HANDOFF_LOOP.md`, list under "Needs the user" what the page needs from them (contact channel, domain), and request B4.

## D-numbers
| D | Lane | Title | Status |
|---|---|---|---|
| D-001 | BRAIN | Direction: permissioned L1 + KYC + encrypted + bank; rebuild | done |
| D-002 | BRAIN | Rails, master-method, gate | done |
| D-003 | BRAIN | LANDING lane skill and agent | done |
| D-004 | LANDING | Launch stack = Next.js static export; load vercel-react-best-practices | done |
| D-005 | BRAIN | Architecture: encrypted consortium chain (eERC + private RPC + multisig audit/freeze) | done |
| D-006 | BRAIN | Avalanche MCP + 16 avaxskills installed | done |
| D-007+ | | | Next free: reserve here first |

## Log
- 2026-11-15 · BRAIN · D-005 architecture (encrypted consortium chain) + D-006 MCP/skills; market research in `docs/research/market_landscape.md`; PLAN v1.1, charter v1.1. `bash tests/check.sh` → ALL CHECKS PASSED.
- 2026-11-14 · BRAIN · rails committed (D-001..D-003); `bash tests/check.sh` → ALL CHECKS PASSED; LANDING tasks L1–L3 opened.
- 2026-11-14 · BRAIN · LANDING launched in herdr terminal `arepapay-landing` via `scripts/start-landing.sh` (login shell: the hc core PATH lacks nvm); it waits on the user's one-time folder-trust confirmation (`hc attach arepapay-landing`).
- 2026-11-15 · LANDING · took the lane (D-004): launch stack = Next.js static export; loaded `vercel-react-best-practices` into the agent; stopped idle duplicate terminal `t1b`; updated skill v1.1, STATE, CHANGELOG, DECISIONS, handoff. `bash tests/check.sh` → ALL CHECKS PASSED. Blocked on the user (brand+domain+contact). Note for BRAIN: when L2 ships, repoint the check.sh "landing gates" step from `landing/index.html` to `landing/out/` (B4).
