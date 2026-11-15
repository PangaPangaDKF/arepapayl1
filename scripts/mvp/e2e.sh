#!/usr/bin/env bash
# MVP end-to-end on the LOCAL arepapaybank L1: deploy -> onboard 3 fresh wallets through the onboarding service ->
# split pay $5 (alice 3 + bob 2, auto-capture) -> second intent covered only 3 -> expire -> withdraw.
# Prints PASS/FAIL per step; exits non-zero on any FAIL.
#   SKIP_DEPLOY=1   reuse config/l1/mvp.local.json
#   E2E_BREAK=1     deliberately wrong expectation in step 6 (must FAIL and exit 1)
# Keys: admin/gas-station keys stay in avalanche-cli's local key store (read by deploy.sh / the service, never printed).
# Fresh wallets are made with `cast wallet new` in memory only and never written anywhere. TESTNET, no real money.
set -uo pipefail
set +x   # never trace: commands carry private keys

export PATH="$HOME/.foundry/bin:$PATH"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG="$REPO/config/l1/arepapaybank.local.json"
MVP="$REPO/config/l1/mvp.local.json"
jget() { python3 -c "import json,functools,sys; d=json.load(open(sys.argv[2])); print(functools.reduce(lambda a,k: a[k], sys.argv[1].split('.'), d))" "$1" "$2"; }
RPC="$(jget rpcUrl "$CFG")"
TX_AL="$(jget precompiles.txAllowList.address "$CFG")"
PORT="${E2E_PORT:-8790}"; API="http://127.0.0.1:$PORT"

FAILS=0; N=0
pass() { N=$((N+1)); echo "PASS [$N] $1"; }
fail() { N=$((N+1)); FAILS=$((FAILS+1)); echo "FAIL [$N] $1"; }
check() { if [ "$2" = "1" ]; then pass "$1"; else fail "$1${3:+ ($3)}"; fi; }
finish() { echo "== $((N-FAILS))/$N passed"; [ "$FAILS" -eq 0 ] && { echo "E2E PASS"; exit 0; } || { echo "E2E FAIL"; exit 1; }; }
num() { awk '{print $1}'; }   # strip cast's "[5e6]" annotations
call() { cast call "$@" -r "$RPC" | num; }
send() { local pk="$1"; shift; cast send --private-key "$pk" -r "$RPC" "$@" >/dev/null 2>&1; }
eq() { [ "$1" = "$2" ] && echo 1 || echo 0; }

echo "== MVP e2e (LOCAL) @ $RPC"
# 1 deploy
if [ "${SKIP_DEPLOY:-0}" = "1" ]; then [ -f "$MVP" ] && pass "deploy skipped, using existing mvp.local.json" || fail "no mvp.local.json"
else
  if out="$(bash "$REPO/scripts/mvp/deploy.sh" local 2>&1)"; then pass "deploy: ${out##*$'\n'}"; else echo "$out" | tail -5; fail "deploy"; finish; fi
fi
USD="$(jget testUsd "$MVP")"; ESC="$(jget splitPayEscrow "$MVP")"; FEE_ROUTER="$(jget feeRouter "$MVP")"
check "escrow points at test USD, fee 50 bps" "$( [ "$(cast call "$ESC" 'token()(address)' -r "$RPC" | tr A-F a-f)" = "$(echo "$USD" | tr A-F a-f)" ] && [ "$(call "$ESC" 'feeBps()(uint16)')" = "50" ] && echo 1 || echo 0)"

# 2 onboarding service (own temp store, manual approval through the admin CLI)
DATA="$(mktemp -d)"
NET=local PORT=$PORT DATA_DIR="$DATA" AUTO_APPROVE=0 node "$REPO/backend/onboarding/server.mjs" >"$DATA/server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$DATA"' EXIT
for _ in $(seq 1 180); do curl -sf "$API/health" >/dev/null && break; sleep 0.5; done   # viem import is slow on /mnt/c
if curl -sf "$API/health" >/dev/null; then pass "onboarding service up"; else fail "onboarding service up"; tail -5 "$DATA/server.log"; finish; fi
check "service serves generated config" "$(curl -sf "$API/config/local" | python3 -c "import json,sys; d=json.load(sys.stdin); print(1 if d['splitPayEscrow']=='$ESC' and d['chainId']==$(jget chainId "$CFG") else 0)")"

declare -A ADDR PK
for who in merchant alice bob; do
  j="$(cast wallet new --json)"
  ADDR[$who]="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["address"])' <<<"$j")"
  PK[$who]="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["private_key"])' <<<"$j")"
done; unset j
echo "     merchant=${ADDR[merchant]} alice=${ADDR[alice]} bob=${ADDR[bob]} (keys in memory only)"

ok=1
for who in merchant alice bob; do
  a="${ADDR[$who]}"
  st="$(curl -s -XPOST "$API/request" -H 'content-type: application/json' -d "{\"address\":\"$a\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
  [ "$st" = "pending" ] || ok=0
  [ "$(call "$TX_AL" 'readAllowList(address)(uint256)' "$a")" = "0" ] || ok=0
done
check "3 requests pending, none allowlisted yet" "$ok"
if out="$(cd "$REPO" && NET=local DATA_DIR="$DATA" node backend/onboarding/admin.mjs approve "${ADDR[merchant]}" "${ADDR[alice]}" "${ADDR[bob]}" 2>&1)"; then ok=1; else ok=0; fi
echo "$out" | sed 's/^/     /'
check "admin CLI approved all 3" "$ok"
ok=1
for who in merchant alice bob; do
  a="${ADDR[$who]}"
  s="$(curl -s "$API/status/$a" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["status"], d["role"])')"
  [ "$s" = "approved 1" ] || ok=0
  [ "$(call "$USD" 'balanceOf(address)(uint256)' "$a")" = "50000000" ] || ok=0
  [ "$(cast balance "$a" -r "$RPC")" != "0" ] || ok=0
done
check "each wallet: status approved, txAllowList enabled, 50 tUSD, gas" "$ok"

# 3 split pay $5: alice 3 + bob 2, auto-capture
now() { cast block latest -f timestamp -r "$RPC"; }
ID1="$(call "$ESC" 'nextId()(uint256)')"
send "${PK[merchant]}" "$ESC" 'createIntent(uint256,uint64,uint8,bool,uint16)' 5000000 $(( $(now) + 600 )) 2 false 50
check "merchant created intent #$ID1 for 5 tUSD" "$(eq "$(call "$ESC" 'totalOf(uint256)(uint256)' "$ID1")" 5000000)"
FR0="$(call "$USD" 'balanceOf(address)(uint256)' "$FEE_ROUTER")"
send "${PK[alice]}" "$USD" 'approve(address,uint256)' "$ESC" 3000000
send "${PK[alice]}" "$ESC" 'authorize(uint256,uint256)' "$ID1" 3000000
check "alice authorized 3 (covered 3/5, still open)" "$( [ "$(call "$ESC" 'coveredOf(uint256)(uint256)' "$ID1")" = 3000000 ] && [ "$(call "$ESC" 'stateOf(uint256)(uint8)' "$ID1")" = 1 ] && echo 1 || echo 0)"
send "${PK[bob]}" "$USD" 'approve(address,uint256)' "$ESC" 2000000
send "${PK[bob]}" "$ESC" 'authorize(uint256,uint256)' "$ID1" 2000000
check "bob authorized 2 -> captured" "$(eq "$(call "$ESC" 'stateOf(uint256)(uint8)' "$ID1")" 3)"
EXPECT_M=$(( 50000000 + 5000000 - 5000000 * 50 / 10000 ))     # 54.975 tUSD: 5 - 0.025 fee
[ "${E2E_BREAK:-0}" = "1" ] && EXPECT_M=55000000                # deliberate wrong expectation (fee ignored)
GOT_M="$(call "$USD" 'balanceOf(address)(uint256)' "${ADDR[merchant]}")"
check "merchant received 5 - fee (expect $EXPECT_M)" "$(eq "$GOT_M" "$EXPECT_M")" "got $GOT_M"
check "fee router got 0.025 tUSD" "$(eq "$(( $(call "$USD" 'balanceOf(address)(uint256)' "$FEE_ROUTER") - FR0 ))" 25000)"
check "payers debited exactly (alice 47, bob 48)" "$( [ "$(call "$USD" 'balanceOf(address)(uint256)' "${ADDR[alice]}")" = 47000000 ] && [ "$(call "$USD" 'balanceOf(address)(uint256)' "${ADDR[bob]}")" = 48000000 ] && echo 1 || echo 0)"

# 4 second intent, only 3 covered -> expire -> withdraw
ID2="$(call "$ESC" 'nextId()(uint256)')"
send "${PK[merchant]}" "$ESC" 'createIntent(uint256,uint64,uint8,bool,uint16)' 5000000 $(( $(now) + 65 )) 2 false 50
EXP2="$(call "$ESC" 'expiryOf(uint256)(uint64)' "$ID2")"
send "${PK[alice]}" "$USD" 'approve(address,uint256)' "$ESC" 3000000
send "${PK[alice]}" "$ESC" 'authorize(uint256,uint256)' "$ID2" 3000000
check "intent #$ID2: alice holds 3 of 5" "$(eq "$(call "$ESC" 'holdOf(uint256,address)(uint256)' "$ID2" "${ADDR[alice]}")" 3000000)"
check "withdraw before expiry is refused" "$(cast send --private-key "${PK[alice]}" -r "$RPC" "$ESC" 'withdraw(uint256)' "$ID2" >/dev/null 2>&1 && echo 0 || echo 1)"
echo "     waiting for expiry ($(( EXP2 - $(date +%s) ))s)…"
while [ "$(date +%s)" -le $(( EXP2 + 2 )) ]; do sleep 3; done
# explicit gas: subnet-evm estimates against the LAST block's timestamp, which on an idle chain is before expiry
send "${PK[bob]}" "$ESC" 'expire(uint256)' "$ID2" --gas-limit 200000
check "anyone (bob) expired it -> voided" "$(eq "$(call "$ESC" 'stateOf(uint256)(uint8)' "$ID2")" 4)"
send "${PK[alice]}" "$ESC" 'withdraw(uint256)' "$ID2" --gas-limit 200000
check "alice withdrew her 3 (balance back to 47)" "$(eq "$(call "$USD" 'balanceOf(address)(uint256)' "${ADDR[alice]}")" 47000000)"
check "N2: escrow balance == totalHeld == 0" "$( [ "$(call "$USD" 'balanceOf(address)(uint256)' "$ESC")" = "$(call "$ESC" 'totalHeld()(uint256)')" ] && [ "$(call "$ESC" 'totalHeld()(uint256)')" = 0 ] && echo 1 || echo 0)"
check "service log has no key material" "$(grep -qiE '[0-9a-f]{64}' "$DATA/server.log" && echo 0 || echo 1)"
finish
