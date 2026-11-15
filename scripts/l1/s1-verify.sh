#!/usr/bin/env bash
# S1 — prove the arepapaybank LOCAL L1 properties with `cast`. Prints PASS/FAIL per check; exits non-zero on any FAIL.
#
# Reads everything from config/l1/arepapaybank.local.json (R7). LOCAL ONLY.
# Keys: the admin key is read from avalanche-cli's local key store (arepapay-local-admin, LOCAL-TEST-ONLY, never holds value).
# Fresh test wallets are made with `cast wallet new` in memory and never written anywhere. No key is ever printed.
#
# Override for a deliberate failure demo:  EXPECT_CHAIN_ID=13370 scripts/l1/s1-verify.sh   (must FAIL and exit 1)
set -uo pipefail
set +x   # never trace: commands carry private keys

export PATH="$HOME/.foundry/bin:$PATH"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG="$REPO/config/l1/arepapaybank.local.json"
cfg() { python3 -c "import json,functools,sys; d=json.load(open('$CFG')); print(functools.reduce(lambda a,k: a[k], sys.argv[1].split('.'), d))" "$1"; }

RPC="$(cfg rpcUrl)"
CHAIN_ID="$(cfg chainId)"
EXPECT_CHAIN_ID="${EXPECT_CHAIN_ID:-$CHAIN_ID}"
ADMIN_ADDR="$(cfg accounts.admin.address)"
DEPLOYER_AL="$(cfg precompiles.contractDeployerAllowList.address)"
MINTER="$(cfg precompiles.contractNativeMinter.address)"
TX_AL="$(cfg precompiles.txAllowList.address)"
FEE_MGR="$(cfg precompiles.feeManager.address)"
WARP="$(cfg precompiles.warpMessenger.address)"
ADMIN_KEY_FILE="$HOME/.avalanche-cli/key/$(cfg accounts.admin.cliKeyName).pk"

FAILS=0; N=0
pass() { N=$((N+1)); echo "PASS [$N] $1"; }
fail() { N=$((N+1)); FAILS=$((FAILS+1)); echo "FAIL [$N] $1"; }
check() { if [ "$2" = "1" ]; then pass "$1"; else fail "$1"; fi; }
lc() { tr '[:upper:]' '[:lower:]'; }

# --- secrets in memory only ---
[ -r "$ADMIN_KEY_FILE" ] || { echo "admin key arepapay-local-admin not found in avalanche-cli key store"; exit 2; }
ADMIN_PK="$(tr -d '[:space:]' < "$ADMIN_KEY_FILE")"; ADMIN_PK="0x${ADMIN_PK#0x}"
[ "$(cast wallet address --private-key "$ADMIN_PK" | lc)" = "$(echo "$ADMIN_ADDR" | lc)" ] \
  || { echo "admin key does not match config admin address"; exit 2; }
NEW_JSON="$(cast wallet new --json)"
F_ADDR="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["address"])' <<<"$NEW_JSON")"
F_PK="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["private_key"])' <<<"$NEW_JSON")"
unset NEW_JSON
SINK=0x000000000000000000000000000000000000dEaD
# tiny contract init code (returns runtime that returns 42); used for deploy tests
INITCODE=0x600a600c600039600a6000f3602a60005260206000f3

role() { cast call "$1" "readAllowList(address)(uint256)" "$2" -r "$RPC" 2>/dev/null; }
# send as $1=pk; remaining args to cast send. Echo "OK", "REVERTED:<contractAddress|txhash>" (mined, status 0)
# or "ERR:<first error line>" (rejected before inclusion). Error text never contains keys.
try_send() {
  local pk="$1"; shift
  local out
  if out="$(cast send --json --private-key "$pk" -r "$RPC" --gas-limit 300000 "$@" 2>&1)"; then
    python3 -c 'import json,sys; r=json.loads(sys.stdin.read()); print("OK" if int(r["status"],16)==1 else "REVERTED:"+(r.get("contractAddress") or r["transactionHash"]))' <<<"$out" 2>/dev/null \
      || echo "ERR:unparseable receipt"
  else
    echo "ERR:$(grep -i -m1 -E 'error|revert|allow' <<<"$out" | tr -d '\r' | cut -c1-200)"
  fi
}
admin_send() { cast send --private-key "$ADMIN_PK" -r "$RPC" "$@" >/dev/null 2>&1; }

echo "== S1 verify: arepapaybank @ $RPC"
echo "   admin=$ADMIN_ADDR  fresh test address=$F_ADDR (key in memory only)"

# 1. chain id
GOT="$(cast chain-id -r "$RPC" 2>/dev/null || echo none)"
check "chain id is $EXPECT_CHAIN_ID (got $GOT)" "$([ "$GOT" = "$EXPECT_CHAIN_ID" ] && echo 1)"

# 2. active precompile set (subnet-evm eth_getActivePrecompilesAt)
ACTIVE="$(cast rpc eth_getActivePrecompilesAt -r "$RPC" 2>/dev/null)"
has() { python3 -c "import json,sys; sys.exit(0 if '$1' in json.loads(sys.argv[1]) else 1)" "$ACTIVE"; }
for p in txAllowListConfig contractDeployerAllowListConfig feeManagerConfig warpConfig; do
  check "precompile $p is active" "$(has $p && echo 1)"
done

# 3. fund the fresh address (admin may send to anyone; the allowlist gates senders, not receivers)
admin_send "$F_ADDR" --value 1ether
BAL="$(cast balance "$F_ADDR" -r "$RPC" 2>/dev/null || echo 0)"
check "fresh address funded with 1 ARPB by admin (balance $BAL wei)" "$([ "$BAL" = "1000000000000000000" ] && echo 1)"

# 4. non-allowlisted fresh address cannot send
R0="$(role "$TX_AL" "$F_ADDR")"
RES="$(try_send "$F_PK" "$SINK" --value 1)"
echo "     -> fresh address tx: $RES"
check "non-allowlisted address (role=$R0) is rejected by txAllowList" \
  "$([ "$R0" = "0" ] && [[ "$RES" == ERR:* ]] && grep -q -i 'allow' <<<"$RES" && echo 1)"

# 5. admin enables it via TxAllowList precompile -> it can send
admin_send "$TX_AL" "setEnabled(address)" "$F_ADDR"
R1="$(role "$TX_AL" "$F_ADDR")"
RES="$(try_send "$F_PK" "$SINK" --value 1)"
echo "     -> after setEnabled: $RES"
check "admin setEnabled(fresh) -> role=$R1 and the address can send" "$([ "$R1" = "1" ] && [ "$RES" = OK ] && echo 1)"

# 6. deployer allowlist blocks deploys from a tx-enabled but not deploy-enabled address
RD="$(role "$DEPLOYER_AL" "$F_ADDR")"
SIM="$(cast call -r "$RPC" --from "$F_ADDR" --create "$INITCODE" 2>&1 | tr -d '\r' | head -1 | cut -c1-200)"
echo "     -> simulated deploy (eth_call) from fresh address: $SIM"
check "deployer allowlist refuses fresh address in simulation (deployer role=$RD)" \
  "$([ "$RD" = "0" ] && grep -q 'not authorized to deploy' <<<"$SIM" && echo 1)"
RES="$(try_send "$F_PK" --create "$INITCODE")"
CODE_AT="none"; [[ "$RES" == REVERTED:* ]] && CODE_AT="$(cast code "${RES#REVERTED:}" -r "$RPC" 2>/dev/null)"
echo "     -> signed deploy tx from fresh address: $RES (code at target: $CODE_AT)"
check "deployer allowlist: real deploy tx from fresh address is mined as failed and creates no code" \
  "$([[ "$RES" == REVERTED:* ]] && [ "$CODE_AT" = "0x" ] && echo 1)"
# control: the admin (deployer-allowlist admin) can deploy
RES="$(try_send "$ADMIN_PK" --create "$INITCODE")"
echo "     -> admin deploy: $RES"
check "control: deployer-allowlist admin can deploy" "$([ "$RES" = OK ] && echo 1)"

# 7. freeze switch: admin removes it -> blocked again
admin_send "$TX_AL" "setNone(address)" "$F_ADDR"
R2="$(role "$TX_AL" "$F_ADDR")"
RES="$(try_send "$F_PK" "$SINK" --value 1)"
echo "     -> after setNone: $RES"
check "admin setNone(fresh) -> role=$R2 and the address is frozen again" \
  "$([ "$R2" = "0" ] && [[ "$RES" == ERR:* ]] && grep -q -i 'allow' <<<"$RES" && echo 1)"

# 8. native minter is NOT active
MCODE="$(cast code "$MINTER" -r "$RPC" 2>/dev/null)"
TCODE="$(cast code "$TX_AL" -r "$RPC" 2>/dev/null)"
check "native minter not in active precompiles" "$(has contractNativeMinterConfig || echo 1)"
check "native minter address has no code ($MCODE) while txAllowList has ($TCODE)" \
  "$([ "$MCODE" = "0x" ] && [ "$TCODE" = "0x01" ] && echo 1)"
# calling mintNativeCoin as admin must not change the balance of the target
B0="$(cast balance "$SINK" -r "$RPC")"
admin_send "$MINTER" "mintNativeCoin(address,uint256)" "$SINK" 1000000000000000000000 --gas-limit 100000
B1="$(cast balance "$SINK" -r "$RPC")"
check "mintNativeCoin as admin mints nothing (sink balance $B0 -> $B1)" "$([ "$B0" = "$B1" ] && echo 1)"

unset ADMIN_PK F_PK
echo "== $((N-FAILS))/$N checks passed"
[ "$FAILS" -eq 0 ] || { echo "== RESULT: FAIL ($FAILS failing)"; exit 1; }
echo "== RESULT: PASS"
