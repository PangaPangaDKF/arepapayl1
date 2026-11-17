// Store directory (D-034): every registered store is a payment contact for every customer. TESTNET ONLY.
//
// A merchant signs storeMessage(address, name, category, issuedAt) with its wallet and POSTs it to /stores; the service
// checks the signature (so nobody can register or rename someone else's store), that it is recent, and that the wallet is
// allowlisted (KYC'd). GET /stores lists every store, real ones first, then the demo stores.
// Demo stores (the user's choice, D-034): three test stores that all pay to the bank's gas-station test wallet, flagged
// demo:true and shown with a "demo" tag. Store: backend/onboarding/data/stores.<net>.json (gitignored). No PII: a store
// name, a type and a wallet address.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMessage } from 'viem';
import { NET, loadConfig, normAddress, roleOf } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(HERE, 'data');
const FILE = join(DATA_DIR, `stores.${NET}.json`);
export const CATEGORIES = ['perros', 'panaderia', 'agua', 'otro'];
const MAX_STORES = 2000;
const MAX_AGE_MS = 10 * 60 * 1000;

export const storeMessage = (address, name, category, issuedAt) =>
  `ArepaPay (testnet): registrar mi negocio "${name}" (${category}) para ${address}. Emitido: ${issuedAt}`;

/** Trim, collapse spaces, drop control characters; 2-40 visible characters. The app renders it with textContent only. */
export function cleanName(raw) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 40 ? s : null;
}

function read() {
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function write(s) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE + '.tmp', JSON.stringify(s, null, 2));
  renameSync(FILE + '.tmp', FILE);
}

function demoStores() {
  const c = loadConfig();
  const wallet = c?.mvp?.onboarder;   // the gas station: the bank's operations test wallet
  if (!wallet) return [];
  return [
    { id: 'demo-perros', name: 'Carrito de perros (demo)', category: 'perros', address: wallet, demo: true },
    { id: 'demo-panaderia', name: 'Panadería (demo)', category: 'panaderia', address: wallet, demo: true },
    { id: 'demo-agua', name: 'Recarga de agua (demo)', category: 'agua', address: wallet, demo: true },
  ];
}

export function listStores() {
  const real = Object.entries(read())
    .map(([address, r]) => ({ id: address, name: r.name, category: r.category, address, demo: false, updatedAt: r.updatedAt }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return [...real, ...demoStores()];
}

export function storeOf(address) {
  const a = normAddress(address);
  const r = a && read()[a];
  return r ? { address: a, name: r.name, category: r.category } : null;
}

const fail = (code, message) => Object.assign(new Error(message), { code });
let chain = Promise.resolve();   // serialize writes

export async function saveStore({ address, name, category, issuedAt, signature }) {
  const addr = normAddress(address);
  const clean = cleanName(name);
  if (!addr || !clean || !CATEGORIES.includes(category) || typeof issuedAt !== 'string' || typeof signature !== 'string') throw fail(400, 'bad request');
  const t = Date.parse(issuedAt);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_AGE_MS) throw fail(400, 'stale or bad issuedAt');
  // the signed text must carry the exact name the merchant typed (before cleaning) so the signature covers what we store
  if (clean !== name) throw fail(400, 'name must be 2-40 plain characters');
  const ok = await verifyMessage({ address: addr, message: storeMessage(addr, name, category, issuedAt), signature }).catch(() => false);
  if (!ok) throw fail(401, 'bad signature');
  const { role } = await roleOf(addr);
  if (!(Number(role) > 0)) throw fail(403, 'wallet not approved yet');
  const run = chain.then(() => {
    const s = read();
    if (!s[addr] && Object.keys(s).length >= MAX_STORES) throw fail(503, 'directory full');
    s[addr] = { name: clean, category, updatedAt: new Date().toISOString() };
    write(s);
    return { address: addr, name: clean, category };
  });
  chain = run.catch(() => {});
  return run;
}
