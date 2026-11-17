// ArepaPay payment alerts over Telegram (D-031). TEST ONLY: testnet, no real money.
// Off unless the bot token file exists (TELEGRAM_TOKEN_FILE, default ~/.arepapay-telegram.token). The token is read into
// memory and never logged, returned or written anywhere else.
//
// Linking (a merchant proves they own the wallet; nobody can subscribe to someone else's payments):
//   1. app: the merchant signs linkMessage(address, issuedAt) and POSTs {address, issuedAt, signature} to /tg/link
//   2. server: verifies the signature (<= 10 min old) and returns a one-time https://t.me/<bot>?start=<token> link
//   3. Telegram: the merchant taps Start; the bot binds that chat to the address. /stop unlinks the chat.
// Watching: polls the escrow's Authorized (a customer paid in, possibly a share) and Captured (the money reached the
// merchant) logs and messages the merchant's linked chats. Store: backend/onboarding/data/telegram.<net>.json (gitignored data dir).
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createPublicClient, http, parseAbiItem, verifyMessage, formatUnits, getAddress } from 'viem';
import { NET, REPO, loadConfig, normAddress } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = process.env.TELEGRAM_TOKEN_FILE || join(homedir(), '.arepapay-telegram.token');
const DATA_DIR = process.env.DATA_DIR || join(HERE, 'data');
const STORE = join(DATA_DIR, `telegram.${NET}.json`);
const TG_API = (process.env.TG_API_BASE || 'https://api.telegram.org').replace(/\/$/, ''); // override only for the local test mock
const LINK_TTL_MS = 10 * 60 * 1000;
const POLL_MS = Number(process.env.TG_POLL_MS || 4000);
const MAX_RANGE = 2000n;

let TOKEN = null;
let BOT = null;          // bot username, from getMe
const pending = new Map(); // one-time start token -> { address, exp }

export const linkMessage = (address, issuedAt) =>
  `ArepaPay (testnet): activar avisos de pago por Telegram para ${address}. Emitido: ${issuedAt}`;

const readStore = () => { try { return JSON.parse(readFileSync(STORE, 'utf8')); } catch { return { links: {}, lastBlock: null }; } };
function writeStore(s) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE + '.tmp', JSON.stringify(s, null, 2));
  renameSync(STORE + '.tmp', STORE);
}

async function tg(method, params = {}) {
  const r = await fetch(`${TG_API}/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params),
    signal: AbortSignal.timeout(40_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description || r.status}`); // never includes the token
  return j.result;
}
const send = (chatId, text) => tg('sendMessage', { chat_id: chatId, text }).catch((e) => console.error(String(e.message)));
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const telegramEnabled = () => TOKEN !== null;
export const telegramInfo = () => ({ enabled: TOKEN !== null, bot: BOT });

/** POST /tg/link body -> { url } or throws Error with .code (400/401/503). */
export async function createLink({ address, issuedAt, signature }) {
  const fail = (code, msg) => Object.assign(new Error(msg), { code });
  if (!TOKEN || !BOT) throw fail(503, 'telegram alerts are off');
  const addr = normAddress(address);
  if (!addr || typeof signature !== 'string' || typeof issuedAt !== 'string') throw fail(400, 'bad request');
  const t = Date.parse(issuedAt);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > LINK_TTL_MS) throw fail(400, 'expired, sign again');
  const ok = await verifyMessage({ address: addr, message: linkMessage(addr, issuedAt), signature }).catch(() => false);
  if (!ok) throw fail(401, 'bad signature');
  for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k);
  if (pending.size > 5000) throw fail(503, 'busy, try later');
  const token = randomBytes(16).toString('hex'); // 32 chars, within Telegram's 64-char start param limit
  pending.set(token, { address: addr, exp: Date.now() + LINK_TTL_MS });
  return { url: `https://t.me/${BOT}?start=${token}`, bot: BOT };
}

async function pollBot() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const msg = u.message; if (!msg?.text || !msg.chat) continue;
        const chatId = msg.chat.id; const text = msg.text.trim();
        const s = readStore();
        let m;
        if ((m = text.match(/^\/start(?:\s+([0-9a-f]{32}))?$/))) {
          const p = m[1] && pending.get(m[1]);
          if (!p || p.exp < Date.now()) { await send(chatId, 'Abre ArepaPay, ve a Cobrar y toca "Avisos por Telegram" para vincular tu billetera.'); continue; }
          pending.delete(m[1]);
          const chats = new Set(s.links[p.address] || []); chats.add(chatId);
          s.links[p.address] = [...chats]; writeStore(s);
          await send(chatId, `Listo. Te avisaré aquí cuando te paguen en ${short(p.address)} (red de prueba, sin dinero real). Escribe /stop para dejar de recibir avisos.`);
        } else if (text === '/stop') {
          for (const a of Object.keys(s.links)) {
            s.links[a] = s.links[a].filter((c) => c !== chatId);
            if (!s.links[a].length) delete s.links[a];
          }
          writeStore(s);
          await send(chatId, 'Avisos desactivados.');
        }
      }
    } catch (e) {
      console.error(`telegram poll: ${String(e.message).slice(0, 160)}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function watchEscrow() {
  const cfg = loadConfig(NET);
  if (!cfg) { console.error('telegram: no MVP config, watcher off'); return; }
  const client = createPublicClient({ transport: http(process.env.L1_RPC_URL || cfg.chain.rpcUrl) });
  const escrow = getAddress(cfg.mvp.splitPayEscrow);
  const dec = Number(cfg.mvp.testUsdDecimals);
  const sym = cfg.mvp.testUsdSymbol;
  const authEv = parseAbiItem('event Authorized(uint256 indexed id, address indexed payer, uint256 amount, uint256 covered)');
  const capEv = parseAbiItem('event Captured(uint256 indexed id, address indexed merchant, uint256 net, uint256 fee)');
  // D-034: payments to a store from the contact list (MerchantPay), when deployed on this net
  const mpFile = join(REPO, 'config', 'l1', `merchantpay.${NET}.json`);
  const mp = existsSync(mpFile) ? getAddress(JSON.parse(readFileSync(mpFile, 'utf8')).merchantPay) : null;
  const paidEv = parseAbiItem('event MerchantPaid(uint256 indexed id, address indexed payer, address indexed merchant, uint256 amount, uint256 net, uint256 fee)');
  const intentsFn = parseAbiItem('function intents(uint256) view returns (address merchant, uint64 expiry, uint16 feeBps, uint8 maxPayers, uint8 payerCount, uint8 confirmedCount, bool requireConfirm, uint8 state, uint256 total, uint256 covered)');
  for (;;) {
    try {
      const s = readStore();
      const head = await client.getBlockNumber();
      // First run starts at the head: no alerts for old payments.
      let from = s.lastBlock == null ? head + 1n : BigInt(s.lastBlock) + 1n;
      while (from <= head) {
        const to = from + MAX_RANGE - 1n < head ? from + MAX_RANGE - 1n : head;
        const [auth, cap, direct] = await Promise.all([
          client.getLogs({ address: escrow, event: authEv, fromBlock: from, toBlock: to }),
          client.getLogs({ address: escrow, event: capEv, fromBlock: from, toBlock: to }),
          mp ? client.getLogs({ address: mp, event: paidEv, fromBlock: from, toBlock: to }) : [],
        ]);
        const links = readStore().links;
        for (const l of auth) {
          const it = await client.readContract({ address: escrow, abi: [intentsFn], functionName: 'intents', args: [l.args.id] });
          const chats = links[getAddress(it[0])] || [];
          const part = l.args.covered < it[8] ? ` (van ${formatUnits(l.args.covered, dec)} de ${formatUnits(it[8], dec)})` : '';
          for (const c of chats) await send(c, `Te pagaron ${formatUnits(l.args.amount, dec)} ${sym} en el cobro #${l.args.id}${part}. (Red de prueba, sin dinero real.)`);
        }
        for (const l of cap) {
          const chats = links[getAddress(l.args.merchant)] || [];
          for (const c of chats) await send(c, `Cobrado: cobro #${l.args.id}, recibiste ${formatUnits(l.args.net, dec)} ${sym} (comisión ${formatUnits(l.args.fee, dec)}). (Red de prueba.)`);
        }
        for (const l of direct) {
          const chats = links[getAddress(l.args.merchant)] || [];
          for (const c of chats) await send(c, `Te pagaron ${formatUnits(l.args.amount, dec)} ${sym} directo a tu negocio; recibiste ${formatUnits(l.args.net, dec)} ${sym} (comisión ${formatUnits(l.args.fee, dec)}). (Red de prueba, sin dinero real.)`);
        }
        const st = readStore(); st.lastBlock = Number(to); writeStore(st);
        from = to + 1n;
      }
      if (s.lastBlock == null) { const st = readStore(); st.lastBlock = Number(head); writeStore(st); }
    } catch (e) {
      console.error(`telegram watch: ${String(e.shortMessage || e.message).split('\n')[0].slice(0, 160)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/** Called once by server.mjs. No token file -> alerts stay off, nothing else changes. */
export async function startTelegram() {
  if (!existsSync(TOKEN_FILE)) { console.log('telegram alerts: off (no token file)'); return; }
  const raw = readFileSync(TOKEN_FILE, 'utf8').trim();
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(raw)) { console.error('telegram alerts: off (token file is not a bot token)'); return; }
  TOKEN = raw;
  try {
    BOT = (await tg('getMe')).username;
  } catch (e) {
    console.error(`telegram alerts: off (${String(e.message).slice(0, 120)})`); TOKEN = null; return;
  }
  console.log(`telegram alerts: on (@${BOT})`);
  pollBot(); watchEscrow();
}
