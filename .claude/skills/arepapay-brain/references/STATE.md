# BRAIN STATE (live facts, open items)

Updated 2026-11-15 (D-005, D-006).

## Phase
Phase 1 (rails) done; architecture decided (D-005); Phase 0 user actions U1–U3 pending; next: spike S1 (B2).

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

## Verified facts (2026-11-15)
- eERC (`ava-labs/EncryptedERC@8dc98cd`, audited circom + gnark, last security fix 2026-08-31): amounts/balances encrypted; `PrivateTransfer` emits `from`/`to` publicly; one auditor key set by owner (`setAuditorPublicKey`, onlyOwner); standalone `privateMint` onlyOwner; blacklist is per token (TokenTracker), not per user.
- Avalanche MCP (community) source: read-only, no signing; hosted mode proxies to `https://build.avax.network/api/mcp`.
- OFAC GL 57 (2026-04-14) authorizes financial services with BCV, Banco de Venezuela, Banco Digital de los Trabajadores, Banco del Tesoro (law-firm alerts; check OFAC text before relying).
- Brazil Drex blockchain shut down Nov 2025, privacy cited (press, BC unofficial).

## Local L1 (D-008)
- Chain 77077, config `config/l1/arepapaybank.local.json` (never hand-type values), verify `bash scripts/l1/s1-verify.sh`.
- avalanche-cli v1.9.6 is `~/bin/avalanche` (`~/.avalanche-cli/bin/avalanche` is the old v1.2.4). Don't run `avalanche network clean` (it touches the v1 ArepaPay config).
- ewoq (public test key) is allowlisted locally only.

## Open items
- U1–U3 (user): repo private, revoke PAT, move funds off old keys.
- Q1/Q3/Q4 resolved by D-005. Open: Q8–Q11, pilot partners. Next: S2 eERC converter on chain 77077 (B3), S6 bridge (B6, needs ICM), Split Pay A audit fixes (D-010).
- (done D-006) Fetch L1 skills from avaxskills.com (subnet-deployment, subnet-evm-config, precompiles, validator-manager-contract,
  kyc-aml-integration, safe-multisig, upgradeable-contracts); read each before installing; re-fetch or delete the broken
  `avax-dapp-architecture` / `avax-smart-contract-patterns` (not installed here).
