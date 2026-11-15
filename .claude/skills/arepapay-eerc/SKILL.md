---
name: arepapay-eerc
description: Verified knowledge of Avalanche's encrypted ERC-20 (eERC, ava-labs/EncryptedERC) for ArepaPay — what it hides from whom, modes, registration, transfers with messages, auditor, provers (circom/SDK and Go/gnark), hard limits (a contract can't hold an encrypted balance without an off-chain proving key; a Safe CAN be an eERC account), and design patterns (bank-held encrypted escrow, dual control). Load before designing, prompting or coding anything that touches encrypted balances, the auditor key, freezes, escrow of encrypted funds, or Split Pay option C.
---

# ArepaPay eERC knowledge

Version 1.1 · 2026-11-15 · D-011, corrected by spike S2 (D-012) · Source read by BRAIN: `ava-labs/EncryptedERC@8dc98cd` (audited circom + gnark; last security
fix 2026-08-31). Every fact below cites the file it was read from. Re-verify the line numbers if the upstream commit changes.

## 1. What eERC hides, and from whom
| Data | On ArepaPay's private L1 (no public RPC) | Inside the chain (bank nodes) | Auditor key | Receiver |
|---|---|---|---|---|
| Balances | hidden | encrypted (ElGamal on BabyJubJub) | decrypts | own only |
| Transfer amount | hidden | encrypted | decrypts (`AuditorPCT`) | decrypts (`ReceiverPCT`) |
| Sender / receiver addresses | hidden | **visible** (`PrivateTransfer(address indexed from, address indexed to, …)`, `EncryptedERC.sol:122`) | visible | visible |
| Deposit / withdraw amounts (converter mode) | hidden | **visible** (`Deposit(user, amount, …)`, `Withdraw(user, amount, …)`, `EncryptedERC.sol:137,153`) | visible | — |
| Message attached to a transfer | hidden | raw bytes as the sender chose them (`PrivateMessage`, `EncryptedMetadata.sol:95`); the SDK encrypts them **to the receiver only** | **not readable** unless the app also encrypts a copy to the auditor | decrypts |

**Deposits are not private:** converter deposits encrypt with a fixed randomness of 1 (`EncryptedERC.sol:661-668`), so the
balance of an account that has only deposited/withdrawn is derivable by anyone who sees the chain. Privacy starts with the first
private transfer (real randomness).

Encryption hides **amounts and balances**, not counterparties. Counterparties are hidden from outsiders only because the L1 is
private (ARCHITECTURE L1).

## 2. Building blocks
- **Modes** (README):
  - *standalone*: new private token; owner-only `privateMint`, `EncryptedERC.sol:254-295`; total supply private.
  - *converter*: wraps an existing ERC-20 via `deposit`/`withdraw` with a TokenTracker.
  - ArepaPay uses **converter** over the bridged USDT/USDC (D-007).
- **Registration** (`Registrar.sol:82-110`, `circom/registration.circom`):
  - The proof's public inputs are `SenderPublicKey, SenderAddress, ChainID, RegistrationHash`.
  - The contract requires `msg.sender == SenderAddress` and the right chain id.
  - **Any address can be an account, including a Safe**, if that address sends the register tx with a proof made by whoever
    holds the BabyJubJub private key.
- **Transfer** (`EncryptedERC.sol:368-400`, `circom/transfer.circom`):
  - The sender proves, with their private key, that they hold enough balance.
  - The ciphertexts for sender, receiver (`ReceiverPCT`) and auditor (`AuditorPCT`) are inside the proof.
  - The overload `transfer(to, tokenId, proof, balancePCT, message)` emits `message` as metadata. **Use it to link a transfer to a
    business object** (e.g. a Split Pay intent id).
  - Both parties must be registered, and an auditor must be set.
- **Auditor** (`EncryptedERC.sol:228-233`):
  - one auditor public key per contract, set only by the owner, from a registered user's key; rotatable.
  - For ArepaPay the owner is the bank multisig (R10). Splitting the auditor *private* key (Shamir / threshold ElGamal) is spike S3.
- **Blacklist** is per token (`TokenTracker.sol:45-81`), not per user. **Freezing a person = removing them from `txAllowList`**
  (ARCHITECTURE L4).
- **Provers:**
  - circom + snarkjs in the browser/app via `@avalabs/eerc-sdk` (payers);
  - a Go/gnark prover in `zk/` (`make build` → `build/encryptedERC`), usable by a **server** (the bank's escrow service).

## 3. Hard limits (design around them)
1. **A contract cannot hold or move an encrypted balance on its own.** Moving encrypted funds needs a fresh ZK proof from the
   account's private key. So "escrow of encrypted funds" always means *some* off-chain key holder. The design question is who,
   and under what control.
2. **The receiver learns the amount** (`ReceiverPCT`). An escrow account's key holder sees every amount sent to it.
3. **Proofs are per transfer** and depend on the sender's current encrypted balance. Two transfers from the same account must be
   sequenced (the second proof uses the balance after the first).
4. **Contract accounts bypass `txAllowList` for the account itself:** the allowlist checks the EOA that sends the tx, so a
   contract account (Safe, forwarder) acts through its executors. **Freezing a contract account = removing every EOA that can
   execute for it.** Mitigation on ArepaPay: `contractDeployerAllowList` means only the bank deploys contracts, so every contract
   account is bank-approved (S2).
5. **Capacity:** a private transfer costs about 1.0–1.14M gas. At an 8M block gas limit and 2 s blocks that's about 3.5 private
   transfers/s; raise the gas limit in genesis or through the fee manager before the pilot (S2).
6. **Proof time is the bottleneck.** Measured on an i5-6500 (S2): transfer 4.4–6.5 s in Node and 7.6 s in headless Chrome;
   withdraw 2.2–4.1 s; registration 0.4–1.1 s. A low-end Android browser is projected at 25–60 s (**unmeasured, the user's
   step**, `docs/spikes/S2.md` §8). Kill criterion: more than 10 s on median phones.
7. **Install upstream with `npm install --ignore-scripts`.** The postinstall runs a fresh trusted setup that would not match the
   shipped prod verifiers.
8. **Addresses are public inside the chain.** Never promise "nobody knows who paid whom" to the bank or the auditor.

## 4. Patterns
- **Contract-controlled account (proven in S2):** a forwarder registered with a proof made for its own address received 1.00
  and sent 0.40 out; the owner calling `register` directly is refused (`InvalidSender`). A real Safe is the same pattern (not yet run).
- **Dual-control encrypted escrow (Split Pay option C):**
  - the escrow *account* is a **Safe** registered in eERC;
  - the **bank's escrow service** holds the BabyJubJub key (HSM) and builds proofs;
  - every outgoing transfer is executed only by the **Safe with t-of-n signatures**;
  - neither the key holder alone nor the signers alone can move funds.
  - Spec: `docs/features/SPLIT_PAY_C.md`.
- **Attested holds:**
  - the service decrypts `ReceiverPCT` for incoming transfers tagged with an intent id (message);
  - it posts a signed attestation on chain (`attestHold(intentId, payer, amount, txHash, logIndex)`);
  - the coordinator contract keeps the state machine.
  - Idempotency key = `(txHash, logIndex)` (N4).
- **Reconciliation invariant:** at every block, *decrypted escrow balance == sum of open attested holds*. The service checks
  it continuously; the auditor checks it independently on a schedule (N2 for encrypted funds).

## 5. Checklist before using eERC in a design
- [ ] Which party holds each private key (user, escrow, auditor), and under what control (HSM, Safe, threshold)?
- [ ] Which amounts become visible to whom (table §1)? Is the public copy honest about it (T1, R4)?
- [ ] Are transfers that touch one account sequenced (limit 3)?
- [ ] Is every attestation idempotent and replay-safe (chain id + contract + txHash + logIndex)?
- [ ] Is there a reconciliation invariant and an independent checker?
- [ ] What happens if the key holder's service is down at expiry (refund obligations, SLA, escalation)?
