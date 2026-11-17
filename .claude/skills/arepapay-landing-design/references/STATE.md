# Landing STATE (live facts, page map, open tasks)

Updated 2026-11-17 (D-036, LANDING). LANDING owns this file.

**D-036 (2026-11-17, L8): the page is now short** (user: "more simple and less text"). 2,150 → 250 visible words (PROVEN by the gate, 2026-11-17).
Sections: header, hero, 3 points + privacy line, Cómo probar (3 steps), 3 FAQ, footer. The long pitch (problema, reservas,
comercios como casas de cambio, privacy table, economía, plan A/B/C, riesgos, pedimos) was cut from the page; its truth sources
stay in `docs/PITCH.md`, `docs/ECONOMICS.md`, `docs/features/MERCHANT_FX.md`. The §2 table below is the D-024 map, kept as history.

**D-033 (2026-11-16, L7): encrypted balances (eERC) are now LIVE in the public testnet MVP** (BRAIN's D-032: Privado tab, wallet
e2e 24/24 LIVE, audit-view PASS). The #solucion "Saldos y montos cifrados" line is now `testnet`; #privacidad, Stage B and the FAQ
say the Privado tab works, with the honest public parts (who-pays-whom + amounts in/out are public; one bank account holds the
audit key; phone proof time unmeasured). See §3.

## 1. Live status
**D-024 (2026-11-15): the page is now the announcement + pitch** (board L4, L5, L6). Next.js static export in `landing/`.
Hosting: GitHub Pages under a sub-path (`https://pangapangadkf.github.io/arepapay-site/`) built with
`NEXT_BASE_PATH=/arepapay-site`; the canonical/OG domain stays `arepapay.site`. BRAIN deploys and publishes `mvp-url.json` next
to the site. Pre-launch cleanup still open (§4): cleaned transparent logo, crisp wordmark, real 1200×630 OG image, favicon.

## 2. Page map
### Current (D-036, 2026-11-17)
| Section (#id) | Content | Truth source | data-status |
|---|---|---|---|
| Header | logo, 2 anchors (Cómo probar, Preguntas) | — | — |
| Hero | H1 "Pagos con QR para micro y pequeños comercios", one lead line (red privada de Avalanche, solo billeteras con acceso aprobado), CTA "Probar el MVP" → `probar/`, disclaimer | txAllowList (D-024), BRAIN | testnet |
| #que | 3 cards: Cobra con QR (Split Pay), Paga a un comercio de la lista (store types, 0,5 %), Saldo privado; privacy line (who-pays-whom + in/out public; one bank account holds the audit key) | app/README.md D-034/D-032, config/l1/mvp.fuji.json feeBps 50 | testnet ×4 |
| #probar | 3 steps (MetaMask, add network, request access → test dollars), CTA | app/README.md "Use", onboarding approve = 50 tUSD | testnet |
| #faq | 3: dinero real (no; planned later with caps + audit), token (no; ARPB gas only), enlace no abre (team PC) | charter R1, D-024 | — |
| Footer | brand, tagline, disclaimer, X @ArepaPay | T7/T8 | — |
| `probar/` | utility redirect; redirects only after the service `/health` answers `{ok:true}`, else "Entorno de prueba apagado" (D-036 fix) | D-024, D-036 | (utility) |

### D-024 map (superseded by D-036, history)
| Section (#id) | Content | Truth source | data-status |
|---|---|---|---|
| Header | logo, 5 anchors (Solución, Probar, Economía, Plan, FAQ) | — | — |
| Hero | announcement H1 "ArepaPay: la cadena bancaria privada para micro y pequeños comercios", CTA "Probar el MVP" → `probar/`, "Ver el plan" → #plan, disclaimer | PITCH title, BRAIN facts | testnet |
| #problema | 3 cards | PITCH §1 | — |
| #solucion | 6 lines, each with its own status | PITCH §2 + BRAIN status list | testnet ×3 (incl. eERC, D-033), in-development ×1, planned ×2 |
| #probar | 4 steps in MetaMask, chainId 77078, ARPB no value, PC-must-be-on note, e2e 19/19 + 18/18 | config/l1/arepapaybank.fuji.json, BRAIN 2026-11-15 | testnet |
| #comercios | merchants as exchange houses: band rate, every sale recorded, no resale (R12); FxLedger built, not deployed | MERCHANT_FX §1–2, D-020 | in-development |
| #reservas | 1:1 lock, invariant, no admin drain, bridge not built, issuer-freeze risk | PITCH §4 | planned |
| #privacidad | who-sees-what table, freeze yes / reverse no, multisig 2-of-3 proposal; note: public MVP IS encrypted (Privado tab, eERC) but who-pays-whom + amounts in/out are public and one bank account holds the audit key (D-033) | PITCH §5, ARCH §3a, D-032 | in-development |
| #economia | "sin token para invertir" + PITCH §6 table, SUPUESTO tags, pilot is a measured cost; testnet Split Pay fee = 0.5 % test money | PITCH §6, ECONOMICS §7, config/l1/mvp.fuji.json feeBps 50 | planned |
| #plan | stages A/B/C + 4 known risks | PITCH §7–8 | in-development / testnet / planned |
| #pedimos | asks to a bank (5) and merchants (3), CTA X @ArepaPay | PITCH §9 | — |
| #faq | 6 questions (no token; MVP not encrypted; why the link may be off) | charter, PITCH | — |
| Footer | disclaimer, sections, X | T7/T8 | — |
| `probar/` | utility page: fetches `../mvp-url.json`, redirects to `url + '/?net=fuji'`, Spanish fallback "El entorno de prueba está apagado…" | D-024 | (utility) |

Removed in D-024: Recompensas (raffles/WiFi, D-014), old "Cómo funciona", features grid, Seguridad section (folded into
#reservas, #privacidad, #plan).

## 3. Verified facts you may use (re-verify if you change them)
- **Superseded 2026-11-15 (D-024):** the old line "no chain config in config/" is false now.
- Fuji L1 (TRACED for LANDING; PROVEN by BRAIN 2026-11-15): chainId **77078** and token **ARPB** in
  `config/l1/arepapaybank.fuji.json`; ARPB is gas only, no value; KYC gate (txAllowList) + freeze 15/15 on Fuji.
- MVP on testnet (BRAIN PROVEN): request access (test stand-in for bank KYC, auto-approved during the public test), tUSD (no
  value), Split Pay QR (funds held until fully covered, then captured; expired → each payer withdraws). e2e 19/19 scripted +
  18/18 through the real UI. MetaMask mobile in-app browser or desktop MetaMask; the page adds the network itself.
- Testnet Split Pay fee is **50 bps** (`config/l1/mvp.fuji.json` feeBps), test money; the pilot recommendation is 0 % (ECONOMICS §7).
- Status: **eERC = LIVE in the public testnet MVP (D-032/D-033): "Privado" tab (activate, Pasar a privado, Enviar privado, Pasar a
  saldo normal); saldos + montos cifrados on chain, but who-pays-whom and the amounts entering/leaving the private balance are
  PUBLIC, and in this test one bank account holds the audit key and reads every private amount (multisig split = Planned, S3);
  phone proof time unmeasured, desktop ~5-9 s.** FxLedger = in development (99 tests, not deployed); bridge = planned; multisig
  councils = planned. Testnet can be reset; the test environment runs on the team PC and can be offline.
- v1 history: a Fuji testnet MVP with merchant payments, raffle tickets and WiFi minutes existed in 2026-03 (FACT in
  `docs/research/arepapay_ground_truth.md` §2). Its Vercel URL is **not verified live**; don't link it.
- v1 did NOT have working KYC, encryption, fees or banking features (ground truth §4). Never claim them.
- No contact channel exists yet. Needs the user.

### Brand (received from the user 2026-11-15)
- Mark: `landing/assets/brand/arepapay-logo.png` — pixel-art arepa (reina pepiada) on a red/white checker cloth, brown ring,
  cream ground, **"AREPAPAY" wordmark in navy `#1A2472`**. Matches the §3 design system. Caveats: AI-generated (Gemini
  watermark + a ghost-text artifact), opaque cream background. For launch, produce a cleaned, transparent logo and a crisp
  pixel/SVG wordmark for the header and favicon/OG; use this PNG as the reference and the hero icon.
- Palette confirmed from the mark: cream ground, navy `#1A2472` wordmark, red/white checker (`--red #CC1111`), brown ring
  (`--brown-light #8A6A40`). No new tokens needed — §3 already covers it.
- Tagline (brand, usable): "La arepa es venezolana." (used in the footer)
- Domain (user, 2026-11-15): **arepapay.site** — set as `metadataBase`, canonical, OpenGraph `url`. No other domain.
- X / social (user, 2026-11-15): **https://x.com/ArepaPay**, handle `@ArepaPay` — the footer contact and the Twitter card
  `site`/`creator`. This resolves the T8 "needs a contact" gap; no other contacts are invented.
- Where assets live for the build: source originals in `landing/assets/brand/`; what ships is `landing/public/brand/` and
  `landing/app/icon.png`. The gate's external-host allow-list is `arepapay.site`, `x.com`, Google Fonts (next/font self-hosts,
  so fonts are actually local `/_next/`).
- `/mnt/d/` also holds official Avalanche brand PNGs (logos, AVAX token). "Built on Avalanche" art may be used only within
  Avalanche's brand guidelines — confirm with BRAIN before placing it (T8).

### Forbidden sources (do NOT copy their copy or UI — they fail the truth rules for v2)
- The old TryNoah landing (screenshots, `trynoah.ai/playground/6a03fdd332907c2639ed60aa`): a **Solana, non-custodial, no-KYC,
  cross-border** concept with fake balances ("2,450 USDC", "+150 USDC to María"). Contradicts v2 (Avalanche permissioned L1 +
  KYC + encrypted) and breaks T2. Anti-reference only.
- The hand-drawn infographics (`/mnt/d/0*_*.png` etc.): English, and they state "receive USDT in seconds / verified merchants /
  win free ice cream" as **live**, with a fake phone + "✓ PAID" UI. Copy and fake UI are forbidden (T2/T3/T6). The *concept*
  (Bs→USDT via a trusted local merchant, rewards from fees) is a Planned/In-dev truth source only via `docs/PLAN.md`, not their words.

## 4. Open tasks
L1–L8 done (L4/L5/L6 in D-024; L7 = eERC-live privacy copy in D-033; L8 = short page in D-036). Remaining:
- **Keep it short (D-036):** new copy must keep the main page ≤ 250 visible words; `landing-check.mjs` enforces it (rule L8, D-036).
  Label flips (FxLedger, bridge, multisigs) now need a line only if the user asks for that feature on the page.
- **Pre-launch cleanup (LANDING):** cleaned transparent logo + crisp wordmark; real 1200×630 OG image; `favicon.ico`.
- **BRAIN:** publish `mvp-url.json` (`{"url":"https://…","updated":"…"}`) at the site root next to `index.html` on every tunnel
  restart; build Pages with `NEXT_BASE_PATH=/arepapay-site`.
- **Flip labels as things land (T6):** eERC in the MVP → done (D-033); FxLedger deployed → #comercios + line 4; bridge
  → #reservas; multisigs → #privacidad. Re-run the gates after each flip.
- **For BRAIN's docs (still open):** ARCHITECTURE §3a says testers can read addresses "never amounts". For the public (non-private)
  MVP balance that remains true, but the eERC audit key (one bank account, D-032) *can* read every private amount. The doc line
  needs that caveat. The landing states it honestly.
- Build + probe recipes: RUNBOOK §3–§6.
