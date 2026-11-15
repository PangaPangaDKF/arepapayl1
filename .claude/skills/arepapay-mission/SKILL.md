---
name: arepapay-mission
description: ArepaPay v2 charter — what to build and what never to change. Load FIRST in every ArepaPay session, before choosing what to build, settling a disagreement between agents, or writing any public claim. Holds mission priorities, hard rules R1–R12, scope fence, decision test and definition of done.
---

# ArepaPay mission (charter)

Version 1.3 · 2026-11-15 · D-001, D-005, D-007, D-014 · Wins every conflict. Built on `master-method` (load it too).

## Role line
ArepaPay is a Venezuelan payments and banking app on its own **permissioned Avalanche L1 (testnet)**. Micro and small merchants (a bakery, a
water-refill shop) deposit **real USDT/USDC collateral** (about $100 each) through **the bank's bridge** into the bank's private
L1, where balances and transfers are **encrypted with the eERC SDK**; customers pay them with prices in bolívares; **KYC is
mandatory for everyone**; the bank runs the validators, the bridge and the ramps; a **bank-style back office** serves them. Merchants are also **exchange houses**: they provide the liquidity and sell
USDT/USDC to customers at the bank's band rate, with every sale recorded in the FX ledger (`docs/features/MERCHANT_FX.md`).
The product is **a light payments app and nothing more** (user, D-014): "mientras más minimalista y sencilla mejor". User's words (2026-11-14): "a testnet L1 … a centralized dApp and an encrypted one with full bank
management and with KYC". Refined 2026-11-15 (D-005): "a centralized banking chain for micro and small business … banks will be
the ramps … it always will be a private chain for merchants … a small test for the idea and how it can fail or fit into the real
world". Main customers: **merchants**. Oversight: a multisig "data cooperation" of independent entities that can view (by case)
and freeze, never a single key. Architecture: `docs/ARCHITECTURE.md`.

## Mission priorities (1 beats 2 beats 3 …)
1. **Money is correct and safe.** No value from nothing (N0); exact fees (N1); solvency proven (N2); keys never exposed (N6).
2. **Compliance by design.** KYC gates access through the chain allowlist; no PII on chain; auditable back office.
3. **Payments that actually settle** on the L1, end to end, with the real app and real merchants on testnet.
4. **Privacy that is real.** Encrypted balances only through a proven design (eERC or a measured fallback), never cosmetic.
5. **Bank-grade operations.** Accounts, ledger, statements, limits, roles, audit log.
6. **Minimal.** Pay, split pay, merchant FX sale, statements. Amounts in Bs, merchant QR, the cream/navy/gold look. Raffles and
   WiFi vouchers are **removed** (D-014).

## Hard rules
| ID | Rule | Concretely | Why |
|---|---|---|---|
| R1 | Staged money | Real USDT/USDC only in stage C (ARCHITECTURE §3), after the audit pipeline is green; caps: ~$1,000 initial liquidity, ~$100 per merchant; copy states the stage | Master-method §4.3: mocks prove logic, only the live chain proves deployment (D-007) |
| R2 | No PII on chain | Chain holds tier, expiry, hash; PII encrypted off chain | Privacy law; chains are forever |
| R3 | Admin = multisig + timelock | No lone EOA owns contracts, allowlists or validators | v1's single public key owned everything |
| R4 | No cosmetic security | "Encrypted", "KYC", "audited" appear only when code proves it | DeepSeek's v1 claims were false |
| R5 | Native minting disabled | `contractNativeMinter` off; supply only from genesis/fees | N0 |
| R6 | Server never trusts the client | Amounts, rates, ids, KYC status validated server-side | DOGEON relay lessons |
| R7 | One source of truth | Chain params, addresses, fees generated into `config/`, consumed everywhere | B6 |
| R9 | One bridge, run by the bank | Only the bank's ICTT bridge to C-Chain USDT/USDC; no other bridges or external platforms; bridge has no admin drain path; L1 supply == locked on C-Chain (invariant) | User: "the bank bridges, as the entity in charge of its chain and validators" (D-007) |
| R10 | Oversight by multisig, logged | Audit (decrypt a case) and freeze powers sit in bank-led multisigs (signers = Q9); every use logged on chain | User: "if someone moves your funds, the bank can tell you"; no lone key (N6) |
| R12 | **No resale, no black market (unbreakable)** | Every merchant → customer transfer maps to an FX order or payment; customer → customer transfers flagged; rates outside the bank band rejected; offenders frozen; legal agreements | User: "es una regla que no se puede quebrar" (D-014, MERCHANT_FX §2) |
| R11 | KYC mandatory | Every wallet is enabled only after KYC at the bank; only real people | User: "only real people can register, it's a bank's network" (D-007) |
| R8 | Light and minimal | Smallest change that moves a priority; no decorative extras | User's standing rule |

## Scope fence
| IN | OUT (until the user says otherwise) |
|---|---|
| Bank-run private L1, bank ICTT bridge for real USDT/USDC, merchant collateral deposits, eERC converter (SDK) encryption, mandatory KYC, merchant payments, Split Pay, merchant FX sales + FX ledger, bank FX (USD↔Bs), audit + freeze multisigs, ledger/back office, tax export, restock payments, landing | Lending/credit/RWA (later, on merchant consent), yield products, a speculative token, other bridges or external platforms, real money before stage C, the AI agent before Phase 6, reversal/clawback power (Q11), raffles, WiFi vouchers, rewards (removed D-014) |

## Decision test (before building anything)
1. Which priority does this advance? None → don't build.
2. Does it touch R1–R12? → stop and apply the rule.
3. What is the lightest version?
4. How will I prove it (test, gate, live check)?
5. Does it touch the other lane? → board task first.

## Definition of done
Gate green with output quoted · DECISIONS entry · docs/STATE updated · committed (own paths) · public copy still true.

## DO NOT
Handle keys or seeds · reuse any v1 key · copy v1 files without a secret scan · claim a feature in present tense before it is
live · promise yield, price or returns · add scope the user didn't ask for · use caveman style.

## Gap list (charter vs code, 2026-11-14)
Everything is a gap: v2 has no code yet. v1 facts are in `docs/research/arepapay_ground_truth.md`.
