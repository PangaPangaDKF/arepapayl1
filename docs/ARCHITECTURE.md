# ArepaPay v2 architecture — bank-run encrypted L1 with real USDT/USDC collateral

Version 1.1 · 2026-11-15 · D-005, corrected by D-007 · Owner: BRAIN · Sources: user's words (below), eERC source
`ava-labs/EncryptedERC@8dc98cd` (read by BRAIN), `docs/research/market_landscape.md`, Avalanche MCP + avaxskills (D-006).

## 0. The user's model (this is the spec; BRAIN analyzes it, it does not replace it)
User, 2026-11-15 (Spanish, condensed, translated):
- "I want the chain encrypted with the SDK."
- "The centralized part, where the bank controls it or is the ramp, means there will be a **bridge and initial liquidity**.
  Micro businesses deposit the **USDT or USDC collateral** they need."
- "The IRL test is **real**: **$100 per micro business**, like a bakery or a shop with pumps and tanks that refills filtered
  water jugs. To start they'd invest 100 real USDT, or whatever best fits 'legal' use, since we're self-custody."
- "The L1 is a private service; used locally and controlled with **$1,000 of liquidity**. It's blockchain logic."
- "The bank has real USD backing, and the chain also holds USDT or USDC; obviously **the bank bridges**, as the entity in charge
  of its chain and its validators. It saves the bank the work of upgrading to a whole new network or changing its language or
  its centralized logic."
- "If the chain closes, **the liquidity is in there and not in the bank**. That's a plus for the bank: it can show that the
  liquidity exists and can be returned, even if the bank goes bankrupt tomorrow."
- "I just don't want people's **balances or transactions to be traced**. That's bank-style centralization, and it's privacy."
- "As a security layer, **if someone moves your funds, the bank can tell you**."
- "**KYC is mandatory** and part of the centralization. Only real people can register; it's a bank's network, meaning trust."

D-005 v1.0 got three things wrong, and v1.1 corrects them:
1. "never bridged" → **one bridge, run by the bank**;
2. "bank-issued IOU" → **real USDT/USDC locked in the bridge**;
3. "light tier without KYC" → **KYC mandatory for everyone**.
Lesson L-003.

## 1. How it fits together (one picture in words)
```
 Avalanche C-Chain (public)                 ArepaPay L1 (private, run by the bank)
 ┌──────────────────────────┐   bank-run    ┌──────────────────────────────────────────────┐
 │ Real USDT / USDC         │   bridge      │ Bridged USDT/USDC (ERC-20, only via bridge)   │
 │ locked in the bridge's   │ ─────────────▶│        │ deposit (converter mode)             │
 │ "home" contract          │ ◀───────────── │        ▼                                      │
 │ = the liquidity, visible │   (ICTT/ICM)  │ eERC encrypted balance (SDK): transfers and   │
 │ to anyone on C-Chain     │               │ balances hidden; KYC'd wallets only           │
 └──────────────────────────┘               └──────────────────────────────────────────────┘
```
- **The liquidity lives on chain, not on the bank's balance sheet.** The real USDT/USDC sits in the bridge's home contract on
  C-Chain. Anyone can verify that the locked amount matches what circulates on the L1. This is the "plus for the bank" the user
  described: provable reserves that can be returned even if the bank fails.
  - Caveat: that holds only if the bridge contract has no admin path to drain it. That is a design requirement, tested by an
    invariant (N2).
- **The bank doesn't have to rebuild its systems.** It runs the validators, the bridge relayer and the KYC, and plugs its existing
  core banking into the chain through an API.

## 2. Layers

### L1 — The bank's private chain
- Avalanche L1 (Subnet-EVM). **Validators run by the bank** (plus ArepaPay as a second operator if the bank agrees).
- **No public RPC:** the bank's apps and ArepaPay's apps connect through an authenticated gateway.
  - Outsiders can't read anything.
  - This is the bank-secrecy layer the user asked for.
- Precompiles:
  - `txAllowList`: only KYC'd wallets can transact. It is also the freeze switch.
  - `contractDeployerAllowList`: only the bank and ArepaPay deploy.
  - `feeManager`;
  - `contractNativeMinter` off (N0: tokens only arrive through the bridge).
- Gas: users never buy gas. A genesis-funded gas station tops up KYC'd wallets.

### L2 — The bridge and the liquidity (the "ramp")
- **One bridge only, operated by the bank:** Avalanche Interchain Token Transfer (ICTT over ICM/Warp).
  - A C-Chain "home" contract locks real USDT/USDC.
  - A "remote" ERC-20 on the L1 is minted 1:1 only by the bridge.
  - The bank runs the relayer.
- No other bridges or external platforms (charter R9 v1.1).
- **Initial liquidity: about $1,000**, so the bank can serve withdrawals and bolívar trades at the start.
- **Merchant collateral: $100 in real USDT/USDC per merchant** (or the amount that fits the use), deposited by the merchant
  from their own wallet. That keeps it self-custody: their key, their funds.
- Bolívares: the bank trades USD↔Bs with merchants off chain through its normal banking, or on chain through a bank-signed
  quote contract (FXDesk). Exchange happens only with the bank.

### L3 — Encryption with the SDK (what nobody outside can trace)
- **eERC converter mode** (`@avalabs/eerc-sdk` + `ava-labs/EncryptedERC`) wraps the bridged USDT/USDC into encrypted balances.
- What is hidden and from whom, verified in `EncryptedERC.sol`:

| Data | Public internet | Bank (runs the nodes) | Audit key holder |
|---|---|---|---|
| Balances | hidden (private chain + encrypted) | **encrypted** | can decrypt |
| Transfer amounts | hidden | **encrypted** | can decrypt |
| Who paid whom (addresses) | hidden (private chain) | visible (eERC emits `from`/`to`) | visible |
| Deposit / withdraw amounts (entering/leaving encryption) | hidden | visible (`Deposit`/`Withdraw` events); deposit ciphertexts are deterministic, so deposit-only balances are derivable (S2) | visible |
- So nobody outside can trace anything, and inside the bank amounts and balances stay encrypted. The bank knows the network
  (who pays whom), like any bank knows its customers' counterparties.
- **Holders keep their own keys:** the ZK proofs require the holder's key, so the system is self-custody by construction.

### L4 — Security layer: "if someone moves your funds, the bank can tell you"
- The eERC **auditor key** (one per token, set by the contract owner) lets its holder decrypt amounts for a specific case.
- **Who holds it:** the bank, in a multisig with ArepaPay. Requests are logged on chain (`AuditRequest`: case, reason, wallets,
  dates).
  - Proposal: 2-of-3, bank + bank + ArepaPay. The user decides the signers (Q9).
- **Flow when a user reports theft:**
  1. the user reports;
  2. the bank opens a case;
  3. the auditor multisig decrypts the movements of the user's wallet;
  4. the bank tells the user where the funds went (the counterparty is a KYC'd person on the bank's network);
  5. the Freeze multisig freezes the receiving wallet through `txAllowList`;
  6. legal process.
- **Freezing contract accounts:** `txAllowList` checks the sending EOA, so freezing a contract account means removing its
  executors. Only the bank can deploy contracts (deployer allowlist), so every contract account is known (S2).
- **Freeze yes, reverse no** (default): eERC balances can't be moved without the holder's key. Adding a reversal/recovery power is
  possible only with a custom design and is the user's decision (Q11).

### L5 — Identity: KYC mandatory for everyone
- Every wallet (merchant or customer) is enabled in `txAllowList` only after **KYC at the bank**.
- On chain: tier, expiry, a hash. ID documents stay in the bank's systems (R2).
- Merchants additionally pass KYB (business registration, activity).

### L6 — Banking core and apps
- Indexer → ledger per institution.
- Holders decrypt their own statements in the app.
- Tax withholding export for merchants.
- Restock payments to suppliers on chain.
- Credit/RWA later, based on merchant history with consent.
- Apps:
  - Merchant PWA: charge in Bs, receive encrypted USDT/USDC, statements, tax export.
  - Customer PWA: pay by QR.
  - Bank console: KYC queue, bridge/liquidity monitor, FX, cases.
  - Multisig console: audit requests, freezes.

## 3. The IRL pilot (real money, small, staged)
| Stage | Network | Money | Gate to enter |
|---|---|---|---|
| A | Local tmpnet | none | spikes S1–S6 green |
| B | Fuji L1 + Fuji C-Chain | testnet USDC (Circle faucet) | full flow works end to end on real phones; proof times measured |
| C | **Mainnet L1 + C-Chain** | **real USDT/USDC: ~$1,000 initial liquidity + $100 per merchant**, first merchants: a bakery, a water-refill shop | contracts + bridge audited (master-method §4.3: "only the live chain proves deployment"; real funds after the audit pipeline is green); keys in a multisig (N6) |

Why staged: it is the same rule we used in DOGEON. Mocks prove logic, testnet proves deployment, and real money goes in only after
the audit is green. It is not a judgment on the idea.

Facts for stage C:
- A mainnet L1 pays a continuous validator fee on the P-Chain (about 1.33 AVAX/month per validator under ACP-77; to verify in S1).
- The bridge relayer needs a little AVAX for C-Chain gas.

**Measure:**
- merchants active per week;
- cost per $100 moved compared with Pago Móvil and Binance P2P;
- eERC proof time on the merchants' phones;
- bridge in/out time;
- blackout downtime;
- theft/freeze cases handled.

## 3b. Measured so far (S1, S2, local)
- S1: allowlist, freeze switch, deployer allowlist and native minter off: 15/15 PASS.
- S2: eERC converter end to end works. Transfer proof 4.4–7.6 s on a desktop CPU; gas ~1.1M per private transfer (~3.5 tx/s at
  an 8M gas limit). **Biggest risk: proof time on cheap phones (projected 25–60 s in the browser).** It needs the user's
  measurement. Options if too slow: a native mobile prover instead of the browser, a merchant POS device doing the proving, or
  the signed-ledger fallback. Proving on a server with the user's key would end self-custody, so it is only for the bank's own
  escrow (option C).

## 4. Spikes
| ID | Proves |
|---|---|
| S1 | Private L1 on tmpnet: allowlists, gateway RPC, native minter off |
| S2 | eERC converter over an ERC-20 on that L1; proof times on desktop and a low-end Android |
| S3 | Auditor multisig + `AuditRequest`, decrypt one wallet's movements |
| S4 | Freeze multisig via `txAllowList` + `FreezeRegistry` |
| S5 | KYC at the bank (mock API) → wallet enabled |
| S6 | **ICTT bridge** C-Chain (Fuji) USDC home → L1 remote, bank-run relayer, invariant: L1 supply == locked on C-Chain, no admin drain |

## 5. Open decisions (the user's)
- Q9: auditor and freeze multisig signers.
- Q10: legal wrapper for stage C.
- Q11: reversal/recovery power, yes or no.
- Q12: USDT, USDC or both.
