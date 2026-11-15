# BRAIN STATE (live facts, open items)

Updated 2026-11-14 (D-002).

## Phase
Phase 1 (rails) done in this session; Phase 0 user actions U1–U3 pending; next: spikes S1–S4 after the user answers Q1.

## Verified facts (2026-11-14, BRAIN re-checked the research agent's claims)
- Live v1 L1: chain 13370, Subnet-EVM v0.8.0, local only (`~/.avalanche-cli/subnets/ArepaPay/genesis.json`), genesis has only
  `feeConfig` + `warpConfig` (no allowlists). RPC is down.
- DeepSeek `config/genesis.json` (chainId 432100) adds allowlist/minter/fee/reward precompiles but was never used by any chain.
- DeepSeek "encryption": `encryptedL1SDK.ts:16` uses `nacl.randomBytes(32)` as the sender secret key and discards it → no one
  can decrypt. Transfers are plain public ERC-20.
- No KYC code anywhere in v1 (`grep -i kyc` in agent src + contracts: no hits).
- v1 PaymentProcessor has no fee (no `fee` in `arepapay-l1/contracts/src/PaymentProcessor.sol`).
- The L1 deployer private key is in tracked files on `origin/main` of `PangaPangaDKF/arepaAgent`
  (`contracts/reference/SetupL1.s.sol`, `docs/l1/L1_MIGRATION_PLAN.md`; `PROGRESS.md` in the local commit). Treat as burned.

## Open items
- U1–U3 (user): repo private, revoke PAT, move funds off old keys.
- Q1 custody (asked 2026-11-14), then Q2–Q7.
- Fetch L1 skills from avaxskills.com (subnet-deployment, subnet-evm-config, precompiles, validator-manager-contract,
  kyc-aml-integration, safe-multisig, upgradeable-contracts); read each before installing; re-fetch or delete the broken
  `avax-dapp-architecture` / `avax-smart-contract-patterns` (not installed here).
