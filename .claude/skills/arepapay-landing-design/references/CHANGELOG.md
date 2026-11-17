# arepapay-landing-design changelog (newest first)

## 1.7 · 2026-11-17 · D-036 — short page (L8): 2,150 → 250 visible words, word budget in the gate
- User (2026-11-16): "the landing page should be more simple and less text". `landing/app/page.js` is now hero (one line, CTA,
  disclaimer), 3 status-labeled points (Cobra con QR, Paga a un comercio de la lista with the D-034 store types and 0,5 %,
  Saldo privado), one privacy line (who-pays-whom and in/out visible; one bank account holds the audit key), Cómo probar
  (3 steps), 3 FAQ, footer. Cut: problema, solución ×6, comercios como casas de cambio, reservas, privacy table, economía,
  plan A/B/C + riesgos, pedimos, 3 FAQ. Their truth sources stay in `docs/PITCH.md` / `docs/ECONOMICS.md`; no "Más detalles"
  page (the user asked for less, and nothing left on the page depends on the cut text).
- `scripts/landing-check.mjs` rule L8: the main page fails above 250 visible words (`LANDING_MAX_WORDS` overrides). Dead CSS
  for the removed sections (lines, tables, stages, risks, asks, supuesto, phases) deleted; metadata description no longer says
  "operada por un banco" in the present tense.
- Lesson: my first short draft was 300 words, and it felt short. The new gate rule failed it on its first run (that was the V9
  proof). A "short page" target needs a counter, because the writer's sense of length is not a measurement. Count the badges,
  nav and footer too: the reader sees them.
- Lesson: `landing-probe.mjs --shot … --width 390` looked clipped on the right while the overflow probe said clean. Chrome
  lays a window narrower than ~500 px out wider and crops it, so the shot lied, not the page. `--shot` now renders widths
  below 500 px through an iframe (same trick as the overflow probe). Trust the iframe probe; read phone shots only from it.
- Lesson: cutting copy can create falsehood by context. Before deleting a section, check whether a sentence that stays leans on
  it. Here, "Solo pagan las billeteras aprobadas" needed no bank context, but "operada por un banco" in the old meta description
  was only honest next to the Planned sections, so it went too.

## 1.6 · 2026-11-16 · D-033 — privacy copy flipped to live eERC in the testnet MVP (L7)
- `landing/app/page.js`: encrypted balances (eERC) were live in the public testnet MVP (D-032, e2e 24/24 LIVE, audit-view PASS),
  but five places still said "todavía no está en el MVP público" / "todavía no hay cifrado". Flipped the #solucion "Saldos y
  montos cifrados" line from `in-development` to `testnet` (Red de pruebas · MVP) and rewrote it, the #privacidad table row and
  note, the Stage B paragraph and the FAQ answer.
- Kept it honest (T7): the Privado tab exists and works, but who-pays-whom and the amounts entering/leaving the private balance
  stay public, and in this test **one bank account holds the audit key and can read every private amount** (the multisig split is
  Planned, S3); phone proof time is unmeasured (desktop ~5-9 s). All five sentences trace to D-032 + `app/README.md`.
- Lesson: the T6 flip is only half the job. When a privacy feature goes live, the *overstatement* is the dangerous half — the old
  table said "y el banco tampoco" (the bank can't see amounts), which became false the moment one bank account held the audit
  key. Flipping a status label must be paired with re-reading every adjacent privacy sentence for a claim the new deployment
  breaks, not just the one that now reads "live".
- Lesson (supersedes 1.5's last lesson): ARCHITECTURE §3a's "testers see addresses never amounts" is now right for the public
  (non-private) balances but still wrong for the audit key; the BRAIN-docs note in STATE §4 stays open.

## 1.5 · 2026-11-15 · D-024 — announcement + pitch page (L6), merchants as exchange houses (L4), Learn and remember (L5), Pages sub-path, probar/ link
- Rewrote `landing/app/page.js` as the announcement: hero "ArepaPay: la cadena bancaria privada para micro y pequeños comercios",
  problem, six solution lines each with its own status, "Cómo probar" (testnet, MetaMask, chainId 77078 from config), merchants as
  exchange houses (in development), 1:1 reserves (planned), privacy and oversight, the economics table with SUPUESTO tags and "sin
  token para invertir", stages A/B/C with known risks, the ask. Raffles/WiFi, the old features grid and "Seguridad" are gone.
- `landing/public/probar/index.html`: the only test link. Reads `../mvp-url.json`, redirects to `url + '/?net=fuji'`, Spanish
  fallback when the file is missing or not https. No tunnel URL anywhere in the repo.
- `next.config.mjs` honors `NEXT_BASE_PATH` (basePath + assetPrefix + `NEXT_PUBLIC_BASE_PATH`); `<img>` and OG paths use it.
- Gate: chain ids are allowed when present in `config/` (T4), `probar/` is a utility page (disclaimer required, hardcoded URL
  forbidden), relative links must resolve, the asset check strips the base path. Probe: `--height`. Skill §5a Learn and remember.
- Lesson: the T4 rule was written as "config/ has no chain params yet, so no chainId at all". When config gained a Fuji chain the
  rule became wrong, not just strict. Gate rules should compare against the source of truth (config), never encode today's state.
- Lesson: the first render put the economics table in a scroll wrapper with `min-width: 560px`; the probe flagged 38 elements at
  390 px. A table that scrolls sideways is still bad on a phone, so rows now stack under 640 px instead of loosening the probe.
- Lesson: the first sub-path build printed the OG image as `https://arepapay.site/arepapay-site/brand/…`, a URL that exists on
  neither host. A base path changes the origin question too: canonical/OG now come from `NEXT_PUBLIC_SITE_URL` + base path.
- Lesson: the public MVP is not encrypted yet, while ARCHITECTURE §3a says testers see addresses "never amounts". Check every
  privacy sentence against what is actually deployed, not the design; the page now says test amounts are visible.

## 1.4 · 2026-11-15 · D-017 — static-export playbook (§7) + session context doc
- Added §7 to the skill: build, **preview via a static server (not `next dev`)**, and the gate internals, so the next session
  doesn't rediscover them. Wrote `docs/SESSION_CONTEXT.md` (next session = main brain for the loop) and pointed START_HERE at it.
- Lesson (the one that triggered this): running `next dev` for a live preview **crashed** (`Cannot find module './627.js'`) the
  moment BRAIN's `check.sh` ran `next build` — they share `landing/.next`. Serving `landing/out/` with `python3 -m http.server`
  is collision-proof and previews the real artifact. Never hand the user a `next dev` URL on this repo.

## 1.3 · 2026-11-15 · D-013 — landing v0 built (Next.js static export) + gates implemented
- Scaffolded `landing/` (Next.js App Router static export), built the Spanish-first v0 from STATE §2 with T6 status labels and
  the T7 disclaimer in hero + footer, and wrote the two gates (`scripts/landing-check.mjs`, `scripts/landing-probe.mjs`).
  User gave domain `arepapay.site` and X `@ArepaPay`. 3 gates green; V9 negative test passes; renders read.
- Lesson: Next.js inlines the page text a **second time** in `<script>self.__next_f...</script>` (the RSC payload). A disclaimer
  or forbidden-word check that counts raw occurrences is fooled by that copy. The gate strips `<script>…</script>` before every
  text check, so "disclaimer in hero AND footer" means ≥2 in the real DOM, not the duplicate.
- Lesson: the first emoji regex also caught plain typographic arrows (`↔`, U+2190–21FF) and flagged legit copy. Narrowed it to
  true emoji/dingbat ranges; reworded the copy to drop the arrow anyway (cleaner, fewer AI tells, §4).
- Lesson: Next static export writes assets with absolute paths (`/_next/…`, `/brand/…`); under `file://` the probe must rewrite
  `="/…"` to `="file://<out>/…"` or the CSS never loads and the overflow result is meaningless.
- Lesson: `tests/check.sh` (BRAIN's) still probes `landing/index.html` and now **skips** — the stack is a static export. Flagged
  BRAIN to repoint it to build+probe `landing/out/`; until then the landing gates run standalone (and are green).

## 1.2 · 2026-11-15 — brand mark ingested; old materials flagged as anti-references
- Saved the user's pixel logo to `landing/assets/brand/arepapay-logo.png` and recorded the brand facts in STATE §3.
- Lesson: the user also sent an old TryNoah landing and hand-drawn infographics. They describe a **different, older product**
  (Solana, non-custodial, no-KYC) and state planned features as live with fake balances and fake app UI. Reusing their copy
  would reproduce exactly the DeepSeek-v1 failure (false claims). STATE §3 now lists them as forbidden sources; v2 copy comes
  from the charter and `docs/PLAN.md` only, with status labels (T6).
- Lesson: AI-generated brand art ships with watermarks and ghost artifacts. Treat the delivered PNG as a reference; produce a
  cleaned transparent logo + a crisp wordmark for the real header/favicon/OG before launch.

## 1.1 · 2026-11-15 · D-004 — LANDING took the lane; launch stack = Next.js static export
- Loaded `vercel-react-best-practices` into the landing agent. Set the launch stack to Next.js (App Router) static export,
  superseding the single-file/no-framework rule, for SEO/OG/Twitter-card and image optimization on a real domain.
- Lesson: a framework is allowed only when it earns its weight (R8). Static export keeps the output as plain HTML, so the truth
  and overflow gates still apply unchanged — if a future stack stops emitting static HTML, the gates must be rebuilt first.
- Lesson: brand (logo, exact palette) must come from the user's own source (their X), never invented (T8). Until it arrives,
  build on the §3 cream/navy/gold tokens with no logo rather than guess one.

## 1.0 · 2026-11-14 · D-003 — created by BRAIN
Seeded from DOGEON landing skill 2.1. Lessons carried over:
- Lesson (DOGEON D-085): a hallucinated RPC on a parked domain shipped on the first landing. Chain facts only from config, verified live.
- Lesson (ArepaPay v1, 2026-11-14): the DeepSeek landing stated planned KYC and encryption as fact and showed fake contacts.
  Status labels (T6) and no invented contacts (T8) are now hard rules checked by the gate.
