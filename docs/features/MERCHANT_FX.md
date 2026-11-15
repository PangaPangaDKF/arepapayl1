# Feature: merchants as exchange houses + the FX coordination ledger

Version 1.1 · 2026-11-15 · D-014, D-020 · Owner: BRAIN · Status: **`FxLedger` built** (`contracts/src/FxLedger.sol`, 65 tests incl. invariants)

## 0. The user's spec (their words, condensed and translated)
- "The merchants will **sell USDT or USDC to customers** and will be **exchange houses**, since they provide the liquidity."
- "Create some kind of **coordination between what the point of sale or the customer receives and what the business sends**."
- "A **record that shows it happened**, so the merchant can't move funds and not declare them."
- "It's self-custody, but there will be **laws and agreements** for protection and to avoid dishonest actions, like **reselling the
  USDT or creating black or emerging markets to exchange currency. It's a rule that can't be broken.**"

## 1. How it works (one FX sale)
```
Customer pays Bs (cash / Pago Móvil)  ──▶  Merchant (exchange house, KYC'd, holds encrypted USDT/USDC it deposited)
         ▲                                              │ eERC private transfer, amount encrypted
         │                                              ▼
   confirms receipt  ◀──────────────────────────  Customer wallet (KYC'd)
                        FxLedger contract records every step; the bank reconciles
```
| Step | Who | On chain (`FxLedger`) |
|---|---|---|
| 1. Quote | Merchant POS | `openOrder(customer, rate, commitment, expiry)`. The `rate` (Bs per USD) is checked against the bank's band; `commitment = hash(merchant, usdAmount, bsAmount, bsMethod, bsRef, salt)`. The orderId is left out because the merchant can't know it before the tx lands (D-020) |
| 2. Customer accepts | Customer app | `acceptOrder(orderId)`: the customer agrees to the quote and states they paid the Bs |
| 3. Merchant sends | Merchant POS | eERC `transfer(customer, …)`, then `markSent(orderId, eercTxHash)` |
| 4. Customer confirms | Customer app | `confirmReceived(orderId)` → **Settled**. Or `dispute(orderId)` → the bank's compliance reviews |
| 5. Bank reconciles | Bank service (auditor key) | Decrypts the transfer's amount (`AuditorPCT`); checks from = merchant, to = customer, amount = committed `usdAmount`, Bs data matches the commitment opened by the merchant app; posts `reconciled(orderId, ok)` |

- **The record the user asked for:** every sale has an order. The merchant opens it, the customer accepts and confirms it, the
  transfer is linked to it, and the bank checks that it matches.
- **The merchant's books:** the ledger *is* their FX sales record (tax and accounting export).
- **Privacy:** the chain stores the rate and a commitment, not the amounts. Amounts stay encrypted in eERC and are opened only to
  the bank's reconciliation (the bank-secrecy model).

## 2. The rule that can't be broken: no resale, no black market
No single mechanism can make it impossible, so it is enforced in layers. Each layer catches what the one before misses.

| Layer | What it stops | How |
|---|---|---|
| 1. Chain | Taking USDT/USDC to outside markets | The only exit is the bank's bridge (R9); only KYC'd wallets exist (R11) |
| 2. Contract | Speculative rates | `openOrder` rejects a rate outside the band the bank sets (e.g. bank rate ± spread), so the official/legal price is enforced at the POS |
| 3. Reconciliation | Undeclared sales | The bank sees every address pair (eERC from/to are visible to the bank, ARCHITECTURE L3). **Every merchant → customer transfer must map to a settled order or a payment refund**; otherwise it is flagged |
| 4. Reconciliation | Resale between customers | A customer → customer transfer is visible to the bank as a transfer between two non-merchant wallets. It is flagged automatically |
| 5. Freeze | Repeat offenders | The Freeze multisig removes the wallet from `txAllowList` (S1 proved the switch) |
| 6. Legal | Everything else | Merchant agreement and the laws/agreements the user described; the ledger is the evidence |

**Prevention instead of detection (Q16):** customers could be technically unable to send to anyone but a merchant or an escrow, if
eERC's `transfer` also checked the receiver's role. That means changing audited eERC code. **Default: detect + freeze (layers 3–5)
with unmodified eERC; switching to prevention is the user's decision.**

## 3. Coordination with Split Pay and normal payments
- Payments (customer → merchant) use plain eERC transfers or Split Pay. FX sales (merchant → customer) use `FxLedger`.
- Reconciliation classifies every transfer the bank sees:
  - payment;
  - FX sale (order);
  - Split Pay escrow movement;
  - bridge in/out;
  - **unexplained** (flag).

## 4. Contract rules (for the build prompt)
- N0: the ledger moves no money. It records and checks.
- Rate band: `rate ∈ [bankRate × (1 − spread), bankRate × (1 + spread)]`. `bankRate` is updated by the bank's signer with bounds and
  an event; `spread` is capped by a constant.
- Order states: Open → Accepted → Sent → Settled, or Disputed / Expired / Cancelled. Expiry is always terminal.
- Only the merchant opens and marks sent; only the named customer accepts, confirms or disputes; only the bank's reconciler
  attests; every transition emits an event.
- `markSent` hashes are unique (one transfer can't settle two orders, N4).
- Tests: every transition, wrong-actor reverts, rate band edges, expiry, duplicate tx hash, and a reconciliation simulator that
  flags an unexplained transfer.

## 4b. Decisions taken while building (D-020)
- The reconciler may also attest **Expired orders that already have a delivering transfer**. Otherwise a customer could receive
  the USD and let the order expire, which would escape reconciliation and open an R12 gap.
- A **Disputed** order is closed by the reconciler's result (Ok / Flagged); the follow-up (refund, freeze) happens off chain or
  through the Freeze multisig.
- A registered merchant may also be a customer of another merchant (a B2B restock purchase is legitimate).
- Roles are single addresses (rate signer, reconciler) under an Ownable2Step admin; `renounceOwnership` is disabled; the rate moves
  at most ±20 % per update; the spread is capped at 3 %.

## 5. Open decisions (user)
- Q16: detect + freeze (default) or prevention by modified eERC.
- Q17: who sets the bank rate and the spread (the bank's signer; and is the spread 1 %, 2 %, …?).
