// ArepaPay MVP test dApp (D-022). TESTNET, no real money. No framework, no build step.
// Config comes at runtime from the onboarding service (/config/<net>), which builds it from the generated config/l1 files (R7).
// Rule: click handlers send the wallet request first (no slow awaits before it) so the MetaMask popup is instant.
'use strict';
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
// Served by the onboarding service itself (single origin, stage B) -> same origin; else the dev layout (page :8080, API :8787).
const SAME_ORIGIN = location.protocol === 'https:' || (location.port !== '' && location.port !== '8080');
const API = (Q.get('api') || (SAME_ORIGIN ? location.origin : `${location.protocol}//${location.hostname || '127.0.0.1'}:8787`)).replace(/\/$/, '');
let NET = /^(local|fuji)$/.test(Q.get('net') || '') ? Q.get('net') : null;   // null -> the service's own network (/health)
const STATES = ['-', 'Abierto', 'Listo (falta confirmar)', 'Cobrado', 'Anulado'];
const ROLES = ['sin acceso', 'habilitado', 'admin', 'manager'];

const ESCROW_ABI = [
  'function createIntent(uint256 total, uint64 expiry, uint8 maxPayers, bool requireConfirm, uint16 maxFeeBps) returns (uint256)',
  'function authorize(uint256 id, uint256 amount)',
  'function confirm(uint256 id)',
  'function withdraw(uint256 id)',
  'function cancel(uint256 id)',
  'function intents(uint256) view returns (address merchant, uint64 expiry, uint16 feeBps, uint8 maxPayers, uint8 payerCount, uint8 confirmedCount, bool requireConfirm, uint8 state, uint256 total, uint256 covered)',
  'function holdOf(uint256, address) view returns (uint256)',
  'function confirmed(uint256, address) view returns (bool)',
  'function feeBps() view returns (uint16)',
  'event IntentCreated(uint256 indexed id, address indexed merchant, uint256 total, uint64 expiry, uint16 feeBps, uint8 maxPayers, bool requireConfirm)',
  'error ZeroAmount()', 'error BadExpiry()', 'error TooManyPayers()', 'error NotOpen()', 'error NotReady()', 'error Expired()',
  'error MerchantCannotPay()', 'error NotMerchant()', 'error NotPayer()', 'error AlreadyConfirmed()', 'error NotVoidable()',
  'error NothingToWithdraw()', 'error ShareTooSmall()', 'error FeeAboveMerchantMax()',
];
const ERC20_ABI = [
  'function approve(address, uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)',
];
const AL_ABI = ['function readAllowList(address) view returns (uint256)'];
const iEscrow = new ethers.Interface(ESCROW_ABI);
const iErc20 = new ethers.Interface(ERC20_ABI);

const S = { cfg: null, eth: null, account: null, chainId: null, intentId: null, intent: null, mine: 0n, myConfirmed: false, allowance: 0n, timer: null,
  lastState: {}, alerted: new Set() };   // per-charge last seen state + charges already announced (payment alert fires once)

// ---------------------------------------------------------------- helpers
const msg = (t) => { $('msg').textContent = t || ''; };
const err = (e) => { $('err').textContent = e ? niceError(e) : ''; };
const usd = (v) => (S.cfg ? `${ethers.formatUnits(v, S.cfg.testUsdDecimals)} ${S.cfg.testUsdSymbol}` : '-');
const rate = () => Number($('rate').value) || 0;
const bs = (v) => (rate() > 0 && S.cfg ? ` ≈ Bs ${(Number(ethers.formatUnits(v, S.cfg.testUsdDecimals)) * rate()).toFixed(2)}` : '');
const onChain = () => S.cfg && S.chainId === S.cfg.chainId;
const hexChain = () => '0x' + S.cfg.chainId.toString(16);

function niceError(e) {
  const data = e?.data?.data || e?.data || e?.error?.data || e?.info?.error?.data;
  if (typeof data === 'string' && data.startsWith('0x')) {
    for (const i of [iEscrow, iErc20]) { try { return 'Contrato: ' + i.parseError(data).name; } catch {} }
  }
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED') return 'Rechazado en la billetera.';
  return String(e?.shortMessage || e?.message || e).split('\n')[0].slice(0, 300);
}

// EVM provider: window.ethereum, or the MetaMask/EVM entry of providers[] (skip TRON wallets).
function pickProvider() {
  const w = window.ethereum;
  if (!w) return null;
  const list = Array.isArray(w.providers) && w.providers.length ? w.providers : [w];
  const evm = list.filter((p) => p && typeof p.request === 'function' && !p.isTronLink && !p.isTron && !p.tron);
  return evm.find((p) => p.isMetaMask) || evm[0] || null;
}

// Read provider: the wallet when it is on our chain, else the config RPC.
let rpcProvider;
function reader() {
  if (S.eth && onChain()) return new ethers.BrowserProvider(S.eth, S.cfg.chainId);
  rpcProvider = rpcProvider || new ethers.JsonRpcProvider(S.cfg.rpcUrl, S.cfg.chainId, { staticNetwork: true });
  return rpcProvider;
}

// Send straight to the wallet (eth_sendTransaction). No estimate/nonce awaits first: the popup opens at once.
function sendTx(to, data, gas) {
  if (!S.eth || !S.account) return Promise.reject(new Error('Conecta la billetera primero.'));
  if (!onChain()) return Promise.reject(new Error('Cambia a la red ArepaPay L1 primero.'));
  return S.eth.request({ method: 'eth_sendTransaction', params: [{ from: S.account, to, data, ...(gas ? { gas } : {}) }] });
}
async function waitTx(hash) {
  msg('Esperando confirmación… ' + hash.slice(0, 12));
  for (let i = 0; i < 120; i++) {
    const r = await S.eth.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (r) {
      if (r.status !== '0x1') throw new Error('La transacción falló (revert). ' + hash);
      return r;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error('Sin confirmación todavía: ' + hash);
}

// ---------------------------------------------------------------- refresh
async function refreshAccount() {
  document.body.classList.toggle('is-connected', !!S.account);   // presentational: hero vs balance card
  document.body.classList.toggle('on-chain', !!onChain());         // presentational: hide the network button
  if (!S.account) document.body.classList.remove('has-access');
  $('addr').textContent = S.account || '-';
  $('chain').textContent = S.chainId == null ? '-' : (onChain() ? `ArepaPay L1 (${S.chainId})` : `otra red (${S.chainId}): cambia a ArepaPay`);
  if (!S.account || !S.cfg) return;
  try {
    const p = reader();
    const usdC = new ethers.Contract(S.cfg.testUsd, ERC20_ABI, p);
    const al = new ethers.Contract(S.cfg.txAllowList, AL_ABI, p);
    const [nat, bal, role, allow] = await Promise.all([
      p.getBalance(S.account), usdC.balanceOf(S.account), al.readAllowList(S.account), usdC.allowance(S.account, S.cfg.splitPayEscrow),
    ]);
    S.allowance = allow;
    $('native').textContent = `${Number(ethers.formatEther(nat)).toFixed(4)} ${S.cfg.nativeSymbol}`;
    $('usd').textContent = usd(bal) + bs(bal);
    let st = '';
    try { st = (await (await fetch(`${API}/status/${S.account}`)).json()).status; } catch { st = 'servicio no disponible'; }
    const stEs = { none: 'sin solicitud', pending: 'pendiente', approved: 'aprobada' }[st] || st;
    $('access').textContent = `${ROLES[Number(role)] || role} (solicitud: ${stEs})`;
    $('access').className = Number(role) > 0 ? 'ok' : '';
    document.body.classList.toggle('has-access', Number(role) > 0);   // presentational: hide "Solicitar acceso"
  } catch (e) { err(e); }
}

async function refreshIntent() {
  if (!S.intentId || !S.cfg) return;
  try {
    const esc = new ethers.Contract(S.cfg.splitPayEscrow, ESCROW_ABI, reader());
    const it = await esc.intents(S.intentId);
    S.intent = it;
    if (S.account) { [S.mine, S.myConfirmed] = await Promise.all([esc.holdOf(S.intentId, S.account), esc.confirmed(S.intentId, S.account)]); }
    const state = Number(it.state);
    const isMerchant = !!S.account && it.merchant.toLowerCase() === S.account.toLowerCase();
    const prev = S.lastState[S.intentId];
    S.lastState[S.intentId] = state;
    // Payment alert: only on a live transition to Cobrado that this page saw, for the merchant, once per charge.
    if (isMerchant && state === 3 && prev !== undefined && prev !== 3 && !S.alerted.has(S.intentId)) {
      S.alerted.add(S.intentId);
      paidAlert(S.intentId, it.total - (it.total * BigInt(it.feeBps)) / 10000n, it.total);
    }
    $('iState').dataset.s = state;   // presentational: badge color
    $('intentBox').classList.remove('hidden');
    $('iId').textContent = S.intentId;
    if (state === 0) { $('iState').textContent = 'No existe'; return; }
    const now = Math.floor(Date.now() / 1000);
    const expired = now >= Number(it.expiry);
    const fee = (it.total * BigInt(it.feeBps)) / 10000n;
    const remaining = it.total - it.covered;
    $('iState').textContent = STATES[state] + (expired && (state === 1 || state === 2) ? ' (vencido)' : '');
    $('iTotal').textContent = usd(it.total) + bs(it.total);
    $('iCovered').textContent = usd(it.covered);
    $('iRemaining').textContent = usd(remaining);
    $('iFee').textContent = `${usd(fee)} (${Number(it.feeBps) / 100}%)`;
    $('iNet').textContent = usd(it.total - fee);
    $('iPayers').textContent = `${it.payerCount}/${it.maxPayers}${it.requireConfirm ? `, confirmados ${it.confirmedCount}` : ''}`;
    $('iExpiry').textContent = new Date(Number(it.expiry) * 1000).toLocaleTimeString();
    $('iMine').textContent = usd(S.mine);
    // the one visible detail line (D-034): the fee is always shown before paying
    $('iSummary').textContent = state === 1 || state === 2
      ? `Comisión ${usd(fee)} (${Number(it.feeBps) / 100}%) · Falta ${usd(remaining)}`
      : `Comisión ${usd(fee)} · Comercio recibe ${usd(it.total - fee)}`;
    const canPay = state === 1 && !expired && !isMerchant;
    $('payBox').classList.toggle('hidden', !canPay);
    if (canPay && !$('share').value) $('share').value = ethers.formatUnits(remaining, S.cfg.testUsdDecimals);
    $('btnConfirm').classList.toggle('hidden', !(state === 2 && !expired && S.mine > 0n && !S.myConfirmed));
    $('btnWithdraw').classList.toggle('hidden', !(S.mine > 0n && (state === 4 || ((state === 1 || state === 2) && expired))));
    $('btnCancel').classList.toggle('hidden', !(isMerchant && (state === 1 || state === 2)));
  } catch (e) { err(e); }
}

function startPolling() {
  clearInterval(S.timer);
  S.timer = setInterval(() => { refreshIntent(); }, 3000);
}

// ---------------------------------------------------------------- actions
async function connect() {
  err('');
  if (!S.eth) return err('No hay billetera. Abre esta página en el navegador de MetaMask.');
  try {
    const accs = await S.eth.request({ method: 'eth_requestAccounts' });
    S.account = accs[0] ? ethers.getAddress(accs[0]) : null;
    S.chainId = Number(await S.eth.request({ method: 'eth_chainId' }));
    await refreshAccount(); await refreshIntent();
    if (typeof loadStores === 'function') loadStores();   // my store + contacts depend on the account (D-034)
  } catch (e) { err(e); }
}

async function addNetwork() {
  err('');
  if (!S.eth) return err('No hay billetera. Abre esta página en el navegador de MetaMask.');
  if (!S.cfg) return err('Configuración no cargada.');
  const chainId = hexChain();
  try {
    await S.eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (e) {
    try {
      await S.eth.request({ method: 'wallet_addEthereumChain', params: [{
        chainId, chainName: S.cfg.chainName, rpcUrls: [S.cfg.rpcUrl],
        nativeCurrency: { name: S.cfg.nativeSymbol, symbol: S.cfg.nativeSymbol, decimals: 18 },
      }] });
    } catch (e2) { return err(e2); }
  }
  S.chainId = Number(await S.eth.request({ method: 'eth_chainId' }));
  refreshAccount();
}

// Telegram payment alerts (D-031). The text must match backend/onboarding/telegram.mjs linkMessage().
const tgMessage = (address, issuedAt) => `ArepaPay (testnet): activar avisos de pago por Telegram para ${address}. Emitido: ${issuedAt}`;
async function linkTelegram() {
  err('');
  if (!S.eth || !S.account) return err('Conecta la billetera primero.');
  const issuedAt = new Date().toISOString();
  try {
    const signature = await S.eth.request({ method: 'personal_sign', params: [ethers.hexlify(ethers.toUtf8Bytes(tgMessage(S.account, issuedAt))), S.account] });
    const r = await fetch(`${API}/tg/link`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: S.account, issuedAt, signature }) });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || `error ${r.status}`);
    const a = $('tgLink'); a.href = j.url; a.classList.remove('hidden');
    $('tgHint').textContent = 'Abre Telegram y toca "Iniciar" para activar los avisos.';
    try { window.open(j.url, '_blank'); } catch {}   // blocked popup -> the visible link above still works
  } catch (e) { err(e); }
}
async function initTelegram() {
  try { const j = await (await fetch(`${API}/tg/info`)).json(); $('tgBox').classList.toggle('hidden', !j.enabled); } catch {}
}

async function requestAccess() {
  err('');
  if (!S.account) return err('Conecta la billetera primero.');
  try {
    msg('Enviando solicitud…');
    const r = await fetch(`${API}/request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: S.account }) });
    const j = await r.json();
    msg(`Solicitud: ${j.status}${j.error ? ' (' + j.error + ')' : ''}`);
    refreshAccount();
  } catch (e) { err(e); }
}

function parseUsd(v) {
  const n = ethers.parseUnits(String(v || '0'), S.cfg.testUsdDecimals);
  if (n <= 0n) throw new Error('Monto inválido.');
  return n;
}

function createIntent() {
  err('');
  audioCtx();   // unlock WebAudio inside this tap so the payment beep can play later
  let total, data;
  try {
    total = parseUsd($('amount').value);
    const split = $('split').checked;
    const maxPayers = split ? Math.min(10, Math.max(2, Number($('maxPayers').value) || 2)) : 1;
    const requireConfirm = split && $('needConfirm').checked;
    const ttl = Math.min(1440, Math.max(2, Number($('ttl').value) || 10)) * 60;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    data = iEscrow.encodeFunctionData('createIntent', [total, expiry, maxPayers, requireConfirm, S.cfg.feeBps]);
  } catch (e) { return err(e); }
  sendTx(S.cfg.splitPayEscrow, data)   // popup first
    .then(waitTx)
    .then((r) => {
      const log = r.logs.map((l) => { try { return iEscrow.parseLog(l); } catch { return null; } }).find((l) => l && l.name === 'IntentCreated');
      if (!log) throw new Error('No se encontró el cobro en el recibo.');
      const id = log.args.id.toString();
      const link = `${location.origin}${location.pathname}?intent=${id}${NET !== 'local' ? '&net=' + NET : ''}${Q.get('api') ? '&api=' + encodeURIComponent(API) : ''}`;
      const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
      $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      $('link').href = link; $('link').textContent = 'Copiar enlace';   // the QR carries the link; the raw URL is not shown
      $('created').classList.remove('hidden');
      $('newCharge').classList.add('hidden');
      msg(`Cobro #${id} creado.`);
      S.intentId = id; refreshIntent(); startPolling();
    })
    .catch(err);
}

function pay() {
  err('');
  let share;
  try { share = parseUsd($('share').value); } catch (e) { return err(e); }
  const id = S.intentId;
  const authData = iEscrow.encodeFunctionData('authorize', [id, share]);
  const doAuth = () => sendTx(S.cfg.splitPayEscrow, authData).then(waitTx);
  const first = S.allowance >= share
    ? doAuth()
    : sendTx(S.cfg.testUsd, iErc20.encodeFunctionData('approve', [S.cfg.splitPayEscrow, share])) // popup first
        .then(waitTx).then(() => { msg('Aprobado. Ahora autoriza el pago…'); return doAuth(); });
  first.then(() => { msg('Pago autorizado.'); $('share').value = ''; refreshAccount(); refreshIntent(); }).catch(err);
}

// withdraw gets a fixed gas limit: the node estimates against the last block's timestamp, which on an idle chain
// is still before expiry, so estimating a withdraw-after-expiry would wrongly revert.
function simple(fn, okText, gas) {
  return () => {
    err('');
    sendTx(S.cfg.splitPayEscrow, iEscrow.encodeFunctionData(fn, [S.intentId]), gas)
      .then(waitTx).then(() => { msg(okText); refreshAccount(); refreshIntent(); }).catch(err);
  };
}

function newCharge() {
  clearInterval(S.timer);
  S.intentId = null; S.intent = null;
  $('created').classList.add('hidden'); $('newCharge').classList.remove('hidden');
  $('intentBox').classList.add('hidden'); $('qr').innerHTML = ''; $('amount').value = ''; $('amountBs').textContent = '';
  msg(''); err('');
  $('amount').focus();
}

// ---------------------------------------------------------------- load a charge (deep link, manual entry, scanned QR)
// A v2 QR / share link is <origin>/app/?intent=<id>&net=<net>; a bare number (optionally "#12") is accepted too.
function parseIntentRef(raw) {
  const s = String(raw || '').trim();
  if (/^#?\d+$/.test(s)) return { id: s.replace('#', ''), net: null };
  let u;
  try { u = new URL(s, location.href); } catch { return null; }
  const id = u.searchParams.get('intent');
  return id && /^\d+$/.test(id) ? { id, net: u.searchParams.get('net') } : null;
}

// Same path as the ?intent= deep link: set the id, switch to Pagar, refresh now and keep polling.
function loadIntent(id) {
  S.intentId = id; $('intentId').value = id; $('share').value = '';
  showTab('customer');
  refreshIntent().then(() => { if (!$('intentBox').classList.contains('hidden')) $('intentBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  startPolling();
}

function loadRef(raw) {
  err(''); $('scanMsg').textContent = '';
  const r = parseIntentRef(raw);
  if (!r) { $('scanMsg').textContent = 'No reconozco ese cobro. Escribe el número (ej. 12) o pega el enlace.'; return false; }
  if (r.net && /^(local|fuji)$/.test(r.net) && r.net !== NET) { $('scanMsg').textContent = `Ese cobro es de otra red (${r.net}).`; return false; }
  loadIntent(r.id);
  return true;
}

// ---------------------------------------------------------------- QR scanner (port of v1 QRScanner.jsx)
// getUserMedia (rear camera) -> <video> -> canvas -> jsQR in a requestAnimationFrame loop; tracks stop on success/close.
// jsQR is loaded on demand from jsDelivr, pinned + SRI (sha384 of jsqr@1.4.0/dist/jsQR.js, computed from the file).
const JSQR_SRC = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';
let jsqrP = null;
function loadJsQR() {
  if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
  jsqrP = jsqrP || new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = JSQR_SRC; sc.integrity = JSQR_SRI; sc.crossOrigin = 'anonymous';
    sc.onload = () => (typeof window.jsQR === 'function' ? res(window.jsQR) : rej(new Error('jsQR')));
    sc.onerror = () => { jsqrP = null; sc.remove(); rej(new Error('No se pudo cargar el lector de QR. Revisa tu conexión.')); };
    document.head.appendChild(sc);
  });
  return jsqrP;
}

const SCAN = { active: false, stream: null, raf: 0 };
function camError(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Permiso de cámara denegado. Actívalo en el navegador o escribe el número del cobro.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No se encontró una cámara. Escribe el número o pega el enlace del cobro.';
  if (n === 'NotReadableError') return 'La cámara está en uso por otra app. Ciérrala o escribe el número del cobro.';
  return e?.message && !n ? e.message : `No se pudo abrir la cámara${n ? ' (' + n + ')' : ''}. Escribe el número del cobro.`;
}
function scanFail(text) {
  closeScanner();
  $('scanMsg').textContent = text;
  $('intentId').focus();
}
async function openScanner() {
  err(''); $('scanMsg').textContent = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    return scanFail(window.isSecureContext ? 'Este navegador no permite usar la cámara. Escribe el número o pega el enlace.'
      : 'La cámara necesita una conexión segura (https). Escribe el número o pega el enlace.');
  }
  SCAN.active = true;
  $('scanHint').textContent = 'Apunta la cámara al QR del comercio'; $('scanHint').classList.remove('warn');
  $('scanner').classList.remove('hidden'); document.body.classList.add('no-scroll');
  const video = $('scanVideo');
  let decode;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (!SCAN.active) { stream.getTracks().forEach((t) => t.stop()); return; }
    SCAN.stream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
    decode = await loadJsQR();
  } catch (e) { return scanFail(camError(e)); }
  if (!SCAN.active) return;
  const canvas = $('scanCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let lastBad = '';
  const tick = () => {
    if (!SCAN.active) return;
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
      const k = Math.min(1, 640 / video.videoWidth);   // downscale big frames: faster decode on phones
      canvas.width = Math.round(video.videoWidth * k); canvas.height = Math.round(video.videoHeight * k);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = decode(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        if (typeof parsePrivRef === 'function' && parsePrivRef(code.data)) { closeScanner(); loadPrivRef(code.data); return; }   // D-032
        if (parseIntentRef(code.data)) { closeScanner(); if (navigator.vibrate) try { navigator.vibrate(60); } catch {} loadRef(code.data); return; }
        if (code.data !== lastBad) { lastBad = code.data; $('scanHint').textContent = 'Ese QR no es un cobro de ArepaPay.'; $('scanHint').classList.add('warn'); }
      }
    }
    SCAN.raf = requestAnimationFrame(tick);
  };
  tick();
}
function closeScanner() {
  SCAN.active = false;
  cancelAnimationFrame(SCAN.raf);
  if (SCAN.stream) SCAN.stream.getTracks().forEach((t) => t.stop());
  SCAN.stream = null;
  $('scanVideo').srcObject = null;
  $('scanner').classList.add('hidden'); document.body.classList.remove('no-scroll');
}

// ---------------------------------------------------------------- payment received alert (merchant)
let actx = null;
function audioCtx() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
  } catch { actx = null; }
  return actx;
}
function beep() {
  const c = audioCtx();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  [[880, 0], [1320, 0.18]].forEach(([f, d]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
    o.connect(g).connect(c.destination);
    o.start(t0 + d); o.stop(t0 + d + 0.18);
  });
}
function paidAlert(id, net, total) {
  $('paidAmount').textContent = usd(total);
  const what = String(id).startsWith('directo') ? 'Pago directo' : `Cobro #${id}`;   // D-034: contact payments too
  $('paidSub').textContent = `${what} · recibes ${usd(net)}${bs(total)}`;
  $('paidAlert').classList.remove('hidden');
  try { beep(); } catch {}
  try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate([200, 100, 200]); } catch {}
  refreshAccount();   // the balance just changed
  $('btnPaidOk').focus();
}
function closePaid() { $('paidAlert').classList.add('hidden'); }

function showTab(which) {
  $('merchant').classList.toggle('hidden', which !== 'merchant');
  $('customer').classList.toggle('hidden', which !== 'customer');
  $('private').classList.toggle('hidden', which !== 'private');
  document.body.dataset.tab = which;   // presentational: active bottom tab
  for (const [id, w] of [['tabMerchant', 'merchant'], ['tabCustomer', 'customer'], ['tabPrivate', 'private']]) {
    $(id).classList.toggle('active', which === w); $(id).setAttribute('aria-pressed', String(which === w));
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  try { $('rate').value = localStorage.getItem('arepapay.rate') || '0'; } catch {}
  $('rate').oninput = () => { try { localStorage.setItem('arepapay.rate', $('rate').value); } catch {} updateBs(); refreshIntent(); };
  const updateBs = () => { try { $('amountBs').textContent = S.cfg && $('amount').value ? bs(parseUsd($('amount').value)) : ''; } catch { $('amountBs').textContent = ''; } };
  $('amount').oninput = updateBs;
  $('split').onchange = () => $('splitOpts').classList.toggle('hidden', !$('split').checked);
  $('btnNet').onclick = addNetwork;
  $('btnConnect').onclick = connect;
  $('btnRequest').onclick = requestAccess;
  $('tabMerchant').onclick = $('chooseMerchant').onclick = () => { audioCtx(); showTab('merchant'); };
  $('tabCustomer').onclick = $('chooseCustomer').onclick = () => { showTab('customer'); loadJsQR().catch(() => {}); };   // prefetch the QR reader
  $('btnCreate').onclick = createIntent;
  $('btnNewCharge').onclick = newCharge;
  $('link').onclick = (e) => {   // copy instead of navigating; if the clipboard is blocked, the link just opens
    if (!navigator.clipboard?.writeText) return;
    e.preventDefault();
    navigator.clipboard.writeText($('link').href).then(() => msg('Enlace copiado.'), () => { location.href = $('link').href; });
  };
  $('btnTelegram').onclick = linkTelegram;
  initTelegram();
  $('btnLoad').onclick = () => loadRef($('intentId').value);
  $('intentId').onkeydown = (e) => { if (e.key === 'Enter') loadRef($('intentId').value); };
  $('btnScan').onclick = openScanner;
  $('btnScanClose').onclick = closeScanner;
  $('btnPaidOk').onclick = closePaid;
  $('paidAlert').onclick = (e) => { if (e.target === $('paidAlert')) closePaid(); };
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; closePaid(); if (SCAN.active) closeScanner(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && SCAN.active) closeScanner(); });   // release the camera
  $('btnPay').onclick = pay;
  $('btnConfirm').onclick = simple('confirm', 'Pago confirmado.');
  $('btnWithdraw').onclick = simple('withdraw', 'Tu parte fue devuelta.', '0x30d40');
  $('btnCancel').onclick = simple('cancel', 'Cobro cancelado.');

  try {
    if (!NET) { try { NET = (await (await fetch(`${API}/health`)).json()).net; } catch {} }
    if (!/^(local|fuji)$/.test(NET || '')) NET = 'local';
    const r = await fetch(`${API}/config/${NET}`);
    if (!r.ok) throw new Error(`config ${NET}: HTTP ${r.status}`);
    S.cfg = await r.json();
    $('netinfo').textContent = `Red: ${S.cfg.chainName} · comisión ${S.cfg.feeBps / 100}%`;   // no host URL on screen (user, 2026-11-16)
    window.__arepapayConfigLoaded = true;
    if (typeof initPrivate === 'function') initPrivate();   // app/private.js (D-032)
    if (typeof initStores === 'function') initStores();     // app/stores.js (D-034)
  } catch (e) {
    $('netinfo').textContent = 'No se pudo cargar la configuración.';
    return err(`No se pudo leer la configuración desde ${API}/config/${NET} (${e.message}). ¿Está corriendo el servicio de onboarding?`);
  }

  S.eth = pickProvider();
  if (S.eth) {
    S.eth.on?.('chainChanged', (c) => { S.chainId = Number(c); refreshAccount(); refreshIntent(); });
    S.eth.on?.('accountsChanged', (a) => { S.account = a[0] ? ethers.getAddress(a[0]) : null; refreshAccount(); refreshIntent(); if (typeof privAccountChanged === 'function') privAccountChanged(); if (typeof storesAccountChanged === 'function') storesAccountChanged(); });
    try {   // silent: already-authorized accounts only, no popup (N7)
      const accs = await S.eth.request({ method: 'eth_accounts' });
      S.account = accs[0] ? ethers.getAddress(accs[0]) : null;
      S.chainId = Number(await S.eth.request({ method: 'eth_chainId' }));
    } catch {}
  } else {
    msg('Sin billetera: solo lectura. Abre en el navegador de MetaMask para pagar.');
  }

  if (typeof loadPrivRef === 'function' && Q.get('pto')) loadPrivRef(location.href);   // private-pay link (D-032)
  const qi = Q.get('intent');
  if (qi && /^\d+$/.test(qi)) { S.intentId = qi; $('intentId').value = qi; showTab('customer'); startPolling(); }
  refreshAccount(); refreshIntent();
  if (typeof loadStores === 'function') loadStores();
}
boot();
