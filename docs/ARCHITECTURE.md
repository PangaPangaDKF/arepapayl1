# ArepaPay v2 architecture — the encrypted consortium chain

Version 1.0 · 2026-11-15 · D-005 · Owner: BRAIN · Sources: `docs/research/market_landscape.md` (market, Venezuela, perspectives),
eERC source `ava-labs/EncryptedERC@8dc98cd` (read by BRAIN), Avalanche MCP + avaxskills (D-006).

## 0. Thinking (M0)
- **User's model (2026-11-15, own words, condensed):**
  - "a multisig system for data cooperation, because banks need privacy and customers too";
  - "they can freeze funds and watch who has your money if you get hacked";
  - "you can't track txs like in a normal EVM";
  - "centralized privacy";
  - "a centralized banking chain for micro and small business";
  - "banks will be the ramps";
  - "it always will be a private chain for merchants";
  - "a small test for the idea and how it can fail or fit into the real world".
- **What the technology really gives us (verified in code, not marketing):**
  - eERC encrypts **amounts and balances** only.
  - **Sender, receiver and time stay visible** (`PrivateTransfer(address indexed from, address indexed to, …)`).
  - There is **one auditor key**, set only by the contract owner (`EncryptedERC.sol:228`).
  - In standalone mode **only the owner mints** (`privateMint … onlyOwner`).
  - Its blacklist blocks *tokens*, not users.
  - So "can't trace like a normal EVM" needs **two layers**: a private network (outsiders can't read the chain at all) **and**
    eERC (even node operators can't read amounts).
  - Freezing a person has to come from the chain allowlist precompile.
- **Why this shape (rules):**
  - N0: money only enters when a bank receives real money.
  - N6/R3: no lone key, so view and freeze powers are split across independent entities.
  - R4: no cosmetic security, so we label honestly that eERC hides amounts, not counterparties.
  - B3: the research says Drex died on exactly this privacy problem, so we measure before we promise.
- **What the research changes (market_landscape §4–5):**
  - Nobody runs this for micro-merchants; the closest real competitor is Kontigo (licensed app plus Venezuelan bank ramps).
  - The likely failure points are cost versus Binance P2P/Pago Móvil, getting a bank to sign, licensing, and trust in the freeze-key holders.
  - The pilot is therefore designed to **measure those failure points**, not to look finished.

## 1. Layers

### L1 — Private network (who can see and who can act)
- Avalanche L1 (Subnet-EVM). **Validators are run only by consortium members**: ArepaPay plus each partner bank.
- **No public RPC.** Apps reach the chain only through an authenticated gateway (per-institution API keys, rate limits, request log).
- Precompiles:
  - `txAllowList`: only enabled addresses can send transactions. This is the KYC/KYB gate and the freeze switch.
  - `contractDeployerAllowList`: only the consortium deploys.
  - `feeManager`: fees are tiny and stable.
  - `contractNativeMinter` **disabled** (N0).
- Admin of every precompile = the **Freeze Council** multisig (§3), never an EOA.
- Gas: users never buy gas. The native supply is allocated in genesis to a **gas station contract** that tops up allowlisted
  wallets a few cents' worth at a time. There is no minting (N0).
- No bridges, ever (user rule). Teleporter/ICM is not deployed.

### L2 — Encrypted money (what nobody can read)
- **eERC standalone tokens issued by partner banks:**
  - `USDa`: a digital dollar deposit, 1 token = 1 USD held by the issuing bank in USD or USDT/USDC reserves.
  - Optionally `VESa`, digital bolívares.
- **Correction to the original idea:** real USDT/USDC **cannot live on a never-bridged private chain.** What circulates is a
  bank-issued token backed by reserves. That makes the issuer a regulated deposit/e-money issuer, and it must be a licensed bank
  or work under a SUNACRIP licensee (market §2, §5).
- **Mint/burn only by the issuing bank**, through an `IssuerGateway` contract that owns the eERC:
  - mint happens only after the bank's core banking confirms the fiat or stablecoin deposit (N0);
  - burn happens when the bank pays out;
  - monthly reserve attestation is published as a hash on chain.
- Holders keep their own eERC keys. The ZK proofs need the holder's key, so the system is **non-custodial by construction**
  (this resolves Q1 toward non-custodial; the recovery UX is a spike).
- Trading USD↔Bs happens only with banks, on chain: banks quote and fill through an `FXDesk` contract at a rate the bank signs.
  There is no external exchange.

### L3 — Oversight: "data cooperation"
Two separate powers held by two separate councils. Each is a multisig of **independent legal entities** (research: "never one
organization controlling the threshold", the Ronin lesson).

| Power | Holder | Mechanism | Limits (published policy) |
|---|---|---|---|
| **View** (decrypt amounts/balances of a case) | **Audit Council**, e.g. 3-of-5 | eERC auditor key generated in a ceremony and split with Shamir t-of-n (spike S3 also tests threshold ElGamal so the key is never rebuilt in one place). A decryption happens only for an on-chain `AuditRequest(caseId, reason, scope)` approved by t members. | Logged forever on chain; scoped to named addresses and a date range; reason codes (fraud report, court order, regulator request) |
| **Freeze** (stop an address from transacting) | **Freeze Council**, e.g. 3-of-5 | Freeze Council multisig removes the address from `txAllowList`; a `FreezeRegistry` logs case, reason and expiry. | **Temporary holds lapse** (e.g. 72 h) unless renewed with a court order or a regulator request; every use published (counts and reasons) |

- **Freeze yes, reverse no.** eERC balances can't be moved without the holder's key, so the system can freeze a thief, not seize funds.
  Restitution is a legal process.
  - Reversal power would make the councils custodians of everyone's money, which is a much bigger trust and legal step.
  - Any "recovery" feature is a separate user decision (Q11).
- **Council seats (proposal, Q9):**
  - the issuing bank;
  - a second bank;
  - ArepaPay;
  - a merchant cooperative/association;
  - an independent auditor or notary.
  - Regulators get read access through the Audit Council process, not a seat holding keys.

### L4 — Identity
- **Merchants (KYB)** are verified by the partner bank, which already has to know its customer. ArepaPay never stores ID documents.
- The bank's approval → Freeze Council-managed `Onboarding` contract enables the merchant's wallet in `txAllowList` and records
  tier + expiry + a hash. There is no PII on chain (R2).
- **Customers (Q8):** the user said KYC is for merchants. Because `txAllowList` gates every sender, customers still need an
  enabled wallet. Proposal: a **light tier** (phone number + merchant sponsorship, low daily limit) that upgrades to full KYC at
  the bank for higher limits.

### L5 — Banking core (off chain)
- Indexer → double-entry ledger per institution.
- Holders decrypt their own statements client-side; banks see their own customers' flows through their KYC relationship and the
  audit process.
- **Tax withholding:** each payment can split a tax portion (e.g. IGTF 3% on foreign-currency payments) into a tax escrow that the
  merchant's bank remits. This is an accounting export, not legal advice; the rate comes from the bank (Q10).
- Merchant accounting exports.
- Restock payments to suppliers on the same chain (the B2B loop, §2).
- Credit/RWA later: merchant payment history → bank credit scoring with the merchant's consent (scope fence: Phase 9+).

### L6 — Apps
- Merchant PWA: charge in Bs, receive USDa, statements, tax export, restock payments.
- Customer PWA: pay by QR, light tier.
- Bank console: mint/burn, FX desk, KYB queue.
- Council console: AuditRequest and freeze workflow.

## 2. Pilot shape (what we test, and how it can fail)
- **One partner bank + one wholesale distributor + 10–30 of its retail merchants** in a closed restock loop. This is where the
  research says the model fits best (market §4): money moves from customers → merchants → distributor → bank, all inside the chain.
- **Measure:**
  - active merchants per week;
  - all-in cost per $100 versus Pago Móvil and Binance P2P;
  - payment success rate and latency;
  - eERC proof time on the merchants' real phones;
  - downtime during blackouts;
  - freeze/audit requests (count, time to resolve, abuse).
- **Kill criteria** (written before starting):
  - all-in cost stays above Binance P2P;
  - proofs take more than 10 s on median phones;
  - no bank signs within the pilot window.

## 3. Alternatives considered
| Option | Why not (now) |
|---|---|
| Public chain + eERC on C-Chain | Counterparties public to the world; contradicts "private chain for merchants" |
| Centralized signed ledger first, no chain (research suggestion) | Cheaper and maybe wiser commercially, but the user's stated goal is to test the *chain* model; kept as the fallback if S2 fails |
| Canton / Besu private transactions | Canton is outside the Avalanche stack the user chose; Besu Tessera private transactions are deprecated (market §1) |
| Single auditor key held by ArepaPay | The single-trusted-regulator model already failed in Venezuela (PDVSA-Cripto); violates R3 |
| Clawback/reversal power | Turns councils into custodians; legal/trust step the user hasn't chosen (Q11) |

## 4. Open questions (added to PLAN §2)
- Q8 customer KYC tier.
- Q9 council seats.
- Q10 legal wrapper (licensed bank / SUNACRIP licensee partner, OFAC opinion) and tax rate source.
- Q11 recovery/reversal power: yes or no.
