# Landing STATE (live facts, page map, open tasks)

Updated 2026-11-14 by BRAIN (initial). LANDING owns this file from now on.

## 1. Live status
Nothing is deployed. `landing/index.html` does not exist yet. Deploy target is decided by BRAIN later (B-task).

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

## 4. Open tasks
See board tasks L1–L3.
