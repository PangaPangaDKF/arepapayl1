# ArepaPay v2 agent board (mailbox for BRAIN and LANDING; append-only per lane)

## Status
2026-11-14 · Phase 1 rails committed by BRAIN. LANDING starts now on L1–L3 (landing v0). BRAIN waits on the user for Q1 (custody)
and U1–U3 (security), then runs spikes S1–S4. Nothing is deployed.

## Tasks for BRAIN
- [ ] B1 · Fetch and read L1 skills from avaxskills.com (subnet-deployment, subnet-evm-config, precompiles, validator-manager-contract, kyc-aml-integration, safe-multisig, upgradeable-contracts); install the useful ones into `.claude/skills/`, record sources in `skills-lock.json`.
- [ ] B2 · Spike S1 permissioned L1 (local), after Q1/Q2 · PLAN §1 Phase 2.
- [ ] B3 · Spike S2 eERC on local L1 · PLAN §1 Phase 2.
- [ ] B4 · Review LANDING's v0 against T1–T8 and decide the deploy target.

## Tasks for LANDING
- [ ] L1 · Write the gates. Files: `scripts/landing-check.mjs` (zero deps, rules in `arepapay-landing-design` §5) and `scripts/landing-probe.mjs` (390/360 px iframe overflow probe and `--shot '#id' --out <png>` at 1280 px; reference implementations at `/mnt/c/Users/dulbi/dogeon/scripts/landing-check.mjs` and `landing-probe.mjs`, read-only). Prove `landing-check.mjs` fails once on purpose (plant an emoji and a forbidden word in a temp copy) before trusting it. Verify: both scripts exit 0 on the finished page.
- [ ] L2 · Build `landing/index.html` v0: Spanish first, single file, design tokens and sections exactly as in `arepapay-landing-design` §3 and `references/STATE.md` §2. Every feature section carries a status label (T6). Disclaimer in hero and footer (T7). No contacts, addresses, numbers, screenshots or partner logos (T2–T4, T8). CTAs are in-page anchors only. Truth sources: `docs/PLAN.md`, `.claude/skills/arepapay-mission/SKILL.md`, `docs/research/arepapay_ground_truth.md` §2 and §4. Verify: the 3 gates green and one 1280 px render of hero + one section read by you.
- [ ] L3 · Close out with RULE L0 (reserve your D-number below first), report under `## Log` and in `docs/HANDOFF_LOOP.md`, list under "Needs the user" what the page needs from them (contact channel, domain), and request B4.

## D-numbers
| D | Lane | Title | Status |
|---|---|---|---|
| D-001 | BRAIN | Direction: permissioned L1 + KYC + encrypted + bank; rebuild | done |
| D-002 | BRAIN | Rails, master-method, gate | done |
| D-003 | BRAIN | LANDING lane skill and agent | done |
| D-004+ | | | Next free: reserve here first |

## Log
- 2026-11-14 · BRAIN · rails committed (D-001..D-003); `bash tests/check.sh` → ALL CHECKS PASSED; LANDING tasks L1–L3 opened.
- 2026-11-14 · BRAIN · LANDING launched in herdr terminal `arepapay-landing` via `scripts/start-landing.sh` (login shell: the hc core PATH lacks nvm); it waits on the user's one-time folder-trust confirmation (`hc attach arepapay-landing`).
