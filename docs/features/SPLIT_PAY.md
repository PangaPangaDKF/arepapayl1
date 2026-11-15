# Feature: Split Pay (one QR, several payers, one payment)

Version 1.1 · 2026-11-15 · D-009, D-010 · Owner: BRAIN · Status: **option A built** (`contracts/src/SplitPayEscrow.sol`, 34 tests, audited `docs/audits/2026-11-15/split-pay-A.md`) · option C spec: `SPLIT_PAY_C.md`

## 0. The user's spec (their words, condensed and translated)
- "The customer wants to pay $5, but one customer has $3 and the other the rest."
- "The merchant app creates a QR. The QR's contract is an **open transaction**."
- "A **verification** happens first, as a transaction, to know the customer has the amount. When the other one reads the QR, the
  contract also verifies they have the rest."
- "They get a **notification** that the contract verified they have the amount."
- "Then, through an API, agent or automation, the app that shows the QR sends a **'pay' notification**. When both pay, the $5 is
  settled."
- "It removes a bit of fee from the price, and that's where the complexity is: those contracts or algorithms must be meticulously
  built."
- "It's like when a customer pays the same thing with different cards."

## 1. What it is called (so we can search, prompt and explain it)
| Name | Where it comes from | Meaning |
|---|---|---|
| **Split tender** | Retail / card POS | One order paid with several payment methods. In card systems each part gets its own **authorization** linked to one order id, then it is **captured** or **voided** together (e.g. Authorize.net `splitTenderId`). Exactly the "different cards" case. |
| **Authorization hold → capture / void** | Card networks | Step 1 *reserves* the money (hold); step 2 *collects* it (capture) or *releases* it (void). This is the user's "verification first, pay after". |
| **Group payment / all-or-nothing** | Blockchain (e.g. Algorand atomic transfers) | Everyone pays or nobody pays; no payer can leave the merchant short. |
| **Assurance contract** | Economics / crowdfunding | Pledges are collected only if the target is reached, otherwise returned. Kickstarter is one. |
| **Payment intent** | Stripe-style APIs | An object that represents "this merchant wants $5 for order X" and moves through states. Our QR points to one. |
| **Two-phase commit** | Databases | Prepare (everyone confirms they can) → commit (everyone does it together). |

**Our name:** *Split Pay*, technically a **multi-payer payment intent with authorization holds and all-or-nothing capture**.

## 2. The user's flow, mapped step by step
| User's step | On chain | Why |
|---|---|---|
| Merchant app creates the QR (open transaction) | `createIntent(merchant, total=5.00, expiry=+10 min, maxPayers)` → `intentId`; the QR encodes `arepapay://pay?intent=<id>&chain=<chainId>` | The QR is only a pointer; amount and merchant live in the contract, so a QR can't be tampered with |
| Payer 1 scans, chooses $3, "verification" | `authorize(intentId, 3.00)`: **the $3 moves into the intent's hold** | A balance *check* is not a guarantee: between the check and the payment the payer can spend the money elsewhere. That's why cards *hold* funds. Holding *is* the verification. |
| Notification "verified, you have the amount" | `Authorized(intentId, payer, amount, covered=3/5)` event → indexer → push to all payers + merchant | Event-driven backend; deterministic, no AI needed for money flows (N4) |
| Payer 2 scans, $2, verification | `authorize(intentId, 2.00)` → covered = 5/5 | Contract caps the last share at the remaining amount (no overpay) |
| "Pay" notification, both pay → $5 settled | **Option 1 (automatic):** the authorize that reaches 5/5 triggers `capture` in the same tx → merchant paid. **Option 2 (user's flow literally):** state becomes `Ready`; each payer gets "confirm payment"; when all confirmed (or the merchant presses charge), `capture` | Option 1 has fewer steps and no stuck states; Option 2 matches the user's described UX (a final confirm). The user picks (Q13). |
| Not enough before expiry | `void`: every payer can withdraw their hold (pull payment), or the merchant cancels → all released | Nobody loses money; matches card "void" |

**About the fee:**
- What actually gets cheaper is **one settlement to the merchant** instead of N separate payments, plus no card or processor fees.
- On the bank's own L1, gas is near zero and paid by the gas station. So the saving is mostly in the merchant's fee per payment
  (set in code, N1) and the accounting (one sale = one record).

## 3. The hard part: encryption (eERC) meets escrow
- An escrow contract **cannot hold an eERC balance by itself.** Registration requires `msg.sender == account` plus a ZK proof made
  with that account's private key (`Registrar.sol:82-89`), and moving encrypted funds needs new proofs from that key.
- So the hold must live in one of three places:

| Option | How | Privacy | Guarantee | Fits |
|---|---|---|---|---|
| **A. Hold on the private chain's public layer** | Each payer withdraws their share from eERC into the bridged ERC-20 and locks it in `SplitPayEscrow`; capture pays the merchant (who can re-deposit into eERC) | Amounts visible to the bank's nodes only (the chain is private), same as deposits today | Strongest: refunds enforced by code | Fastest to build and prove |
| **B. Pay the merchant directly (encrypted) + commitment tracker** | Payers send encrypted transfers straight to the merchant; the contract only tracks commitments and coverage; the merchant refunds if incomplete | Fully encrypted | Weaker: refunds depend on the KYC'd merchant | Most private |
| **C. Bank-operated escrow account** | A registered escrow account whose eERC key is held by the bank's service (multisig/HSM) | Fully encrypted | Bank-backed; the bank is briefly the custodian | Matches the "bank-centralized" model |

Spike S7 measures A, then C. B is the fallback if neither is acceptable.

## 4. Rules the contract must meet (meticulous part)
- **N0** no value from nothing: captured total == sum of holds == intent total, exactly.
- **N1** exact fee, capped, shown before each payer authorizes.
- **N3** CEI + nonReentrant + SafeERC20; refunds are pull-based.
- **N4** idempotent; notifications keyed by tx hash + log index; refund only on void/expiry, never on "unknown".
- Concurrency: two payers racing for the last share → the second gets only the remainder or reverts. Never over-cover.
- Expiry always ends in a terminal state (captured or voided). No funds stuck forever.
- The same payer can top up or withdraw before capture (decide: Q14).
- Max payers per intent (gas bound, no unbounded loops): up to 10.
- **Fair share (audit F-01):** a new payer must cover at least `remaining / free slots` (or the whole remainder). Dust can't fill the slots, and the free slots can always complete the total.
- **Confirm window (audit F-02):** in confirm mode, once 100% is covered, payers have 5 minutes (`CONFIRM_TTL`) to confirm; otherwise the intent becomes voidable and everyone withdraws.
- **Merchant fee cap (audit F-07):** `createIntent(..., maxFeeBps)` reverts if the current fee is higher than the merchant accepts.
- **Anyone can `expire`** an intent past its expiry (audit F-08).
- **Full delivery only (audit F-03):** a token that delivers less than requested is rejected (`UnsupportedToken`).
- Every payer must be KYC'd (txAllowList already enforces it).
- 6-decimal USDT/USDC rounding: shares in base units; the UI shows Bs and USD.
- Invariant tests (Foundry): sum of holds ≤ total; contract balance == sum of open holds; after capture, the merchant got total − fee and
  the fee router got the fee; after void, every payer can withdraw exactly what they put in.

## 5. Open decisions (user)
- Q13: automatic capture at 100% (option 1) or a final "confirm" from each payer (option 2).
- Q14: can a payer change or withdraw a share before capture?
- Q15: escrow option A, B or C (after spike S7 numbers).
