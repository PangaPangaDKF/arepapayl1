#!/usr/bin/env bash
# D-034: deploy MerchantPay (pay a store from the contact list) against the live SplitPayEscrow of config/l1/mvp.<net>.json
# and generate config/l1/merchantpay.<net>.json. Usage: scripts/mvp/deploy-merchantpay.sh [local|fuji]
# Keys: the admin key from avalanche-cli's key store (TESTNET-ONLY), passed to forge, never printed or written.
set -euo pipefail
set +x
export PATH="$HOME/.foundry/bin:$PATH"
NET="${1:-local}"
[[ "$NET" =~ ^(local|fuji)$ ]] || { echo "local or fuji only (got: $NET)"; exit 2; }
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG="$REPO/config/l1/arepapaybank.$NET.json"; MVP="$REPO/config/l1/mvp.$NET.json"
j() { python3 -c "import json,functools,sys; d=json.load(open(sys.argv[2])); print(functools.reduce(lambda a,k: a[k], sys.argv[1].split('.'), d))" "$1" "$2"; }
RPC="$(j rpcUrl "$CFG")"; ESCROW="$(j splitPayEscrow "$MVP")"
KEY="$HOME/.avalanche-cli/key/$(j accounts.admin.cliKeyName "$CFG").pk"
[ -r "$KEY" ] || { echo "admin key not found"; exit 2; }
[ "$(cast chain-id -r "$RPC")" = "$(j chainId "$CFG")" ] || { echo "RPC chain id differs from config"; exit 2; }
[ "$(cast code "$ESCROW" -r "$RPC")" != "0x" ] || { echo "no escrow code at $ESCROW"; exit 2; }
cd "$REPO/contracts"
export NETWORK="$NET" ESCROW
LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT
if ! forge script script/DeployMerchantPay.s.sol:DeployMerchantPay --rpc-url "$RPC" --broadcast --slow \
    --private-key "$(tr -d '[:space:]' < "$KEY")" >"$LOG" 2>&1; then
  grep -iE 'error|revert' "$LOG" | head -5; echo "FAIL: forge script"; exit 1
fi
grep -q 'ONCHAIN EXECUTION COMPLETE & SUCCESSFUL' "$LOG" || { tail -5 "$LOG"; echo "FAIL: broadcast not confirmed"; exit 1; }
OUT="$REPO/config/l1/merchantpay.$NET.json"
grep -m1 -o 'MERCHANTPAY_CONFIG_JSON=.*' "$LOG" | sed 's/^MERCHANTPAY_CONFIG_JSON=//' \
  | python3 -c 'import json,sys; json.dump(json.load(sys.stdin), open(sys.argv[1],"w"), indent=2); open(sys.argv[1],"a").write("\n")' "$OUT"
MP="$(j merchantPay "$OUT")"
[ "$(cast code "$MP" -r "$RPC")" != "0x" ] || { echo "FAIL: no code at $MP"; exit 1; }
[ "$(cast call "$MP" 'feeBps()(uint16)' -r "$RPC")" = "$(cast call "$ESCROW" 'feeBps()(uint16)' -r "$RPC")" ] || { echo "FAIL: fee differs from escrow"; exit 1; }
echo "deployed: merchantPay=$MP (fee $(cast call "$MP" 'feeBps()(uint16)' -r "$RPC") bps, escrow $ESCROW) -> config/l1/merchantpay.$NET.json"
