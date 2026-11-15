#!/usr/bin/env bash
# Stage B public test endpoint (D-019): onboarding service in SINGLE_ORIGIN mode (dApp + /rpc + /config + KYC stand-in)
# behind a cloudflared quick tunnel (HTTPS, no account). A supervisor loop restarts either one if it dies and writes the
# current public URL to backend/onboarding/data/public-url.fuji.txt (gitignored; quick-tunnel URLs change on restart).
#   scripts/mvp/serve-public.sh start|stop|status|url
# TESTNET ONLY. AUTO_APPROVE=1: anyone who asks is allowlisted (stand-in for bank KYC during the public test).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NET="${NET:-fuji}"; PORT="${PORT:-8788}"
DATA="$REPO/backend/onboarding/data"; mkdir -p "$DATA"
RUN="$DATA/public.$NET"; mkdir -p "$RUN"
URLF="$DATA/public-url.$NET.txt"
CF="${CLOUDFLARED:-/home/panga/cloudflared}"
KEYDIR="$HOME/.avalanche-cli/key"

supervise() {
  export NET PORT HOST=127.0.0.1 SINGLE_ORIGIN=1 AUTO_APPROVE="${AUTO_APPROVE:-1}" CORS_ORIGINS='*' DATA_DIR="$DATA"
  if [ "$NET" = fuji ]; then export ADMIN_KEY_FILE="$KEYDIR/arepapay-fuji.pk" GAS_KEY_FILE="$KEYDIR/arepapay-fuji-gas.pk"; fi
  local srv=0 tun=0
  while :; do
    if [ "$srv" = 0 ] || ! kill -0 "$srv" 2>/dev/null; then
      node "$REPO/backend/onboarding/server.mjs" >>"$RUN/server.log" 2>&1 & srv=$!; echo "$srv" >"$RUN/server.pid"
      echo "$(date -Is) server started pid $srv" >>"$RUN/supervisor.log"
    fi
    if [ "$tun" = 0 ] || ! kill -0 "$tun" 2>/dev/null; then
      : >"$RUN/tunnel.log"
      "$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >>"$RUN/tunnel.log" 2>&1 & tun=$!; echo "$tun" >"$RUN/tunnel.pid"
      for _ in $(seq 1 60); do u="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel.log" | head -1)"; [ -n "$u" ] && break; sleep 1; done
      [ -n "${u:-}" ] && echo "$u" >"$URLF"
      echo "$(date -Is) tunnel started pid $tun url ${u:-none}" >>"$RUN/supervisor.log"
    fi
    sleep 15
  done
}

case "${1:-status}" in
  start)
    if [ -f "$RUN/supervisor.pid" ] && kill -0 "$(cat "$RUN/supervisor.pid")" 2>/dev/null; then echo "already running"; exit 0; fi
    setsid nohup "$0" _supervise >/dev/null 2>&1 < /dev/null & echo $! >"$RUN/supervisor.pid"
    for _ in $(seq 1 90); do [ -s "$URLF" ] && [ "$(stat -c %Y "$URLF")" -ge "$(stat -c %Y "$RUN/supervisor.pid")" ] && break; sleep 1; done
    echo "public URL: $(cat "$URLF" 2>/dev/null || echo pending)";;
  _supervise) supervise;;
  stop)
    for f in supervisor tunnel server; do [ -f "$RUN/$f.pid" ] && kill "$(cat "$RUN/$f.pid")" 2>/dev/null; rm -f "$RUN/$f.pid"; done; echo stopped;;
  url) cat "$URLF";;
  status)
    for f in supervisor server tunnel; do p="$(cat "$RUN/$f.pid" 2>/dev/null)"; printf '%-10s %s\n' "$f" "$([ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "up ($p)" || echo down)"; done
    echo "url        $(cat "$URLF" 2>/dev/null || echo none)";;
esac
