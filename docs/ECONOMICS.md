# ArepaPay v2 economics ("tokenomics" of the bank chain)

Version 1.0 · 2026-11-15 · D-021 (decision memo, for BRAIN and the user) · Owner: BRAIN · Status: **analysis, nothing here is built
beyond what §0 lists**

> **Testnet only. No real money.** Every number below is either measured (cited) or an **ASSUMPTION** (marked). Nothing here
> is a promise of yield, price or return. ArepaPay has **no speculative token**: it is out of scope (charter, scope fence).
> "Tokenomics" here means **the economics of the units and money flows in the system**: who can create each unit, what backs
> it, how it leaves, and who pays or earns what.

Sources (read as data): charter `.claude/skills/arepapay-mission/SKILL.md` v1.3, `docs/ARCHITECTURE.md` v1.1,
`docs/features/MERCHANT_FX.md`, `docs/features/SPLIT_PAY.md`, `docs/PLAN.md` v1.3, `docs/research/market_landscape.md`,
`docs/spikes/S1.md`, `docs/spikes/S2.md`, `docs/spikes/STAGE_B_FUJI.md`, `contracts/src/SplitPayEscrow.sol`, `docs/DECISIONS.md`.

## 0. What exists today (so no number is read as live)
| Piece | Status | Proof |
|---|---|---|
| Bank's private L1 (allowlist, freeze switch, deployer allowlist, native minter off) | built, local (stage A) | S1 15/15 PASS (D-008) |
| eERC converter: register, deposit, private transfer, withdraw | works on the local L1; phone proof time **not measured** | S2 (D-012) |
| Split Pay option A (`SplitPayEscrow.sol`, fee snapshot, 1 % hard cap) | built, 34 tests, audited | D-010 |
| Bank bridge (ICTT), FxLedger, gas station contract, fee router, audit/freeze multisigs, KYC onboarding | **not built** (spikes S3–S6, D-020 reserved) | PLAN §1 |

So the bridge, the FX ledger and every fee except Split Pay's are **design**, and this memo analyses the design.

---

## 1. The user's model, in the user's words
From ARCHITECTURE §0 (D-007), MERCHANT_FX §0 (D-014), SPLIT_PAY §0 (D-009), condensed and translated in those docs:
- "The centralized part, where the bank controls it or is the ramp, means there will be a **bridge and initial liquidity**.
  Micro businesses deposit the **USDT or USDC collateral** they need."
- "The IRL test is **real**: **$100 per micro business**, like a bakery or a shop with pumps and tanks that refills filtered
  water jugs."
- "The L1 is a private service; used locally and controlled with **$1,000 of liquidity**."
- "The bank has real USD backing, and the chain also holds USDT or USDC; obviously **the bank bridges**, as the entity in charge
  of its chain and its validators. It saves the bank the work of upgrading to a whole new network."
- "If the chain closes, **the liquidity is in there and not in the bank**. That's a plus for the bank: it can show that the
  liquidity exists and can be returned, even if the bank goes bankrupt tomorrow."
- "The merchants will **sell USDT or USDC to customers** and will be **exchange houses**, since they provide the liquidity."
- "A **record that shows it happened**, so the merchant can't move funds and not declare them."
- "Reselling the USDT or creating black or emerging markets … **It's a rule that can't be broken.**" (R12)
- Split Pay: "It **removes a bit of fee** from the price, and that's where the complexity is."
- Fee rule already in the plan (PLAN Q5): "One fee in bps with a cap, enforced in code; set with the partner bank's costs once
  known."

This memo keeps every one of these. It does not add a token, a yield product, or a bank-issued IOU (L-003).

---

## 2. Every unit in the system
| Unit | What it is | Who can create it | What backs it | How it leaves | Invariant (test) |
|---|---|---|---|---|---|
| **ARPB** (native gas coin, chain 77077) | Gas for the L1. Has no price, is never sold, users never buy it | **Only genesis.** `contractNativeMinter` is off (R5; S1 checks 13–15 prove minting does nothing) | Nothing, and it needs nothing: it is a metering unit, not money | Spent as gas. With `rewardManager` absent (S1 genesis), base fees are not paid to anyone; **ASSUMPTION/VERIFY:** Subnet-EVM default burns them, so supply only falls | total ARPB ≤ genesis alloc |
| **Bridged USDT/USDC** (ERC-20 on the L1, "remote") | The L1 copy of real USDT/USDC | **Only the bank's ICTT bridge**, 1:1 when real tokens are locked on C-Chain (R9) | Real USDT/USDC locked in the bridge's C-Chain "home" contract, visible to anyone on C-Chain | Burned on the L1 by the bridge; the home contract releases the same amount on C-Chain | **L1 supply == locked on C-Chain**; no admin drain path (S6, not built) |
| **eERC encrypted balance** (converter mode) | The private form of the bridged token: balances and amounts encrypted | Nobody mints in converter mode: a holder `deposit`s bridged tokens and gets the same encrypted amount | The bridged ERC-20 held by the eERC contract, 1:1 | `withdraw` (ZK proof by the holder's key) returns the ERC-20 | sum of encrypted balances == ERC-20 held by eERC (amounts visible at `Deposit`/`Withdraw`, S2) |
| **Split Pay hold** | Bridged ERC-20 locked in `SplitPayEscrow` during an intent | Payers, by `authorize` | The tokens themselves | `capture` (merchant gets total − fee, fee router gets fee) or pull refund after void | token balance == `totalHeld`; captured == sum of holds == total (4 Foundry invariants, D-010) |
| **Bolívares (Bs)** | Off chain only (cash, Pago Móvil, the bank) | The banking system | Not on chain | Not on chain; FxLedger stores a rate and a hash commitment, never Bs | FxLedger moves no money (MERCHANT_FX §4, N0) |

Key consequences:
1. **No unit can be created from nothing.** ARPB only from genesis; dollars only from locked real dollars (N0).
2. **The $1,000 initial liquidity does not back redemptions; the lock does.** Every bridged token can always be redeemed from the
   home contract, 1:1, without the bank's balance sheet. The $1,000 is the bank's **working float** for its USD↔Bs desk and for
   serving merchants who run out of USDT (ARCHITECTURE L2: "so the bank can serve withdrawals and bolívar trades at the start").
3. **The merchant's $100 is self-custodied inventory**, not a deposit the bank can seize: it is in the merchant's own encrypted
   balance, moved only by the merchant's key (ARCHITECTURE L3/L4, "freeze yes, reverse no"). It is the stock the merchant sells
   as an exchange house.
4. **Total dollars on the chain are capped by what was bridged in.** At stage C caps (R1): 30 merchants × $100 + $1,000 = **$4,000**
   maximum float (worked example below). Payment volume = float × velocity.

---

## 3. Money flows
```
 C-Chain (public)                       ArepaPay L1 (private, bank-run)                        Off chain
 ┌────────────────┐  bridge in (lock)   ┌─────────────────────────────────────────────┐
 │ real USDT/USDC │ ──────────────────▶ │ bridged ERC-20 ──deposit──▶ eERC (encrypted) │
 │ in home        │ ◀────────────────── │ bridged ERC-20 ◀─withdraw── eERC             │
 │ contract       │  bridge out (burn)  └─────────────────────────────────────────────┘
 └────────────────┘

 (a) Customer pays merchant          customer eERC ──private transfer──▶ merchant eERC        (no fee in eERC itself)
 (b) Merchant sells USD (FX)         customer ──Bs (cash/Pago Móvil)──▶ merchant                (off chain)
                                     merchant eERC ──private transfer──▶ customer eERC          FxLedger: open → accept → sent
                                                                                                → confirm → bank reconciles
 (c) Split Pay (option A)            payer eERC ─withdraw─▶ ERC-20 ─authorize─▶ SplitPayEscrow
                                     capture: escrow ─(total − fee)─▶ merchant ; escrow ─fee─▶ fee router
 (d) Bank FX desk (USD↔Bs)           merchant ⇄ bank, off chain or via a bank-signed quote (ARCHITECTURE L2, FXDesk)
 (e) Gas                             gas station (genesis ARPB) ──top-up──▶ KYC'd wallet ──gas──▶ burned (VERIFY)
```

**The closed loop this creates (the core of the user's model):** a customer gets dollars on the chain mainly by buying them from a
merchant with Bs (b), then spends them at merchants (a or c). So in steady state **FX sales ≈ payment volume**: a merchant's USDT
goes out as FX sales and comes back as payments, and its Bs grow by what it sold. Customers can also bridge in their own USDT/USDC
(KYC'd, through the bank's bridge only). Every transfer the bank sees is classified as payment, FX order, Split Pay movement,
bridge in/out, or **unexplained (flag)** (MERCHANT_FX §3).

**Technical fact that shapes the fee model:** the eERC operations measured in S2 (deposit, transfer, withdraw) carry **no fee**.
`SplitPayEscrow` is the only built code that takes a fee, and it can do so because option A takes the money out of encryption.
Taking a fee on a plain *private* payment needs a **second private transfer** (payer → fee router): another ZK proof (S2: 4.4–7.6 s
on desktop, projected 25–60 s on a low-end phone) and another ~1.1M gas. SPLIT_PAY_C §"proof 2, escrow → fee router" shows the same
cost. (**VERIFY:** BRAIN to confirm against `ava-labs/EncryptedERC@8dc98cd` that no fee hook exists.)

---

## 4. Fee options on one worked example

### 4.1 Worked example (all ASSUMPTIONS except where cited)
| Item | Value | Basis |
|---|---|---|
| Merchants | 30 | ASSUMPTION (the brief) |
| Collateral | $100 each = $3,000 | user's model (R1 cap) |
| Bank initial liquidity | $1,000 | user's model (R1 cap) |
| Max float on chain | $4,000 | sum of the two |
| Payments | 10 per merchant per day × $5 average = 300/day, **$1,500/day, $45,000/month** (30 days) | ASSUMPTION |
| FX sales | ≈ payment volume, $1,500/day, average $15 → 100 orders/day, **$45,000/month** | ASSUMPTION, from the loop in §3 |
| Bridge traffic | $4,500/month crossing (in + out), about 60 operations (~$75 each); 30 of them out | ASSUMPTION |
| Split Pay share | 10 % of payments (30/day) | ASSUMPTION |
| Band spread | ±1 % around the bank rate | ASSUMPTION; MERCHANT_FX §5 Q17 uses "1 %, 2 %, …" as examples |
| Bank rate example | 889.26 Bs/$ (official, 30 Oct 2026) | market_landscape §2.4 |

Velocity check: $1,500/day on a $4,000 float is 0.375 turns a day. Capacity check: 400 private transfers/day against ~3.5/s
(≈ 300,000/day) at the 8M gas limit (S2 finding 4). Capacity is not the constraint.

### 4.2 The options
| Option | What is charged | Monthly revenue in the example | Who gets it | Technical cost |
|---|---|---|---|---|
| **F1: payment fee in bps on every payment** | 50 bps (0.5 %) or 100 bps (1 %, the contract cap) | 50 bps: $45,000 × 0.005 = **$225**; 100 bps: **$450** | Fee router → bank and ArepaPay (split = Q24) | On Split Pay A: already coded. On plain private payments: a second proof per payment (9,000 extra proofs/month, +0.199 ARPB each at 175 gwei) |
| **F2: zero payment fee; merchants earn the band markup; bank earns bridge and desk** | Merchant sells up to bank rate × 1.01; bank: flat $0.50 per bridge-out (ASSUMPTION) + 1 % on its USD↔Bs desk with merchants on $3,000/month (ASSUMPTION) | Merchants: up to 1 % × $45,000 = **$450** in total (≤ $15 each); bank: 30 × $0.50 + $30 = **$45**; ArepaPay: **$0** unless Q23 | Merchant keeps its markup (exchange-house role); bank its fees | None on payments. FxLedger already checks the rate band (MERCHANT_FX §4) |
| **F3: bridge-only fee** | 0.5 % on bridge in and out | $4,500 × 0.005 = **$22.50**, plus a one-off $20 on the first $4,000 deposited | Bank | Bridge amounts are visible anyway (`Deposit`/`Withdraw`, ICTT). **VERIFY in S6:** ICTT sends carry a relayer fee field |
| **F4: one monthly merchant fee in bps, paid in one private transfer** | 50 bps on the merchant's monthly received volume, computed by the merchant's app from its own decrypted statement; the bank checks by case | Same as F1 at 50 bps: **$225** | Fee router | 30 extra proofs/month instead of 9,000. Weaker: relies on the merchant's statement plus case audits (decrypt per case, not in bulk, market_landscape §5.3) |

### 4.3 What a customer and a merchant pay per $100 (example)
| Path | Cost per $100 | Note |
|---|---|---|
| F2, customer buys USDT from a merchant and pays | up to **$1** (band markup); payment fee $0; gas $0 (gas station) | |
| F1 at 100 bps, the same path | up to $1 markup + **$1** merchant fee | |
| Pago Móvil / Binance P2P | market_landscape gives **no fee figure**; it calls both "cheap or free" (§3d) | Micro-merchants adopt only near-zero-fee rails (Pix, Pochi, §3d) |
| Risk to every option | a 3 % IGTF may apply to crypto payments (§2.7), and the official-to-parallel gap was ~11.7 % in October 2026 (§2.4) | "A 3 % IGTF plus an official-rate spread is a 10 %+ haircut, and it kills the proposition" (§3d) |

The cited market fact points one way: at pilot scale, a payment fee is the part most likely to push merchants back to Pago Móvil
and Binance P2P, and the rate anchor matters far more than the fee (see §6, risk 1).

---

## 5. Who pays which cost, and break-even

### 5.1 Costs
| Cost | Amount | Who pays (proposal; Q26) | Source |
|---|---|---|---|
| P-Chain validator fee | 512 nAVAX/s ≈ **1.33 AVAX per validator per month**; 3 validators (2 bank + 1 ArepaPay) ≈ **4 AVAX/month** | Each node's operator | S1 §7 (ACP-77, read live) |
| L1 create/convert txs | < 0.001 AVAX, once | Bank | S1 §5 |
| Stage B (Fuji) validator fee | the same, in **testnet** AVAX (no real value) | the user's Fuji key | STAGE_B_FUJI §3 |
| Server (gateway RPC, indexer, backend) | "the only real-money cost" in stage B; amount not measured. **ASSUMPTION: $30/month** | ArepaPay | STAGE_B_FUJI §3 |
| Validator machines | **ASSUMPTION: $40/month each**, $120 for 3 (zero if the bank uses existing servers) | Each node's operator | |
| Bridge relayer C-Chain gas | "a little AVAX" (ARCHITECTURE §3); **ASSUMPTION: $5/month** | Bank | |
| AVAX price | **ASSUMPTION: $20/AVAX** → 4 AVAX ≈ $80/month | | none in the docs |
| Gas station top-ups | **$0 in money**: paid in genesis ARPB (below) | nobody | S1, S2 |
| **Total stage C, example** | **≈ $235/month** (ASSUMPTION) | | |

### 5.2 Gas economics (ARPB)
Measured gas (S2 §6) at the suggested 175 gwei; the base fee floor is 25 gwei (S1 §5), so the same tx costs 7× less if wallets pay
only the base fee.

| Activity (example, per day) | Gas | ARPB at 175 gwei |
|---|---|---|
| 300 private payments × 1.14M gas | 0.199 each | 59.6 |
| 100 FX orders: 1 private transfer + 4 FxLedger calls (**ASSUMPTION: 100k gas each**, contract not built) | 0.269 each | 26.9 |
| 2 deposits + 2 withdraws | 0.088 + 0.151 | 0.5 |
| **Total** | | **≈ 87 ARPB/day** |

- Onboarding one wallet: `setEnabled` 0.0076 + `register` 0.056 + `approve` 0.0081 ≈ **0.072 ARPB**, plus a working top-up (S2
  funded 5 ARPB per wallet).
- The stage A genesis gives the gas station **100,000 ARPB** (S1 §2). At ~87 ARPB/day that is **~1,150 days** at 175 gwei and
  roughly 7× that at the base fee. **The pilot never runs out**, and gas costs nobody money.
- Long term, with minting off and fees not recycled, ARPB only falls. Two in-model fixes, both inside R5 ("supply only from
  genesis/fees"): a larger genesis allocation for Fuji/mainnet, or `rewardManager` sending fees back to the gas station. Either
  way, `feeManager` can lower `minBaseFee` (S1 §8 Q2). Decision: Q25.
- Spam control does not come from gas price: only KYC'd wallets can send at all (txAllowList), and the gas station rate-limits
  top-ups.

### 5.3 Break-even (example costs ≈ $235/month)
| Fee level on payments | Monthly volume needed | Per merchant per day ($5 payments) | Example volume ($45,000) |
|---|---|---|---|
| 100 bps (cap) | $23,500 | ~5.2 payments | covers costs ($450) |
| 50 bps | $47,000 | ~10.4 payments | just short ($225) |
| 0 bps (F2) | never from payments | | bank fees $45; **a pilot cost of ~$190/month** shared by bank and ArepaPay |

Honest reading: **at the stage C caps ($4,000 float), no option makes a business; the pilot is a measured cost of roughly
$200–$250 a month** (ASSUMPTION). The reason to run it is the user's: "a small test for the idea and how it can fail or fit into
the real world" (charter, D-005). What scales revenue is float × velocity: more merchants and more bridged dollars, which stage C
deliberately caps.

---

## 6. Risks to the economics, each with a mitigation inside the user's model
| # | Risk | Evidence | Mitigation that fits the model |
|---|---|---|---|
| 1 | **Rate anchor wrong.** If the band sits on the official rate while the parallel gap is ~11.7 %, merchants lose value selling inside the band, and customers who buy cheap want to resell (pressure on R12) | market_landscape §2.4, failure mode 1 | The band anchors on the rate PLAN Phase 4 already specifies ("official BCV plus P2P median, signed, pushed on chain with bounds"); spread width is the bank's (Q17); reference index = Q21 |
| 2 | **Fees push merchants back** to Pago Móvil / Binance P2P | §3d, Pix/Pochi | 0 bps on payments in the pilot (F2); the fee mechanism stays in code with its 1 % cap, changed only by multisig + timelock (R3) after measured data |
| 3 | **A fee on private payments doubles proof time** on phones | S2 §7 (transfer projected 25–60 s on low-end phones) | Charge only where amounts are already visible (bridge, Split Pay A) or batch it monthly (F4) |
| 4 | **Merchant runs out of USDT** to sell (FX demand > $100 inventory) | loop in §3 | The bank's $1,000 float sells USDT to the merchant at the bank rate (desk); payments refill the merchant during the day |
| 5 | **Bank float runs dry** on Bs trades | $1,000 cap (R1) | Redemptions never depend on it (the lock backs them); desk pauses at a floor; adding float is a bridge-in, never a mint |
| 6 | **Issuer freezes the reserve** (Tether/Circle can freeze the locked USDT/USDC on C-Chain) | §1, Tether $182M freeze | Q12 (USDT, USDC or both); USDC's court-order-only practice vs Tether's discretionary practice is the input; disclose it in the pitch |
| 7 | **Bridge drain** breaks "provable reserves" | ARCHITECTURE §1 caveat | No admin drain path + invariant L1 supply == locked (S6); audit before stage C (R1) |
| 8 | **IGTF 3 %** on crypto payments | §2.7 | Legal opinion under Q10; tax export already in scope (merchant formalization is a fit, §4 "where it could fit" #2) |
| 9 | **Fee-on-transfer token** makes escrow insolvent | audit F-03 | Already fixed: `authorize` refuses short delivery (D-010) |
| 10 | **Fee rounding** at small amounts | audit: fee rounds to 0 under 200 base units at 50 bps | Harmless (in the payer's favour); $5 at 50 bps = $0.025, exact in 6 decimals |
| 11 | **ARPB depletion** over years | §5.2 | Q25 (genesis size or `rewardManager` recycling) |
| 12 | **Thin scale**: $4,000 float can't cover costs | §5.3 | Treat stage C as a measured pilot; grow only by bridging more real dollars, never by minting (N0) |

---

## 7. Recommendation (one) and the user's decisions

### Recommendation: F2 for the pilot, with the fee machine built but set to zero
1. **Payments (plain eERC and Split Pay): 0 bps** in stage B and the first stage C months. `SplitPayEscrow` already has the fee
   snapshot, the merchant's `maxFeeBps` and the 1 % hard cap; deploy it at `feeBps = 0`. Raising it later is one multisig +
   timelock call (R3), announced in the app (N1: fee shown before signing).
2. **Merchants earn the FX band markup** (up to the spread), because in the user's model they "provide the liquidity" as exchange
   houses. FxLedger enforces the band; the bank sets rate and spread (Q17, Q21).
3. **The bank earns at the visible points:** a flat bridge-out fee that recovers relayer gas, and its own USD↔Bs desk with the
   $1,000 float. Its larger benefit is the one the user named: provable reserves "even if the bank goes bankrupt tomorrow", and no
   core rebuild. That is a strategic argument, not a revenue promise.
4. **Gas: free to users**, paid from genesis ARPB; no top-up money exists or is needed in the pilot.
5. **Turn on a payment fee only with data:** after stage C measures active merchants per week and "cost per $100 moved compared
   with Pago Móvil and Binance P2P" (ARCHITECTURE §3), and then preferably as the monthly batched fee (F4), which needs one proof
   per merchant per month.

Why this one: it keeps every element of the user's model; it is the only option that adds no proof to the payment path (the
largest measured risk, S2); and it matches the strongest cited market fact (micro-merchants adopt only near-zero-fee rails). Its
cost: ArepaPay earns nothing from fees in the pilot (Q23), and the pilot runs at an estimated ~$190/month net cost (ASSUMPTION).

### Decisions for the user (continuing from Q18)
| Q | Decision | Recommendation |
|---|---|---|
| Q19 | Payment fee level in the pilot: 0, 50 or 100 bps | 0 bps; mechanism coded, cap 1 % |
| Q20 | Who keeps the FX band markup: the merchant, or shared with the bank | The merchant (exchange-house role) |
| Q21 | Which reference rate anchors the band: official BCV, or BCV + P2P median (PLAN Phase 4) | BCV + P2P median, signed with bounds (risk 1); spread width stays Q17 |
| Q22 | Bridge fees: none, flat on exit only, or % both ways | Free in; flat on exit, cost recovery only |
| Q23 | ArepaPay's revenue: a share of the fee router, a service agreement with the bank, or none during the pilot | Your call; this memo does not choose a business model for you |
| Q24 | Fee router recipient and split (bank / ArepaPay), once any fee is on | One multisig address; split set in writing with the bank |
| Q25 | ARPB long term: bigger genesis allocation, or `rewardManager` recycling fees to the gas station; `minBaseFee` level | Bigger genesis for Fuji/mainnet + wallets paying the base fee; recycling only if needed |
| Q26 | Who pays validator AVAX, validator machines and the server | Each node's operator pays its node; ArepaPay pays the gateway/indexer server |
| Q27 | When a payment fee is turned on: per payment (second proof) or monthly batched (F4) | Monthly batched |
| Q28 | IGTF/tax treatment of on-chain USDT payments and who withholds (with Q10, legal wrapper) | Legal opinion before stage C |
| Q29 | Merchant collateral: a fixed $100, or "the amount that fits the use" (ARCHITECTURE L2) with $100 as the stage C cap | $100 cap in stage C (R1), lower allowed |
