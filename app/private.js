// ArepaPay MVP — saldo privado (encrypted balances with eERC, D-032). TESTNET, no real money.
// Loaded after app.js and uses its helpers ($, S, sendTx, waitTx, reader, msg, err, onChain). Crypto + proofs live in
// vendor/eerc-lib.js (global ArepaEerc, built from scripts/eerc/browser) and circuits/ (snarkjs + pinned wasm/zkey), both
// loaded only when this tab is used.
//
// What is private: amounts and balances (encrypted to the owner's key, plus a copy of each transfer amount for the bank's
// auditor key). What is NOT private: who sends to whom, and the amounts entering (Pasar a privado) and leaving (Pasar a
// saldo normal), which are plain ERC-20 moves. The page says so.
'use strict';

const PRIV_REG_ABI = [
  'function register(((uint256[2] a, uint256[2][2] b, uint256[2] c) proofPoints, uint256[5] publicSignals) proof)',
  'function isUserRegistered(address) view returns (bool)',
  'function getUserPublicKey(address) view returns (uint256[2])',
];
const PRIV_EERC_ABI = [
  'function deposit(uint256 amount, address tokenAddress, uint256[7] amountPCT)',
  'function transfer(address to, uint256 tokenId, ((uint256[2] a, uint256[2][2] b, uint256[2] c) proofPoints, uint256[32] publicSignals) proof, uint256[7] balancePCT)',
  'function withdraw(uint256 tokenId, ((uint256[2] a, uint256[2][2] b, uint256[2] c) proofPoints, uint256[16] publicSignals) proof, uint256[7] balancePCT)',
  'function balanceOf(address user, uint256 tokenId) view returns (((uint256 x, uint256 y) c1, (uint256 x, uint256 y) c2) eGCT, uint256 nonce, (uint256[7] pct, uint256 index)[] amountPCTs, uint256[7] balancePCT, uint256 transactionIndex)',
  'function tokenIds(address) view returns (uint256)',
  'function auditorPublicKey() view returns (uint256 x, uint256 y)',
  'error InvalidProof()', 'error UserNotRegistered()', 'error AuditorKeyNotSet()', 'error InvalidOperation()',
];
const iPReg = new ethers.Interface(PRIV_REG_ABI);
const iPEerc = new ethers.Interface(PRIV_EERC_ABI);
// Gas limits sent with the wallet request, with margin over S2's measurements (docs/spikes/S2.md §4): register 320k,
// first deposit 634k, transfer 0.96–1.14M, withdraw 860k. At 25 gwei a transfer costs ~0.03 ARPB.
const PGAS = { register: '0x7a120', deposit: '0xc3500', transfer: '0x186a00', withdraw: '0x155cc0' };

const P = { key: null, keyFor: null, registered: false, cents: 0n, egct: null, verified: false, busy: false, libP: null };

const deep = (r) => (r && typeof r === 'object' && typeof r.length === 'number' ? Array.from(r, deep) : r);
const ecfg = () => S.cfg && S.cfg.eerc;
const pBase = () => new URL(ecfg().circuits, location.href).href.replace(/\/$/, '');
const centsText = (c) => { const n = BigInt(c); return money(`${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`); };
function parseCents(v) {
  const s = String(v || '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Monto inválido (máximo 2 decimales).');
  const [a, b = ''] = s.split('.');
  const c = BigInt(a) * 100n + BigInt((b + '00').slice(0, 2));
  if (c <= 0n) throw new Error('Monto inválido.');
  return c;
}

function loadScriptOnce(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const sc = document.createElement('script');
    sc.src = src; sc.dataset.src = src;
    sc.onload = () => res();
    sc.onerror = () => { sc.remove(); rej(new Error(`No se pudo cargar ${src}. Revisa tu conexión.`)); };
    document.head.appendChild(sc);
  });
}
function privLib() {
  P.libP = P.libP || Promise.all([loadScriptOnce('vendor/eerc-lib.js'), loadScriptOnce(`${ecfg().circuits}/snarkjs.min.js`)])
    .then(() => window.ArepaEerc).catch((e) => { P.libP = null; throw e; });
  return P.libP;
}

function pView() {
  const on = !!ecfg();
  $('pOff').classList.toggle('hidden', on);
  const unlocked = on && P.key && P.keyFor === S.account;
  $('pLocked').classList.toggle('hidden', !on || unlocked);
  $('pRegister').classList.toggle('hidden', !unlocked || P.registered);
  $('pOpen').classList.toggle('hidden', !unlocked || !P.registered);
  for (const id of ['btnPUnlock', 'btnPRegister', 'btnPDeposit', 'btnPSend', 'btnPWithdraw']) $(id).disabled = P.busy;
}

function privAccountChanged() {   // a different wallet must sign again: never reuse another account's key
  if (P.keyFor !== S.account) { P.key = null; P.keyFor = null; P.registered = false; P.cents = 0n; }
  pView();
}

async function privRefresh() {
  if (!ecfg() || !P.key || !S.account) return pView();
  const e = ecfg();
  const p = reader();
  const reg = new ethers.Contract(e.registrar, PRIV_REG_ABI, p);
  P.registered = await reg.isUserRegistered(S.account);
  if (P.registered) {
    const eerc = new ethers.Contract(e.encryptedERC, PRIV_EERC_ABI, p);
    const tokenId = await eerc.tokenIds(e.token);
    const lib = await privLib();
    const bal = tokenId === 0n ? [[[0n, 0n], [0n, 0n]], 0n, [], [0n, 0n, 0n, 0n, 0n, 0n, 0n], 0n] : deep(await eerc.balanceOf(S.account, tokenId));
    const d = lib.decryptBalance(P.key, bal);
    P.cents = d.cents; P.egct = d.egct; P.verified = d.verified; P.tokenId = tokenId;
    $('pBal').textContent = d.verified ? centsText(d.cents) : 'no se pudo verificar';
    $('pBalNote').textContent = d.verified ? 'Descifrado en tu teléfono. En la cadena solo se ve cifrado.' : 'El historial cifrado no coincide con el saldo. No envíes hasta revisarlo.';
    const link = `${location.origin}${location.pathname}?pto=${S.account}${NET !== 'local' ? '&net=' + NET : ''}`;
    try { const qr = qrcode(0, 'M'); qr.addData(link); qr.make(); $('pQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch {}
    $('pMe').textContent = S.account;
  }
  pView();
}

// One job at a time; errors go to the shared error line.
async function privJob(fn) {
  if (P.busy) return;
  err(''); P.busy = true; pView();
  try { await fn(); } catch (e) { err(privError(e)); } finally { P.busy = false; pView(); }
}
function privError(e) {
  const data = e?.data?.data || e?.data || e?.error?.data || e?.info?.error?.data;
  if (typeof data === 'string' && data.startsWith('0x')) {
    for (const i of [iPEerc, iPReg]) { try { return 'Contrato: ' + i.parseError(data).name; } catch {} }
  }
  return e;
}
function needReady() {
  if (!S.account) throw new Error('Conecta la billetera primero.');
  if (!onChain()) throw new Error('Cambia a la red ArepaPay L1 primero.');
}

async function privUnlock() {
  return privJob(async () => {
    needReady();
    const lib = privLib();   // start downloading while the wallet asks for the signature
    const account = S.account;
    const signature = await S.eth.request({ method: 'personal_sign', params: [ethers.hexlify(ethers.toUtf8Bytes((await lib).registerMessage(account))), account] });
    P.key = await (await lib).keyFromSignature(signature);
    P.keyFor = account;
    msg('Llave de lectura lista (solo en esta página).');
    await privRefresh();
    (await lib).preload(pBase(), P.registered ? 'transfer' : 'registration').catch(() => {});
  });
}

async function privRegister() {
  return privJob(async () => {
    needReady();
    const lib = await privLib();
    msg('Creando la prueba de registro…');
    const { proof, ms } = await lib.prove(pBase(), 'registration', lib.registrationInput(P.key, S.account, BigInt(S.cfg.chainId)));
    msg(`Prueba lista en ${(ms / 1000).toFixed(1)} s. Firma la transacción.`);
    const h = await sendTx(ecfg().registrar, iPReg.encodeFunctionData('register', [proof]), PGAS.register);
    await waitTx(h);
    msg('Saldo privado activado.');
    await privRefresh();
    lib.preload(pBase(), 'transfer').catch(() => {});
  });
}

async function privDeposit() {
  return privJob(async () => {
    needReady();
    const e = ecfg();
    const cents = parseCents($('pDep').value);
    const raw = cents * 10n ** BigInt(e.tokenDecimals - e.eercDecimals);
    const lib = await privLib();
    const usdC = new ethers.Contract(e.token, ERC20_ABI, reader());
    if ((await usdC.balanceOf(S.account)) < raw) throw new Error('No tienes suficiente saldo normal.');
    if ((await usdC.allowance(S.account, e.encryptedERC)) < raw) {
      msg('Paso 1 de 2: autoriza el monto.');
      await waitTx(await sendTx(e.token, iErc20.encodeFunctionData('approve', [e.encryptedERC, raw])));
    }
    msg('Firma el paso a privado.');
    const h = await sendTx(e.encryptedERC, iPEerc.encodeFunctionData('deposit', [raw, e.token, lib.depositPCT(P.key, cents)]), PGAS.deposit);
    await waitTx(h);
    $('pDep').value = '';
    msg(`${centsText(cents)} pasaron a tu saldo privado.`);
    await privRefresh(); refreshAccount();
  });
}

async function privSend() {
  return privJob(async () => {
    needReady();
    const e = ecfg();
    let to;
    try { to = ethers.getAddress($('pTo').value.trim()); } catch { throw new Error('Dirección inválida.'); }
    if (to === S.account) throw new Error('No puedes enviarte a ti mismo.');
    const cents = parseCents($('pAmt').value);
    await privRefresh();
    if (!P.verified) throw new Error('Tu saldo privado no se pudo verificar.');
    if (cents > P.cents) throw new Error('No tienes suficiente saldo privado.');
    const p = reader();
    const reg = new ethers.Contract(e.registrar, PRIV_REG_ABI, p);
    if (!(await reg.isUserRegistered(to))) throw new Error('Quien recibe todavía no activó su saldo privado.');
    const recv = deep(await reg.getUserPublicKey(to)).map(BigInt);
    const aud = deep(await new ethers.Contract(e.encryptedERC, PRIV_EERC_ABI, p).auditorPublicKey()).map(BigInt);
    const lib = await privLib();
    const { input, balancePCT } = lib.transferInput(P.key, P.cents, P.egct, recv, aud, cents);
    msg('Creando la prueba de privacidad… (puede tardar hasta un minuto)');
    const { proof, ms } = await lib.prove(pBase(), 'transfer', input);
    msg(`Prueba lista en ${(ms / 1000).toFixed(1)} s. Firma la transacción.`);
    window.__arepapayLastProofMs = ms;
    const h = await sendTx(e.encryptedERC, iPEerc.encodeFunctionData('transfer', [to, P.tokenId, proof, balancePCT]), PGAS.transfer);
    await waitTx(h);
    $('pAmt').value = '';
    msg(`Enviado en privado: ${centsText(cents)} (prueba ${(ms / 1000).toFixed(1)} s).`);
    await privRefresh();
  });
}

async function privWithdraw() {
  return privJob(async () => {
    needReady();
    const e = ecfg();
    const cents = parseCents($('pWd').value);
    await privRefresh();
    if (!P.verified) throw new Error('Tu saldo privado no se pudo verificar.');
    if (cents > P.cents) throw new Error('No tienes suficiente saldo privado.');
    const aud = deep(await new ethers.Contract(e.encryptedERC, PRIV_EERC_ABI, reader()).auditorPublicKey()).map(BigInt);
    const lib = await privLib();
    const { input, balancePCT } = lib.withdrawInput(P.key, P.cents, P.egct, aud, cents);
    msg('Creando la prueba… ');
    const { proof, ms } = await lib.prove(pBase(), 'withdraw', input);
    msg(`Prueba lista en ${(ms / 1000).toFixed(1)} s. Firma la transacción.`);
    const h = await sendTx(e.encryptedERC, iPEerc.encodeFunctionData('withdraw', [P.tokenId, proof, balancePCT]), PGAS.withdraw);
    await waitTx(h);
    $('pWd').value = '';
    msg(`${centsText(cents)} volvieron a tu saldo normal.`);
    await privRefresh(); refreshAccount();
  });
}

// Private-pay link / QR: <page>?pto=<address>[&net=<net>], or a bare 0x address.
function parsePrivRef(raw) {
  const s = String(raw || '').trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return { to: s, net: null };
  let u;
  try { u = new URL(s, location.href); } catch { return null; }
  const to = u.searchParams.get('pto');
  return to && /^0x[0-9a-fA-F]{40}$/.test(to) ? { to, net: u.searchParams.get('net') } : null;
}
function loadPrivRef(raw) {
  const r = parsePrivRef(raw);
  if (!r) return false;
  showTab('private');
  if (r.net && /^(local|fuji)$/.test(r.net) && r.net !== NET) { err(`Esa dirección es de otra red (${r.net}).`); return false; }
  $('pTo').value = r.to;
  msg('Dirección cargada. Abre tu saldo privado y escribe el monto.');
  return true;
}

function initPrivate() {
  $('tabPrivate').onclick = () => { showTab('private'); if (ecfg()) privLib().catch(() => {}); if (P.key && !P.busy) privRefresh().catch(err); };
  // while the tab is open and unlocked, re-read the encrypted balance so a received private payment shows up by itself
  setInterval(() => {
    if (P.key && !P.busy && document.body.dataset.tab === 'private' && !document.hidden) privRefresh().catch(() => {});
  }, 6000);
  $('btnPUnlock').onclick = privUnlock;
  $('btnPRegister').onclick = privRegister;
  $('btnPDeposit').onclick = privDeposit;
  $('btnPSend').onclick = privSend;
  $('btnPWithdraw').onclick = privWithdraw;
  $('btnPScan').onclick = openScanner;
  pView();
}
