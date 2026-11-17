// ArepaPay onboarding service (TEST-ONLY stand-in for bank KYC). Testnet, no real money.
//   POST /request {address}   -> stores a pending request (AUTO_APPROVE=1 approves it right away, for demos)
//   GET  /status/:address     -> { status: none|pending|approved, role, roleName } (role read live from txAllowList)
//   GET  /config/:net         -> public dApp config built from the generated config/l1 files (R7)
//   SINGLE_ORIGIN=1 (stage B, D-019): also serves the dApp (app/) at / and a restricted JSON-RPC proxy at /rpc, so one
//   HTTPS origin (e.g. a cloudflared tunnel) carries everything; /config then advertises <origin>/rpc as the RPC.
// Env: PORT (8787), HOST (127.0.0.1), NET (local), CORS_ORIGINS (comma list or *), AUTO_APPROVE, PUBLIC_RPC_URL,
//      ADMIN_KEY_FILE, GAS_KEY_FILE, GAS_TOPUP, MINT_USD, SINGLE_ORIGIN, RPC_RATE (req/min/IP, 600). Keys are never logged.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { CATEGORIES, listStores, saveStore } from './stores.mjs';
import { NET, REPO, addRequest, approve, checkSigners, loadConfig, normAddress, publicConfig, readStore, roleOf } from './lib.mjs';
import { startTelegram, createLink, telegramInfo, linkMessage } from './telegram.mjs';

const SINGLE = process.env.SINGLE_ORIGIN === '1';
const APP_DIR = join(REPO, 'app');
// If the landing's static export exists, it is served at / and the dApp moves to /app/ (one public origin, D-026).
const SITE_DIR = process.env.SITE_DIR || join(REPO, 'landing', 'out');
const HAS_SITE = SINGLE && existsSync(join(SITE_DIR, 'index.html'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm' };
// JSON-RPC methods a dApp + MetaMask need. No admin/debug/personal/txpool; writes only as pre-signed raw txs.
const RPC_ALLOW = new Set(['eth_chainId', 'net_version', 'eth_blockNumber', 'eth_getBalance', 'eth_getCode', 'eth_call', 'eth_estimateGas',
  'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getTransactionCount', 'eth_getTransactionByHash',
  'eth_getTransactionReceipt', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getLogs', 'eth_sendRawTransaction',
  'eth_getStorageAt', 'eth_syncing', 'web3_clientVersion', 'eth_getActivePrecompilesAt', 'eth_baseFee', 'eth_accounts']);
const RPC_RATE = Number(process.env.RPC_RATE || 600);
const hits = new Map();
function rateOk(ip) {
  const now = Date.now(), w = hits.get(ip) || { t: now, n: 0 };
  if (now - w.t > 60_000) { w.t = now; w.n = 0; }
  w.n += 1; hits.set(ip, w);
  if (hits.size > 10_000) hits.clear();
  return w.n <= RPC_RATE;
}
const clientIp = (req) => String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const originOf = (req) => `${req.headers['x-forwarded-proto'] || (req.headers['cf-visitor'] ? 'https' : 'http')}://${req.headers['x-forwarded-host'] || req.headers.host}`;

function serveStatic(res, root, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  let file = normalize(join(root, rel));
  if (file.startsWith(root) && !existsSync(file) && existsSync(file + '.html')) file += '.html';
  if (file.startsWith(root) && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return false;
  // eERC circuit files (D-032) are big (transfer.zkey 15 MB) and pinned by sha256: let phones keep them for a day.
  const big = /[\\/]circuits[\\/][a-z.]+\.(wasm|zkey|js)$/.test(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': big ? 'public, max-age=86400' : 'no-cache',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
  res.end(readFileSync(file));
  return true;
}
function serveApp(req, res, pathname) {
  if (!HAS_SITE) return serveStatic(res, APP_DIR, pathname);
  if (pathname === '/app') { res.writeHead(301, { location: '/app/' }); res.end(); return true; }
  if (pathname.startsWith('/app/')) return serveStatic(res, APP_DIR, pathname.slice(4));
  if (pathname === '/mvp-url.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ url: `${originOf(req)}/app`, network: NET, updated: new Date().toISOString() }));
    return true;
  }
  return serveStatic(res, SITE_DIR, pathname);
}

async function proxyRpc(req, res, body) {
  let calls;
  try { calls = JSON.parse(body); } catch { return send(req, res, 400, { error: 'bad json' }); }
  const arr = Array.isArray(calls) ? calls : [calls];
  if (arr.length === 0 || arr.length > 20) return send(req, res, 400, { error: 'batch size' });
  const bad = arr.find((c) => !c || typeof c.method !== 'string' || !RPC_ALLOW.has(c.method));
  if (bad) return send(req, res, 200, { jsonrpc: '2.0', id: bad?.id ?? null, error: { code: -32601, message: 'method not allowed on the public ArepaPay test RPC' } });
  const upstream = loadConfig().chain.rpcUrl;
  try {
    const r = await fetch(upstream, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const text = await r.text();
    res.writeHead(r.status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' });
    res.end(text);
  } catch { send(req, res, 502, { error: 'chain unavailable' }); }
}

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const AUTO = process.env.AUTO_APPROVE === '1';
// L-012: auto-approve without usable keys used to fail on the first request (502) after a silent start. Fail at boot instead.
if (AUTO) {
  try { checkSigners(); } catch (e) {
    console.error(`AUTO_APPROVE=1 but the approval keys are not usable: ${e.message}. Set ADMIN_KEY_FILE and GAS_KEY_FILE (see scripts/mvp/serve-public.sh).`);
    process.exit(2);
  }
}
const ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080').split(',').map((s) => s.trim());

function send(req, res, code, body) {
  const origin = req.headers.origin;
  const h = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (ORIGINS.includes('*')) h['access-control-allow-origin'] = '*';
  else if (origin && ORIGINS.includes(origin)) { h['access-control-allow-origin'] = origin; h.vary = 'Origin'; }
  h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
  h['access-control-allow-headers'] = 'content-type';
  res.writeHead(code, h);
  res.end(code === 204 ? undefined : JSON.stringify(body));
}

function readBody(req, limit = 1024) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > limit) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

const errMsg = (e) => String(e?.shortMessage || e?.message || e).split('\n')[0].slice(0, 200);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return send(req, res, 204);
    if (req.method === 'GET' && url.pathname === '/health') return send(req, res, 200, { ok: true, net: NET, autoApprove: AUTO, singleOrigin: SINGLE });
    if (SINGLE && url.pathname === '/rpc') {
      if (req.method !== 'POST') return send(req, res, 405, { error: 'POST only' });
      if (!rateOk(clientIp(req))) return send(req, res, 429, { error: 'rate limited' });
      let body; try { body = await readBody(req, 128 * 1024); } catch { return send(req, res, 413, { error: 'too large' }); }
      return proxyRpc(req, res, body);
    }

    if (req.method === 'GET' && url.pathname === '/tg/info') return send(req, res, 200, telegramInfo());
    if (req.method === 'GET' && url.pathname === '/tg/message') {
      const a = normAddress(url.searchParams.get('address') || ''); const at = url.searchParams.get('issuedAt') || '';
      if (!a || at.length > 40) return send(req, res, 400, { error: 'bad request' });
      return send(req, res, 200, { message: linkMessage(a, at) });
    }
    if (req.method === 'POST' && url.pathname === '/tg/link') {
      if (!rateOk(clientIp(req))) return send(req, res, 429, { error: 'rate limited' });
      try {
        return send(req, res, 200, await createLink(JSON.parse(await readBody(req, 2048))));
      } catch (e) { return send(req, res, e.code || 400, { error: e.code ? e.message : 'bad request' }); }
    }

    // store directory (D-034): every store is a contact for payments
    if (req.method === 'GET' && url.pathname === '/stores') return send(req, res, 200, { stores: listStores(), categories: CATEGORIES });
    if (req.method === 'POST' && url.pathname === '/stores') {
      if (!rateOk(clientIp(req))) return send(req, res, 429, { error: 'rate limited' });
      try {
        return send(req, res, 200, await saveStore(JSON.parse(await readBody(req, 2048))));
      } catch (e) { return send(req, res, e.code || 400, { error: e.code ? e.message : 'bad request' }); }
    }

    let m;
    if (req.method === 'GET' && (m = url.pathname.match(/^\/config\/(local|fuji)$/))) {
      const cfg = publicConfig(m[1]);
      if (cfg && SINGLE && m[1] === NET) cfg.rpcUrl = `${originOf(req)}/rpc`;
      return cfg ? send(req, res, 200, cfg) : send(req, res, 404, { error: `no generated config for ${m[1]}` });
    }

    if (req.method === 'GET' && (m = url.pathname.match(/^\/status\/([^/]+)$/))) {
      const address = normAddress(decodeURIComponent(m[1]));
      if (!address) return send(req, res, 400, { error: 'bad address' });
      const rec = readStore()[address];
      const { role, roleName } = await roleOf(address);
      return send(req, res, 200, { address, status: rec?.status || 'none', role, roleName });
    }

    if (req.method === 'POST' && url.pathname === '/request') {
      let address;
      try { address = normAddress(JSON.parse(await readBody(req)).address); } catch { address = null; }
      if (!address) return send(req, res, 400, { error: 'bad address' });
      const rec = addRequest(address);
      console.log(`request ${address} (${rec.status})`);
      if (AUTO && rec.status !== 'approved') {
        try {
          const steps = await approve(address);
          console.log(`auto-approved ${address}: ${steps.join(',') || 'nothing to do'}`);
          return send(req, res, 200, { address, status: 'approved', steps });
        } catch (e) {
          console.error(`auto-approve failed ${address}: ${errMsg(e)}`);
          return send(req, res, 502, { address, status: 'pending', error: 'approve failed' });
        }
      }
      return send(req, res, 200, { address, status: rec.status });
    }
    if (SINGLE && req.method === 'GET' && serveApp(req, res, url.pathname)) return;
    send(req, res, 404, { error: 'not found' });
  } catch (e) {
    console.error(`error: ${errMsg(e)}`);
    send(req, res, 500, { error: 'internal error' });
  }
}).listen(PORT, HOST, () => { startTelegram(); console.log(`onboarding (TEST ONLY) net=${NET} on http://${HOST}:${PORT} autoApprove=${AUTO} singleOrigin=${SINGLE} cors=${ORIGINS.join(',')}`); });
