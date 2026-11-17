# BRAIN STATE (live facts, open items)

Updated 2026-11-16 (D-032).

## Phase
Phase 5b test dApp live on the **Fuji L1** (chain 77078): Split Pay, QR scanner, payment alerts, and (D-032) encrypted
balances. Landing live at https://arepapay.site (GitHub Pages, D-027). Next: merchant FX sale screen + FxLedger on Fuji,
then B5 (S3 audit council / S4 freeze) and B6 bridge. User actions open: U1–U3, D-028 named tunnel, D-031 bot token,
phone check of the Privado tab.

## Live (2026-11-16, PROVEN by curl / e2e this session)
- Fuji L1 node: `~/.avalanche-cli/bin/avalanchego/avalanchego-v1.15.3` with `local/arepapay-fuji` flags; RPC in `config/l1/arepapaybank.fuji.json`.
- Public MVP: `scripts/mvp/serve-public.sh` (server :8788 + cloudflared quick tunnel); current URL in
  `backend/onboarding/data/public-url.fuji.txt`; `https://arepapay.site/probar/` follows `config/public/mvp-url.json`.
  After a reboot: node + `serve-public.sh start` + `publish-url` (the quick-tunnel URL changes).
- eERC on Fuji (D-032): `config/l1/eerc.fuji.json`; auditor = gas station, key `~/.avalanche-cli/key/arepapay-fuji-auditor.bjj`
  (0600, testnet). Toolchain: `scripts/eerc/deploy.sh prepare|circuits|fuji` (clone in `~/.cache/arepapay/EncryptedERC`;
  `/tmp` scratch clones die on reboot). Circuit files in `app/circuits/` are gitignored: re-run `deploy.sh circuits` on a new machine.
- Store contacts (D-034): MerchantPay `config/l1/merchantpay.fuji.json` (fee = escrow fee); directory `backend/onboarding/data/stores.fuji.json`
  (gitignored) via `GET/POST /stores`; demo stores pay to the gas-station wallet.

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

## eERC on chain 77077 (D-012)
- Addresses: `config/l1/eerc.local.json` (generated). Run: `bash scripts/eerc/s2-run.sh`; phone bench: `scripts/eerc/s2-phone-bench.sh`, `docs/spikes/S2.md` §8.
- Proofs (i5-6500): transfer 4.4–7.6 s, withdraw 2.2–4.1 s, register 0.4–1.1 s; transfer ~1.1M gas.

## Stage B (D-016)
- Runbook `docs/spikes/STAGE_B_FUJI.md`; waiting on user U-B1 server (IP + SSH user), U-B2 key, U-B3 ≥ 3 test AVAX on P-Chain, U-B4 DNS rpc.arepapay.site.
- LANDING runs in herdr terminal `arepapay-landing` (`hc read/send arepapay-landing`).

## Open items
- U1–U3 (user): repo private, revoke PAT, move funds off old keys.
- Q1/Q3/Q4 resolved by D-005. Open: Q8–Q11, pilot partners. **Waiting on the user: phone proof-time measurement (S2 §8), the go/no-go for eERC on phones.** Next for BRAIN: S6 bridge (B6, needs ICM), S3/S4 multisig audit/freeze with a real Safe, SplitPayCoordinator (option C step 1).
- (done D-006) Fetch L1 skills from avaxskills.com (subnet-deployment, subnet-evm-config, precompiles, validator-manager-contract,
  kyc-aml-integration, safe-multisig, upgradeable-contracts); read each before installing; re-fetch or delete the broken
  `avax-dapp-architecture` / `avax-smart-contract-patterns` (not installed here).
