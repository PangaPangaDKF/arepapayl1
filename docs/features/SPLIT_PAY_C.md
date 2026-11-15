# Split Pay option C: encrypted escrow under dual control

Version 1.0 · 2026-11-15 · D-011 · Status: **algorithm spec (not built)** · Builds on option A (`contracts/src/SplitPayEscrow.sol`,
D-010) and the eERC knowledge skill (`.claude/skills/arepapay-eerc/`). Spec of the feature: `SPLIT_PAY.md`.

## 0. Thinking (M0)
- **What we keep from A:**
  - the **state machine** (Open → Ready → Captured / Voided);
  - the **rules** (cap at remainder, max payers, expiry always terminal, fee snapshot, pull refunds);
  - the **invariants** (held == owed; captured == total; never over-covered).
  - A proved these with 28 tests, including invariants that caught planted bugs.
- **What changes:**
  - money no longer sits in a contract as a plain ERC-20;
  - it sits in an **encrypted eERC account**, because only that keeps amounts encrypted end to end (the user's privacy goal);
  - a contract can't hold encrypted funds alone (eERC skill §3.1), so custody becomes **dual control**: the bank's escrow service
    holds the proving key, and a Safe multisig must sign every outgoing transfer.
- **Why this is the bank-centralized model the user described:**
  - the bank is the trusted operator for a few minutes per payment;
  - every step is attested and logged on chain;
  - the auditor can verify it independently.

## 1. Components
| Component | What it is | Holds | Can do |
|---|---|---|---|
| `SplitPayCoordinator` (contract) | The A state machine without the token: intents, attested holds, confirmations, terminal states, refund obligations | no funds | records truth; emits events |
| Escrow account | A **Safe** (t-of-n: bank signers + ArepaPay) **registered in eERC** | encrypted funds | sends eERC transfers only with t signatures |
| Escrow service (bank) | Server with the escrow's BabyJubJub key in an HSM + the Go/gnark prover; holds the coordinator's `ATTESTER_ROLE` key | proving key | decrypts incoming amounts, builds transfer proofs, posts attestations, proposes Safe txs |
| Payers / merchant | eERC users (app + SDK) | own keys | pay into escrow with `transfer(…, message=intentId)` |
| Auditor (multisig, R10) | eERC auditor key | view key | independently re-checks reconciliation |

## 2. Algorithm (A's steps, mapped)
**1. Create.** The merchant calls `createIntent(total, expiry, maxPayers, requireConfirm)` on the coordinator, as in A (fee
snapshot, limits). The QR encodes `intentId`.

**2. Authorize (hold), payer side.**
- The app reads the intent, shows the remaining amount and the fee (N1), and caps the share at the remainder in the UI.
- The payer generates an eERC transfer proof (SDK) to the escrow account for `share`.
- The payer calls `EncryptedERC.transfer(escrow, tokenId, proof, balancePCT, message = abi.encode(intentId, chainId,
  coordinator))`.

**3. Authorize, service side** (per `PrivateTransfer(from=payer, to=escrow)` event with an intent message):
```
on PrivateTransfer(from, to=escrow, txHash, logIndex) with message m:
    require m.chainId == chainId and m.coordinator == coordinator            # replay-safe
    key = (txHash, logIndex); if seen(key): return                          # N4 idempotent
    amount = decrypt(ReceiverPCT, escrowKey)                                # exact amount received
    it = coordinator.intent(m.intentId)
    if it.state != Open or now >= it.expiry or from == it.merchant or payer cap reached:
        queueRefund(from, amount, reason)                                   # nothing is kept that isn't owed
        return
    accepted = min(amount, it.total - it.covered)
    excess   = amount - accepted
    coordinator.attestHold(intentId, from, accepted, txHash, logIndex)      # ATTESTER_ROLE; emits Authorized
    if excess > 0: queueRefund(from, excess, "over remainder")
```
The coordinator's `attestHold` applies A's rules on chain (state, expiry, max payers, cap) and **reverts** if the attested amount
would over-cover. The service then refunds instead (the same logic as A's cap, enforced twice).

**4. Ready / confirm / capture.** Same as A.
- When `covered == total`, the state becomes Ready (confirm mode) or captures directly.
- Capture on the coordinator emits `CaptureRequested(intentId, net, fee)`.
- The service then:
  1. builds proof 1, escrow → merchant `net` (message = intentId);
  2. builds proof 2, escrow → fee router `fee`, sequenced after proof 1 (eERC skill §3.3);
  3. proposes both as one Safe batch;
  4. after t signatures and execution, posts `attestCaptured(intentId, txHash)`.

**5. Void and refunds.**
- On cancel, expiry, or a payer's `release` while Open, the coordinator records `refundOwed[intentId][payer] = hold`.
- The service builds escrow → payer transfers for every owed refund; the Safe executes; the service posts `attestRefunded`.
- A's pull-refund guarantee becomes **an on-chain obligation plus an SLA**: refunds owed and not attested within N minutes raise
  `RefundOverdue`, which alerts the bank, the Safe signers and the auditor.

## 3. Invariants (from A, adapted)
| A invariant | C equivalent | Checked by |
|---|---|---|
| token balance == totalHeld | **decrypted escrow balance == sum(open attested holds) + sum(refunds owed, not yet paid) + captured-not-yet-paid-out** | service every block; auditor on schedule (independent decrypt with the auditor key) |
| captured == sum(holds) == total | coordinator: `attested holds == total` at capture; merchant net + fee == total in the two transfers (decryptable by receivers and auditor) | coordinator (on chain) + auditor |
| never over-covered | `attestHold` reverts beyond the remainder | coordinator (on chain) |
| void returns every share | every `refundOwed` ends in `attestRefunded` with the same amount | service + `RefundOverdue` watchdog |
| no admin path to held funds | Safe t-of-n + proving key: neither alone can move funds; the attester role can't move funds, only attest | design + Safe config review |

## 4. Trust and failure analysis (A vs C)
| Risk | A | C |
|---|---|---|
| Amount privacy | bank nodes see amounts | amounts encrypted; escrow key holder (bank) and auditor see them |
| Who can steal held funds | nobody (contract) | needs the proving key **and** t Safe signers (collusion) |
| Refund guarantee | code (pull) | obligation on chain + SLA; depends on the bank's service being up |
| Wrong attestation | n/a | the auditor's independent reconciliation detects it; the attester key can be rotated by the multisig |
| Service down | n/a | intents expire; refunds queue as `refundOwed`; a backup service with a shared HSM policy |
| Latency | 1 tx per payer | 1 eERC proof per payer (measure on phones, S2) + escrow proofs + Safe signatures at capture |

## 5. Build order (spike S7, part 2)
1. Coordinator (A's tests reused: same state machine, attest calls instead of token pulls) → Foundry tests + invariants.
2. Register a Safe as an eERC account on the local L1. Proves eERC skill §2 "a Safe can be an account".
3. Service prototype (Node + Go prover): watch, decrypt, attest, build proofs, propose Safe batch.
4. End-to-end demo: $3 + $2 = $5 captured; $3 alone expires → refunded; tampered message ignored and refunded.
5. Reconciliation checker with the auditor key; make it fail once on purpose (V9).
