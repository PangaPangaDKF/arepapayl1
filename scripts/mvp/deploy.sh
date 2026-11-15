#!/usr/bin/env bash
# Deploy the MVP test stack (ArepaPayTestUSD + SplitPayEscrow) and generate config/l1/mvp.<net>.json.
# Usage: scripts/mvp/deploy.sh [local]      (LOCAL ONLY for now; Fuji deploys use the user's own keystore, see app/README.md)
# Keys: read from avalanche-cli's local key store (LOCAL-TEST-ONLY, never hold value). Never printed, never written to the repo.
set -euo pipefail
set +x   # never trace: commands carry private keys

export PATH="$HOME/.foundry/bin:$PATH"
NET="${1:-local}"
[ "$NET" = "local" ] || { echo "deploy.sh only deploys to the LOCAL L1 (got: $NET)"; exit 2; }
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG_REL="config/l1/arepapaybank.$NET.json"
CFG="$REPO/$CFG_REL"
cfg() { python3 -c "import json,functools,sys; d=json.load(open('$CFG')); print(functools.reduce(lambda a,k: a[k], sys.argv[1].split('.'), d))" "$1"; }
lc() { tr '[:upper:]' '[:lower:]'; }

RPC="$(cfg rpcUrl)"
ADMIN_ADDR="$(cfg accounts.admin.address)"
GAS_ADDR="$(cfg accounts.gasStation.address)"
TX_AL="$(cfg precompiles.txAllowList.address)"
DEP_AL="$(cfg precompiles.contractDeployerAllowList.address)"
ADMIN_KEY_FILE="$HOME/.avalanche-cli/key/$(cfg accounts.admin.cliKeyName).pk"
[ -r "$ADMIN_KEY_FILE" ] || { echo "admin key not found in the avalanche-cli key store"; exit 2; }

# sanity: key matches config, chain id matches config, deployer is on the deployer allowlist (role >= 1)
[ "$(cast wallet address --private-key "$(tr -d '[:space:]' < "$ADMIN_KEY_FILE")" | lc)" = "$(echo "$ADMIN_ADDR" | lc)" ] \
  || { echo "admin key does not match the config admin address"; exit 2; }
[ "$(cast chain-id -r "$RPC")" = "$(cfg chainId)" ] || { echo "RPC chain id differs from config"; exit 2; }
[ "$(cast call "$DEP_AL" "readAllowList(address)(uint256)" "$ADMIN_ADDR" -r "$RPC")" != "0" ] \
  || { echo "admin is not on the deployer allowlist"; exit 2; }

ONBOARDER="${ONBOARDER:-$GAS_ADDR}"     # the onboarding service mints with the gas-station key
FEE_ROUTER="${FEE_ROUTER:-$ADMIN_ADDR}" # deployer-chosen fee sink for the test stack
cd "$REPO/contracts"
export NETWORK="$NET" ONBOARDER FEE_ROUTER OWNER="$ADMIN_ADDR" CHAIN_CONFIG="$CFG_REL"
LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT
if ! forge script script/DeployMvp.s.sol:DeployMvp --rpc-url "$RPC" --broadcast --slow \
    --private-key "$(tr -d '[:space:]' < "$ADMIN_KEY_FILE")" >"$LOG" 2>&1; then
  grep -iE 'error|revert' "$LOG" | head -5; echo "FAIL: forge script"; exit 1
fi
grep -q 'ONCHAIN EXECUTION COMPLETE & SUCCESSFUL' "$LOG" || { tail -5 "$LOG"; echo "FAIL: broadcast not confirmed"; exit 1; }
OUT="$REPO/config/l1/mvp.$NET.json"
grep -m1 -o 'MVP_CONFIG_JSON=.*' "$LOG" | sed 's/^MVP_CONFIG_JSON=//' \
  | python3 -c 'import json,sys; json.dump(json.load(sys.stdin), open(sys.argv[1],"w"), indent=2); open(sys.argv[1],"a").write("\n")' "$OUT" \
  || { echo "FAIL: $OUT not generated"; exit 1; }
USD="$(python3 -c "import json;print(json.load(open('$OUT'))['testUsd'])")"
ESC="$(python3 -c "import json;print(json.load(open('$OUT'))['splitPayEscrow'])")"
[ "$(cast code "$USD" -r "$RPC")" != "0x" ] || { echo "FAIL: no code at testUsd $USD"; exit 1; }
[ "$(cast code "$ESC" -r "$RPC")" != "0x" ] || { echo "FAIL: no code at splitPayEscrow $ESC"; exit 1; }

# the gas station must be tx-allowlisted to send gas top-ups and mints
if [ "$(cast call "$TX_AL" "readAllowList(address)(uint256)" "$GAS_ADDR" -r "$RPC")" = "0" ]; then
  cast send "$TX_AL" "setEnabled(address)" "$GAS_ADDR" -r "$RPC" \
    --private-key "$(tr -d '[:space:]' < "$ADMIN_KEY_FILE")" >/dev/null
fi
echo "deployed: testUsd=$USD splitPayEscrow=$ESC -> config/l1/mvp.$NET.json"
