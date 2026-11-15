#!/usr/bin/env bash
# S2 — build and serve a static proof-benchmark page for a phone (Chrome on Android). LOCAL ONLY.
# It runs the SAME snarkjs groth16.fullProve on the SAME circom/build wasm+zkey as the desktop bench, in the phone browser
# (the path @avalabs/eerc-sdk uses), with downloads done before timing.
#
# Prereq: scripts/eerc/s2-run.sh bench 1   (writes sample inputs to $EERC_DIR/s2-phone/inputs; throwaway test keys only)
# Usage:  scripts/eerc/s2-phone-bench.sh [port]   (default 8088), then follow docs/spikes/S2.md §8.
set -euo pipefail
EERC_DIR="${EERC_DIR:-/tmp/claude-1000/-home-panga/9175df3d-cd88-4613-9f2f-8bb72c0ae070/scratchpad/s2/eerc}"
PORT="${1:-8088}"
OUT="$EERC_DIR/s2-phone"
[ -f "$OUT/inputs/transfer.json" ] || { echo "no sample inputs; run: scripts/eerc/s2-run.sh bench 1"; exit 2; }

mkdir -p "$OUT/c"
cp "$EERC_DIR/node_modules/snarkjs/build/snarkjs.min.js" "$OUT/"
cp "$EERC_DIR/circom/build/registration/registration.wasm" "$OUT/c/registration.wasm"
cp "$EERC_DIR/circom/build/registration/circuit_final.zkey" "$OUT/c/registration.zkey"
cp "$EERC_DIR/circom/build/transfer/transfer.wasm" "$OUT/c/transfer.wasm"
cp "$EERC_DIR/circom/build/transfer/transfer.zkey" "$OUT/c/transfer.zkey"
cp "$EERC_DIR/circom/build/withdraw/withdraw.wasm" "$OUT/c/withdraw.wasm"
cp "$EERC_DIR/circom/build/withdraw/circuit_final.zkey" "$OUT/c/withdraw.zkey"

cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>S2 proof bench</title>
<style>body{font:15px system-ui,sans-serif;margin:16px;background:#fff;color:#111}button{font-size:16px;padding:10px 14px;margin:4px 0}pre{white-space:pre-wrap;background:#f3f3f3;padding:8px}</style>
</head><body>
<h3>ArepaPay S2: eERC proof bench (snarkjs groth16)</h3>
<p>Keep the screen on, close other apps, plug in the charger. Runs: <input id="n" type="number" value="5" min="1" style="width:4em"></p>
<button onclick="runAll()">Run registration + transfer + withdraw</button>
<pre id="out">loading snarkjs…</pre>
<script src="snarkjs.min.js"></script>
<script>
const out = document.getElementById("out");
const log = (s) => { out.textContent += s + "\n"; };
out.textContent = `UA: ${navigator.userAgent}\ncores: ${navigator.hardwareConcurrency}  deviceMemory: ${navigator.deviceMemory ?? "?"} GB\n`;
const get = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
const med = (xs) => { const s=[...xs].sort((a,b)=>a-b), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
async function bench(name, n) {
  const t0 = performance.now();
  const [wasm, zkey, input] = await Promise.all([get(`c/${name}.wasm`), get(`c/${name}.zkey`), fetch(`inputs/${name}.json`).then(r=>r.json())]);
  log(`${name}: download ${(performance.now()-t0).toFixed(0)} ms (${((wasm.length+zkey.length)/2**20).toFixed(1)} MiB), not counted`);
  const runs = [];
  for (let i = 0; i <= n; i++) {
    const s = performance.now();
    await snarkjs.groth16.fullProve(input, wasm, zkey);
    const ms = performance.now() - s;
    if (i === 0) log(`  warm-up ${ms.toFixed(0)} ms`); else { runs.push(ms); log(`  run ${i}: ${ms.toFixed(0)} ms`); }
  }
  log(`  ${name} MEDIAN ${med(runs).toFixed(0)} ms  min ${Math.min(...runs).toFixed(0)}  max ${Math.max(...runs).toFixed(0)}`);
  return Math.round(med(runs));
}
async function runAll() {
  const n = Number(document.getElementById("n").value) || 5;
  const r = {};
  try { for (const c of ["registration","transfer","withdraw"]) r[c] = await bench(c, n); }
  catch (e) { log("ERROR " + e); }
  log("RESULT " + JSON.stringify({ ua: navigator.userAgent, cores: navigator.hardwareConcurrency, medianMs: r }));
}
// ?auto=N starts immediately (used for the desktop headless-browser check)
const auto = new URLSearchParams(location.search).get("auto");
if (auto) { document.getElementById("n").value = auto; runAll(); }
</script></body></html>
HTML

echo "serving $OUT on 0.0.0.0:$PORT  (Ctrl-C to stop). Phone: see docs/spikes/S2.md §8 (adb reverse tcp:$PORT tcp:$PORT, open http://localhost:$PORT)"
cd "$OUT" && exec python3 -m http.server "$PORT" --bind 0.0.0.0
