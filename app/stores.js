// ArepaPay MVP — stores as payment contacts (D-034). TESTNET, no real money.
// Loaded after app.js / private.js; uses their helpers ($, S, API, sendTx, waitTx, reader, msg, err, usd, bs, onChain,
// iErc20, ERC20_ABI, paidAlert, showTab).
// - Cobrar: "Mi negocio" — the merchant picks a type (carrito de perros, panadería, recarga de agua, otro) and a name, signs
//   it with the wallet, and the store appears in every customer's contact list (service /stores).
// - Pagar: the contact list; tap a store, type the amount, see the fee, pay. The payment goes through MerchantPay: the
//   store receives amount − fee and the fee router the fee, in one transaction, with the same fee as a charge.
// - The store gets the "¡Pago recibido!" alert for these payments too (MerchantPaid logs, polled every 4 s).
'use strict';

const MP_ABI = [
  'function pay(address merchant, uint256 amount, uint16 maxFeeBps) returns (uint256)',
  'function feeBps() view returns (uint16)',
  'function MIN_AMOUNT() view returns (uint256)',
  'event MerchantPaid(uint256 indexed id, address indexed payer, address indexed merchant, uint256 amount, uint256 net, uint256 fee)',
  'error SelfPayment()', 'error BelowMinimum()', 'error FeeAbovePayerMax()', 'error ZeroAddress()', 'error UnsupportedToken()',
];
const iMP = new ethers.Interface(MP_ABI);
const CAT = {
  perros: { label: 'Carrito de perros', svg: '<path d="M3 12.5c0-1.4 1.1-2.5 2.5-2.5h13c1.4 0 2.5 1.1 2.5 2.5S19.9 15 18.5 15h-13C4.1 15 3 13.9 3 12.5z"/><path d="M5 10c.6-2 2.9-3.5 7-3.5s6.4 1.5 7 3.5"/><path d="M5 15c.6 2 2.9 3.5 7 3.5s6.4-1.5 7-3.5"/><path d="M7 12.5c1-.8 2-.8 3 0s2 .8 3 0 2-.8 3 0"/>' },
  panaderia: { label: 'Panadería', svg: '<path d="M4 15.5C4 10.8 7.6 7 12 7s8 3.8 8 8.5V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 8.2c.8 1.5 1 3.4.6 5.3M15 8.2c-.8 1.5-1 3.4-.6 5.3M12 7v6.5"/>' },
  agua: { label: 'Recarga de agua', svg: '<path d="M12 3.5c3 3.6 6 7 6 10.2a6 6 0 0 1-12 0C6 10.5 9 7.1 12 3.5z"/><path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.4"/>' },
  otro: { label: 'Otro negocio', svg: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/><path d="M10 20v-4h4v4"/>' },
};
const catIcon = (c) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">${(CAT[c] || CAT.otro).svg}</svg>`;
const catLabel = (c) => (CAT[c] || CAT.otro).label;
const storeMsg = (address, name, category, issuedAt) =>   // must match backend/onboarding/stores.mjs storeMessage()
  `ArepaPay (testnet): registrar mi negocio "${name}" (${category}) para ${address}. Emitido: ${issuedAt}`;

const ST = { list: [], mine: null, pick: null, sel: null, fee: null, busy: false, lastBlock: null, seen: new Set(), timer: null };
const mpAddr = () => S.cfg && S.cfg.merchantPay;

// ---------------------------------------------------------------- directory
async function loadStores() {
  try {
    const j = await (await fetch(`${API}/stores`)).json();
    ST.list = Array.isArray(j.stores) ? j.stores : [];
  } catch { ST.list = []; }
  ST.mine = S.account ? ST.list.find((s) => !s.demo && s.address.toLowerCase() === S.account.toLowerCase()) || null : null;
  renderContacts(); renderMine();
}

function renderContacts() {
  const box = $('contacts');
  box.textContent = '';
  const list = ST.list.filter((s) => !S.account || s.demo || s.address.toLowerCase() !== S.account.toLowerCase());
  if (!mpAddr() || !list.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const h = document.createElement('p'); h.className = 'label'; h.textContent = 'Comercios'; box.appendChild(h);
  for (const s of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'contact'; b.dataset.id = s.id;
    const ico = document.createElement('span'); ico.className = 'store-ico'; ico.innerHTML = catIcon(s.category);   // fixed SVG, no user text
    const txt = document.createElement('span'); txt.className = 'store-txt';
    const n = document.createElement('b'); n.textContent = s.name.replace(/ \(demo\)$/, '');   // user text: textContent only
    const c = document.createElement('span'); c.className = 'hint'; c.textContent = s.demo ? 'Tienda de prueba' : catLabel(s.category);
    txt.append(n, c);
    b.append(ico, txt);
    if (s.demo) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = 'demo'; b.appendChild(t); }
    b.onclick = () => openContact(s);
    box.appendChild(b);
  }
}

async function openContact(s) {
  err('');
  ST.sel = s;
  $('cIco').innerHTML = catIcon(s.category);
  $('cName').textContent = s.name; $('cCat').textContent = catLabel(s.category) + (s.demo ? ' · tienda de prueba' : '');
  $('cAmt').value = ''; $('cFee').textContent = '';
  $('cPay').classList.remove('hidden'); $('contacts').classList.add('hidden');
  try { ST.fee = Number(await new ethers.Contract(mpAddr(), MP_ABI, reader()).feeBps()); } catch { ST.fee = S.cfg.feeBps; }
  feeLine();
  $('cAmt').focus();
}
function closeContact() { ST.sel = null; $('cPay').classList.add('hidden'); renderContacts(); }

function cAmount() {
  const v = String($('cAmt').value || '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const a = ethers.parseUnits(v, S.cfg.testUsdDecimals);
  return a > 0n ? a : null;
}
function feeLine() {
  const a = cAmount();
  if (!a || ST.fee == null) { $('cFee').textContent = ST.fee == null ? '' : `Comisión ${ST.fee / 100}%`; return; }
  const fee = (a * BigInt(ST.fee)) / 10000n;
  $('cFee').textContent = `Comisión ${usd(fee)} (${ST.fee / 100}%) · ${ST.sel.demo ? 'La tienda' : 'El comercio'} recibe ${usd(a - fee)}${bs(a)}`;
}

function mpError(e) {
  const data = e?.data?.data || e?.data || e?.error?.data || e?.info?.error?.data;
  if (typeof data === 'string' && data.startsWith('0x')) {
    try {
      const n = iMP.parseError(data).name;
      return { BelowMinimum: 'El monto mínimo es 0.01.', FeeAbovePayerMax: 'La comisión cambió; vuelve a revisar el monto.', SelfPayment: 'No puedes pagarte a ti mismo.' }[n] || 'Contrato: ' + n;
    } catch {}
  }
  return e;
}

async function payContact() {
  if (ST.busy || !ST.sel) return;
  err('');
  ST.busy = true; $('btnCPay').disabled = true;
  try {
    if (!S.account) throw new Error('Conecta la billetera primero.');
    if (!onChain()) throw new Error('Cambia a la red ArepaPay L1 primero.');
    const a = cAmount();
    if (!a) throw new Error('Escribe un monto válido (máximo 2 decimales).');
    if (ST.fee == null) throw new Error('No se pudo leer la comisión.');
    const usdC = new ethers.Contract(S.cfg.testUsd, ERC20_ABI, reader());
    const [bal, allow] = await Promise.all([usdC.balanceOf(S.account), usdC.allowance(S.account, mpAddr())]);
    if (bal < a) throw new Error('No tienes saldo suficiente.');
    if (allow < a) {
      msg('Paso 1 de 2: autoriza el pago.');
      await waitTx(await sendTx(S.cfg.testUsd, iErc20.encodeFunctionData('approve', [mpAddr(), a])));
    }
    msg('Firma el pago.');
    // maxFeeBps = the fee shown on screen (review I-3): a fee change before the tx lands makes it revert, never overcharge
    const h = await sendTx(mpAddr(), iMP.encodeFunctionData('pay', [ST.sel.address, a, ST.fee]), '0x30d40');
    await waitTx(h);
    msg(`Pagaste ${usd(a)} a ${ST.sel.name}.`);
    $('cAmt').value = '';
    closeContact();
    refreshAccount();
  } catch (e) { err(mpError(e)); } finally { ST.busy = false; $('btnCPay').disabled = false; }
}

// ---------------------------------------------------------------- my store (Cobrar)
function renderMine() {
  const has = !!ST.mine, on = !!S.account && !!mpAddr();
  $('myStore').classList.toggle('hidden', !on);
  $('storeView').classList.toggle('hidden', !has || ST.editing);
  $('storeForm').classList.toggle('hidden', has && !ST.editing);
  if (has) {
    $('storeIco').innerHTML = catIcon(ST.mine.category);
    $('storeName').textContent = ST.mine.name; $('storeCat').textContent = catLabel(ST.mine.category);
  }
  document.querySelectorAll('.cat').forEach((b) => {
    const on2 = b.dataset.cat === ST.pick;
    b.classList.toggle('on', on2); b.setAttribute('aria-checked', String(on2));
  });
}
async function saveStore() {
  err('');
  const name = String($('storeNameIn').value || '').replace(/\s+/g, ' ').trim();
  if (!S.account) return err('Conecta la billetera primero.');
  if (!ST.pick) return err('Elige el tipo de negocio.');
  if (name.length < 2 || name.length > 40) return err('El nombre debe tener entre 2 y 40 caracteres.');
  const issuedAt = new Date().toISOString();
  try {
    const signature = await S.eth.request({ method: 'personal_sign', params: [ethers.hexlify(ethers.toUtf8Bytes(storeMsg(S.account, name, ST.pick, issuedAt))), S.account] });
    const r = await fetch(`${API}/stores`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: S.account, name, category: ST.pick, issuedAt, signature }) });
    const j = await r.json();
    if (!r.ok) throw new Error({ 'wallet not approved yet': 'Primero solicita acceso.', 'bad signature': 'Firma inválida.' }[j.error] || j.error || `error ${r.status}`);
    ST.editing = false;
    msg(`Tu negocio "${j.name}" ya aparece en la lista de comercios.`);
    await loadStores();
  } catch (e) { err(e); }
}

// ---------------------------------------------------------------- "¡Pago recibido!" for direct payments
async function watchDirect() {
  if (!ST.mine || !S.account || !mpAddr() || !onChain()) return;
  try {
    const p = reader();
    const head = await p.getBlockNumber();
    if (ST.lastBlock == null) { ST.lastBlock = head; return; }   // start at the head: no alerts for old payments
    if (head <= ST.lastBlock) return;
    const topic = iMP.getEvent('MerchantPaid').topicHash;
    const logs = await p.getLogs({ address: mpAddr(), fromBlock: ST.lastBlock + 1, toBlock: head,
      topics: [topic, null, null, ethers.zeroPadValue(S.account, 32)] });
    ST.lastBlock = head;
    for (const l of logs) {
      const key = `${l.transactionHash}:${l.index}`;
      if (ST.seen.has(key)) continue;
      ST.seen.add(key);
      const ev = iMP.parseLog(l);
      paidAlert(`directo ${ev.args.id}`, ev.args.net, ev.args.amount);
    }
  } catch {}
}

function storesAccountChanged() { ST.lastBlock = null; ST.editing = false; loadStores(); }

function initStores() {
  document.querySelectorAll('.cat').forEach((b) => {
    b.innerHTML = `${catIcon(b.dataset.cat)}<span>${catLabel(b.dataset.cat)}</span>`;   // fixed labels
    b.onclick = () => { ST.pick = b.dataset.cat; renderMine(); };
  });
  $('btnStoreSave').onclick = saveStore;
  $('btnStoreEdit').onclick = () => { ST.editing = true; ST.pick = ST.mine?.category || null; $('storeNameIn').value = ST.mine?.name || ''; renderMine(); };
  $('btnCPay').onclick = payContact;
  $('btnCClose').onclick = closeContact;
  $('cAmt').oninput = feeLine;
  $('cAmt').onkeydown = (e) => { if (e.key === 'Enter') payContact(); };
  loadStores();
  clearInterval(ST.timer);
  ST.timer = setInterval(watchDirect, 4000);
}
