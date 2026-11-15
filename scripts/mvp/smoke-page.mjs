// Headless Chrome smoke for app/ (no wallet): the page renders, reads the config from the onboarding service, and throws no
// JS errors. Zero deps (Node 22+ global WebSocket + Chrome DevTools Protocol).
//   node scripts/mvp/smoke-page.mjs <pageUrl>      CHROME=<path to chrome / chrome-headless-shell>
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:8080/';
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const pw = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).sort().reverse()) {
      const p = join(pw, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (d.startsWith('chromium_headless_shell') && existsSync(p)) return p;
    }
  }
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) if (existsSync(p)) return p;
  throw new Error('no Chrome found; set CHROME');
}

const port = 9300 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), 'smoke-'));
const chrome = spawn(findChrome(), ['--headless', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const done = (code, text) => { console.log(text); chrome.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); };
setTimeout(() => done(1, "FAIL smoke: timeout"), 90000);

let target;
for (let i = 0; i < 150 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await new Promise((r) => setTimeout(r, 200));
}
if (!target) done(1, 'FAIL smoke: Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0; const pending = new Map(); const errors = [];
const cmd = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
};
await new Promise((r) => (ws.onopen = r));
await cmd('Runtime.enable'); await cmd('Log.enable'); await cmd('Page.enable');
await cmd('Page.navigate', { url });
let state;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const r = await cmd('Runtime.evaluate', { expression: 'JSON.stringify({ok: !!window.__arepapayConfigLoaded, ethers: typeof ethers, qr: typeof qrcode, net: document.getElementById("netinfo")?.textContent, warn: document.querySelector(".warn")?.textContent, err: document.getElementById("err")?.textContent, msg: document.getElementById("msg")?.textContent})', returnByValue: true });
  state = JSON.parse(r.result.value);
  if (state.ok || state.err) break;
}
console.log(JSON.stringify(state, null, 1));
const bad = !state.ok || state.ethers !== 'object' || state.qr !== 'function' || !/TESTNET/.test(state.warn || '') || errors.length;
if (errors.length) console.log(errors.join('\n'));
done(bad ? 1 : 0, bad ? 'FAIL smoke' : 'PASS smoke: page rendered, config loaded, no JS errors');
