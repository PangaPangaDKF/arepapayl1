# Landing STATE (live facts, page map, open tasks)

Updated 2026-11-14 by BRAIN (initial). LANDING owns this file from now on.

## 1. Live status
Nothing is deployed. The landing is not built yet. Launch stack = **Next.js (App Router) static export** in `landing/` (D-004,
2026-11-15), superseding the single-file plan. Deploy target still BRAIN's call (board B4). Brand mark received 2026-11-15
(see §3 Brand). Still blocked on the user for the **domain** and a **footer contact** before the page is launch-complete.

## 2. Page map (target for v0; each section lists its truth source)
| Section | Content | Truth source | Status label |
|---|---|---|---|
| Header | logo wordmark, ≤ 6 nav links | — | — |
| Hero | one sentence of what ArepaPay is, testnet disclaimer, one CTA (anchor to "Cómo funciona" until a real pilot contact exists) | charter role line | In development |
| El problema | paying small amounts with USDT in Venezuela; Bs vs USDT friction | v1 research §2 (concept) | — |
| Cómo funciona | pay a merchant by QR with the amount in Bs; merchant receives USDT | PLAN Phase 5 | In development |
| Cuenta verificada (KYC) | why KYC: a permissioned network where only verified people transact; no personal data on chain | PLAN S3, charter R2 | Planned |
| Saldos cifrados | private balances with an auditor key for compliance; being evaluated | PLAN S2 | Planned (in evaluation) |
| Red propia (L1) | ArepaPay's own Avalanche L1 on testnet, permissioned, multisig admin | PLAN S1, charter R3/R5 | In development |
| Comercios | merchants as cash ↔ USDT bridges with escrow | PLAN Phase 3 OTCEscrow | Planned |
| Recompensas | raffles and WiFi minutes funded only by fees | PLAN Phase 3, N0 | Planned |
| Seguridad y transparencia | what we commit to: open contracts once deployed, audits before launch, testnet only | charter R1/R3/R4 | — |
| Hoja de ruta | Phases 0–8 in plain words, with status | PLAN §1 | per phase |
| FAQ | testnet, no real money, KYC data handling, who controls the network | charter | — |
| Footer | disclaimer, link to source repo only if public | T7/T8 | — |

## 3. Verified facts you may use (re-verify if you change them)
- v2 status: Phase 1 (rails). No contracts, no app, no chain config in `config/`. (BRAIN, 2026-11-14)
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
- Tagline (brand, usable): "La arepa es venezolana."
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
See board tasks L1–L3 (now on the Next.js static-export stack, D-004). Brand mark received (§3). Still blocked on the user:
domain and footer contact. L1 gate scripts probe the exported `landing/out/**.html`.
Next build steps: scaffold the Next.js app in `landing/`, place the brand, build the Spanish-first v0 from §2 with status
labels, then write the L1 gates and run them.
