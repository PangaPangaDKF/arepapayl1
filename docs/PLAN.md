# ArepaPay v2 — master plan

Version 1.2 · 2026-11-15 (D-005 architecture, D-007 user correction: bank bridge, real collateral, mandatory KYC) · Owner: BRAIN (decides inside the user's rules) · Method: `master-method` skill · Charter: skill `arepapay-mission`
Ground truth: `docs/research/arepapay_ground_truth.md` (what exists, FACT vs CLAIM) · Method source: `docs/research/dogeon_methodology.md`

## 0. Thinking (M0: what we believe and why)
- **What the user asked for:** ArepaPay as a **permissioned ("centralized") Avalanche L1 on testnet, with encrypted balances, full
  bank-style account management and KYC**, built and managed by BRAIN, with a LANDING agent doing the landing as in DOGEON (D-001).
- **What actually exists (verified 2026-11-14):** a Fuji MVP (payments + raffle + WiFi minutes), a *local-only* L1 (chain 13370)
  whose genesis has **only Warp** (no allowlists), contracts with no fee and several money bugs, and a DeepSeek-harness commit whose
  "encryption" can't be decrypted, whose precompiles sit in a genesis file the chain never used, and whose KYC/banking exist only as
  landing-page text. The L1 deployer key is public on GitHub.
- **Therefore:** this is a **rebuild, not a migration** (G11). We keep the concept, the design system, the screen flows and the
  L1 know-how; we rewrite contracts, the encryption layer, KYC and the banking core; and we treat every old key as burned (C15).
- **Why the order below:** security first (a public owner key makes any reuse unsafe, N6); then rails and truth (B1, B6), so two
  agents can work without colliding; then **spikes** on the three risky technologies (permissioned L1, eERC, KYC) before planning
  code around them, because building on an unproven assumption is how v1 ended up with features that don't exist.

## 1. Phases (each phase ends only when its exit gate is green and logged on the board)

### Phase 0 — Containment (Needs the user + BRAIN) · now
| ID | Action | Who | Exit check |
|---|---|---|---|
| U1 | Make `github.com/PangaPangaDKF/arepaAgent` private (or delete it). The key is burned either way. | User | repo not public |
| U2 | Revoke the GitHub token embedded in `/home/panga/arepapay-clean/.git/config` (GitHub → Settings → Developer settings → Tokens). | User | token revoked |
| U3 | Check whether `0x0D1F…4741` or any key in the old `.env` files holds funds on Fuji or mainnet; move funds to a fresh wallet. Never reuse those keys. | User | balances moved |
| B0 | New repo never contains a key: `.gitignore` + secret-scan stage in `tests/check.sh` (C8). History rewrite of old repos only if the user asks. | BRAIN | gate fails on a planted test key |

### Phase 1 — Rails and truth · this session
Repo, charter, lane skills, board, decisions/lessons ledgers, research reports, gate script, caveman disabled, LANDING started.
Exit: `bash tests/check.sh` green; START_HERE + both agents launchable; board has the first tasks.

### Phase 2 — Spikes (time-boxed, each ends in a D-entry with numbers, not opinions) · architecture: `docs/ARCHITECTURE.md` (D-005)
| ID | Question | Method | Decides |
|---|---|---|---|
| S1 | **Private permissioned L1** we control | avalanche-cli / platform-cli (skills `avax-subnet-deployment`, `avax-precompiles`, `avax-subnet-evm-config`), local tmpnet first: `txAllowList` + `contractDeployerAllowList` + `feeManager`, native minter off, admin = test Safe; RPC behind an authenticated gateway; genesis gas station | L1 config + hosting (Q2) |
| S2 | **eERC converter (SDK)** on that L1 | deploy `ava-labs/EncryptedERC` converter mode over the bridged ERC-20 with `@avalabs/eerc-sdk`; measure registration/transfer proof time on desktop and a low-end Android, gas, UX of key backup | Go/no-go for encrypted balances; fallback = signed ledger |
| S3 | **Audit Council view key** | Shamir t-of-n split of the auditor key in a ceremony + on-chain `AuditRequest` flow; research threshold ElGamal decryption so the key is never rebuilt | View-power design |
| S4 | **Freeze Council** | Safe multisig as `txAllowList` admin, `FreezeRegistry` with expiring holds | Freeze-power design |
| S5 | **Bank KYC → onboarding** | bank approval (mock bank API) → `Onboarding` contract enables wallet with tier/expiry/hash | Identity flow (KYC mandatory, D-007) |
| S6 | **Bank-run ICTT bridge** | Fuji C-Chain USDC home → L1 remote ERC-20, bank relayer; invariant L1 supply == locked; no admin drain | Ramp + provable liquidity (D-007) |

### Phase 3 — Contracts v2 (BRAIN; tests first; nerves N0–N7; v1 is a spec, not code)
- **KYCRegistry:** tier, expiry, provider-reference hash; **no PII on chain**; compliance role only.
- **PaymentProcessor v7:** one exact fee in bps with a hard cap (N1), minimum amount, SafeERC20, roles + pause, rewards only above
  the minimum and never to the payee (fixes zero-amount farming), fee routed atomically to the FeeRouter.
- **FeeRouter / Treasury:** one distributor (replaces RevenueDistributor + FeeDistributor); prizes paid only from fees that
  arrived (N2); access-controlled `notify`.
- **IssuerGateway** (owns the eERC; bank-only mint after confirmed deposit, burn on payout, reserve attestation hash), **FXDesk**
  (USD↔Bs only against bank-signed quotes), **AuditRequest**, **FreezeRegistry**, **Onboarding**, **GasStation** (genesis-funded, N0).
- **OTCEscrow v2** moved to later: banks are the ramps (D-005).
- **MerchantRegistry v2:** verify / unverify / KYB status.
- **Rewards:** non-transferable ERC-1155 tickets; Raffle with commit-reveal (or VRF if available on the L1); InternetVoucher kept.
- **Dropped (by plan, D-entry each):** ERC-20 ArepaToken (native AREPA gas covers it), LiquidityManager, SavingsVault admin
  "yield" (violates N2/N5), MerchantCreditPool (lending needs its own legal review), ArepaAgent.sol (not ERC-8004).
- **Admin:** Safe multisig + timelock for parameter changes.
- Gate: `forge test` unit + fuzz + **solvency invariant**; `solidity-auditor` loop; audit pipeline stage 1.

### Phase 4 — Banking core (backend)
Node/TypeScript service + Postgres:
- users/accounts with KYC tiers and limits;
- **double-entry ledger** mirrored from chain events by an indexer (the chain is the settlement truth, the ledger is the
  bank view);
- statements and exports;
- back office with roles operator / compliance / auditor and an append-only audit log;
- merchant onboarding (KYB);
- cash-in/out through the OTC escrow;
- **BCV rate signer**: official BCV plus P2P median, signed, pushed on chain with bounds (no hard-coded 400 Bs/$);
- notifications.

PII is stored encrypted at rest and separate from the ledger. The server never trusts the client.

### Phase 5 — App (React PWA, keeps the v1 design system: cream/navy/gold, Inter, PixelButton, cards)
Screens:
- KYC onboarding;
- wallet;
- pay (merchant QR, amount in Bs, fee shown before signing);
- receive;
- history/statements;
- encrypted balance view;
- merchant mode;
- back-office web.

Wallet rules K3/K4/K8/K9. One generated `config/deployments/<chain>.json` feeds app, backend, landing and docs (B6).

### Phase 6 — Agent (later, optional)
Reuse the v1 x402 pattern and tool dispatch; role-gated; replay protection persisted.

### Phase 7 — Landing (LANDING lane, parallel from Phase 1)
Spanish-first, truthful.
- Every feature carries a Live / Testnet / In development / Planned label (T6).
- Addresses and chain params come only from `config/` (T4).
- No fake contacts (T8).

Gates: `node scripts/landing-check.mjs`, `node scripts/landing-probe.mjs`, `bash tests/check.sh`.

### Phase 8 — Audit and testnet launch
- Sequential audit pipeline adapted from DOGEON: baseline → contracts → app↔chain → backend & web security → compliance/KYC flows
  → landing truth → verifier.
- Live E2E on the Fuji L1.
- Real-browser smoke.
- Deploy.
- Pilot with 3–4 real merchants.

## 2. Decisions needed from the user (one at a time, each with a recommendation)
| Q | Decision | Status / recommendation |
|---|---|---|
| Q1 | Custody | **Resolved by D-005:** non-custodial by construction (eERC proofs need the holder's key); key backup/recovery UX is part of S2. |
| Q2 | L1 hosting | Stage A local tmpnet, stage B Fuji L1, stage C mainnet L1 with bank-run validators (ARCHITECTURE §3, D-007). |
| Q3 | Privacy layer | **Chosen: eERC standalone + private RPC (D-005)**, go/no-go after S2 numbers. |
| Q4 | KYC provider | The bank does KYC (mandatory for everyone, D-007); ArepaPay stores no ID documents. |
| Q5 | Fee model | One fee in bps with a cap, enforced in code; set with the partner bank's costs once known. |
| Q6 | Raffles / WiFi minutes | Parked: not in the user's 2026-11-15 model; revisit after the pilot. |
| Q7 | Repo visibility | Private until the Phase 8 audit. |
| Q8 | Customer KYC | **Resolved by D-007: mandatory KYC for everyone.** |
| Q9 | Multisig signers (audit + freeze) | Proposal 2-of-3: bank, bank, ArepaPay. User decides. |
| Q10 | Legal wrapper | Operate under a licensed bank or SUNACRIP licensee + written OFAC opinion before any real money (market §5). |
| Q12 | USDT, USDC or both on the bridge | USDC first on Fuji (Circle testnet faucet exists); both on mainnet if the bank wants. |
| Q11 | Recovery/reversal power | Default no (freeze yes, reverse no); possible only with a custom design. User decides. |

## 3. Risks
- Fuji L1 validator uptime.
- eERC proof cost on low-end phones.
- KYC provider coverage for Venezuela.
- Regulatory exposure: all copy stays "testnet, no real money" until legal review (N5, T7).
- Scope creep from v1's many ideas: the charter's scope fence decides.

## 4. What we keep from v1 (as spec or assets)
- Product concept: merchants as liquidity bridges, cash ↔ USDT escrow, real-goods raffles, WiFi minutes, amounts in Bs.
- Design system: `/mnt/c/Users/dulbi/arepapay-clean/DESIGN_SYSTEM.md`.
- Screen flows: `/mnt/c/Users/dulbi/arepapay-l1/frontend/src/components/`.
- L1 runbook: `arepapay-l1/LOCAL_NETWORK.md`, with the key redacted before any copy.
- v6 security lessons.
- x402 pattern.

Never copy files from the old folders without running the secret scan on them first.
