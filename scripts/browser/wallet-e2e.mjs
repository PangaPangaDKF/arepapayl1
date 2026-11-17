// End-to-end test of the REAL dApp UI (app/index.html + app/app.js) in headless Chrome, driven like a MetaMask user.
// Each of three fresh wallets (merchant, alice, bob) gets its own tab with an injected EIP-1193 `window.ethereum`
// (isMetaMask: true) whose request() is forwarded over a CDP binding to Node, where the key lives (in memory only,
// never printed). TESTNET only.
//
//   node scripts/browser/wallet-e2e.mjs <pageUrl> [--shots <dir>]
//   e.g. node scripts/browser/wallet-e2e.mjs http://127.0.0.1:8795/
// The page must be served by the onboarding service with AUTO_APPROVE=1 (SINGLE_ORIGIN=1 so /config and /rpc share the origin).
// Flow: connect -> add/switch network (wallet starts on 0x1) -> request access (allowlist + gas + 50 tUSD) ->
// merchant creates a 5 tUSD split intent for 2 payers -> alice opens the share link and pays 3 -> bob pays 2 ->
// on-chain check: merchant has 50 + 5 - 0.5% fee = 54.975 tUSD, UI shows "Cobrado".
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(join(REPO, 'backend', 'onboarding', 'package.json'));
const { createWalletClient, http, defineChain, hexToBigInt, isHex } = req('viem');
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts');

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
let pageUrl = null, shots = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--shots') shots = argv[++i];
  else if (!pageUrl) pageUrl = argv[i];
}
if (!pageUrl) { console.error('usage: node scripts/browser/wallet-e2e.mjs <pageUrl> [--shots <dir>]'); process.exit(2); }
shots = shots || mkdtempSync(join(tmpdir(), 'arepapay-shots-'));
const ORIGIN = new URL(pageUrl).origin;
const TX_TIMEOUT = 120_000;        // approve + authorize, Fuji ~2-5 s per tx, plus UI polling
const ACCESS_TIMEOUT = 180_000;    // auto-approve does up to 3 txs and is serialized on the server
setTimeout(() => { console.log('FAIL global timeout (15 min)'); process.exit(1); }, 15 * 60_000).unref();

// ---------------------------------------------------------------- config + RPC
const getJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); };
const health = await getJson(`${ORIGIN}/health`);
const NET = new URL(pageUrl).searchParams.get('net') || health.net;
const cfg = await getJson(`${ORIGIN}/config/${NET}`);
if (!health.autoApprove) console.log('WARN: service reports autoApprove=false; "request access" will stay pending');
let rpcSeq = 0;
async function rpc(method, params = [], url = cfg.rpcUrl) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcSeq, method, params }) });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; if (j.error.data !== undefined) e.data = j.error.data; throw e; }
  return j.result;
}
async function usdBalance(addr) {
  const data = '0x70a08231' + addr.slice(2).toLowerCase().padStart(64, '0');
  return BigInt(await rpc('eth_call', [{ to: cfg.testUsd, data }, 'latest']));
}
const U = (n) => BigInt(Math.round(n * 10 ** cfg.testUsdDecimals));
const fmt = (v) => (Number(v) / 10 ** cfg.testUsdDecimals).toString();

// ---------------------------------------------------------------- injected wallet
const PROVIDER_SRC = `(() => {
  const listeners = {};
  const eth = {
    isMetaMask: true,
    request: (args) => { const { method, params } = args || {}; return window.__walletRequest(method, params || []); },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return eth; },
    removeListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); return eth; },
    __emit(ev, data) { for (const fn of listeners[ev] || []) { try { fn(data); } catch (e) { console.error('listener ' + ev + ': ' + e.message); } } },
  };
  window.ethereum = eth;
  window.dispatchEvent(new Event('ethereum#initialized'));
})();`;

const rpcError = (code, message, data) => Object.assign(new Error(message), { code, ...(data !== undefined ? { data } : {}) });

class Wallet {
  constructor(name) {
    this.name = name;
    this.account = privateKeyToAccount(generatePrivateKey());   // key stays inside the viem account object; never printed
    this.address = this.account.address;
    this.chainId = 1;                    // start on Ethereum mainnet id to exercise add/switch
    this.added = new Set([1]);
    this.authorized = false;
    this.rpcUrl = cfg.rpcUrl;
    this.calls = [];                     // method names only, for debugging
    this.page = null;
  }
  emit(ev, data) {
    return this.page.send('Runtime.evaluate', { expression: `window.ethereum && window.ethereum.__emit(${JSON.stringify(ev)}, ${JSON.stringify(data)})` }).catch(() => {});
  }
  client() {
    const chain = defineChain({ id: cfg.chainId, name: cfg.chainName, nativeCurrency: { name: cfg.nativeSymbol, symbol: cfg.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: [this.rpcUrl] } } });
    return createWalletClient({ account: this.account, chain, transport: http(this.rpcUrl) });
  }
  async handle(method, params) {
    this.calls.push(method);
    const hexId = '0x' + this.chainId.toString(16);
    switch (method) {
      case 'eth_requestAccounts': this.authorized = true; return [this.address];
      case 'eth_accounts': return this.authorized ? [this.address] : [];
      case 'eth_chainId': return hexId;
      case 'net_version': return String(this.chainId);
      case 'wallet_requestPermissions': this.authorized = true; return [{ parentCapability: 'eth_accounts' }];
      case 'wallet_getPermissions': return this.authorized ? [{ parentCapability: 'eth_accounts' }] : [];
      case 'wallet_switchEthereumChain': {
        const id = Number(params[0]?.chainId);
        if (!this.added.has(id)) throw rpcError(4902, `Unrecognized chain ID ${params[0]?.chainId}. Try adding the chain using wallet_addEthereumChain first.`);
        if (id !== this.chainId) { this.chainId = id; await this.emit('chainChanged', '0x' + id.toString(16)); }
        return null;
      }
      case 'wallet_addEthereumChain': {
        const p = params[0] || {};
        const id = Number(p.chainId);
        if (id !== cfg.chainId) throw rpcError(4001, `test wallet only accepts chain ${cfg.chainId}`);
        if (p.rpcUrls?.[0]) this.rpcUrl = p.rpcUrls[0];
        this.added.add(id);
        if (id !== this.chainId) { this.chainId = id; await this.emit('chainChanged', '0x' + id.toString(16)); }   // MetaMask switches after add
        return null;
      }
      case 'eth_sendTransaction': {
        if (!this.authorized) throw rpcError(4100, 'unauthorized');
        if (this.chainId !== cfg.chainId) throw rpcError(-32603, `wallet is on chain ${this.chainId}, not ${cfg.chainId}`);
        const t = params[0] || {};
        if (t.from && t.from.toLowerCase() !== this.address.toLowerCase()) throw rpcError(4100, 'from is not this wallet');
        try {
          return await this.client().sendTransaction({
            to: t.to, data: t.data, ...(t.value ? { value: hexToBigInt(t.value) } : {}), ...(t.gas ? { gas: hexToBigInt(t.gas) } : {}),
          });
        } catch (e) {
          const data = e?.walk?.((x) => typeof x?.data === 'string')?.data;
          throw rpcError(-32603, String(e?.shortMessage || e?.message || e).split('\n')[0], data);
        }
      }
      case 'personal_sign': {
        const [m] = params;
        return this.account.signMessage({ message: isHex(m) ? { raw: m } : m });
      }
      case 'eth_signTypedData_v4': {
        const td = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
        const { EIP712Domain, ...types } = td.types;
        return this.account.signTypedData({ domain: td.domain, types, primaryType: td.primaryType, message: td.message });
      }
      default:
        return rpc(method, params, this.rpcUrl);   // every read goes to the RPC the page advertised
    }
  }
}

// ---------------------------------------------------------------- steps
let passed = 0, total = 0, aborted = false;
const browser = await launch();
async function finish() {
  console.log(`== ${passed}/${total} passed (screenshots: ${shots})`);
  await browser.close();
  process.exit(passed === total && !aborted ? 0 : 1);
}

async function step(name, fn, wallets = []) {
  total++;
  if (aborted) { console.log(`SKIP ${name}`); return; }
  const before = wallets.map((w) => w.page.errors.length);
  try {
    const note = await fn();
    const newErr = wallets.flatMap((w, i) => w.page.errors.slice(before[i]).map((e) => `[${w.name}] ${e}`));
    if (newErr.length) throw new Error('page JS errors:\n  ' + newErr.join('\n  '));
    passed++;
    console.log(`PASS ${name}${note ? ' (' + note + ')' : ''}`);
  } catch (e) {
    aborted = true;
    console.log(`FAIL ${name}: ${e.message}`);
    for (const w of wallets) {
      try { await w.page.screenshot(join(shots, `FAIL-${w.name}.png`)); } catch {}
      const ui = await w.page.evaluate(`JSON.stringify({ msg: document.getElementById('msg')?.textContent, err: document.getElementById('err')?.textContent, state: document.getElementById('iState')?.textContent })`).catch(() => '?');
      console.log(`  [${w.name}] ui=${ui} wallet calls (last 12): ${w.calls.slice(-12).join(',')}`);
    }
  }
}
const shot = (w, tag) => w.page.screenshot(join(shots, `${String(++shotN).padStart(2, '0')}-${w.name}-${tag}.png`));
let shotN = 0;

const merchant = new Wallet('merchant'), alice = new Wallet('alice'), bob = new Wallet('bob');
const all = [merchant, alice, bob];
console.log(`ArepaPay wallet e2e: ${pageUrl} net=${NET} chainId=${cfg.chainId} rpc=${cfg.rpcUrl}`);
console.log(`wallets: ${all.map((w) => `${w.name}=${w.address}`).join(' ')}`);

const $text = (w, id) => w.page.text('#' + id);
const waitText = (w, id, re, ms = 30000) => w.page.waitFor(`(() => { const t = document.getElementById(${JSON.stringify(id)})?.textContent || ''; return ${re}.test(t) ? t : false; })()`, ms);

for (const w of all) {
  await step(`${w.name}: page loads with injected wallet`, async () => {
    w.page = await browser.newPage();
    await w.page.exposeFunction('__walletRequest', (m, p) => w.handle(m, p));
    await w.page.addInitScript(PROVIDER_SRC);
    await w.page.goto(pageUrl);
    await w.page.waitFor('!!window.__arepapayConfigLoaded || !!document.getElementById("err").textContent', 60000);
    const e = await $text(w, 'err');
    if (e) throw new Error('page error: ' + e);
    if ((await w.page.evaluate('typeof window.ethereum?.request')) !== 'function') throw new Error('window.ethereum missing');
    return 'config loaded';
  }, []);
  if (!w.page) break;
  await step(`${w.name}: connect`, async () => {
    await w.page.click('#btnConnect');
    await w.page.waitFor(`document.getElementById('addr').textContent === ${JSON.stringify(w.address)}`, 30000);
    return await $text(w, 'chain');
  }, [w]);
  await step(`${w.name}: add/switch to ArepaPay L1`, async () => {
    await w.page.click('#btnNet');
    const t = await waitText(w, 'chain', '/ArepaPay L1/', 30000);
    if (!w.calls.includes('wallet_addEthereumChain')) throw new Error('expected the 4902 -> wallet_addEthereumChain path');
    return t;
  }, [w]);
  await step(`${w.name}: request access (auto-approve -> allowlisted, gas, 50 tUSD)`, async () => {
    await w.page.click('#btnRequest');
    await waitText(w, 'msg', '/Solicitud: approved/', ACCESS_TIMEOUT);
    // the click triggers one refresh; poll by re-clicking Connect (cheap, no popup in MetaMask once authorized)
    const end = Date.now() + 60000;
    for (;;) {
      const a = await $text(w, 'access'), u = await $text(w, 'usd');
      if (/^habilitado/.test(a) && /^50(\.0)? tUSD/.test(u)) { await shot(w, 'approved'); return `${a}; ${u}; gas ${await $text(w, 'native')}`; }
      if (Date.now() > end) throw new Error(`access="${a}" usd="${u}"`);
      await new Promise((r) => setTimeout(r, 2000));
      await w.page.click('#btnConnect');
    }
  }, [w]);
}

// Optional (D-031): with TG_MOCK=<telegram-mock url> and the service started with TG_API_BASE pointing at it,
// the merchant links Telegram from the UI and the test later expects the paid + captured alerts in that chat.
const TG_MOCK = process.env.TG_MOCK;
const TG_CHAT = 7000 + Math.floor(Math.random() * 1000);
const tgSent = async () => (await getJson(`${TG_MOCK}/_sent`)).filter((m) => m.chatId === TG_CHAT).map((m) => m.text);
const tgWait = async (re, ms) => {
  const end = Date.now() + ms;
  for (;;) { const t = await tgSent(); if (t.some((x) => re.test(x))) return t; if (Date.now() > end) throw new Error(`no ${re} in ${JSON.stringify(t)}`); await new Promise((r) => setTimeout(r, 1000)); }
};
if (TG_MOCK) await step('merchant: link Telegram alerts (sign -> t.me link -> /start)', async () => {
  const p = merchant.page;
  await p.click('#tabMerchant');
  await p.waitFor(`!document.getElementById('tgBox').classList.contains('hidden')`, 15000);
  await p.click('#btnTelegram');
  await p.waitFor(`/start=[0-9a-f]{32}$/.test(document.getElementById('tgLink').href)`, 30000);
  if (!merchant.calls.includes('personal_sign')) throw new Error('expected a personal_sign');
  const tok = (await p.evaluate(`document.getElementById('tgLink').href`)).split('start=')[1];
  await fetch(`${TG_MOCK}/_inject`, { method: 'POST', body: JSON.stringify({ chatId: TG_CHAT, text: `/start ${tok}` }) });
  return (await tgWait(/^Listo/, 20000)).at(-1).slice(0, 40);
}, [merchant]);

let link = null;
await step('merchant: create 5 tUSD split intent for 2 payers', async () => {
  const p = merchant.page;
  await p.click('#tabMerchant');
  await p.type('#amount', '5');
  await p.click('#split');
  await p.waitFor(`!document.getElementById('splitOpts').classList.contains('hidden')`, 5000);
  await p.type('#maxPayers', '2');
  await p.click('#btnCreate');
  link = await p.waitFor(`(() => { const a = document.getElementById('link'); return a && /[?&]intent=\\d+/.test(a.href) ? a.href : false; })()`, TX_TIMEOUT);
  await waitText(merchant, 'iState', '/^Abierto/', 30000);
  if (!(await p.visible('#qr svg'))) throw new Error('QR not rendered');
  await shot(merchant, 'intent-created');
  return link;
}, [merchant]);

async function payFrom(w, amount, expectCovered) {
  const p = w.page;
  await p.goto(link);
  await p.waitFor('!!window.__arepapayConfigLoaded', 60000);
  await waitText(w, 'addr', new RegExp(w.address), 15000).catch(() => { throw new Error('wallet not silently reconnected on the share link (eth_accounts)'); });
  await waitText(w, 'iState', '/^Abierto/', 30000);
  await p.waitFor(`!document.getElementById('payBox').classList.contains('hidden')`, 15000);
  await p.type('#share', String(amount));
  await p.click('#btnPay');
  await waitText(w, 'msg', '/Pago autorizado/', TX_TIMEOUT);
  if (expectCovered) await waitText(w, 'iCovered', new RegExp('^' + expectCovered.replace('.', '\\.')), 15000);
  await shot(w, `paid-${amount}`);
  return `covered ${await $text(w, 'iCovered')}, state ${await $text(w, 'iState')}`;
}
await step('alice: open share link and pay 3 tUSD', () => payFrom(alice, 3, '3'), [alice]);
await step('bob: open share link and pay 2 tUSD', () => payFrom(bob, 2, '5'), [bob]);

await step('UI: intent shows Cobrado (merchant polls, bob refreshed)', async () => {
  await waitText(bob, 'iState', '/^Cobrado/', 30000);
  await waitText(merchant, 'iState', '/^Cobrado/', 30000);
  await shot(merchant, 'captured');
  return `merchant sees "${await $text(merchant, 'iState')}", net ${await $text(merchant, 'iNet')}`;
}, [merchant, bob]);

await step('chain: merchant 54.975, alice 47, bob 48 tUSD (0.5% fee)', async () => {
  const [m, a, b] = await Promise.all(all.map((w) => usdBalance(w.address)));
  const want = [U(54.975), U(47), U(48)];
  const got = [m, a, b];
  if (got.some((v, i) => v !== want[i])) throw new Error(`got ${got.map(fmt).join('/')} want ${want.map(fmt).join('/')}`);
  return got.map(fmt).join(' / ');
}, all);

await step('UI: merchant balance shows 54.975 tUSD', async () => {
  await merchant.page.click('#btnConnect');
  await waitText(merchant, 'usd', '/^54\\.975 tUSD/', 20000);
  await shot(merchant, 'final');
  return await $text(merchant, 'usd');
}, [merchant]);

if (TG_MOCK) await step('telegram: merchant got "Te pagaron" and "Cobrado" alerts', async () => {
  await tgWait(/^Te pagaron/, 30000);
  const t = await tgWait(/^Cobrado/, 30000);
  return t.filter((x) => !/^Listo/.test(x)).map((x) => x.slice(0, 48)).join(' | ');
});

// ---------------------------------------------------------------- encrypted balances (D-032), when the net has eERC
// alice + merchant unlock (personal_sign -> key) and register (registration proof); alice moves 10 tUSD to private, sends
// 3 privately to the merchant (transfer proof in the page); the merchant sees 3.00 and moves 1 back to normal (withdraw
// proof). Chain checks: plain tUSD moved exactly by the deposit/withdraw amounts; the transfer moved no plain tUSD.
const PROOF_TIMEOUT = 300_000;
const privBal = (w) => $text(w, 'pBal');
async function privOpen(w) {
  const p = w.page;
  await p.click('#tabPrivate');
  await p.waitFor(`!document.getElementById('private').classList.contains('hidden')`, 5000);
  await p.click('#btnPUnlock');
  await p.waitFor(`!document.getElementById('pRegister').classList.contains('hidden') || !document.getElementById('pOpen').classList.contains('hidden')`, 60000);
  if (!w.calls.includes('personal_sign')) throw new Error('expected a personal_sign for the key');
  if (await p.visible('#pRegister')) {
    await p.click('#btnPRegister');
    await waitText(w, 'msg', '/Saldo privado activado/', PROOF_TIMEOUT);
  }
  await p.waitFor(`!document.getElementById('pOpen').classList.contains('hidden')`, 30000);
  return `registered; balance ${await privBal(w)}`;
}
if (cfg.eerc && process.env.EERC !== '0') {
  await step('alice: unlock + activate private balance (registration proof)', () => privOpen(alice), [alice]);
  await step('merchant: unlock + activate private balance', () => privOpen(merchant), [merchant]);
  await step('alice: move 10 tUSD to private (approve + deposit)', async () => {
    const before = await usdBalance(alice.address);
    await alice.page.type('#pDep', '10');
    await alice.page.click('#btnPDeposit');
    await waitText(alice, 'msg', '/pasaron a tu saldo privado/', TX_TIMEOUT);
    await waitText(alice, 'pBal', '/^10\\.00 tUSD/', 30000);
    const after = await usdBalance(alice.address);
    if (before - after !== U(10)) throw new Error(`plain tUSD moved ${fmt(before - after)}, want 10`);
    await shot(alice, 'private-10');
    return `private ${await privBal(alice)}; plain ${fmt(after)}`;
  }, [alice]);
  await step('alice: send 3 tUSD privately to the merchant (transfer proof)', async () => {
    const [aB, mB] = await Promise.all([usdBalance(alice.address), usdBalance(merchant.address)]);
    await alice.page.type('#pTo', merchant.address);
    await alice.page.type('#pAmt', '3');
    await alice.page.click('#btnPSend');
    await waitText(alice, 'msg', '/Enviado en privado/', PROOF_TIMEOUT);
    await waitText(alice, 'pBal', '/^7\\.00 tUSD/', 30000);
    const [aA, mA] = await Promise.all([usdBalance(alice.address), usdBalance(merchant.address)]);
    if (aA !== aB || mA !== mB) throw new Error('a private transfer moved plain tUSD');
    const ms = await alice.page.evaluate('window.__arepapayLastProofMs');
    await shot(alice, 'private-sent');
    return `alice private ${await privBal(alice)}; transfer proof ${Math.round(ms)} ms in headless Chrome`;
  }, [alice]);
  await step('merchant: private balance shows 3.00 by itself (auto-refresh)', async () => {
    await waitText(merchant, 'pBal', '/^3\\.00 tUSD/', 30000);
    await shot(merchant, 'private-received');
    return await privBal(merchant);
  }, [merchant]);
  await step('merchant: move 1 tUSD back to normal (withdraw proof)', async () => {
    const before = await usdBalance(merchant.address);
    await merchant.page.type('#pWd', '1');
    await merchant.page.click('#btnPWithdraw');
    await waitText(merchant, 'msg', '/volvieron a tu saldo normal/', PROOF_TIMEOUT);
    await waitText(merchant, 'pBal', '/^2\\.00 tUSD/', 30000);
    const after = await usdBalance(merchant.address);
    if (after - before !== U(1)) throw new Error(`plain tUSD grew ${fmt(after - before)}, want 1`);
    return `private ${await privBal(merchant)}; plain ${fmt(after)}`;
  }, [merchant]);
}

const warn = all.filter((w) => w.page).flatMap((w) => w.page.logs.filter((l) => !/favicon/.test(l)).map((l) => `[${w.name}] ${l}`));
if (warn.length) console.log('browser log (info):\n  ' + warn.slice(0, 10).join('\n  '));
await finish();
