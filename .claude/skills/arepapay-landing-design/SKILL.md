---
name: arepapay-landing-design
description: Handoff skill for ArepaPay v2's landing page (landing/index.html) and its check scripts. Load at the start of any landing session, or before designing, reviewing, writing copy for, or changing anything in landing/. Holds the session protocol, the LANDING lane, truth rules T1–T8 adapted for a regulated fintech, the design system, the gates, and references/ with live state, runbook and changelog. Must be updated in the same commit as every landing change.
---

# ArepaPay landing skill

Version 1.5 · 2026-11-15 · D-024 (was 1.4, D-017) · Lane: LANDING · Agent: `.claude/agents/arepapay-landing.md` · Seeded from
DOGEON `dogeon-landing-design` 2.1 and master-method §4.6/§6.4. v0 built; gates `scripts/landing-{check,probe}.mjs` implemented and
green; see §7 for the static-export playbook (build, preview, gate internals).

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
- **T6** Status labels on every feature: **Live / Testnet / In development / Planned**. Nothing is Live (2026-11-15). **Testnet**
  (BRAIN-verified, D-024): the Fuji L1 (chainId 77078, ARPB gas, KYC allowlist + freeze 15/15) and the MVP (request access,
  tUSD, Split Pay QR). **In development:** eERC encrypted balances, the merchant FX ledger. **Planned:** the bank bridge, the
  multisig councils, bank KYC, stage C. Present tense only for what is Testnet, and always with "de prueba".
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
tables in a scroll wrapper; alt text; visible focus; `prefers-reduced-motion`.

**Stack (D-004, supersedes "single HTML file, no framework"):** build the launch page as a **Next.js App Router app with static
export** (`output: 'export'`) in `landing/`, for SEO + OpenGraph + Twitter-card control and image optimization. Follow
`vercel-react-best-practices`. Keep it light (R8): server-components first, minimal client JS, fonts via `next/font` (Google only),
images via `next/image` (or a plain `<img>` for a single logo — `images.unoptimized` is on for export). The build still emits
static HTML, so the truth/overflow gates below probe the exported output. **Brand/domain are set (STATE §3):** mark at
`landing/public/brand/arepapay-logo.png`, domain `arepapay.site` (metadataBase/canonical/OG), X `@ArepaPay` (footer + Twitter card).

## 5. Gates (all must pass before a commit)
```bash
npm --prefix landing run build      # Next.js static export → landing/out/**.html (D-004)
node scripts/landing-check.mjs      # truth/design gate over landing/out (LANDING writes and maintains it)
node scripts/landing-probe.mjs      # true 390/360 px overflow probe over landing/out
bash tests/check.sh                 # project suite
```
`landing-check.mjs` must fail on: an address or chain id not present in `config/`, external hosts outside an allow-list
(fonts.googleapis.com, fonts.gstatic.com), missing assets, emoji, a feature section without a status label, forbidden words
(`garantizado`, `guaranteed`, `rendimiento`, `APY`, `interés`, `gana dinero`, `earn`), and the missing disclaimer in hero or footer.
Make it fail once on purpose before trusting it (V9). Also view a 1280 px render of what you changed.

## 5a. Learn and remember (master-method §5.7, D-023)
- **Recall first.** Session start = STATE + the newest CHANGELOG Lessons + the newest `docs/LESSONS.md` entries that touch the
  landing or its gates. Do not rediscover what they already record.
- **Label every fact you write.** PROVEN (you ran it: a gate, a build, a render you read), TRACED (you read the code or config)
  or SUSPECTED. Only PROVEN goes into STATE §3 or this skill as a fact; a TRACED one says so. Facts that BRAIN hands you are
  TRACED for you until a gate or a render of yours confirms them (e.g. "Fuji 15/15" is BRAIN's PROVEN, your TRACED).
- **Catch the incident when it happens.** A red gate, a wrong claim on the page, a collision with BRAIN or a user correction
  gets a CHANGELOG Lesson line at once, and a `docs/LESSONS.md` entry (What happened, Root cause, RULE, Enforced by) handed to
  BRAIN as text. If nothing enforces the rule yet, write `(note only)` and add a gate check next.
- **Turn lessons into checks.** A copy mistake that can recur becomes a `landing-check.mjs` rule (V2); the rule must fail once
  on purpose before you trust it (V9).
- **Retro (5 lines, in the report to BRAIN for HANDOFF_LOOP):** what shipped with proof, what broke and the rule added, what the
  next landing session must read first, what waits on the user, one improvement made to this skill or a gate.
- **Hygiene.** Absolute dates; supersede, never silently delete; a subagent's "lesson" is a claim until verified.

## 6. References
`references/STATE.md` (every session) · `references/RUNBOOK.md` (recipes) · `references/CHANGELOG.md` (lessons).

## 7. Next.js static-export playbook (lessons, D-013/D-017/D-024)
- **Build:** `npm --prefix landing run build` → `landing/out/`. `tests/check.sh` runs this build + both gates (D-015), so a broken
  build fails the whole suite — keep it green.
- **Preview the export, never `next dev`.** `next dev` and `next build` share `landing/.next`; because `check.sh` builds the
  landing, a concurrent build corrupts the dev cache and dev crashes with `Error: Cannot find module './NNN.js'`. Serve the
  finished files instead: `python3 -m http.server 3000 --bind 127.0.0.1 --directory landing/out` (then `curl -I localhost:3000`).
- **The truth gate strips `<script>…</script>` before text checks.** Next inlines the page text a second time in its RSC payload
  (`self.__next_f`); counting raw occurrences would hide a missing disclaimer or a forbidden word. The generated 404 is exempt
  from the feature/disclaimer structure but still scanned for addresses/emoji/hosts.
- **The probe rewrites absolute asset paths.** Next exports `/_next/…` and `/brand/…`; under `file://` those resolve to the
  filesystem root and never load, so `landing-probe.mjs` rewrites `="/…"` → `="file://<out>/…"` before measuring overflow.
- **Emoji check ≠ typographic arrows.** An early regex flagged `↔`; it now targets true emoji/dingbats only. Prefer words over
  symbols in copy anyway (fewer AI tells, §4).
- **Fonts self-host.** `next/font/google` downloads Inter at build into `/_next/`, so the export has no external font host — good
  for the allow-list and for building offline.
- **Versions:** pin in `package.json` (`next@15.1.6`, `react@19.0.0`), commit `package-lock.json`; `out/`, `.next/`,
  `node_modules/` are gitignored. Brand/domain are set: `arepapay.site`, X `@ArepaPay` (STATE §3).
- **Sub-path hosting (D-024).** `NEXT_BASE_PATH=/arepapay-site npm --prefix landing run build` sets `basePath` + `assetPrefix`;
  `next.config.mjs` passes it on as `NEXT_PUBLIC_BASE_PATH`; every plain `<img>` path is written `${BP}/brand/…`.
  Set `NEXT_PUBLIC_SITE_URL` to the host's origin too, or canonical/OG URLs point at `arepapay.site` (the default). Never
  write a bare `/brand/…` path in JSX. Default (empty) builds are what the gates and the probe check.
- **Test link = relative `probar/` only (D-024).** `landing/public/probar/index.html` reads `../mvp-url.json` (published by BRAIN
  next to the site) and redirects to `url + '/?net=fuji'`, with a Spanish fallback. The gate fails if that page hardcodes a URL,
  and checks that every relative link resolves in `out/`.
