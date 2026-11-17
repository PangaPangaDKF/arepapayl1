#!/usr/bin/env bash
# ArepaPay test stack in one command, no Claude session needed (D-037). TESTNET ONLY.
#
#   scripts/arepapay.sh up        # Fuji L1 node + onboarding service + Cloudflare tunnel; fixes the /probar/ pointer if needed
#   scripts/arepapay.sh status    # what is up, the public URL, and a live HTTP check
#   scripts/arepapay.sh down      # stop service + tunnel (the L1 node keeps running; stop it with: avalanche node local stop)
#   scripts/arepapay.sh logs      # last lines of the boot, supervisor, server and tunnel logs
#   scripts/arepapay.sh fixed-address       # once, after the Cloudflare login (docs/HOSTING.md): move to app.arepapay.site
#   scripts/arepapay.sh install-autostart   # start `up` automatically when you log in to Windows (Startup folder, no admin)
#   scripts/arepapay.sh remove-autostart
#
# Safe to run any number of times: each part starts only if it is down. Shortcut after `install-autostart`: `arepapay up`.
set -uo pipefail
REPO="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
export NET="${NET:-fuji}"
DATA="$REPO/backend/onboarding/data"; RUN="$DATA/public.$NET"; mkdir -p "$RUN"
LOG="$RUN/boot.log"
SERVE="$REPO/scripts/mvp/serve-public.sh"
# Same Node as an interactive shell (nvm; the service runs on it), without needing ~/.bashrc.
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
export PATH="$HOME/bin:$HOME/.foundry/bin:$PATH"

STARTUP_WIN="$(cmd.exe /c 'echo %APPDATA%' 2>/dev/null | tr -d '\r')\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
VBS_NAME="ArepaPay-start.vbs"

stamp() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
url() { cat "$DATA/public-url.$NET.txt" 2>/dev/null; }
# the pointer as published (origin/main), not the local file: publish-url never touches the working tree (L-013)
pointer() { git -C "$REPO" fetch -q origin main 2>/dev/null; git -C "$REPO" show origin/main:config/public/mvp-url.json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])" 2>/dev/null; }

up() {
  exec 9>"$RUN/up.lock"
  flock -n 9 || { echo "another 'up' is running"; return 0; }
  stamp "up: starting (node, service, tunnel)"
  "$SERVE" start 2>&1 | tee -a "$LOG"
  local u; u="$(url)"
  [ -n "$u" ] || { stamp "up: no public URL yet; see: $0 logs"; return 1; }
  # /probar/ on arepapay.site follows config/public/mvp-url.json: update it only when the address changed
  # (with the fixed address app.arepapay.site this happens once).
  if [ "$(pointer)" != "$u/app" ]; then stamp "up: pointer changed -> publishing"; "$SERVE" publish-url 2>&1 | tee -a "$LOG"; fi
  local code; code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$u/app/")"
  stamp "up: done. app $u/app/ -> HTTP $code"
}

status() {
  "$SERVE" status
  local u; u="$(url)"
  [ -n "$u" ] && printf 'live check %s/app/ -> HTTP %s\n' "$u" "$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$u/app/")"
  printf 'probar ptr %s\n' "$(pointer)"
}

install_autostart() {
  [ -n "${STARTUP_WIN%%\\*}" ] || { echo "cannot find the Windows Startup folder"; return 1; }
  local dst; dst="$(wslpath "$STARTUP_WIN")/$VBS_NAME"
  # Hidden window; `sleep infinity` keeps WSL running so the node, service and tunnel stay up after the window would close.
  cat >"$dst" <<VBS
' ArepaPay test stack (D-037): runs scripts/arepapay.sh up at Windows logon, hidden. Remove: scripts/arepapay.sh remove-autostart
CreateObject("WScript.Shell").Run "wsl.exe -d ${WSL_DISTRO_NAME:-Ubuntu} -u $(id -un) --exec bash -c ""'$REPO/scripts/arepapay.sh' up >/dev/null 2>&1; exec sleep infinity""", 0, False
VBS
  mkdir -p "$HOME/bin"; ln -sf "$REPO/scripts/arepapay.sh" "$HOME/bin/arepapay"
  echo "installed: $dst"
  echo "shortcut:  arepapay up | status | down | logs   (in a new terminal)"
}

case "${1:-status}" in
  up) up ;;
  status) status ;;
  down) "$SERVE" stop ;;
  logs) for f in boot supervisor server tunnel; do echo "== $f"; tail -n 8 "$RUN/$f.log" 2>/dev/null; done ;;
  fixed-address)   # once, after `~/cloudflared tunnel login` (docs/HOSTING.md): app.arepapay.site forever
    "$SERVE" setup-named || exit 1
    "$SERVE" stop; up ;;
  install-autostart) install_autostart ;;
  remove-autostart) rm -f "$(wslpath "$STARTUP_WIN")/$VBS_NAME" && echo removed ;;
  *) sed -n 2,12p "$0"; exit 2 ;;
esac
