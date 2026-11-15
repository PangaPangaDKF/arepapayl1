#!/usr/bin/env bash
# S1 — create + deploy the `arepapaybank` Avalanche L1 on the LOCAL network only.
#
# Idempotent: re-running skips steps that are already done.
#   1. (re)create the CLI blockchain config from config/l1/genesis.arepapaybank.json if missing or different
#   2. start the local network if it is not running
#   3. deploy arepapaybank to the local network if it is not deployed yet
#
# LOCAL ONLY. Keys used (by name, never printed):
#   - ewoq                       : avalanche-cli built-in local test key (pays local P-Chain fees, PoA validator-manager owner)
#   - arepapay-local-admin       : `avalanche key create` key, admin of txAllowList / deployer allowlist / feeManager
#   - arepapay-local-gasstation  : `avalanche key create` key, future gas station (genesis-funded)
# These keys are LOCAL-TEST-ONLY and must NEVER hold value or be used on Fuji/Mainnet.
# The old v1 chain (~/.avalanche-cli/subnets/ArepaPay) is never touched by this script.
set -euo pipefail

NAME=arepapaybank
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GENESIS="$REPO/config/l1/genesis.arepapaybank.json"
AVA="${AVALANCHE_BIN:-$HOME/bin/avalanche}"   # avalanche-cli v1.9.6 (~/.avalanche-cli/bin/avalanche is an old v1.2.4)
CLI_DIR="$HOME/.avalanche-cli/subnets/$NAME"
EWOQ_ADDR=0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC   # public ewoq test address (local only)
VM_VERSION=v0.8.0                                       # subnet-evm, RPC 44 (matches avalanchego v1.14.0)
AVAGO_VERSION=v1.14.0
ava() { "$AVA" "$@" --skip-update-check </dev/null; }

[ "$NAME" != "ArepaPay" ] || { echo "refusing to touch the v1 chain"; exit 1; }
"$AVA" --version | grep -q '1\.9\.' || { echo "need avalanche-cli 1.9.x at $AVA"; exit 1; }

# 1. blockchain config
if [ -f "$CLI_DIR/genesis.json" ] && python3 -c "import json,sys; sys.exit(0 if json.load(open('$CLI_DIR/genesis.json'))==json.load(open('$GENESIS')) else 1)"; then
  echo "[s1-create] config $NAME already matches $GENESIS — skip create"
else
  if [ -f "$CLI_DIR/sidecar.json" ] && grep -q '"Local Network"' "$CLI_DIR/sidecar.json"; then
    echo "[s1-create] $NAME is already deployed locally with a DIFFERENT genesis; refusing to overwrite."
    echo "            Stop and decide manually (a genesis cannot change after deploy)."
    exit 1
  fi
  echo "[s1-create] creating $NAME from $GENESIS"
  ava blockchain create "$NAME" --force --genesis "$GENESIS" \
    --evm --evm-token ARPB --vm-version "$VM_VERSION" \
    --sovereign --proof-of-authority \
    --validator-manager-owner "$EWOQ_ADDR" --proxy-contract-owner "$EWOQ_ADDR" \
    --warp --icm=false
fi

# 2. local network
if ! ava network status 2>&1 | grep -q -i 'not running'; then
  echo "[s1-create] local network already running"
else
  echo "[s1-create] starting local network"
  ava network start --avalanchego-version "$AVAGO_VERSION"
fi

# 3. deploy
if grep -q '"Local Network"' "$CLI_DIR/sidecar.json"; then
  echo "[s1-create] $NAME already deployed on Local Network — skip deploy"
else
  echo "[s1-create] deploying $NAME to the local network"
  ava blockchain deploy "$NAME" --local --ewoq \
    --num-bootstrap-validators 1 --avalanchego-version "$AVAGO_VERSION"
fi

ava blockchain describe "$NAME" | grep -i -E 'rpc|chain ?id|subnet ?id|blockchain ?id|vm ?id' | grep -v -i private || true
echo "[s1-create] done. Verify with scripts/l1/s1-verify.sh"
