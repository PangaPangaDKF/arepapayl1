# Stage B: ArepaPay L1 on Fuji, reachable by anyone with MetaMask

Version 1.0 · 2026-11-15 · D-016 · Owner: BRAIN · Status: **runbook, waiting on the user's steps U-B1…U-B3**
Source of commands: the installed avalanche-cli v1.9.6 help (`~/bin/avalanche blockchain deploy --help`, `avalanche node --help`),
not memory (G6). Local proof of the same chain config: spike S1 (15/15) and S2.

## 0. Thinking (M0)
- **User's choice (2026-11-15):** "quiero la B". The L1 lives on Fuji so anyone can test from the MetaMask mobile browser.
- **What a Fuji L1 needs, from the CLI help:**
  - a bootstrap validator node that Fuji peers can reach (TCP 9651);
  - a funded P-Chain key that pays creation fees and the validator's continuous fee (`--balance`; about 1.33 AVAX per validator
    per month under ACP-77, confirmed in S1);
  - an **HTTPS** RPC URL for MetaMask.
- **Why a server and not this PC:** WSL sits behind NAT; Fuji peers can't reach port 9651 without router and Windows port
  forwarding, and the node would stop whenever the PC sleeps. `avalanche node setup` configures a remote server over SSH.
- **Keys (N6):**
  - The Fuji key is created **in the user's own terminal** and holds testnet AVAX only (no real value).
  - Agents never print or copy it.
  - Admin roles on the L1 move to a Safe multisig before any real money (stage C, R3).

## 1. The user's steps
| ID | Step | Exact action | Done when |
|---|---|---|---|
| U-B1 | A small Linux server | Ubuntu 22.04/24.04, ≥ 4 vCPU, ≥ 8 GB RAM, ≥ 200 GB SSD, public IP; firewall open on TCP 9651 (staking) and 443 (HTTPS RPC). SSH key access for user `ubuntu` (or similar). Any provider. | You send BRAIN the server's IP and SSH user (not the SSH private key) |
| U-B2 | Fuji key, in your terminal | `avalanche key create arepapay-fuji` | `avalanche key list --fuji` shows it |
| U-B3 | Fund it with test AVAX | Request Fuji AVAX from the Avalanche faucet (core.app tools → testnet faucet) to the key's C-Chain address, then move it to the P-Chain: `avalanche key transfer` (follow its prompts: from C-Chain to P-Chain, same key). Target ≥ 3 AVAX on the P-Chain (creation fees + 1–2 AVAX validator balance). | `avalanche key list --fuji --keys arepapay-fuji` shows the P-Chain balance |
| U-B4 | DNS | An A record `rpc.arepapay.site` → the server IP (same DNS panel as the landing) | `dig rpc.arepapay.site` returns the IP |

## 2. BRAIN's steps (after U-B1…U-B4)
1. **Node:** `avalanche node setup` against the server (SSH), Fuji, primary-network partial sync; wait until bootstrapped
   (`avalanche node status`).
2. **Chain config:**
   - `config/l1/genesis.arepapaybank.fuji.json` is derived from the S1 genesis: txAllowList, contractDeployerAllowList, feeManager
     and warp on; native minter off; gas limit raised for eERC capacity (S2: ~1.1M gas per private transfer).
   - Precompile admins = the user's `arepapay-fuji` address now, the Safe later.
   - ewoq is **not** included (local-only key).
3. **Create + deploy:**
   - `avalanche blockchain create arepapaybank-fuji --genesis <file> …`
   - `avalanche blockchain deploy arepapaybank-fuji --fuji --key arepapay-fuji --bootstrap-endpoints <server> --balance 1`
     (flags per the v1.9.6 help; PoA validator manager on the L1).
4. **Public RPC:** Caddy on the server terminates HTTPS at `https://rpc.arepapay.site` and proxies only the L1's
   `/ext/bc/<blockchainID>/rpc` path. Admin/debug APIs are not exposed; requests are rate-limited.
5. **Verify:** `scripts/l1/s1-verify.sh` pointed at the Fuji config (`config/l1/arepapaybank.fuji.json`) → all checks PASS;
   `eth_chainId` over HTTPS from outside.
6. **eERC:** re-run the S2 deploy against Fuji → `config/l1/eerc.fuji.json`.
7. **MetaMask:** the test dApp's "add network" button uses chain id, RPC and currency from `config/l1/arepapaybank.fuji.json`
   (never hand-typed; landing drift guard T4).
8. **Testers' access (R11 in test form):** a tester submits their address through the test dApp; the bank admin enables it in
   `txAllowList`. Manual approval stands in for KYC during the test.

## 3. Costs and limits (facts, not advice)
- The P-Chain continuous fee is paid in **testnet** AVAX: 512 nAVAX/s ≈ 1.33 AVAX/month per validator (S1, ACP-77).
- The server is the only real-money cost.
- Addresses are readable by anyone with the public test RPC; amounts are not (ARCHITECTURE §3a).
- One validator = no fault tolerance. Fine for a test. Stage C adds bank-run validators.
