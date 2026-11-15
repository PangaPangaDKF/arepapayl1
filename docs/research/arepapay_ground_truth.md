# ArepaPay — Forensic History & Current-State Report

Researched 2026-11-14. Read-only investigation. Nothing in any repo was modified.
Legend: **FACT** = seen in code, config, or git. **CLAIM** = only in docs, pitches, or comments.
No secret values appear in this report, only file paths.

---

## 0. TL;DR

- The **newest code** is `/mnt/c/Users/dulbi/OneDrive/Documentos/deepseek-harness/default-workspace/arepaAgent` (local commit `5f06d45`, 2026-11-01, **not pushed**: `origin/main` is still `84f19d2`).
  - It is an off-chain **Node/TS agent**, not the dApp.
  - The **most complete dApp** (contracts + React frontend on the L1) is `/mnt/c/Users/dulbi/arepapay-l1`. It has no git and is a fork of `arepapay-clean`.
  - The **public GitHub/Vercel MVP (Fuji)** is `/mnt/c/Users/dulbi/arepapay-clean` @ `0a075f4`.
- **The move from Fuji to a local L1 was done in March 2026, not by DeepSeek.**
  - The project started on a local subnet (2026-03-01..03).
  - It moved to Fuji on 2026-03-07 because the judges required it.
  - A local Avalanche-CLI subnet "ArepaPay" (chain **13370**) was created on 2026-03-09 and used from about 2026-03-13 on.
  - The arepaAgent work of 2026-03-21/22 was co-authored by Claude Sonnet 4.6.
- **DeepSeek's one commit (`5f06d45`) changed no running behaviour.** It contains:
  - edits to a **genesis.json the live chain never used**;
  - a cosmetic tweetnacl "encryption" wrapper that is broken (the signer is never set up, and the ciphertext can't be decrypted or is never sent);
  - an "institutional fee" that sends the fee to the payment **recipient**, not to a treasury;
  - a static landing page.
- **"Centralized / encrypted / full bank management / KYC" is almost entirely untrue in code.**
  - The live L1 genesis has **no** allowlist precompiles.
  - There is no eERC/FHE/ZK.
  - There are no user accounts, ledger, KYC, or fiat ramps.
  - What does exist: owner-only admin functions everywhere, which makes it de-facto centralized, and an owner-curated merchant allowlist.
- **Secrets:** the L1 deployer private key is committed **and pushed** to the public arepaAgent GitHub repo. A GitHub PAT is embedded in a git remote URL. Several `.env` files hold keys. Details in section 8.

---

## 1. Version map & timeline

### 1.1 Copies

| # | Path | Type | Git HEAD / date | Origin | Relationship & status |
|---|---|---|---|---|---|
| A | `/home/panga/contracts-foundry` | Foundry only | `da4d53f` 2026-03-03 (10 commits from 03-01) | `PangaPangaDKF/arepapay.git` | **Oldest.** 6 contracts: ArepaToken, MockUSDT, MerchantRegistry, PaymentProcessor, RewardNFT, LiquidityManager. Commit msg says "deployed in local Subnet ArepaPay" (Fase 1). Untracked `.env` holds a key. |
| B | `/home/panga/arepapay` | Next.js 16 + wagmi/viem scaffold, plus contracts/ and subnet/ (avalanche-cli tarball and genesis) | `d220f60` 2026-03-03 (2 commits) | `arepapay.git` | Abandoned Next.js attempt. Boilerplate README. Superseded by C. |
| C0 | `/home/panga/arepapay-frontend` | Vite React + web3modal | no git, files 03-03..05 | — | Early frontend prototype that became `frontend/` in the main repo. |
| D | `/home/panga/arepapay-clean` | Main repo (WSL clone) | `ec8f998` 2026-03-08 (26 commits) | `arepapay.git`, **with PAT embedded in URL** | Snapshot of the main repo at PaymentProcessor v6 (Fuji). Uncommitted: MerchantRegistry +7 lines, untracked `contracts/script/DeployL1.s.sol`. Untracked `.env` holds secrets. |
| E | `/mnt/c/Users/dulbi/arepapayWDK` | Main repo + WDK experiments | `ec8f998` 2026-03-08 | `arepapay` | Same HEAD as D. Uncommitted, untracked: `frontend/src/components/WalletSetup.jsx`, `frontend/src/hooks/useEmbeddedWallet.js`, `wdk-server.js` (Tether WDK MCP server for chain 13370), vendored `wdk/`, `.vscode/` (mcp.json takes `WDK_SEED`). |
| F | `/home/panga/arepawallet` | Vite + `@tetherto/wdk` embedded-wallet prototype | `5cdb3a3` 2026-03-08 (1 commit, no remote) | — | Fuji-configured. Seed stored **base64 (not encrypted)** in localStorage. Never merged. |
| G | `/mnt/c/Users/dulbi/arepapay-clean` | **Public main repo tip** | `0a075f4` 2026-03-13 (53 commits) | `arepapay.git` (main plus `origin/v0/dfkspanish-5049-dc32e2ef`) | Fuji MVP deployed on Vercel (`.vercel/project.json` projectName "frontend"). Working-tree "changes" are CRLF plus package-lock only. Untracked: `L1_MIGRATION_PLAN.md`, `infographic/`, `.vscode/`. Ignored/untracked docs: CLAUDE.md, CONTEXTO_ACTUAL.md, ECONOMIA_IDEAS.md, JUECES_*.md. Contains `arepawalletWDK/` (WIP). |
| G' | branch `origin/v0/dfkspanish-5049-dc32e2ef` | — | points at `af98ba4` (2026-03-07) | — | **No unique commits.** It is an ancestor of main, a Vercel v0 preview branch. Nothing to salvage. |
| H | `/mnt/c/Users/dulbi/OneDrive/.../default-workspace/arepapay` | Fresh clone of G | `0a075f4`, clean | — | Cloned by the DeepSeek harness on 2026-11-01 00:48. **DeepSeek made zero changes here.** It differs from G only by the missing ignored/untracked docs. |
| I | `/mnt/c/Users/dulbi/arepapay-l1` | **Most complete dApp (L1)** | no git (`contracts/.git` exists but has 0 commits) | — | Copied from G on about 2026-03-10 (L1_MIGRATION_PLAN Fase 0.3). Adds ArepaHub, OTCMarket, SavingsVault, MerchantCreditPool, RevenueDistributor, FeeDistributor, DeployL1/SetupL1. Frontend repointed to chain 13370 with an "add network" button. Docs: HACKATHON_MASTER (03-20), LOCAL_NETWORK (03-19), STAGE3_PITCH (03-20), AREPAPAY_PITCH. `deploy.sh`/`setup.sh` hard-code the deployer key. |
| J | `~/.avalanche-cli/subnets/ArepaPay` | Live L1 config | genesis ts = 2026-03-09 02:20 UTC; sidecar 03-22 | — | The **real** chain definition (section 3.1). RPC is not running now (checked 127.0.0.1:9650, unreachable). |
| K | `/home/panga/arepaAgent` | Agent (WSL clone) | `84f19d2` 2026-03-22 (16 commits) | `PangaPangaDKF/arepaAgent.git` | Same as `origin/main`. Has a real `.env` with secrets. |
| L | `/mnt/c/Users/dulbi/OneDrive/.../default-workspace/arepaAgent` | **Newest code** | `5f06d45` 2026-11-01 21:37 (local only) | `arepaAgent.git` | Clone of K at `84f19d2`, plus DeepSeek's commit. Working-tree "modifications" (32 files) are **CRLF-only** (`git diff --ignore-cr-at-eol` is empty). `dist/` was built on 11-01. `tsc --noEmit` passes. |

### 1.2 Chronology (FACT, from git and file dates)

| Date | Event |
|---|---|
| 2026-03-01..03 | Contracts written in Foundry and deployed to a **local Avalanche subnet** (A). Next.js scaffold tried (B). |
| 03-03 | Main repo restructured (`0e43c04`). |
| 03-04..06 | RewardTicket, dashboard, Send/Receive/QR, raffles screen. Pixel-RPG redesign (`55ab877`). PWA (`4d867a1`). |
| 03-07 | Judges' Stage 2 rules require a "web3 verifiable on Fuji" MVP. Repo **migrated to Fuji** (`af98ba4`). Incentives system: 3-winner raffle plus InternetVoucher (`b0285fd`). |
| 03-08 | **PaymentProcessor v6** security fix (`ec8f998`). WDK embedded-wallet experiments (E, F). |
| 03-09 | Local L1 genesis created (chain 13370, PoA, Subnet-EVM v0.8.0). Many UX commits on Fuji app: BCV display, Bs input, receipts, raffle draw, winner badge. |
| 03-10 | `arepapay-l1/` created. Economic-model docs (MLP). VAEM contracts written (SavingsVault, MerchantCreditPool, RevenueDistributor). |
| 03-13 | Last public main commit `0a075f4`. |
| 03-15 / 03-19 | L1 deploy #3 / #4 (11 contracts) per LOCAL_NETWORK.md. |
| 03-20 | HACKATHON_MASTER plus Stage 3 pitch. |
| 03-21..22 | arepaAgent built: x402, ArepaAgent.sol "ERC-8004", WDK seed, Groq, CLI. **Fresh L1 redeploy with new addresses.** README "hackathon submission". |
| 2026-11-01 | DeepSeek harness clones arepapay (unchanged) and arepaAgent. Commits `5f06d45` (encrypted SDK, genesis edits, landing page). Not pushed. |

---

## 2. Product concept (mostly CLAIM, with some code)

- **Problem.** Venezuelans hold USDT but can't easily buy it or pay small amounts with it locally. Bolívar hyperinflation. Zelle and Binance P2P bring friction and require KYC.
- **Original value proposition** (README, JUECES_RESPUESTAS; Fuji era):
  - self-custody;
  - **"no registration, no KYC, nobody can block your wallet"**;
  - QR payments to verified neighbourhood merchants;
  - every payment earns rewards.
  - *Note: this is the opposite of the DeepSeek "institutional / permissioned / KYC" pivot.*
- **Users:**
  - payers (urban 18–45 with smartphones);
  - merchants (panadería, bodega, water delivery, hot-dog stand; 4 demo merchants);
  - admin/operator (liquidity provider);
  - later an AI agent.
- **Features (status):**
  - Merchant payments in USDT. FACT: `PaymentProcessor.payMerchant`.
  - Raffle tickets: 1 per payment. FACT.
  - Weighted raffle with 3 winners; round opens every N payments. FACT. Prize is the hard-coded string "3 Helados Coco".
  - Internet/WiFi vouchers: 30 min per payment, `activate()` emits an event for a MikroTik listener. FACT for the contract. **The router listener is absent.**
  - Merchant QR panel without a wallet (`?merchant`). FACT (frontend).
  - Bs to USDT input at a fixed **400 Bs/$** hard-coded rate. FACT (`Dashboard.jsx:109`, `SendScreen.jsx:54`).
- **L1 phase additions:**
  - ArepaHub: admin USDT treasury that sells to merchants at BCV + margin.
  - OTCMarket: escrow where a user pays cash Bs to a merchant and the merchant releases USDT.
  - SavingsVault: sUSDT.
  - MerchantCreditPool: credit score and credit lines.
  - Revenue/Fee distributors.
  - Contracts are FACT. **No UI for any of them.**
- **AREPA token:**
  - On the L1 it is the native gas coin (FACT, genesis).
  - An ERC20 `ArepaToken` also exists (Fuji/LiquidityManager era).
  - Staking, governance, and "DAT" buybacks are CLAIM only.
- **MLP (Merchant Liquidity Provider):** merchants supply USDT and get Bs at the "~515 Bs/$ auction rate". README roadmap only, so CLAIM. The closest code is ArepaHub plus MerchantCreditPool.
- **x402:**
  - FACT in arepaAgent: an Express 402 middleware plus a client that pays with a direct ERC20 transfer and retries with a tx-hash header.
  - Replay protection is an in-memory Set only.
  - Demo endpoint `/api/bcv-rate` returns a **simulated** rate (36.5).
- **ERC-8004 agent:**
  - FACT: `ArepaAgent.sol` deployed on the L1 at `0x6352B8D1D72f6B16bb659672d5591fe06aAa41c8`, with a daily budget, nonces, a validator signature, and generic `execute()`.
  - It is **not** real ERC-8004 (the Trustless Agents identity/reputation/validation registries). The interface id `0x80048004` is invented.
  - **The TS agent never calls this contract.**
- **Arbitrage agent:**
  - Fetches the Binance P2P rate (FACT).
  - The trade is **simulated**.
  - The only real on-chain step is `ArepaHub.inject()`, which is `onlyOwner`, so it only works when the agent wallet is the deployer.

---

## 3. Architecture now (newest versions)

### 3.1 The real L1 (FACT, `~/.avalanche-cli/subnets/ArepaPay/{genesis,sidecar,chain}.json`)

**Identity and network**

| Item | Value |
|---|---|
| Name / VM | ArepaPay / Subnet-EVM **v0.8.0**, AvalancheGo v1.14.0 (doc) |
| Chain ID | **13370** (0x343a). The `config/genesis.json` chainId 432100 file was **never used** (LOCAL_NETWORK.md says so explicitly). |
| SubnetID | `2W9boARgCWL25z6pMFNtkCfNA5v28VGg9PmBgUJfuKndEdhrvw` |
| BlockchainID | `24KtPXNgmHT2vVUPK1rx72ykjKwHBdfGrQr5bwJxmuaEBm5Fpx` |
| Network | **Local only** ("Local Network"). 2 nodes, `127.0.0.1:9650` and `:9652`. Not on Fuji. `Sovereign: false` (classic subnet, not converted to L1). |
| RPC | `http://127.0.0.1:9650/ext/bc/24KtPX.../rpc`. Currently **down**. |

**Validation, fees, and precompiles**

| Item | Value |
|---|---|
| Validation | Proof of Authority via ValidatorManager. Owner `0x0D1F1B9409FF22E65974784D91D65f5f02d24741` (deployer). Proxy at `0x0Feedc0de…`, impl `0x0C0DEbA5E…`. |
| Gas token | AREPA (native). Deployer has 1,000,010 AREPA. ICM relayer `0x5cDf…` has 600. |
| feeConfig | gasLimit 8M, minBaseFee 25 gwei, targetGas 40M |
| **Precompiles** | **Only `warpConfig`** (quorum 67). **NO** txAllowList, contractDeployerAllowList, nativeMinter, feeManager, or rewardManager. |
| ICM/Teleporter | Messenger `0x253b…5fcf`, Registry `0xd8a7…CBA` |
| chain.json | Exposes `admin`, `debug`, and `internal-personal` APIs. Fine locally, dangerous if ever public. |

### 3.2 Contract deployments: three conflicting address sets (FACT)

- **Fuji (C-Chain 43113)**, from `arepapay-clean/frontend/src/config/network.js` and README:
  - MockUSDT `0xcfefb29b…1820` (**18 decimals** on Fuji)
  - MerchantRegistry `0x53ac0743…bc0b`
  - RewardTicket `0x5430B759…2aEf`
  - PaymentProcessor v6 `0xb10EE9c9…4483`
  - Raffle `0x3c25B5E7…1CC0`
  - InternetVoucher `0xd72a6a47…B8AD`
  - ArepaToken `0x67b3a03c…b4fe`
  - LiquidityManager `0xe404e1d6…f602`
- **L1 deploy #3/#4 (03-15/19)**, used by `arepapay-l1/frontend`:
  - MockUSDT `0x49FCa1a7…a8A0` (6 dec)
  - MerchantRegistry `0xd9c61D11…9d69`
  - RewardTicket `0x29D720D6…0d18`
  - Raffle `0x25214…e29c`
  - InternetVoucher `0x6ACC…C1F9`
  - PaymentProcessor `0x2F02…3AB8`
  - SavingsVault `0xCf93…1c46`
  - MCP `0xc09b…674b`
  - RevenueDistributor `0x7E9f…e7b0`
  - ArepaHub `0x53E5…34F1`
  - OTCMarket `0x67b3…B4FE`
- **L1 redeploy (03-21)**, used by arepaAgent `src/blockchain/config.ts`:
  - ArepaAgent `0x6352…41c8`
  - MockUSDT `0x29D7…0d18`
  - MerchantRegistry `0x2521…e29c`
  - PaymentProcessor `0xc09b…674b`
  - … (addresses shifted by nonce)
- **What this means:**
  - **The L1 frontend and the agent point at different deployments.** Same deployer, same addresses reused for different contracts.
  - The L1 state lives only in the local avalanche-cli DB. If it is lost, everything must be redeployed.
- **Merchant address mismatch:**
  - 3 of 4 merchant addresses in arepaAgent (botellones, perros, bodega) are **different addresses** from those in the frontend (e.g. `0xc79D5946**1fC9**…` vs `0xc79d5946**3C8c**…`).
  - The agent "fixed the checksum" with `getAddress(lowercase)`, which turned invalid hex into different valid addresses that nobody probably holds keys for.
  - The L1 MerchantRegistry entries from 03-22 point at these addresses.

### 3.3 Off-chain components

- **arepaAgent (TS, ESM)** has three modes: Anthropic SDK (claude-sonnet-4-6) REPL, Groq (OpenAI SDK) REPL, and plain CLI.
  - Tools: check_balance, pay_merchant, activate_internet, get_market_prices, get_hub_liquidity, execute_arbitrage, inject_liquidity, fetch_with_payment, plus DeepSeek's encrypted_pay and encrypted_balance.
  - Wallet from `WDK_SEED` (ethers HDNodeWallet, BIP-44) or `PRIVATE_KEY`.
  - x402 demo server on Express, port 3001.
- **No backend or database for the dApp.** The frontend is a static Vite PWA talking to the RPC through `window.ethereum` / web3modal.

---

## 4. DeepSeek harness changes: claim-by-claim verification

What commit `5f06d45` (2026-11-01, local, unpushed) actually touched: `config/genesis.json`, `landing-institucional.html` (new), `package.json` (+tweetnacl), `src/agent/tools.ts`, `src/blockchain/encryptedL1SDK.ts` (new), `src/blockchain/encryptedPrecompiles.ts` (new), `src/tools/dispatch.ts`, `src/tools/encryptedBalance.ts` (new), `src/tools/encryptedPay.ts` (new). **No Solidity and no frontend changes.** The arepapay clone (H) is untouched.

### 4.1 "From Fuji testnet to a testnet L1" — **TRUE but NOT DeepSeek's work; partially implemented**

- The L1 (chain 13370) existed from 2026-03-09. Agent and frontend targeted it from March.
- The L1 is **local only** (127.0.0.1), not a Fuji-hosted L1. `deploy_fuji_l1.sh` exists but L1_MIGRATION_PLAN Fase 4 ("deploy subnet to Fuji") is all ⬜ pending.
- The public Vercel app still runs on **Fuji**.
- DeepSeek only edited `arepaAgent/config/genesis.json`. That is a docs-copy file with **chainId 432100**, which is **not** the running chain (13370). Its changes:
  - added contractDeployerAllowList, nativeMinter, txAllowList, feeManager, rewardManager, and warp configs (admin = deployer, `enabledAddresses: []`);
  - minBaseFee raised 1 → 25 gwei;
  - gasLimit raised 8M → 12M.
- **Not applied to any chain.** If it were applied as written, txAllowList with no enabled addresses would block every non-admin user.
- **Status:** L1 = implemented and working (locally, from March). Permissioned L1 = **documented/config-file only**.

### 4.2 "It is now a centralized dApp" — **PARTIALLY TRUE, and was already true before DeepSeek**

De-facto centralization in code (FACT, pre-existing):
- every contract is `Ownable` / AccessControl with single-EOA admin;
- MerchantRegistry verification is owner-only;
- ArepaHub is fully admin-operated (inject, supply, setBcvRate, withdrawTreasury);
- OTCMarket has owner-authorized merchants and `adminCancel`;
- SavingsVault has `emergencyWithdraw` (owner can drain);
- MerchantCreditPool has admin credit scores;
- Raffle has owner-only `draw()`;
- the validator set is PoA owned by the same deployer key.

Permissioned chain-level controls (allowlists): **absent on the live chain**. Present only in DeepSeek's unused genesis file and in an ABI list (`encryptedPrecompiles.ts`) that nothing calls.

**Status:** centralized admin = implemented. Permissioned network = documented only.

### 4.3 "It is an encrypted one" — **FALSE in substance; cosmetic and broken**

What exists (`src/blockchain/encryptedL1SDK.ts`):
- `encryptPayload()` = `nacl.box(payload, nonce, serverPubKey, nacl.randomBytes(32))`.
- The sender secret key is random and thrown away, and its public key is never transmitted. So **nobody, not even the server, can ever decrypt it.** It is effectively random bytes.
- If `L1_SERVER_PUBKEY` is unset (it is not in `.env.example`), the payload is returned **in plaintext**.

`encryptedTransfer()` is a **plain public `ERC20.transfer`**:
- amounts, sender, and receiver are fully public on-chain;
- the "encrypted memo" is computed and only returned to the caller, **never put on-chain or sent anywhere**.

`encrypted_balance` reads public balances and optionally attaches an undecryptable blob.

`sendEncryptedGovernanceVote()` sends to the Warp precompile:
- no tool calls it;
- there is no governance contract;
- Warp messages are public anyway.

**Runtime bug:** `encryptedClient = new EncryptedL1Client()` is created without a key, and `initSigner()` is never called. So `encrypted_pay` **always fails** with "Signer not initialized".

Not present anywhere: eERC (Avalanche encrypted ERC-20), homomorphic encryption, ZK proofs, or confidential balances.

The only other "encryption" in the whole project:
- `arepawalletWDK/src/crypto.js` (PBKDF2 → AES-GCM PIN vault) is marked WIP/TODO.
- `/home/panga/arepawallet` stores the seed **base64-only** in localStorage.

The landing page's text about "sealed boxes… sender/receiver privacy with on-chain validation… encrypted governance via Warp" is CLAIM.

**Status:** **absent** as real privacy. A broken placeholder exists.

### 4.4 "With full bank management" — **FALSE (documented / marketing only)**

There are no user accounts, no KYC'd account opening, no internal ledger, no statements, no admin back-office UI, and no fiat on/off-ramp integration (no bank API, no Pago Móvil). No backend or database exists.

Closest real pieces (FACT, pre-DeepSeek, no UI):
- ArepaHub: admin USDT treasury, per-merchant supplied/earned/withdrawn accounting, daily limit, `bcvRateCents` set by admin, margin.
- OTCMarket: cash-Bs to USDT escrow with 30-min timeout. Bs settlement is off-chain trust.
- SavingsVault: sUSDT shares, admin-injected "yield".
- MerchantCreditPool: credit lines and scores.

BCV rate:
- frontend hard-codes 400 Bs/$;
- the ArepaHub rate is set manually by the admin;
- the x402 demo returns a simulated 36.5;
- Binance P2P is fetched live (agent only).

DeepSeek's "institutional fee" (`payInstitutionalFee`) **transfers 0.5% to the `payer` argument, which the caller passes as the recipient (`opts.to`)**. So the fee goes to the payee, not to the treasury `0x0D1F…` declared in `INSTITUTIONAL_FEE_CONFIG`. It is also a second separate transfer, not atomic. Min/max fees ($0.50 / $50), the 0.25% redemption fee, and validator fees appear only on the landing page.

**Status:** banking = documented only. Liquidity/OTC/savings/credit contracts = implemented on-chain, untested end-to-end, no UI.

### 4.5 "With KYC" — **FALSE (absent)**

There is no KYC provider, no identity contract, no attestation, and no txAllowList on the live chain.

The only gatekeeping (FACT):
- the owner verifies merchants (`MerchantRegistry.adminRegisterAndVerify`, `ArepaHub.authorizeMerchant`, `OTCMarket.authorizeMerchant`);
- a comment in MerchantCreditPool says "Score 5: manual only (requires KYC/admin review)".

"KYC selectivo a nivel de validador sin afectar privacidad del usuario final" is copied verbatim from `ROADMAP_FUTURO.md` (2026-03-10) onto the landing page.

**Status:** **absent** (merchant allowlist only).

### 4.6 Landing page (`landing-institucional.html`)

- Static HTML in the same palette as the dApp (cream / navy / gold, Inter).
- Contains **broken leftover JSX** (`{[-8,0,8,16].map(...)}` at lines 320–321) that renders as literal text.
- Fake contacts: `institucional@arepapay.ve`, WhatsApp `+58 424 123 4567`.
- Says "Construido en la Avalanche Venezuela Hackathon 2025".
- Not linked from or deployed with any app.

---

## 5. Contracts inventory (newest source = `arepapay-l1/contracts/src` = `arepaAgent/contracts/reference`, byte-identical modulo CRLF)

| Contract | Purpose | Key functions | Issues (FACT from reading code) |
|---|---|---|---|
| **PaymentProcessor** (v6) | Pay a verified merchant in USDT and mint rewards | `payMerchant(merchant, amount)`; owner `update*` setters | **No fee at all** (all fee docs are unimplemented). No min amount, so **0-amount or dust payments still mint a ticket + 30 min** (farming via a colluding merchant or a second wallet). Owner can swap registry/ticket/raffle/voucher at will. Rewards swallowed by `try/catch`. Does not notify RevenueDistributor or MerchantCreditPool. |
| MerchantRegistry | Merchant allowlist | `registerMerchant` (anyone, unverified), `verifyMerchant` / `adminRegisterAndVerify` (owner), `isMerchant` | Admin overwrite allowed. No removal / unverify function. |
| RewardTicket (`RewardNFT.sol`) | Non-standard fungible ticket balance | `mint` (processor only), `transfer`, `burn` (self/processor/raffle) | Not ERC20/721 (custom, no approvals). Tickets transferable, so a market for tickets is possible. Custom owner, not transferable. |
| Raffle | Opens a round every `txThreshold` payments; users burn tickets to stake; owner draws 3 weighted winners | `recordTransaction`, `enter`, `draw` (owner), `getRaffleState` | **Insecure randomness**: `block.timestamp`/`prevrandao` (constant-ish on Subnet-EVM) and the owner chooses when to draw. Prize is a hard-coded string. No on-chain prize payout. `txCount` keeps growing while a round is open (rounds can be skipped). Chainlink VRF only CLAIM. |
| InternetVoucher | WiFi minutes | `mint` (processor), `activate` (user burns, emits event), `consume` (authorized router), `setMinutesPerPayment` | No listener or router integration exists. |
| MockUSDT | Test stablecoin, 6 dec (L1); README says 18 dec on Fuji | `faucet` (owner) | Docs say faucet is "public"; it is owner-only. |
| ArepaToken | ERC20 "AREPA", 1M supply | — | Redundant with native AREPA gas on the L1. |
| LiquidityManager | Owner-held USDT/AREPA reserve | add/removeLiquidity (owner) | Placeholder ("prize pool"). |
| **ArepaHub** | Admin treasury; sells USDT to merchants at BCV + margin; merchants sell back with daily limit | `inject`, `supplyMerchant`, `sellToHub`, `recordEarnings`, `withdrawTreasury`, `setBcvRate`, `sellPriceCents` | Unchecked `transfer` returns (not SafeERC20). Bs leg off-chain. `recordEarnings` is manual. Agent ABI had to be "corrected" (commit `3caa39e`). PROGRESS.md mentions `buyUSDT` / `getTotalLiquidity`, which **don't exist**. |
| **OTCMarket** | Merchant escrows USDT; buyer reserves; merchant confirms after cash Bs | `createOffer`, `reserveOffer`, `confirmSale`, `cancelReservation`, `adminCancel`, `getOpenOffers` | **Griefing**: anyone can reserve any offer free for 30 min, repeatedly. Merchant can refuse to confirm after receiving cash (no dispute). `getOpenOffers` capped at 200. Unchecked transfers. |
| SavingsVault | sUSDT share vault, admin-injected yield | `deposit`, `withdraw`, `injectYield`, `receiveYield`, `emergencyWithdraw` (owner) | Owner can drain. Yield source is not automated. |
| MerchantCreditPool | Merchant credit lines, score 1–5, rewards | `registerMerchant`, `withdrawCredit`, `repayCredit`, `recordPaymentAndAccrueReward`, `withdrawRewards` | Not wired to PaymentProcessor. No collateral or liquidation. |
| RevenueDistributor | Fee split 5/30/40/25 (vault/merchants/prizes/devs) | `notifyPayment`, `distribute`, `setShares` | **`notifyPayment` has no access control** (comment "En producción: require…"). Nothing ever sends it fees. |
| FeeDistributor | Alternative split 30/30/40 (validators/merchants/prizes) | `receiveFee`, `distribute` | Unused duplicate of RevenueDistributor. |
| **ArepaAgent** (`arepaAgent/contracts/src`) | "ERC-8004" agent wallet with budget | `execute(target,value,data)`, `processX402Payment(…sig,nonce)`, budget/pause/validator admin | Not ERC-8004 compliant. `execute()` gives validators an **arbitrary call that bypasses the budget**. Signed message lacks chainId and contract address (cross-deployment replay). Unused by the TS code. |

PaymentProcessor v6 fix (`ec8f998`, 2026-03-08, FACT):
- removed `rewardTicket.mint(_merchant)` (merchants were getting tickets);
- added `require(msg.sender != _merchant)` against self-pay farming;
- `FixAndDeployV6.s.sol` re-authorized the Raffle, which had pointed to the v4 processor so `recordTransaction` was silently failing.
- Flattened sources were added for Snowtrace verification.

Remaining v6 gaps: zero-amount farming, two-wallet farming, no fee.

Tests: `contracts/test/` exists, but no meaningful Forge test suite was found for the new contracts (L1_MIGRATION_PLAN 2.9 "tests unitarios" is ⬜). The Script-based `TestPayments` / `TestRaffle` and `scripts/testRaffle.js` act as manual tests.

---

## 6. Frontend & design system

**Stack (FACT):**
- React 19, Vite 7, ethers v6, `@web3modal/ethers` v5, jsQR, qrcode.react, vite-plugin-pwa;
- inline styles (no Tailwind or shadcn in the live app);
- mobile-first, max-width 420px;
- Spanish UI.

**Screens (FACT, `frontend/src/components`):**
- Dashboard: USDT, AREPA/AVAX, tickets, minutes, BCV 400 display, merchant strip, PAGAR, receipt modal.
- SendScreen: Bs input → USDT conversion, merchant picker, contacts stub, QR-prefilled read-only amount, approve + payMerchant.
- ReceiveScreen: QR plus copyable address.
- RafflesScreen: state, enter, winners, winner badge.
- InternetScreen: minutes and activate.
- MerchantPanel and MerchantQRPage: `?merchant` wallet-less QR generator.
- QRScanner, BottomNav, PixelButton, ErrorBoundary.

Hooks: `useWallet` (MetaMask/Core, add/switch chain), `useBalances`, `useRaffle`.

The L1 variant (`arepapay-l1/frontend`) differs only in network.js (13370 and the 03-15 addresses), an "add ArepaPay L1 network" button, and small useWallet/useBalances changes.

There is **no UI for ArepaHub, OTCMarket, Savings, Credit, history, or admin.**

**Deployment:**
- Vercel project "frontend" (root `frontend/`) → `https://frontend-tau-ten-27.vercel.app` (Fuji). CLAIM from docs; the link was not live-checked.
- The L1 frontend was never deployed; its RPC is localhost.

**Design system (FACT: `DESIGN_SYSTEM.md` plus code)** — "Pixel RPG venezolano":

| Element | Spec |
|---|---|
| Background | cream `#FFF8E0`, white cards |
| Brand | navy `#1A2472` (dark `#0D1040`, deeper `#111855`) |
| Browns | `#2C1A0E` (bottom nav only), `#5A4A30`, `#8A6A40` |
| Golds | `#D4B87A`, `#C89038` (card borders and offset shadows), amber `#D4921C` |
| Reds | `#CC1111` / `#770000` / `#E02222`; Venezuelan red-cream checker strip |
| Info blues | `#4A9EFF`, `#8899CC` |
| Font | **Inter** only (900 weights, uppercase, letter-spacing); monospace for hashes. No pixel font. |
| PixelButton | pill radius 24, 3px border, `0 5px 0` hard shadow, press translateY(3px); variants blue / red / ghost / dark; **no green** |
| Cards | 4px gold border, `6px 6px 0` offset shadow |
| Header | navy; bottom nav dark brown with gold active tab |

The DeepSeek landing page reuses this palette. Infographic panels are in `arepapay-clean/infographic/`.

---

## 7. Economics (all CLAIM; **no fee is implemented on-chain**)

Fee figures conflict across documents:

| Source | Fee | Split |
|---|---|---|
| JUECES_RESPUESTAS (03-09) | MVP 0%; later 0.5% to raffle pot plus merchant badge fee in AREPA | — |
| ECONOMIA_IDEAS | ~2% | 30 validators / 40 prizes / 30 reserve |
| L1_MIGRATION_PLAN / `subnet_params.json` | **0.03%** (3 bp) | 30 validators / 30 merchant LPs / 40 prizes (FeeDistributor). "VAEM" variant 25/25/30/20. |
| ROADMAP_FUTURO / README Fase 4 | 0.5–1.5% ("same as banks") in USDT | 30/30/40, plus MLP at ~515 Bs/$ vs BCV 400 |
| HACKATHON_MASTER / STAGE3_PITCH (03-20) | **1.5%** | 40 prizes / 30 merchants / 25 devs / 5 reserve (matches RevenueDistributor code defaults) |
| DeepSeek landing (11-01) | 0.5% (min $0.50, max $50), 0.25% redemption, 1.33 AVAX/validator/month | 30/30/40 |

Other revenue ideas:
- admin spread (sell USDT to merchants at BCV + 2–3%; ArepaHub `adminMarginBps` supports this);
- an AI arbitrage agent "~5% profit reinvested";
- AREPA DAT buybacks;
- merchant credit.

Sustainability math (pitch): 500 tx × $5 → $37.5/month at 1.5%.

Incentives that are real in code: 1 ticket + 30 WiFi minutes per payment, raffle every 5 payments (L1) or 10 (README).

---

## 8. Security / secrets findings (paths only, no values)

1. **L1 deployer private key** for `0x0D1F…4741` (also PoA owner, validator manager owner, owner of every contract):
   - Plaintext in **tracked and pushed** files of public `github.com/PangaPangaDKF/arepaAgent`, introduced in `2fd0111` and `bd28f1c`:
     - `PROGRESS.md`
     - `contracts/reference/DeployL1.s.sol`
     - `contracts/reference/SetupL1.s.sol`
     - `docs/l1/L1_MIGRATION_PLAN.md`
   - Also in `/mnt/c/Users/dulbi/arepapay-l1/{deploy.sh, setup.sh, LOCAL_NETWORK.md, L1_MIGRATION_PLAN.md, contracts/script/DeployL1.s.sol, contracts/script/SetupL1.s.sol}` and the `/home/panga/arepaAgent` copies.
   - **Treat as burned.** Rotate it and never reuse it for Fuji or mainnet. It is unknown whether the same key controls the Fuji deployer; check.
2. **GitHub Personal Access Token** embedded in the remote URL in `/home/panga/arepapay-clean/.git/config`. **Revoke it.**
3. **Private key committed to public `PangaPangaDKF/arepapay` history:**
   - The pattern `PRIVATE_KEY=<64 hex>` appears in commit `0e43c04` (2026-03-03) and was touched again in `172e1e7` (2026-03-09, which "hid" `CONTEXTO_ACTUAL.md`).
   - Remains in git history.
   - The local copies of `CONTEXTO_ACTUAL.md` in `/mnt/c/Users/dulbi/arepapay-clean`, `/mnt/c/Users/dulbi/arepapayWDK`, `/home/panga/arepapay-clean`, and `/home/panga/arepapay` contain a key-like string.
   - It is not the deployer key above (the `-S` search was negative) and not the anvil default. Identity unknown; rotate.
4. **Untracked `.env` files with secrets:**
   - `/home/panga/arepapay-clean/.env`
   - `/home/panga/arepaAgent/.env` (likely PRIVATE_KEY/WDK_SEED plus AI API keys)
   - `/home/panga/contracts-foundry/.env`
   - Not committed (gitignored), but they live in plain text.
5. `/mnt/c/Users/dulbi/arepapayWDK/wdk/README.md` matched a key pattern. Probably a vendor example; verify. `.vscode/mcp.json` in E holds `WDK_SEED` (not inspected).
6. App-level issues (described above):
   - seed in localStorage as base64 (`/home/panga/arepawallet/src/hooks/useWDKWallet.js`);
   - Raffle randomness;
   - zero-amount reward farming;
   - RevenueDistributor `notifyPayment` open to anyone;
   - OTC reservation griefing;
   - owner drain paths (SavingsVault `emergencyWithdraw`, ArepaHub `withdrawTreasury`, MCP `adminWithdraw`);
   - ArepaAgent `execute()` budget bypass and signature without domain separation;
   - x402 replay Set is in-memory only (lost on restart) and has no tx-age or chain check;
   - `chain.json` enables admin/personal/debug RPC APIs;
   - single EOA controls everything (no multisig or timelock).

---

## 9. What is worth keeping vs rewriting

**Keep (good ideas or reusable assets):**
- Product concept and narrative:
  - merchants as liquidity bridges;
  - cash-Bs ↔ USDT OTC escrow;
  - hyperlocal real-goods raffles;
  - WiFi minutes;
  - Bs-denominated UX;
  - BCV vs P2P rate display.
- Design system (palette, PixelButton, card style, Spanish copy) and the frontend screen set and flows: QR merchant mode, read-only amount QR, receipts.
- Contract **designs**: PaymentProcessor + RewardTicket + Raffle + InternetVoucher wiring, OTCMarket state machine, ArepaHub accounting model. Use them as specs, not code.
- L1 setup know-how: avalanche-cli PoA subnet, chain 13370, AREPA gas, ICM. Also `LOCAL_NETWORK.md` as a runbook (after redacting the key).
- x402 client/server pattern and the agent tool-dispatch structure (`src/tools/dispatch.ts`); the Binance P2P rate fetch.
- PaymentProcessor v6 lessons; USDT 6-decimals discipline.

**Rewrite or replace:**
- All contracts. Add:
  - SafeERC20, min amounts, actual fee + distributor wiring, roles/multisig/timelock;
  - VRF or commit-reveal randomness;
  - dispute/deposit in OTC;
  - proper ERC20/1155 tickets;
  - Forge tests.
- One source of truth for addresses (deployment JSON consumed by the frontend and the agent).
- DeepSeek's "encrypted" layer: delete it.
  - If privacy is a goal, evaluate Avalanche **eERC** (encrypted ERC-20) or a proper design.
  - If permissioning is a goal, set txAllowList/deployerAllowList in the **real** genesis or through precompile admin calls, plus an allowlist manager service.
- KYC: needs a real design (off-chain provider → on-chain allowlist/attestation). Nothing exists to keep.
- The embedded wallet: finish the PBKDF2/AES-GCM vault or use the WDK properly; never store the seed in base64.
- The landing page (broken JSX, fake contacts).
- ArepaAgent.sol: either real ERC-8004 registries or drop the claim.

---

## 10. Open questions

1. Which direction is intended?
   - The original public pitch is **no-KYC, self-custody**.
   - The DeepSeek / roadmap direction is **permissioned, institutional, bank-like with KYC**.
   - These are mutually exclusive positioning choices.
2. Should the L1 run on Fuji (public testnet L1, Sovereign/ConvertSubnetToL1), keep local, or go to C-Chain contracts plus eERC? Who runs the validators?
3. Which fee model is canonical (0.03% / 0.5% / 1.5%), and which split (30/30/40 vs 40/30/25/5)?
4. Is the local L1 DB still intact (`~/.avalanche-cli` snapshots)? The RPC is down now, and which deployment (03-19 vs 03-21) is live is unknown.
5. Who controls the merchant addresses registered on the L1 by the agent (the checksum-"fixed" ones)?
6. Was the deployer key also used on Fuji? Has the PAT been revoked? Which key is in arepapay history commit `0e43c04`?
7. Hackathon identity: docs reference a "Stage 2 / Stage 3", 400+ project Avalanche hackathon (admin "Andrea Vargas" message saved 03-07). The landing says "Avalanche Venezuela Hackathon 2025". The arepaAgent submission (03-22, WDK, x402, Groq) may be a separate (Tether WDK?) hackathon.
   - **No actual judges' feedback was found.** `JUECES_MVP.md` holds the submission requirements and `JUECES_RESPUESTAS.md` holds self-prepared answers.
   - Results unknown.
8. Is the Vercel deployment still live, and from which branch?
9. Real BCV oracle source (manual multisig, an API, Chainlink)?
10. Should WiFi vouchers or a MikroTik integration stay in scope?

---

### Key file index

- Newest code: `/mnt/c/Users/dulbi/OneDrive/Documentos/deepseek-harness/default-workspace/arepaAgent/src/blockchain/encryptedL1SDK.ts`, `.../src/tools/encryptedPay.ts`, `.../config/genesis.json`, `.../landing-institucional.html`, `.../PROGRESS.md`, `.../contracts/src/ArepaAgent.sol`
- Most complete dApp: `/mnt/c/Users/dulbi/arepapay-l1/contracts/src/*.sol`, `/mnt/c/Users/dulbi/arepapay-l1/frontend/src/`, `/mnt/c/Users/dulbi/arepapay-l1/LOCAL_NETWORK.md`, `/mnt/c/Users/dulbi/arepapay-l1/HACKATHON_MASTER.md`
- Public Fuji MVP plus docs: `/mnt/c/Users/dulbi/arepapay-clean/` (README.md, DESIGN_SYSTEM.md, ROADMAP_FUTURO.md, ECONOMIA_IDEAS.md, JUECES_MVP.md, JUECES_RESPUESTAS.md, L1_MIGRATION_PLAN.md)
- Live L1 config: `/home/panga/.avalanche-cli/subnets/ArepaPay/genesis.json`, `sidecar.json`, `chain.json`
