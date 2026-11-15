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

### L-004 · 2026-11-15 · BRAIN · knowledge · a "verified" skill fact was inferred, not run
- What happened: `arepapay-eerc` v1.0 said the auditor can read the transfer message. Spike S2 showed the message is raw bytes that the SDK encrypts to the receiver only.
- Root cause: the row was written from the event's existence (code read) without running a flow.
- RULE: a skill fact is marked verified only after a run that exercises it; code-read-only facts are labeled TRACED.
- Enforced by: `arepapay-eerc` §1 now cites the S2 run; skill checklist and STATE "verified facts" use PROVEN/TRACED labels.

### L-005 · 2026-11-15 · BRAIN · collaboration · committed the other lane's uncommitted line in a shared file
- What happened: `docs/AGENT_BOARD.md` was already dirty (LANDING reserving D-013) when BRAIN edited it and staged the whole file in eb1318d.
- Root cause: C1 check was done (`git status` showed ` M docs/AGENT_BOARD.md`) but not acted on for an append-only shared file.
- RULE: if a shared file is dirty before you edit it, don't stage it; finish your other paths, then edit the shared file after the other lane commits (or write your board line in the next turn).
- Enforced by: `arepapay-agent-sync` §3 line added in the same commit.

### L-006 · 2026-11-15 · BRAIN · verification · a red gate was hidden by a pipe
- What happened: `bash tests/check.sh | tail -1 && git commit …` committed fa57b5a although the gate printed a FAIL (the pipeline's exit code is `tail`'s). The re-run was green (likely a concurrent landing build), and the commit was docs only, but the gate didn't actually guard it.
- Root cause: exit code lost in a pipe.
- RULE: never pipe the gate inside an `&&` chain; run `bash tests/check.sh > /tmp/gate.log; rc=$?; tail -3 /tmp/gate.log; [ $rc -eq 0 ] && git commit …`, or use `set -o pipefail`.
- Enforced by: this lesson + `arepapay-brain` §6 gate line updated in the same commit.

### L-007 · 2026-11-15 · BRAIN · tooling · the CLI lagged a mandatory network upgrade
- What happened: Fuji's Helicon upgrade requires avalanchego ≥ 1.15, and subnet-evm moved inside the avalanchego release. avalanche-cli 1.9.7 still resolves subnet-evm v0.8.0 (plugin 44), and the public API dropped methods the CLI uses (`platform.getBalance`, `avax.getAtomicTxStatus`).
- Root cause: tool versions were assumed compatible with the live network.
- RULE: before any public-network deploy, check (1) the network's required node version and active upgrades, (2) the VM plugin version that node needs, (3) that every API method the tool calls still exists. Run your own node and use `--endpoint` when the public API is trimmed.
- Enforced by: STAGE_B_FUJI runbook preflight + this lesson (promoted to master-method G6 note).
