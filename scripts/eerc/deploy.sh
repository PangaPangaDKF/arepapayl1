#!/usr/bin/env bash
# D-032 — eERC converter for the MVP on an ArepaPay L1, plus the browser circuit files. TESTNET ONLY.
#
# Usage:
#   scripts/eerc/deploy.sh prepare          # clone ava-labs/EncryptedERC@8dc98cd into $EERC_DIR, npm install --ignore-scripts, compile
#   scripts/eerc/deploy.sh fuji|local       # deploy (idempotent; FORCE=1 redeploys) -> config/l1/eerc.<net>.json
#   scripts/eerc/deploy.sh circuits         # copy the shipped wasm/zkey into app/circuits/ (gitignored) and check sha256
#
# Why --ignore-scripts: the upstream postinstall re-runs the trusted setup and would produce zkeys that no longer match
# contracts/prod/*Verifier.sol (S2.md §2). We use the shipped circom/build files, pinned by sha256 in
# config/l1/eerc-circuits.sha256.
set -euo pipefail
set +x
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EERC_DIR="${EERC_DIR:-$HOME/.cache/arepapay/EncryptedERC}"
PIN=8dc98cd
MODE="${1:-}"

prepared() { [ -d "$EERC_DIR/node_modules" ] && [ -d "$EERC_DIR/artifacts" ]; }

case "$MODE" in
  prepare)
    if [ ! -d "$EERC_DIR/.git" ]; then mkdir -p "$(dirname "$EERC_DIR")"; git clone -q https://github.com/ava-labs/EncryptedERC.git "$EERC_DIR"; fi
    git -C "$EERC_DIR" checkout -q "$PIN"
    (cd "$EERC_DIR" && npm install --ignore-scripts --no-audit --no-fund && npx hardhat compile --quiet)
    echo "prepared $EERC_DIR at $(git -C "$EERC_DIR" rev-parse --short HEAD)" ;;
  local|fuji)
    prepared || { echo "eERC clone not prepared at $EERC_DIR. Run: $0 prepare"; exit 2; }
    [ "$(git -C "$EERC_DIR" rev-parse --short HEAD)" = "$PIN" ] || { echo "eERC clone is not at $PIN"; exit 2; }
    mkdir -p "$EERC_DIR/scripts/arepapay"
    cp "$REPO/scripts/eerc/deploy-net.ts" "$EERC_DIR/scripts/arepapay/"
    cd "$EERC_DIR" && TS_NODE_TRANSPILE_ONLY=1 AREPAPAY_REPO="$REPO" NET="$MODE" npx ts-node scripts/arepapay/deploy-net.ts ;;
  circuits)
    prepared || { echo "eERC clone not prepared at $EERC_DIR. Run: $0 prepare"; exit 2; }
    OUT="$REPO/app/circuits"; mkdir -p "$OUT"
    for c in registration transfer withdraw; do
      cp "$EERC_DIR/circom/build/$c/$c.wasm" "$OUT/$c.wasm"
      z="$EERC_DIR/circom/build/$c/circuit_final.zkey"; [ -f "$z" ] || z="$EERC_DIR/circom/build/$c/$c.zkey"
      cp "$z" "$OUT/$c.zkey"
    done
    cp "$EERC_DIR/node_modules/snarkjs/build/snarkjs.min.js" "$OUT/snarkjs.min.js"
    (cd "$OUT" && sha256sum -c "$REPO/config/l1/eerc-circuits.sha256") ;;
  *) sed -n 2,9p "$0"; exit 2 ;;
esac
