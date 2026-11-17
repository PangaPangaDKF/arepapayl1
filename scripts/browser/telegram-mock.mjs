// Local stand-in for the Telegram Bot API, for testing payment alerts (D-031) without a real bot. TEST ONLY.
//   node scripts/browser/telegram-mock.mjs [port=8799]
// Point the onboarding service at it with TG_API_BASE=http://127.0.0.1:<port> and any well-formed token file.
// Test hooks: POST /_inject {chatId, text} queues an incoming message; GET /_sent lists what the bot sent.
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] || 8799);
const queue = []; const sent = []; let nextId = 1;
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });

createServer(async (req, res) => {
  const body = await readBody(req);
  if (req.url === '/_inject') { queue.push({ update_id: nextId++, message: { chat: { id: body.chatId }, text: body.text } }); return json(res, 200, { ok: true }); }
  if (req.url === '/_sent') return json(res, 200, sent);
  const m = req.url.match(/^\/bot[^/]+\/(\w+)$/);
  if (!m) return json(res, 404, { ok: false, description: 'not found' });
  if (m[1] === 'getMe') return json(res, 200, { ok: true, result: { username: 'arepapay_mock_bot' } });
  if (m[1] === 'sendMessage') { sent.push({ chatId: body.chat_id, text: body.text }); return json(res, 200, { ok: true, result: {} }); }
  if (m[1] === 'getUpdates') {
    const end = Date.now() + Math.min(Number(body.timeout || 0), 2) * 1000;
    while (Date.now() < end && !queue.some((u) => u.update_id >= (body.offset || 0))) await new Promise((r) => setTimeout(r, 100));
    return json(res, 200, { ok: true, result: queue.filter((u) => u.update_id >= (body.offset || 0)) });
  }
  json(res, 404, { ok: false, description: 'unknown method' });
}).listen(PORT, '127.0.0.1', () => console.log(`telegram mock on http://127.0.0.1:${PORT}`));
