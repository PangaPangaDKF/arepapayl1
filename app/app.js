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

const S = { cfg: null, eth: null, account: null, chainId: null, intentId: null, intent: null, mine: 0n, myConfirmed: false, allowance: 0n, timer: null };

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
    const isMerchant = S.account && it.merchant.toLowerCase() === S.account.toLowerCase();
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
      $('link').href = link; $('link').textContent = link;
      $('created').classList.remove('hidden');
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

function showTab(which) {
  $('merchant').classList.toggle('hidden', which !== 'merchant');
  $('customer').classList.toggle('hidden', which !== 'customer');
  document.body.dataset.tab = which;   // presentational: active bottom tab
  for (const [id, w] of [['tabMerchant', 'merchant'], ['tabCustomer', 'customer']]) {
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
  $('tabMerchant').onclick = () => showTab('merchant');
  $('tabCustomer').onclick = () => showTab('customer');
  $('btnCreate').onclick = createIntent;
  $('btnLoad').onclick = () => { S.intentId = $('intentId').value || null; $('share').value = ''; refreshIntent(); startPolling(); };
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
    $('netinfo').textContent = `Red: ${S.cfg.chainName} · chainId ${S.cfg.chainId} · comisión ${S.cfg.feeBps / 100}% · servicio ${API}`;
    window.__arepapayConfigLoaded = true;
  } catch (e) {
    $('netinfo').textContent = 'No se pudo cargar la configuración.';
    return err(`No se pudo leer la configuración desde ${API}/config/${NET} (${e.message}). ¿Está corriendo el servicio de onboarding?`);
  }

  S.eth = pickProvider();
  if (S.eth) {
    S.eth.on?.('chainChanged', (c) => { S.chainId = Number(c); refreshAccount(); refreshIntent(); });
    S.eth.on?.('accountsChanged', (a) => { S.account = a[0] ? ethers.getAddress(a[0]) : null; refreshAccount(); refreshIntent(); });
    try {   // silent: already-authorized accounts only, no popup (N7)
      const accs = await S.eth.request({ method: 'eth_accounts' });
      S.account = accs[0] ? ethers.getAddress(accs[0]) : null;
      S.chainId = Number(await S.eth.request({ method: 'eth_chainId' }));
    } catch {}
  } else {
    msg('Sin billetera: solo lectura. Abre en el navegador de MetaMask para pagar.');
  }

  const qi = Q.get('intent');
  if (qi && /^\d+$/.test(qi)) { S.intentId = qi; $('intentId').value = qi; showTab('customer'); startPolling(); }
  refreshAccount(); refreshIntent();
}
boot();
