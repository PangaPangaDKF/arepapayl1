# ArepaPay lessons (error → rule ledger)

Every lesson ends in a rule enforced by something automatic. Never delete; supersede and link. Format: master-method TEMPLATES §2.
Inherited general lessons: master-method KNOWLEDGE §9 (C1–C15).

### L-001 · 2026-11-14 · BRAIN · security · v1 deployer key published
- What happened: the private key that owns every v1 contract and the L1 validator manager was written into docs and scripts and pushed to a public repo.
- Root cause: deploy scripts and progress notes held the literal key; no secret scan existed.
- RULE: no key ever enters a file; deploys use a Foundry encrypted keystore in the user's shell; admin roles go to a multisig (N6, R3).
- Enforced by: `tests/check.sh` stage 1 secret scan; `arepapay-solidity` N6.

### L-002 · 2026-11-14 · BRAIN · process · features claimed by another vendor did not exist
- What happened: a DeepSeek-harness commit described an "encrypted L1 SDK", KYC and institutional banking; code review showed undecryptable output, an unused genesis and no KYC.
- Root cause: commit messages and landing copy were trusted as state.
- RULE: inherited features are claims until a test or live check proves them (C14); public copy carries status labels (T6).
- Enforced by: `arepapay-landing-design` T6 + `landing-check.mjs` (status label check); BRAIN STATE "verified facts" list.

### L-003 · 2026-11-15 · BRAIN · analysis · steered the user's model toward an incumbent design
- What happened: D-005 v1.0 turned "the bank is the ramp" into "no bridge, bank-issued IOU" and added a no-KYC customer tier and a council of outside entities, framing the user's blockchain design through traditional-finance assumptions. The user corrected it.
- Root cause: research findings (what incumbents do) were used to redesign the user's model instead of to analyze it.
- RULE: master-method S8: analyze the user's model on its own terms first; present risks as engineering facts next to it, never as a replacement; any departure from the user's words is a question, not a decision.
- Enforced by: master-method S8 + M0 (state which part is the user's spec and which is BRAIN's analysis); ARCHITECTURE §0 quotes the user's spec verbatim before any design.
