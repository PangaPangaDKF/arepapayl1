---
name: arepapay-landing-design
description: Handoff skill for ArepaPay v2's landing page (landing/index.html) and its check scripts. Load at the start of any landing session, or before designing, reviewing, writing copy for, or changing anything in landing/. Holds the session protocol, the LANDING lane, truth rules T1–T8 adapted for a regulated fintech, the design system, the gates, and references/ with live state, runbook and changelog. Must be updated in the same commit as every landing change.
---

# ArepaPay landing skill

Version 1.0 · 2026-11-14 · D-003 · Lane: LANDING · Agent: `.claude/agents/arepapay-landing.md` · Seeded from DOGEON
`dogeon-landing-design` 2.1 and master-method §4.6/§6.4.

## 0. Start here (every session)
1. Read `references/STATE.md` (page map, verified facts, open tasks). Don't re-derive what it lists.
2. Read the newest board and handoff entries; `git status --short && git log --oneline -8`.
3. Pick the task: board LANDING tasks first, then STATE §4.
4. Before writing any claim, check it against code/config/D-entries (T1). Apply M0.
5. Pass the gates (§5), close out (RULE L0), commit only your paths, report, ask BRAIN to deploy.

## RULE L0: keep the handoff current
Every landing change ends, in the same commit, with: version bump here + top entry in `references/CHANGELOG.md` (with a Lesson line),
`references/STATE.md` updated, a `docs/DECISIONS.md` entry with a D-number reserved on the board first. If something went wrong,
add the rule that would have prevented it.

## 1. Role and lane
The landing has one job: **make a Venezuelan merchant or user understand what ArepaPay will do for them, trust that what is live is
real and what is planned is labeled, and know the next step.** LANDING owns `landing/` (including `landing/assets/`),
`scripts/landing-*.mjs`, this skill and `.claude/agents/arepapay-landing.md`. Everything else is BRAIN's.

## 2. Truth rules (a claim with no source gets deleted)
- **T1** Every claim maps to code, `config/`, `docs/PLAN.md` or a D-entry. Grep before publishing.
- **T2** No fake live data: no balances, user counts, TVL, volumes, "X merchants".
- **T3** Product images are real captures (BRAIN delivers them); until then, use no product screenshots. Illustrations must be
  original and simple, never fake app UI.
- **T4** Chain params and addresses only from `config/` files; while `config/` has none, the page shows none.
- **T5** Links work today. No link to a v1 deployment unless BRAIN verified it live and labeled it "v1 (Fuji, 2026-03)".
- **T6** Status labels on every feature: **Live / Testnet / In development / Planned**. v2 has no live features yet (2026-11-14):
  KYC, encrypted balances, the permissioned L1, the back office and OTC are **In development** or **Planned** per `docs/PLAN.md`.
  Never present tense for anything not live.
- **T7** No yield, interest, price or return promise. Disclaimer in hero and footer: "Testnet. No real money. Not financial advice."
  (Spanish: "Red de pruebas. Sin dinero real. No es asesoría financiera.")
- **T8** No invented contacts, phone numbers, emails, partners, testimonials, hackathon wins or logos. A contact appears only when the
  user provides it (board task for the user via BRAIN).

## 3. Design system (from v1 `DESIGN_SYSTEM.md`, read-only reference at `/mnt/c/Users/dulbi/arepapay-clean/DESIGN_SYSTEM.md`)
"Pixel RPG venezolano", light theme. Tokens on `:root`: `--cream #FFF8E0` (page), `--card #FFFFFF`, `--navy #1A2472` (brand,
dominant), `--navy-dark #0D1040`, `--navy-deeper #111855`, `--brown-dark #2C1A0E`, `--brown-mid #5A4A30`, `--brown-light #8A6A40`,
`--gold #D4B87A`, `--gold-border #C89038`, `--amber #D4921C` (Bs↔USDT accents), `--red #CC1111`, `--red-dark #770000`,
`--blue-info #4A9EFF`. Type: Inter (900 for headlines, uppercase with letter-spacing; 400–600 body), monospace for hashes.
Components: pill buttons (radius 24, 3 px border, `0 5px 0` hard shadow, press translateY(3px)); cards (4 px gold border, radius
12–16, `6px 6px 0 #C89038` offset shadow). Add a dark theme only if the user asks.
Language: **Spanish first**; English toggle optional later.

## 4. Design practices (keep it from looking machine-made)
Real content from the product's world (bodegas, panaderías, Bs amounts, cash ↔ USDT), one bold idea, everything else quiet.
Avoid AI tells: emoji icons, fake dashboards, gradient blobs, decorative numbering, centering everything, identical card chrome,
hype words without a fact, em-dash asides, "not X but Y". Copy plain, specific, active. Grids `minmax(min(Npx,100%),1fr)`; wide
tables in a scroll wrapper; alt text; visible focus; `prefers-reduced-motion`. Single HTML file, inline CSS, no framework; Google
Fonts only; at most one small inline script.

## 5. Gates (all must pass before a commit)
```bash
node scripts/landing-check.mjs      # truth/design gate (LANDING writes and maintains it)
node scripts/landing-probe.mjs      # true 390/360 px overflow probe
bash tests/check.sh                 # project suite
```
`landing-check.mjs` must fail on: an address or chain id not present in `config/`, external hosts outside an allow-list
(fonts.googleapis.com, fonts.gstatic.com), missing assets, emoji, a feature section without a status label, forbidden words
(`garantizado`, `guaranteed`, `rendimiento`, `APY`, `interés`, `gana dinero`, `earn`), and the missing disclaimer in hero or footer.
Make it fail once on purpose before trusting it (V9). Also view a 1280 px render of what you changed.

## 6. References
`references/STATE.md` (every session) · `references/RUNBOOK.md` (recipes) · `references/CHANGELOG.md` (lessons).
