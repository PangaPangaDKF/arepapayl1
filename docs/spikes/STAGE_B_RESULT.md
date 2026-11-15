# Stage B result: ArepaPay L1 on Fuji (D-019)

Version 0.1 · 2026-11-15 · Status: **BLOCKED at step 4 (blockchain deploy)**. Steps 1–3 are done. Steps 5–9 were not started
because they need the deployed L1.

## 0. Summary
| Step | Result |
|---|---|
| 1. Import the pending C→P funds, verify on our node | **PASS**: 3.609992904 AVAX on the P-Chain (`platform.getBalance` via 127.0.0.1:9750) |
| 2. Gas-station key `arepapay-fuji-gas` | **PASS**: `0x9769D591AA88558BB812Cc95908dc4c87a5cF2fF` / `P-fuji1870fywuac54xadmkwx24zgsy02hhx9z9jpn9jd` |
| 3. `config/l1/genesis.arepapaybank.fuji.json` | **PASS** (written; not yet live on chain) |
| 4. Create and deploy on Fuji | **BLOCKED**: no installable subnet-evm matches the Fuji node's plugin version (§2) |
| 5–8. Verify, MVP deploy, single-origin and tunnel, e2e-fuji | not started (they need step 4) |
| Public URL | none yet: no tunnel was opened, because there is no chain to expose |

- Chain id: **77078**. It is free on chainlist (`chainid.network/chains_mini.json`, 2,879 chains). 77077, used by our local S1
  chain, is taken there by "Autyon Testnet"; that is harmless for a local-only chain.
- Blockchain id: none yet.

## 1. What was done (commands and outputs)
CLI: `A=~/.avalanche-cli-latest/bin/avalanche` (v1.9.7). Our Fuji node is avalanchego v1.15.3 (`rpcchainvm=47`), on
127.0.0.1:9750, with partial sync. P bootstrapped at 03:50:17 (`info.isBootstrapped P → true`).

### Step 2: gas key
```
$A key create arepapay-fuji-gas            # -> "Key created" (file ~/.avalanche-cli/key/arepapay-fuji-gas.pk, mode 600)
cast wallet address --private-key <read from the .pk at runtime>   # addresses only, no key printed
  arepapay-fuji      0x3A7e0054821395ca11bA6c403B7DC1fB99235Fc8   P-fuji1rg4s98axcsj6wewqhmwxeqf3larw8rjamg8lq4
  arepapay-fuji-gas  0x9769D591AA88558BB812Cc95908dc4c87a5cF2fF   P-fuji1870fywuac54xadmkwx24zgsy02hhx9z9jpn9jd
```
- `$A key list --fuji` fails: `the method platform.getBalance is not available` (public API).
- `$A key list --endpoint http://127.0.0.1:9750 --blockchains p …` works.

### Step 1: C→P import
Findings:
1. **Our node cannot see the export.** With partial sync it runs only the P-Chain; no C chain is created (the main log lists
   only the P chain). C-Chain ExportTxs are never written to its shared memory, so `platform.getUTXOs(sourceChain=C)` returns 0
   on 127.0.0.1:9750.
2. **The public API can see it.** `platform.getUTXOs(sourceChain=C)` on `api.avax-test.network` returned 1 UTXO of
   `0xd693a400` = 3.6 AVAX.
3. **The new CLI fails the same way as the old one.** I ran
   `$A key transfer --fuji --key arepapay-fuji --destination-key arepapay-fuji --c-chain-sender --p-chain-receiver --amount 0.01`.
   It issued ExportTx `KsNXmi8vKn3utsHbzRKSK8qix8mG7qRfco6xvWsfDGhquVs7p`, then failed with
   `the method avax.getAtomicTxStatus is not available`. That left 3.61 AVAX pending.
4. **Fix: `scripts/l1/fuji-import-p.sh`.**
   - It builds the P-Chain ImportTx with `@avalabs/avalanchejs@5.2.0`. I installed it with `npm i --ignore-scripts` into the
     scratchpad; it is not a repo dependency. I picked 5.2.0 over 6.0.0, which was published 2 days ago.
   - It issues the tx on the public API.
   - It then checks the balance on **our** node.
   - The key is read from the CLI key store at runtime and never printed.
```
AVALANCHEJS_DIR=<scratchpad>/avjs scripts/l1/fuji-import-p.sh arepapay-fuji
P address P-fuji1rg4s98axcsj6wewqhmwxeqf3larw8rjamg8lq4: 2 pending atomic UTXO(s) from C, 3.61 AVAX
ImportTx issued: YL6Q1SBwhup38CNG7smypkB2VvS9ZWh28YegYpXQ3R8m3ZiUM
ImportTx Committed
# 10 s later, our node:
curl … platform.getBalance … http://127.0.0.1:9750/ext/bc/P  -> {"balance":"3609992904","unlocked":"3609992904",…}
```
C-Chain balance after: 0.579999998 AVAX (it was 0.59).

### Step 3: genesis
1. I made a CLI template so that the genesis-deployed validator-manager contracts carry the right owner (not ewoq):
```
$A blockchain create arepapaybankfuji --evm --evm-chain-id 77078 --evm-token ARPB --test-defaults --sovereign \
  --proof-of-authority --validator-manager-owner 0x3A7e…5Fc8 --proxy-contract-owner 0x3A7e…5Fc8 --warp --icm=false --vm-version v0.8.0
```
   - The CLI refuses dashes in names, so the CLI name is `arepapaybankfuji`.
   - In the template, the ProxyAdmin slot0 = `0x3a7e…5fc8`. The validator manager is initialized at deploy time.
2. I then edited the template into `config/l1/genesis.arepapaybank.fuji.json`:

| Setting | Value |
|---|---|
| chainId | 77078 |
| txAllowList | admins `[arepapay-fuji 0x3A7e…5Fc8]`, enabled `[arepapay-fuji-gas 0x9769…F2fF]` |
| contractDeployerAllowList admins | arepapay-fuji |
| feeManager admins | arepapay-fuji |
| native minter / reward manager | absent |
| warp | `blockTimestamp` = genesis timestamp `1794728879` (`0x6af963af`), the S1 lesson; quorum 67 |
| gasLimit | 20,000,000 (`feeConfig.gasLimit` and header `gasLimit` `0x1312d00`) |
| alloc | arepapay-fuji 1,000 ARPB; arepapay-fuji-gas 100,000 ARPB; the CLI's validator-manager contracts (`0x0C0DEbA5E…`, `0x0Feedc0de…` proxy, `0xa0AffE…` ProxyAdmin owned by arepapay-fuji, `0x9c00629c…` library) |
| ewoq / deployer (`0x0D1F…`) | **not present**; a grep for either address returns 0 matches |

- arepapay-fuji, as txAllowList *admin*, can send txs, so it can sign the CLI's PoA `initializeValidatorSet` (S1 problem 3)
  without enabling anyone else.

## 2. The blocker (step 4)
**The Fuji node needs a plugin-47 subnet-evm, and avalanche-cli 1.9.7 cannot install one.**
1. **The node can't go back to plugin 44.** Fuji requires avalanchego ≥ v1.15 (Helicon, mandatory; v1.15.0 moved the plugin
   version to 46, and v1.15.3 is at 47). v1.14.x (plugin 44) cannot follow Fuji.
2. **The newest subnet-evm the CLI knows is plugin 44.** It is `v0.8.0` (RPC 44), the last release in `ava-labs/subnet-evm`.
   `--latest` also resolves to v0.8.0.
3. **The plugin-47 build lives in another repo, where the CLI doesn't look.** subnet-evm moved into the avalanchego repo
   (`graft/subnet-evm`). The plugin-47 binary is the asset `subnet-evm-linux-amd64-v1.15.3.tar.gz` of the **avalanchego** v1.15.3
   release. `blockchain create --vm-version v1.15.3` looks in the old repo and fails:
   `failure downloading https://github.com/ava-labs/subnet-evm/releases/download/v1.15.3/subnet-evm_1.15.3_linux_amd64.tar.gz: 404`.
4. **I downloaded the official tarball but could not install it.**
   - Tarball: `scratchpad/dl-subnetevm/se.tar.gz`, sha256 `192898ff500fc8be8816fb1aacb58285d2c5ef20a8e9a02a2b66df8fdfbb9c14`;
     its `.sig` is also published.
   - Extracting it into `~/.avalanche-cli/bin/subnet-evm/subnet-evm-v1.15.3/` (where the CLI checks for installed VMs) was
     **denied by the session's permission classifier**.
   - Extracting and running `--version` in the scratchpad was **denied** too.
   - I did not try further workarounds (for example `--from-github-repo` builds), since they would sidestep the same denial.

### What unblocks it (user decision)
**Option A (recommended).** The user, in their own terminal, verifies and installs the official plugin:
```bash
cd /tmp/claude-1000/-home-panga/9175df3d-cd88-4613-9f2f-8bb72c0ae070/scratchpad/dl-subnetevm
sha256sum se.tar.gz     # 192898ff500fc8be8816fb1aacb58285d2c5ef20a8e9a02a2b66df8fdfbb9c14
mkdir -p ~/.avalanche-cli/bin/subnet-evm/subnet-evm-v1.15.3
tar xzf se.tar.gz -C ~/.avalanche-cli/bin/subnet-evm/subnet-evm-v1.15.3 --strip-components=1
~/.avalanche-cli/bin/subnet-evm/subnet-evm-v1.15.3/subnet-evm --version   # expect plugin/RPC 47
```
Or grant the agent permission to do exactly that.

**Option B.** Pass the extracted binary with
`blockchain create … --custom --custom-vm-path <path> --genesis config/l1/genesis.arepapaybank.fuji.json`. This needs the same
permission, and the sidecar becomes "Custom VM". It is less tested with the PoA flow.

**Then step 4:**
```bash
$A blockchain create arepapaybankfuji --force --genesis config/l1/genesis.arepapaybank.fuji.json --evm --evm-token ARPB \
  --vm-version v1.15.3 --sovereign --proof-of-authority \
  --validator-manager-owner 0x3A7e0054821395ca11bA6c403B7DC1fB99235Fc8 --proxy-contract-owner 0x3A7e0054821395ca11bA6c403B7DC1fB99235Fc8 \
  --warp --icm=false
# trim chain.json eth-apis to eth, eth-filter, net, web3, internal-eth, internal-blockchain, internal-transaction (S1 problem 7)
$A blockchain deploy arepapaybankfuji --endpoint http://127.0.0.1:9750 --key arepapay-fuji \
  --bootstrap-endpoints http://127.0.0.1:9750 --balance 1     # or --use-local-machine --partial-sync
```

### Risks still open for step 4 (untested)
1. **The node advertises `public-ip 127.0.0.1`.**
   - Behind WSL NAT, Fuji peers cannot dial 9751.
   - A single-validator L1 does not need inbound primary-network peers to produce blocks.
   - The CLI's signature aggregation for the ConvertSubnetToL1 justification runs on this machine, so it can reach the node.
   - Expected to work for a test, but unproven.
2. **The node must track the new subnet** (`track-subnets`), which needs a restart. The CLI does this for its own local
   clusters.

## 3. MetaMask steps for testers (valid once step 7 is live)
1. Open the public `https://…trycloudflare.com/?net=fuji` URL inside the MetaMask mobile app's browser.
2. "Agregar / cambiar a ArepaPay L1" adds chain 77078 (ARPB) with RPC `<public origin>/rpc`, taken from `/config/fuji`.
3. "Conectar" → "Solicitar acceso".
4. The admin approves with `NET=fuji ADMIN_KEY_FILE=… GAS_KEY_FILE=… node backend/onboarding/admin.mjs approve <addr>`, or the
   service runs with `AUTO_APPROVE=1`.

## 4. What stops when this PC sleeps
Everything that is public:
- the Fuji node, and with it the only L1 validator, so the L1 stops producing blocks;
- the onboarding service;
- the cloudflared quick tunnel. Its URL also changes on every restart.

The validator's P-Chain balance keeps being charged while the node is offline: 512 nAVAX/s ≈ 1.33 AVAX/month.

## 5. Costs observed
| Item | Cost |
|---|---|
| C-Chain ExportTxs (two) | ≈ 0.000000002 AVAX total |
| P-Chain ImportTx | 0.000007096 AVAX (3.61 → 3.609992904) |
| P-Chain left for create, convert and validator balance | 3.609992904 AVAX |

## 6. Open issues
1. The step-4 blocker above (plugin-47 subnet-evm install).
2. The CLI blockchain config `arepapaybankfuji` exists as an undeployed v0.8.0 template; it is recreated with `--force` above.
3. `@avalabs/avalanchejs` lives in the scratchpad only. If the import script stays, decide whether to pin it in a repo package.
4. avalanche-cli 1.9.7 is incompatible with the current public Fuji API (`platform.getBalance`, `avax.getAtomicTxStatus`)
   and with the avalanchego-hosted subnet-evm releases. Report it upstream or pin our own tooling.
5. Steps 5–9 (`scripts/l1/fuji-verify.sh`, `scripts/mvp/deploy-fuji.sh`, the onboarding single-origin proxy, the tunnel,
   `scripts/mvp/e2e-fuji.sh`) are not written yet.
