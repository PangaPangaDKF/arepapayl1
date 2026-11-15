# arepapay-landing-design changelog (newest first)

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
