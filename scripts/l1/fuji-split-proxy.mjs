#!/usr/bin/env node
// Fuji split proxy (D-019). avalanche-cli's wallet needs P, X and C endpoints on one base URL.
// Our own Fuji node runs partial sync (P-Chain only); the public API lacks some P methods
// (platform.getBalance, see STAGE_B_RESULT §1). So: P-Chain, info, health and L1 paths -> our node;
// X and C -> the public Fuji API. Listens on 127.0.0.1 only. No keys pass through here except signed txs.
import http from 'node:http';
import https from 'node:https';
const PORT = Number(process.env.PORT || 9760);
const LOCAL = new URL(process.env.LOCAL || 'http://127.0.0.1:9750');
const PUBLIC = new URL(process.env.PUBLIC || 'https://api.avax-test.network');
const isPublic = (p) => /^\/ext\/(bc\/(X|C)(\/|$)|X$|C\/|bc\/2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm|bc\/yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k5HqY)/.test(p);
// P-Chain calls that ask about X/C atomic memory need the full node (public API); all other P calls stay local.
const needsPublic = (body) => { try { const j = JSON.parse(body); const arr = Array.isArray(j) ? j : [j];
  return arr.some((r) => r && r.params && r.params.sourceChain && r.params.sourceChain !== 'P'); } catch { return false; } };
http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => forward(req, res, Buffer.concat(chunks)));
}).listen(PORT, '127.0.0.1', () => console.log(`fuji-split-proxy on 127.0.0.1:${PORT}: P/info -> ${LOCAL.origin}, X/C -> ${PUBLIC.origin}`));
function forward(req, res, body) {
  const pub = isPublic(req.url) || (/^\/ext\/(bc\/)?P/.test(req.url) && needsPublic(body.toString()));
  const target = pub ? PUBLIC : LOCAL;
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host, 'content-length': String(body.length) };
  const up = lib.request({ protocol: target.protocol, hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? 443 : 80), path: req.url, method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502); res.end(String(e.message)); });
  up.end(body);
}
