// ArepaPay onboarding service (TEST-ONLY stand-in for bank KYC). Testnet, no real money.
//   POST /request {address}   -> stores a pending request (AUTO_APPROVE=1 approves it right away, for demos)
//   GET  /status/:address     -> { status: none|pending|approved, role, roleName } (role read live from txAllowList)
//   GET  /config/:net         -> public dApp config built from the generated config/l1 files (R7)
// Env: PORT (8787), HOST (127.0.0.1), NET (local), CORS_ORIGINS (comma list or *), AUTO_APPROVE, PUBLIC_RPC_URL,
//      ADMIN_KEY_FILE, GAS_KEY_FILE, GAS_TOPUP, MINT_USD. Keys are never logged.
import { createServer } from 'node:http';
import { NET, addRequest, approve, normAddress, publicConfig, readStore, roleOf } from './lib.mjs';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const AUTO = process.env.AUTO_APPROVE === '1';
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1024) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

const errMsg = (e) => String(e?.shortMessage || e?.message || e).split('\n')[0].slice(0, 200);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return send(req, res, 204);
    if (req.method === 'GET' && url.pathname === '/health') return send(req, res, 200, { ok: true, net: NET, autoApprove: AUTO });

    let m;
    if (req.method === 'GET' && (m = url.pathname.match(/^\/config\/(local|fuji)$/))) {
      const cfg = publicConfig(m[1]);
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
    send(req, res, 404, { error: 'not found' });
  } catch (e) {
    console.error(`error: ${errMsg(e)}`);
    send(req, res, 500, { error: 'internal error' });
  }
}).listen(PORT, HOST, () => console.log(`onboarding (TEST ONLY) net=${NET} on http://${HOST}:${PORT} autoApprove=${AUTO} cors=${ORIGINS.join(',')}`));
