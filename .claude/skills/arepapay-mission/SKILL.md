---
name: arepapay-mission
description: ArepaPay v2 charter — what to build and what never to change. Load FIRST in every ArepaPay session, before choosing what to build, settling a disagreement between agents, or writing any public claim. Holds mission priorities, hard rules R1–R8, scope fence, decision test and definition of done.
---

# ArepaPay mission (charter)

Version 1.0 · 2026-11-14 · D-001 · Wins every conflict. Built on `master-method` (load it too).

## Role line
ArepaPay is a Venezuelan payments and banking app on its own **permissioned Avalanche L1 (testnet)**. People pay neighbourhood
merchants in USDT with amounts in bolívares, keep **encrypted balances**, pass **KYC** to get an account, and are served by a
**bank-style back office**. User's words (2026-11-14): "a testnet L1 … a centralized dApp and an encrypted one with full bank
management and with KYC".

## Mission priorities (1 beats 2 beats 3 …)
1. **Money is correct and safe.** No value from nothing (N0); exact fees (N1); solvency proven (N2); keys never exposed (N6).
2. **Compliance by design.** KYC gates access through the chain allowlist; no PII on chain; auditable back office.
3. **Payments that actually settle** on the L1, end to end, with the real app and real merchants on testnet.
4. **Privacy that is real.** Encrypted balances only through a proven design (eERC or a measured fallback), never cosmetic.
5. **Bank-grade operations.** Accounts, ledger, statements, limits, roles, audit log.
6. **ArepaPay's character.** Amounts in Bs, merchant QR, raffles and WiFi minutes funded by fees, the cream/navy/gold pixel look.

## Hard rules
| ID | Rule | Concretely | Why |
|---|---|---|---|
| R1 | Testnet only until legal review | Every screen and page says testnet, no real money | Regulatory exposure (N5, T7) |
| R2 | No PII on chain | Chain holds tier, expiry, hash; PII encrypted off chain | Privacy law; chains are forever |
| R3 | Admin = multisig + timelock | No lone EOA owns contracts, allowlists or validators | v1's single public key owned everything |
| R4 | No cosmetic security | "Encrypted", "KYC", "audited" appear only when code proves it | DeepSeek's v1 claims were false |
| R5 | Native minting disabled | `contractNativeMinter` off; supply only from genesis/fees | N0 |
| R6 | Server never trusts the client | Amounts, rates, ids, KYC status validated server-side | DOGEON relay lessons |
| R7 | One source of truth | Chain params, addresses, fees generated into `config/`, consumed everywhere | B6 |
| R8 | Light and minimal | Smallest change that moves a priority; no decorative extras | User's standing rule |

## Scope fence
| IN | OUT (until the user says otherwise) |
|---|---|
| Permissioned L1, KYC onboarding, encrypted balances, merchant payments, OTC cash↔USDT, ledger/back office, BCV rate signer, raffles/WiFi rewards, landing | Lending/credit lines, yield products, a speculative token, mainnet, real money, the AI agent before Phase 6 |

## Decision test (before building anything)
1. Which priority does this advance? None → don't build.
2. Does it touch R1–R8? → stop and apply the rule.
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
