#!/usr/bin/env bash
# Stage B public test endpoint (D-019): onboarding service in SINGLE_ORIGIN mode (dApp + /rpc + /config + KYC stand-in)
# behind a cloudflared quick tunnel (HTTPS, no account). A supervisor loop restarts either one if it dies and writes the
# current public URL to backend/onboarding/data/public-url.fuji.txt (gitignored; quick-tunnel URLs change on restart).
#   scripts/mvp/serve-public.sh start|stop|status|url|publish-url|setup-named
#   start also boots the Fuji L1 node if its RPC is down. publish-url writes config/public/mvp-url.json (read by
#   https://arepapay.site/probar/) and, if the repo has an 'origin' remote, commits that one file and pushes (Pages redeploys).
# TESTNET ONLY. AUTO_APPROVE=1: anyone who asks is allowlisted (stand-in for bank KYC during the public test).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NET="${NET:-fuji}"; PORT="${PORT:-8788}"
DATA="$REPO/backend/onboarding/data"; mkdir -p "$DATA"
RUN="$DATA/public.$NET"; mkdir -p "$RUN"
URLF="$DATA/public-url.$NET.txt"
CF="${CLOUDFLARED:-/home/panga/cloudflared}"
KEYDIR="$HOME/.avalanche-cli/key"
# Fixed address (D-028): once ~/.cloudflared/cert.pem exists (cloudflared tunnel login) and `setup-named` has run, the
# supervisor runs the named tunnel TUNNEL_NAME and the URL is https://$TUNNEL_HOST forever. Otherwise: quick tunnel.
TUNNEL_NAME="${TUNNEL_NAME:-arepapay-mvp}"; TUNNEL_HOST="${TUNNEL_HOST:-app.arepapay.site}"
named_ready() { [ -f "$HOME/.cloudflared/cert.pem" ] && [ -f "$DATA/named-tunnel.$NET" ]; }

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
      if named_ready; then
        "$CF" tunnel --no-autoupdate run --url "http://127.0.0.1:$PORT" "$TUNNEL_NAME" >>"$RUN/tunnel.log" 2>&1 & tun=$!
        u="https://$TUNNEL_HOST"
      else
        "$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >>"$RUN/tunnel.log" 2>&1 & tun=$!
        for _ in $(seq 1 60); do u="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel.log" | head -1)"; [ -n "$u" ] && break; sleep 1; done
      fi
      echo "$tun" >"$RUN/tunnel.pid"
      [ -n "${u:-}" ] && echo "$u" >"$URLF"
      echo "$(date -Is) tunnel started pid $tun url ${u:-none}" >>"$RUN/supervisor.log"
    fi
    sleep 15
  done
}

node_up() { python3 - "$REPO/config/l1/arepapaybank.$NET.json" <<'PY'
import json,sys,urllib.request
c=json.load(open(sys.argv[1]))
try:
    r=urllib.request.urlopen(urllib.request.Request(c['rpcUrl'],data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId"}',headers={'content-type':'application/json'}),timeout=5)
    sys.exit(0 if int(json.load(r)['result'],16)==c['chainId'] else 1)
except Exception: sys.exit(1)
PY
}
publish_url() {
  local u; u="$(cat "$URLF" 2>/dev/null)"; [ -n "$u" ] || { echo "no public URL yet"; return 1; }
  local f="$REPO/config/public/mvp-url.json"; mkdir -p "$(dirname "$f")"
  printf '{\n  "_note": "Pointer read by https://arepapay.site/probar/. Updated by scripts/mvp/serve-public.sh publish-url when the test tunnel changes. TESTNET ONLY.",\n  "url": "%s/app",\n  "network": "%s",\n  "updated": "%s"\n}\n' "$u" "$NET" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$f"
  echo "pointer -> $u/app"
  if git -C "$REPO" remote get-url origin >/dev/null 2>&1 && ! git -C "$REPO" diff --quiet -- config/public/mvp-url.json; then
    git -C "$REPO" commit -q -m "chore(site): MVP test URL -> $u" -- config/public/mvp-url.json && git -C "$REPO" push -q origin HEAD && echo "pushed; Pages redeploys in ~1 min"
  fi
}

case "${1:-status}" in
  start)
    if [ "$NET" = fuji ] && ! node_up; then
      echo "L1 RPC down: starting the Fuji node (arepapay-fuji)…"
      "${AVALANCHE:-$HOME/.avalanche-cli-latest/bin/avalanche}" node local start arepapay-fuji --skip-update-check </dev/null >/dev/null 2>&1
      for _ in $(seq 1 60); do node_up && break; sleep 5; done
      node_up && echo "L1 RPC up" || echo "WARNING: L1 RPC still down; check: avalanche node local status"
    fi
    if [ -f "$RUN/supervisor.pid" ] && kill -0 "$(cat "$RUN/supervisor.pid")" 2>/dev/null; then echo "already running"; exit 0; fi
    setsid nohup "$0" _supervise >/dev/null 2>&1 < /dev/null & echo $! >"$RUN/supervisor.pid"
    for _ in $(seq 1 90); do [ -s "$URLF" ] && [ "$(stat -c %Y "$URLF")" -ge "$(stat -c %Y "$RUN/supervisor.pid")" ] && break; sleep 1; done
    echo "public URL: $(cat "$URLF" 2>/dev/null || echo pending)";;
  _supervise) supervise;;
  stop)
    for f in supervisor tunnel server; do [ -f "$RUN/$f.pid" ] && kill "$(cat "$RUN/$f.pid")" 2>/dev/null; rm -f "$RUN/$f.pid"; done; echo stopped;;
  url) cat "$URLF";;
  publish-url) publish_url;;
  setup-named)   # one time, after `cloudflared tunnel login` authorized arepapay.site
    [ -f "$HOME/.cloudflared/cert.pem" ] || { echo "run first: $CF tunnel login   (authorize arepapay.site in the browser)"; exit 1; }
    "$CF" tunnel info "$TUNNEL_NAME" >/dev/null 2>&1 || "$CF" tunnel create "$TUNNEL_NAME" | grep -v -i 'secret' || exit 1
    "$CF" tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$TUNNEL_HOST" || exit 1
    echo "$TUNNEL_NAME $TUNNEL_HOST" >"$DATA/named-tunnel.$NET"
    echo "named tunnel $TUNNEL_NAME -> https://$TUNNEL_HOST ready; restart: $0 stop && $0 start && $0 publish-url";;
  status)
    for f in supervisor server tunnel; do p="$(cat "$RUN/$f.pid" 2>/dev/null)"; printf '%-10s %s\n' "$f" "$([ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "up ($p)" || echo down)"; done
    echo "url        $(cat "$URLF" 2>/dev/null || echo none)"
    printf 'l1 rpc     %s\n' "$(node_up && echo up || echo down)";;
esac
