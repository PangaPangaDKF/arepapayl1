#!/usr/bin/env bash
# S2 — eERC converter mode on the LOCAL arepapaybank L1 (chain 77077). LOCAL ONLY.
#
# Usage:
#   scripts/eerc/s2-run.sh            # full flow: deploy, register, deposit/transfer/withdraw, visibility, contract account
#   scripts/eerc/s2-run.sh bench [N]  # offline proof benchmark (no chain), N runs per circuit (default 10)
#
# Dependencies (third-party, NOT in this repo): a clone of ava-labs/EncryptedERC at 8dc98cd in $EERC_DIR, prepared with
#   cd $EERC_DIR && npm install --ignore-scripts && npx hardhat compile
# `--ignore-scripts` skips the upstream postinstall (`hardhat zkit make --force`), which would recompile the circuits and do a
# NEW trusted setup that no longer matches contracts/prod/*Verifier.sol. We use the shipped circom/build/*.{wasm,zkey}, whose
# verification keys are embedded in contracts/prod (checked in S2.md).
# Uses from the clone: node_modules (ethers 6.13.4, snarkjs 0.7.5, maci-crypto, @zk-kit/baby-jubjub, poseidon-lite, ts-node),
# src/jub + src/poseidon helpers, circom/build artifacts, hardhat artifacts (solc 0.8.27).
#
# Keys: admin = avalanche-cli local key arepapay-local-admin (LOCAL-TEST-ONLY), read by the TS script, never printed.
set -euo pipefail
set +x

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EERC_DIR="${EERC_DIR:-/tmp/claude-1000/-home-panga/9175df3d-cd88-4613-9f2f-8bb72c0ae070/scratchpad/s2/eerc}"
MODE="${1:-flow}"

[ -d "$EERC_DIR/node_modules" ] && [ -d "$EERC_DIR/artifacts" ] || {
  echo "eERC clone not prepared at $EERC_DIR. Run: cd \$EERC_DIR && npm install --ignore-scripts && npx hardhat compile"; exit 2; }
[ "$(git -C "$EERC_DIR" rev-parse --short HEAD 2>/dev/null)" = "8dc98cd" ] || echo "WARN: eERC clone is not at 8dc98cd"

mkdir -p "$EERC_DIR/scripts/arepapay" "$EERC_DIR/contracts/arepapay"
cp "$REPO/scripts/eerc/s2-common.ts" "$REPO/scripts/eerc/s2-converter.ts" "$REPO/scripts/eerc/s2-bench.ts" "$EERC_DIR/scripts/arepapay/"

# Minimal owner-controlled smart-contract account (stands in for a 1-of-1 Safe's execTransaction). Spike-only code.
cat > "$EERC_DIR/contracts/arepapay/S2Forwarder.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/// @notice S2 spike only: a contract account whose owner relays arbitrary calls (like a 1-of-1 Safe).
contract S2Forwarder {
    address public immutable owner;

    event Executed(address indexed target, bytes4 indexed selector);

    error NotOwner();
    error CallFailed(bytes returndata);

    constructor(address owner_) {
        owner = owner_;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory ret) {
        if (msg.sender != owner) revert NotOwner();
        bool ok;
        (ok, ret) = target.call(data);
        if (!ok) revert CallFailed(ret);
        emit Executed(target, bytes4(data[:4]));
    }
}
SOL

cd "$EERC_DIR"
npx hardhat compile --quiet >/dev/null
export TS_NODE_TRANSPILE_ONLY=1
case "$MODE" in
  flow)  AREPAPAY_REPO="$REPO" npx ts-node scripts/arepapay/s2-converter.ts ;;
  bench) npx ts-node scripts/arepapay/s2-bench.ts "${2:-10}" ;;
  *) echo "unknown mode $MODE"; exit 2 ;;
esac
