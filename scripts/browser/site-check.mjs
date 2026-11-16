// Live site check (D-027): the landing loads, links to probar/, and probar/ lands on the MVP dApp with its config loaded.
//   node scripts/browser/site-check.mjs [https://arepapay.site] [--shots <dir>]
import { launch } from './cdp.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const args = process.argv.slice(2);
const si = args.indexOf('--shots');
const shots = si >= 0 ? args.splice(si, 2)[1] : mkdtempSync(join(tmpdir(), 'site-'));
const base = (args[0] || 'https://arepapay.site').replace(/\/$/, '');
const b = await launch();
let fails = 0;
const step = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); if (!ok) fails++; };
try {
  const p = await b.newPage({ width: 1280, height: 900 });
  await p.goto(base + '/');
  const h1 = await p.text('h1');
  step(/ArepaPay/.test(h1 || ''), 'landing renders', h1);
  const links = await p.evaluate(`[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(h=>h&&h.includes('probar')&&!h.startsWith('#')).length`);
  step(links > 0, 'landing links to probar/', `${links} link(s)`);
  await p.screenshot(join(shots, 'site-landing.png'));
  await p.goto(base + '/probar/', { waitLoad: false });
  let landed = true;
  try { await p.waitFor(`location.pathname.startsWith('/app')`, 30000); } catch { landed = false; }
  step(landed, 'probar/ redirects to the dApp', await p.evaluate('location.href'));
  let cfg = false;
  if (landed) { try { await p.waitFor('window.__arepapayConfigLoaded === true', 60000); cfg = true; } catch {} }
  step(cfg, 'dApp loaded its Fuji config', cfg ? await p.text('#netinfo') : 'no config (tunnel or node down?)');
  await p.screenshot(join(shots, 'site-after-probar.png'));
} catch (e) { step(false, 'site check', e.message); }
await b.close();
console.log(fails ? `SITE FAIL (${fails})` : 'SITE PASS', `screenshots: ${shots}`);
process.exit(fails ? 1 : 0);
