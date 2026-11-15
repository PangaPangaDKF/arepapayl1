---
name: arepapay-solidity
description: ArepaPay money rulebook. Load before ANY change to contracts, L1 genesis/precompiles, fees, the ledger, the BCV rate signer, KYC allowlisting, or any code that sends a transaction or moves value. Holds the nerves N0–N7, the money map, the workflow and the review checklist.
---

# ArepaPay Solidity and money rules

Version 1.0 · 2026-11-14 · D-002 · Copied from DOGEON `dogeon-solidity` (user rule 2026-11-14 "mints can't be infinite and from
nothing, you spend you get") and adapted for a regulated payments app. Full whys: master-method KNOWLEDGE §4.3.

## Nerves
- **N0 SPEND → GET.** Nothing minted, credited or paid out of nothing. Rewards, tickets and prizes are funded by fees that already
  arrived. Native minter disabled on the L1. A function that creates value without a matching input is a bug, even if admin-only.
  Off-chain facts (KYC approved, cash received) bind on chain only through a role-signed call or voucher, never client input.
- **N1 Exact payment.** One fee in bps with a hard cap in code, changed only by the multisig through the timelock with an event;
  the app shows the fee before signing.
- **N2 Solvency.** For every contract holding value: `balance ≥ obligations` (escrows + fees owed + prizes owed), proven by a
  Foundry invariant test that is a hard gate. No admin "yield", no promised returns.
- **N3** CEI + `nonReentrant` + pull payments; SafeERC20 for every transfer; no unbounded loops.
- **N4** No dupes across the chain/backend border: the ledger mirrors chain events idempotently (tx hash + log index); refund only
  on explicit reject/revert, never on unknown outcome.
- **N5** Honest copy: testnet, no real money, no yield/price/return language.
- **N6** Key safety: agents never ask for, store, print or log a key or seed; deploys use a Foundry encrypted keystore in the user's
  shell; all admin roles (contracts, allowlist precompiles, fee manager, validator manager) belong to a Safe multisig + timelock.
  v1 keys are burned and never reused.
- **N7** Browsing and onboarding work without a wallet popup.

## Money map (fill as contracts land; generated values only)
| Contract | Takes | Gives | Fee route | Admin |
|---|---|---|---|---|
| PaymentProcessor v7 | payer USDT | merchant USDT − fee, 1 ticket above min | FeeRouter | multisig/timelock |
| FeeRouter | fees | prize pool / ops / reserve (split = Q5) | — | multisig/timelock |
| OTCEscrow v2 | merchant USDT + bonds | buyer USDT on confirm; bonds per dispute outcome | — | compliance arbiter role |

## Workflow (every money change)
1. Plan entry (board task + D-number) → 2. failing Foundry test first (unit + fuzz; invariant for anything holding value; test first,
last and empty-state participants) → 3. code (OZ v5 pinned, custom errors, events, NatSpec) → 4. `forge test` → 5. `solidity-auditor`
loop (3 passes) + `solidity-security` + `avax-security` checklists → 6. local L1 deploy + E2E script → 7. Fuji L1 deploy by the
user's keystore → 8. live E2E.

## PR checklist
- [ ] N0: every output has a matching input · [ ] N1: fee exact, capped, shown · [ ] N2: invariant test green
- [ ] N3: CEI, nonReentrant, SafeERC20 · [ ] N4: idempotent, refund only on reject · [ ] N5: copy honest
- [ ] N6: no key anywhere, admin is multisig · [ ] events for every state change · [ ] no unbounded loops · [ ] "can one input produce two outputs?"
