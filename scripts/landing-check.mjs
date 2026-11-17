// ArepaPay landing truth gate (LANDING lane, D-013). Zero deps.
//   node scripts/landing-check.mjs                 -> checks every landing/out/**/*.html, exit 1 on any FAIL
//   node scripts/landing-check.mjs --file <path>   -> check one HTML file (used for the V9 negative test)
//
// Enforces the arepapay-landing-design truth rules on the EXPORTED output (D-004 stack):
//   T4  no chain address or chain id unless it is in config/ (D-024: config/l1 now holds the Fuji chainId 77078)
//   T6  every element marked data-feature carries a data-status in {live,testnet,in-development,planned}
//   T7  the testnet disclaimer appears in both the hero and the footer (>= 2 times in the rendered DOM)
//   T8/R4  no forbidden yield/price words; no emoji; only an allow-listed set of external hosts
//   T3  every local asset the page references exists in out/, and every relative link (e.g. "probar/") resolves (D-024)
//   L8  the main content page stays short: <= MAX_WORDS visible words (user, D-036). LANDING_MAX_WORDS overrides (V9 test).
// Utility pages (Next's 404, the probar/ redirect page) are exempt from the >=5-features rule; probar/ still needs the disclaimer.
// Next.js inlines the page text a second time inside <script>self.__next_f...</script> (the RSC payload);
// all text-level checks run on the DOM with those scripts stripped, so a duplicate can't mask a missing one.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'landing', 'out');
const configDir = join(root, 'config');

let fails = 0;
const ok = (m) => console.log(`  OK   ${m}`);
const bad = (m, extra = []) => { fails++; console.log(`  FAIL ${m}`); for (const e of extra.slice(0, 10)) console.log(`       ${e}`); };

const walk = (dir, filter) => {
  const out = [];
  for (const e of existsSync(dir) ? readdirSync(dir) : []) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
};

const ADDR = /0x[0-9a-fA-F]{40}/g;
const CHAINID = /\bchainId\b["':\s]*["']?(0x[0-9a-fA-F]+|\d{2,})/gi;
// emoji/dingbat icons — NOT plain typographic arrows (U+2190–21FF) or geometric shapes, which are legit in text
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{20E3}]/gu;
const FORBIDDEN = [/\bgarantizad[oa]s?\b/i, /\bguaranteed\b/i, /\brendimiento\b/i, /\bAPY\b/, /\binter[eé]s\b/i, /\bgana\s+dinero\b/i, /\bearn\b/i];
const ALLOWED_HOSTS = new Set([
  'arepapay.site', 'www.arepapay.site', 'x.com', 'twitter.com',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'schema.org', 'www.w3.org', 'w3.org',
]);
// a sub-path build for another host (NEXT_PUBLIC_SITE_URL, D-024) may also name that host
try { if (process.env.NEXT_PUBLIC_SITE_URL) ALLOWED_HOSTS.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname); } catch {}
const STATUSES = new Set(['live', 'testnet', 'in-development', 'planned']);
const DISCLAIMER = 'Red de pruebas. Sin dinero real. No es asesoría financiera.';
const MAX_WORDS = Number(process.env.LANDING_MAX_WORDS || 250); // D-036: "more simple and less text"
// visible words = body text without scripts, styles and <head>; a word is any token with a letter or digit
const visibleWords = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<head[\s\S]*?<\/head>/i, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
  .split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// allow-list of on-chain values that MAY appear: whatever config/ actually contains
const configText = walk(configDir, (p) => /\.(json|js|mjs|ts|env|txt)$/.test(p)).map((p) => readFileSync(p, 'utf8')).join('\n');
const allowedAddrs = new Set((configText.match(ADDR) || []).map((a) => a.toLowerCase()));
const allowedChainIds = new Set([...configText.matchAll(/"chainId"\s*:\s*"?(0x[0-9a-fA-F]+|\d+)/g)].map((m) => String(m[1]).toLowerCase()));
// NEXT_BASE_PATH builds (GitHub Pages) prefix every absolute asset path; strip it when checking out/ (D-024)
const basePath = (() => { const r = (process.env.NEXT_BASE_PATH || '').trim(); return r && r !== '/' ? '/' + r.replace(/^\/+|\/+$/g, '') : ''; })();

// pick files
const only = process.argv.indexOf('--file');
const files = only > 0 ? [process.argv[only + 1]] : walk(outDir, (p) => p.endsWith('.html'));

console.log('=== AREPAPAY LANDING TRUTH CHECK ===');
if (!files.length) {
  bad(only > 0 ? `file not found: ${process.argv[only + 1]}` : 'no HTML in landing/out/ — run: npm --prefix landing run build');
  console.log(`\n${fails} problem(s).`);
  process.exit(1);
}
console.log(`  files: ${files.map((f) => f.replace(root + '/', '')).join(', ')}`);
if (allowedAddrs.size) console.log(`  config addresses allowed: ${allowedAddrs.size} value(s) from config/`);
if (allowedChainIds.size) console.log(`  config chain ids allowed: ${[...allowedChainIds].join(', ')}`);

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const dom = raw.replace(/<script[\s\S]*?<\/script>/gi, ' '); // drop Next RSC payload for text checks
  const rel = file.replace(root + '/', '');
  const tag = (m) => `${rel}: ${m}`;
  // Next's generated 404 is a framework page, not landing content: it must still pass the safety
  // checks (addresses, emoji, hosts, forbidden words) but is exempt from the feature/disclaimer structure.
  const is404 = /(^|\/)(404|404\/index)\.html$/.test(rel);
  const isProbar = /(^|\/)probar\/index\.html$/.test(rel); // D-024 redirect page to the test dApp
  const isContent = !is404 && !isProbar;

  // T4 — addresses / chain ids
  const strayAddr = [...new Set((dom.match(ADDR) || []).map((a) => a.toLowerCase()))].filter((a) => !allowedAddrs.has(a));
  strayAddr.length ? bad(tag('on-chain address not present in config/ (T4)'), strayAddr) : ok(tag('no stray chain addresses'));
  const chainIds = [...dom.matchAll(CHAINID)].map((m) => m[1]);
  const strayIds = chainIds.filter((c) => !allowedChainIds.has(c.toLowerCase()));
  strayIds.length ? bad(tag('chainId printed that is not in config/ (T4)'), strayIds)
    : ok(tag(chainIds.length ? `chainId ${[...new Set(chainIds)].join(', ')} matches config/` : 'no chainId claims'));

  // T6 — status labels on every feature (content pages only)
  if (isContent) {
    const featTags = dom.match(/<[a-z][^>]*\bdata-feature\b[^>]*>/gi) || [];
    const noStatus = featTags.filter((t) => { const m = t.match(/data-status="([a-z-]+)"/i); return !(m && STATUSES.has(m[1])); });
    if (featTags.length < 5) bad(tag(`expected >=5 status-labeled feature sections, found ${featTags.length} (T6)`));
    else if (noStatus.length) bad(tag(`${noStatus.length} feature(s) without a valid data-status (T6)`), noStatus);
    else ok(tag(`${featTags.length} feature sections, all status-labeled`));

    // T7 — disclaimer in hero AND footer
    const disc = dom.split(DISCLAIMER).length - 1;
    disc >= 2 ? ok(tag(`disclaimer present ${disc}x (hero + footer)`)) : bad(tag(`disclaimer must appear in hero and footer; found ${disc} (T7)`));

    // L8 — short page (D-036)
    const words = visibleWords(raw);
    words <= MAX_WORDS ? ok(tag(`${words} visible words (<= ${MAX_WORDS})`))
      : bad(tag(`${words} visible words; the page must stay <= ${MAX_WORDS} (user: "more simple and less text", D-036)`));
  } else if (isProbar) {
    dom.includes(DISCLAIMER) ? ok(tag('disclaimer present (utility page)')) : bad(tag('probar/ page must show the disclaimer (T7)'));
    /trycloudflare\.com|ngrok|https?:\/\/(?!(?:www\.)?w3\.org)[a-z0-9.-]+/i.test(raw.replace(/<!--[\s\S]*?-->/g, ''))
      ? bad(tag('probar/ must not hardcode a tunnel or external URL; it reads ../mvp-url.json at runtime (T5)'))
      : ok(tag('probar/ hardcodes no URL (reads ../mvp-url.json)'));
  }

  // R4/T8 — forbidden words
  const hit = FORBIDDEN.filter((re) => re.test(dom)).map((re) => String(re));
  hit.length ? bad(tag('forbidden yield/price word (R4/T7)'), hit) : ok(tag('no forbidden yield/price words'));

  // emoji
  const emoji = [...new Set((dom.match(EMOJI) || []))];
  emoji.length ? bad(tag('emoji in page (use the pixel brand, no emoji)'), emoji) : ok(tag('no emoji'));

  // external hosts
  const hosts = [...new Set([...dom.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()))];
  const unknown = hosts.filter((h) => !ALLOWED_HOSTS.has(h));
  unknown.length ? bad(tag('external host not in allow-list'), unknown) : ok(tag(`${hosts.length} external host(s), all allow-listed`));

  // lang + title
  /<html[^>]*\blang="es"/i.test(raw) ? ok(tag('html lang="es"')) : bad(tag('html must declare lang="es"'));
  /<title>[^<]+<\/title>/i.test(raw) ? ok(tag('has <title>')) : bad(tag('missing <title>'));

  // T3 — local assets exist (only when checking the real out/ tree)
  if (only < 0) {
    const refs = [...new Set([...raw.matchAll(/(?:src|href)="(\/[^"#?]+)/g)].map((m) => m[1]))].filter((p) => !p.startsWith('//'));
    const strip = (p) => (basePath && (p === basePath || p.startsWith(basePath + '/')) ? p.slice(basePath.length) || '/' : p);
    const gone = refs.filter((p) => !existsSync(join(outDir, strip(p))));
    gone.length ? bad(tag('referenced asset missing from out/'), gone) : ok(tag(`${refs.length} local assets exist`));
    // relative links (no scheme, no leading slash, no #anchor) must resolve next to this file
    const rels = [...new Set([...dom.matchAll(/href="(?![a-z]+:|\/|#)([^"#?]+)/gi)].map((m) => m[1]))];
    const dead = rels.filter((r) => { const t = join(dirname(file), r); return !(existsSync(t) && (!statSync(t).isDirectory() || existsSync(join(t, 'index.html')))); });
    dead.length ? bad(tag('relative link does not resolve in out/ (T5)'), dead) : ok(tag(`${rels.length} relative link(s) resolve`));
  }
}

console.log(fails ? `\n${fails} landing problem(s).` : '\nLanding is truthful and labeled.');
process.exit(fails ? 1 : 0);
