// Minimal Chrome DevTools Protocol helper. Zero npm deps: Node 22+ (global WebSocket + fetch) and a local Chrome.
// Used by scripts/browser/wallet-e2e.mjs; reusable for any headless page check.
//
//   import { launch } from './cdp.mjs';
//   const browser = await launch();                 // headless, temp profile, random debugging port
//   const page = await browser.newPage();           // one tab (open several for several wallets)
//   await page.addInitScript('window.x = 1');       // runs before any page script, on every navigation
//   await page.exposeFunction('hello', async (a) => a + 1);   // page: await window.hello(1) -> 2 (runs in Node)
//   await page.goto('http://127.0.0.1:8795/');
//   await page.waitFor('!!window.__arepapayConfigLoaded', 30000);
//   await page.click('#btnConnect'); await page.type('#amount', '5');
//   await page.screenshot('/tmp/x.png'); page.errors  // JS exceptions + console.error lines
//   await browser.close();
//
// CHROME=<path> overrides the Chrome lookup. HEADFUL=1 shows the window (needs a display).
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
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

// One WebSocket session to one CDP target (browser or page).
class Session {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(`${method}: ${m.error.message}`)); else res(m.result);
        return;
      }
      for (const fn of this.listeners.get(m.method) || []) { try { fn(m.params); } catch (e) { console.error('cdp listener error:', e.message); } }
    };
    this.ws.onclose = () => {
      this.closed = true;
      for (const { rej, method } of this.pending.values()) rej(new Error(`${method}: connection closed`));
      this.pending.clear();
    };
  }
  open() {
    if (this.ws.readyState === 1) return Promise.resolve();
    return new Promise((res, rej) => { this.ws.onopen = () => res(); this.ws.onerror = () => rej(new Error('CDP websocket error')); });
  }
  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error(`${method}: connection closed`));
    return new Promise((res, rej) => {
      const id = ++this.seq;
      this.pending.set(id, { res, rej, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() { try { this.ws.close(); } catch {} }
}

export class Page {
  constructor(browser, targetId, session) {
    this.browser = browser;
    this.targetId = targetId;
    this.s = session;
    this.errors = [];     // page JS exceptions and console.error calls (fail-worthy)
    this.logs = [];       // browser log entries (network 404s etc.; informational)
    this.console = [];    // every console call, for debugging
    this.bindings = new Map();
    session.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails;
      this.errors.push('exception: ' + (d.exception?.description || d.text));
    });
    session.on('Runtime.consoleAPICalled', (p) => {
      const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
      this.console.push(`${p.type}: ${text}`);
      if (p.type === 'error') this.errors.push('console.error: ' + text);
    });
    session.on('Log.entryAdded', (p) => { this.logs.push(`${p.entry.level}: ${p.entry.text} ${p.entry.url || ''}`.trim()); });
    session.on('Runtime.bindingCalled', (p) => {
      const fn = this.bindings.get(p.name);
      if (fn) fn(p.payload);
    });
  }

  async init({ width = 480, height = 1000 } = {}) {
    await this.s.send('Runtime.enable');
    await this.s.send('Log.enable');
    await this.s.send('Page.enable');
    await this.s.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    return this;
  }

  send(method, params) { return this.s.send(method, params); }
  on(method, fn) { this.s.on(method, fn); }

  // Script that runs before the page's own scripts, on every navigation of this tab.
  addInitScript(source) { return this.s.send('Page.addScriptToEvaluateOnNewDocument', { source }); }

  // Raw binding: page calls window[name](string); handler(payload) runs in Node. Survives navigations.
  async addBinding(name, handler) {
    this.bindings.set(name, handler);
    await this.s.send('Runtime.addBinding', { name });
  }

  // Promise-returning page function backed by an async Node function (args/results must be JSON-serializable).
  // A thrown error reaches the page as an Error carrying the thrown object's code/data/message.
  async exposeFunction(name, fn) {
    const binding = `__cdp_${name}`;
    await this.addInitScript(`(() => {
      const b = window[${JSON.stringify(binding)}]; const pend = new Map(); let seq = 0;
      window.__cdpReply = window.__cdpReply || {};
      window.__cdpReply[${JSON.stringify(name)}] = (id, ok, value) => {
        const p = pend.get(id); if (!p) return; pend.delete(id);
        if (ok) p.res(value); else { const e = new Error(value && value.message || 'error'); Object.assign(e, value || {}); p.rej(e); }
      };
      Object.defineProperty(window, ${JSON.stringify(name)}, { configurable: true, value: (...args) => new Promise((res, rej) => {
        const id = ++seq; pend.set(id, { res, rej }); b(JSON.stringify({ id, args }));
      }) });
    })();`);
    await this.addBinding(binding, async (payload) => {
      const { id, args } = JSON.parse(payload);
      let ok = true, value;
      try { value = await fn(...args); } catch (e) {
        ok = false;
        value = { message: String(e?.message || e), ...(e?.code !== undefined ? { code: e.code } : {}), ...(e?.data !== undefined ? { data: e.data } : {}) };
      }
      const expr = `window.__cdpReply && window.__cdpReply[${JSON.stringify(name)}] && window.__cdpReply[${JSON.stringify(name)}](${id}, ${ok}, ${JSON.stringify(value === undefined ? null : value)})`;
      this.s.send('Runtime.evaluate', { expression: expr }).catch(() => {});
    });
  }

  async goto(url, { waitLoad = true, timeoutMs = 30000 } = {}) {
    let loaded;
    const p = new Promise((r) => { loaded = r; });
    const off = (ev) => loaded(ev);
    this.s.on('Page.loadEventFired', off);
    try {
      const r = await this.s.send('Page.navigate', { url });
      if (r.errorText) throw new Error(`navigate ${url}: ${r.errorText}`);
      if (waitLoad) await Promise.race([p, sleep(timeoutMs).then(() => { throw new Error(`load timeout: ${url}`); })]);
    } finally {
      const arr = this.s.listeners.get('Page.loadEventFired'); arr.splice(arr.indexOf(off), 1);   // drop the one-shot listener
    }
  }

  // Evaluate an expression in the page; promises are awaited; returns the JSON value.
  async evaluate(expression) {
    const r = await this.s.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evaluate: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }

  // Poll a JS predicate until truthy; returns its value. Throws with the last value on timeout.
  async waitFor(predicate, timeoutMs = 30000, intervalMs = 250) {
    const end = Date.now() + timeoutMs;
    let last;
    while (Date.now() < end) {
      try { last = await this.evaluate(predicate); if (last) return last; } catch (e) { last = e.message; }
      await sleep(intervalMs);
    }
    throw new Error(`waitFor timeout (${timeoutMs} ms): ${predicate} -> ${JSON.stringify(last)}`);
  }

  text(selector) { return this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`); }
  visible(selector) {
    return this.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false;
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })()`);
  }

  // Real mouse click at the element's center (scrolls it into view first). Fails if the element is missing or hidden.
  async click(selector) {
    const box = await this.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
      e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : 'hidden'; })()`);
    if (!box) throw new Error(`click: no element ${selector}`);
    if (box === 'hidden') throw new Error(`click: element not visible ${selector}`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await this.s.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    }
  }

  // Clear the field and type text as keyboard input (fires real input events).
  async type(selector, text) {
    const ok = await this.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false;
      e.scrollIntoView({ block: 'center' }); e.focus(); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    if (!ok) throw new Error(`type: no element ${selector}`);
    await this.s.send('Input.insertText', { text: String(text) });
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('change', { bubbles: true }))`);
  }

  async screenshot(path) {
    const r = await this.s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
    return path;
  }

  async close() {
    try { await this.browser.browser.send('Target.closeTarget', { targetId: this.targetId }); } catch {}
    this.s.close();
  }
}

export class Browser {
  constructor(proc, port, profile, browserSession) {
    this.proc = proc; this.port = port; this.profile = profile; this.browser = browserSession; this.pages = [];
  }
  async newPage(opts = {}) {
    const { targetId } = await this.browser.send('Target.createTarget', { url: 'about:blank' });
    const s = new Session(`ws://127.0.0.1:${this.port}/devtools/page/${targetId}`);
    await s.open();
    const page = await new Page(this, targetId, s).init(opts);
    this.pages.push(page);
    return page;
  }
  async close() {
    for (const p of this.pages) p.s.close();
    this.browser.close();
    try { this.proc.kill('SIGKILL'); } catch {}
    await sleep(300);
    try { rmSync(this.profile, { recursive: true, force: true }); } catch {}
  }
}

export async function launch({ chrome = findChrome(), headless = process.env.HEADFUL !== '1', args = [] } = {}) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
  const proc = spawn(chrome, [
    ...(headless ? ['--headless'] : []), '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...args, 'about:blank',
  ], { stdio: 'ignore' });
  let info;
  for (let i = 0; i < 150 && !info; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {}
    if (!info) await sleep(200);
  }
  if (!info) { proc.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); throw new Error('Chrome did not start'); }
  const bs = new Session(info.webSocketDebuggerUrl);
  await bs.open();
  const b = new Browser(proc, port, profile, bs);
  const cleanup = () => { try { proc.kill('SIGKILL'); } catch {} };
  process.once('exit', cleanup);
  return b;
}
