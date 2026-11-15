# ArepaPay v2 handoff loop (newest first)

## 2026-11-15 · BRAIN turn 3
- Done: S1 private L1 (D-008), Split Pay A built + audited (D-010), Split Pay C spec + eERC skill (D-011), S2 eERC on chain 77077 (D-012), merchant FX design + R12 (D-014), check.sh runs your landing build + gates (D-015).
- Verified: `bash tests/check.sh` → ALL CHECKS PASSED (secret scan, rails, landing build + 2 gates, forge 34 tests).
- Next for LANDING: **L4**: remove raffles/WiFi/rewards; add "Comercios como casas de cambio" (Planned); stay minimal; no "how to test" links until a public test network exists. Read the D-014 note at the top of "Tasks for LANDING".
- Needs the user: phone proof-time measurement is no longer blocking (user accepts slow proofs); Q18 public test network (Fuji L1 vs tunnel); Q16, Q17; DNS for arepapay.site; security U1–U3.

## 2026-11-15 · LANDING turn 2
- Done: built the landing **v0** (D-013). Next.js App Router static export in `landing/`; Spanish-first page with every section
  from STATE §2, status labels (T6), disclaimer in hero + footer (T7); brand mark placed; footer links X `@ArepaPay`. Wrote both
  gates (`scripts/landing-check.mjs`, `scripts/landing-probe.mjs`).
- Verified: `node scripts/landing-check.mjs` → "Landing is truthful and labeled." (0 problems, 9 status-labeled features);
  V9 negative test (emoji + forbidden words + unlabeled feature) → exit 1; `node scripts/landing-probe.mjs` → 390/360 px nothing
  overflows; hero + "cómo funciona" 1280 px renders read; `bash tests/check.sh` → ALL CHECKS PASSED (landing step skips — below).
- Inputs from the user: domain `arepapay.site`, X `@ArepaPay`. Committed landing-lane paths only; **not pushed** (BRAIN owns deploy, C9).
- Next for BRAIN: (1) repoint the check.sh landing step to `npm --prefix landing ci && npm --prefix landing run build && node
  scripts/landing-check.mjs && node scripts/landing-probe.mjs` (it still looks for `landing/index.html` and skips); (2) B4 —
  deploy target is a static host serving `landing/out/`, domain arepapay.site; then deploy.
- Needs the user: nothing blocking. Pre-launch polish (LANDING will do): cleaned transparent logo + crisp wordmark + a real
  1200×630 OG image + favicon.ico (today the icon/OG use the watermarked 1024 px brand PNG).

## 2026-11-15 · LANDING turn 1
- Done: took the LANDING lane. Set launch stack to Next.js static export (D-004), loaded `vercel-react-best-practices` into the
  landing agent, stopped the idle duplicate landing terminal `t1b`, and updated the skill (v1.1), STATE, CHANGELOG, board and decisions.
- Verified: `bash tests/check.sh` → <result quoted in board Log>. No code touched, only docs/skill/agent.
- Next for BRAIN: B4 — confirm the deploy target for a Next.js static export (Vercel). Answer Q1 (custody) so LANDING can write
  the "Cómo funciona / KYC" copy against a settled model.
- Needs the user: brand logo + exact palette from your X account + the X link · the domain you will buy · a footer contact
  channel (or "none yet" → the footer omits it, T8). Still open from BRAIN turn 1: U1–U3 (security) and Q1 (custody).

## 2026-11-14 · BRAIN turn 1
- Done: ground-truth research of all v1 copies (verified), master-method user skill, v2 rails (charter, lanes, nerves, gate), plan.
- Verified: `bash tests/check.sh` → ALL CHECKS PASSED; secret scan failed on a planted key, then passed after removal.
- Next for LANDING: L1–L3 on the board.
- Needs the user: U1 make arepaAgent repo private · U2 revoke the GitHub token in `/home/panga/arepapay-clean/.git/config` · U3 move funds off any v1 key · Q1 custody model.
