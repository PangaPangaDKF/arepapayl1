# Prompt: build Split Pay (copy into a BRAIN session or give to a subagent)

Version 1.0 · 2026-11-15 · D-009 · Shape: master-method §6.1 (role → context → goals → rules → process → acceptance → negative
constraints). "Why this prompt is shaped this way" is at the bottom.

```
<role>
You are the BRAIN developer of ArepaPay v2, a bank-run private Avalanche L1 for micro-merchants. Load skills master-method,
arepapay-mission, arepapay-solidity. Apply M0 before each decision (what you think, which rule, why) and S8 (the user's spec
is the spec).
</role>

<context_to_load>
- docs/features/SPLIT_PAY.md (the spec: user's words §0, names §1, flow §2, escrow options §3, rules §4)
- docs/ARCHITECTURE.md L1–L5 (private chain, bank bridge, eERC converter, KYC allowlist)
- config/l1/arepapaybank.local.json (chain id, RPC, precompiles; never hand-type these)
- ava-labs/EncryptedERC Registrar.sol:82-89 (why a contract cannot hold an eERC balance)
</context_to_load>

<goal>
Implement Split Pay escrow option <A|B|C> as a "multi-payer payment intent with authorization holds and all-or-nothing
capture": the merchant creates an intent (total, expiry, maxPayers) shown as a QR; each payer authorizes a share, which LOCKS
it; at 100% coverage the intent captures (<automatic|after every payer confirms>); at expiry or merchant cancel it voids and
every payer withdraws exactly their share.
</goal>

<rules>
- N0: captured == sum(holds) == total, exactly. N1: one fee in bps, capped, shown before authorize. N3: CEI, nonReentrant,
  SafeERC20, pull refunds. N4: idempotent; notifications keyed by txHash+logIndex; refund only on void/expiry.
- No over-coverage under concurrency (the last share is capped at the remainder). Every intent ends captured or voided.
- maxPayers bounded (no unbounded loops). Base units (6 decimals). Events for every state change.
- Never handle private keys; local test keys only for local tests (N6).
</rules>

<process>
1. Write the failing Foundry tests first: unit (create, authorize, capture, void, withdraw), fuzz (random shares and payer
   counts), invariants (contract balance == sum of open holds; sum(holds) <= total; capture pays merchant total-fee and fee
   router fee; void returns every share). Test first payer, last payer, empty intent, expiry boundary, two payers racing for
   the last share.
2. Implement SplitPayEscrow (OZ v5 pinned, custom errors, NatSpec).
3. forge test green; run solidity-auditor loop (3 passes) + solidity-security checklist; fix only REAL findings.
4. Notification service: indexer reads Authorized / Ready / Captured / Voided events, pushes to the intent's payers and
   merchant; idempotent.
5. Close out: DECISIONS entry with the reserved D-number, docs/STATE, Conventional Commit of your paths.
</process>

<acceptance>
- bash tests/check.sh → ALL CHECKS PASSED, including the new invariants.
- A scripted demo on the local L1: merchant intent $5.00; payer A $3.00, payer B $2.00 → merchant receives 5.00 − fee;
  a second intent with only $3.00 → expiry → payer A withdraws 3.00.
</acceptance>

<negative_constraints>
- No AI agent decides money movements; automation is deterministic.
- No balance "check" in place of a lock. No admin function that moves held funds.
- Never generate Rust, Anchor, Solana code. Never bridge to anything but the bank's ICTT bridge.
</negative_constraints>
```

## Why this prompt is shaped this way
- **The spec file is separate from the prompt.** The user's words, the names and the edge cases live in `SPLIT_PAY.md`, so the
  prompt stays short and doesn't drift. B1, master-method §6.1.
- **The `<A|B|C>` and `<automatic|confirm>` slots are the user's open decisions (Q13–Q15).** Filling them is the user's call
  (S8), not the agent's.
- **Tests first with named edge cases.** Money bugs live at the first payer, the last payer, the empty state and races (C3).
- **"No balance check in place of a lock"** is spelled out because it is the one design trap in the user's flow (§2): a check
  can go stale before the payment.
