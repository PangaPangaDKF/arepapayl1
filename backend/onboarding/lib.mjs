// ArepaPay onboarding (TEST-ONLY stand-in for bank KYC, R11). Testnet, no real money.
// Shared code for server.mjs and admin.mjs: config (generated files only, R7), the JSON request store, and approve().
// Keys: read from files named by env vars (ADMIN_KEY_FILE, GAS_KEY_FILE), kept in memory, never logged or returned.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient, createWalletClient, http, defineChain, getAddress, isAddress, parseEther, parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const NET = process.env.NET || 'local';
if (!/^(local|fuji)$/.test(NET)) throw new Error('NET must be local or fuji');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export function loadConfig(net = NET) {
  const chainPath = join(REPO, 'config', 'l1', `arepapaybank.${net}.json`);
  const mvpPath = join(REPO, 'config', 'l1', `mvp.${net}.json`);
  if (!existsSync(chainPath) || !existsSync(mvpPath)) return null;
  const chain = readJson(chainPath);
  const mvp = readJson(mvpPath);
  if (Number(mvp.chainId) !== Number(chain.chainId)) throw new Error(`mvp.${net}.json chainId != chain config`);
  return { chain, mvp };
}

/** The public subset the dApp needs. PUBLIC_RPC_URL lets a LAN/HTTPS RPC replace the 127.0.0.1 one for phones. */
export function publicConfig(net) {
  const c = loadConfig(net);
  if (!c) return null;
  return {
    network: net,
    chainId: c.chain.chainId,
    chainName: `ArepaPay L1 (${net}, testnet)`,
    nativeSymbol: c.chain.tokenSymbol,
    rpcUrl: (net === NET && process.env.PUBLIC_RPC_URL) || c.chain.rpcUrl,
    txAllowList: c.chain.precompiles.txAllowList.address,
    testUsd: c.mvp.testUsd,
    testUsdSymbol: c.mvp.testUsdSymbol,
    testUsdDecimals: c.mvp.testUsdDecimals,
    splitPayEscrow: c.mvp.splitPayEscrow,
    feeBps: c.mvp.feeBps,
    deployBlock: c.mvp.deployBlock,
    eerc: eercPublic(net, c),
    merchantPay: merchantPayPublic(net, c),
    testnet: true,
  };
}

/** Pay a store from the contact list (D-034): config/l1/merchantpay.<net>.json, or null when not deployed. */
function merchantPayPublic(net, c) {
  const p = join(REPO, 'config', 'l1', `merchantpay.${net}.json`);
  if (!existsSync(p)) return null;
  const m = readJson(p);
  if (Number(m.chainId) !== Number(c.chain.chainId) || m.escrow.toLowerCase() !== c.mvp.splitPayEscrow.toLowerCase()) return null;
  return m.merchantPay;
}

/** Encrypted balances (D-032): the generated config/l1/eerc.<net>.json, or null when not deployed on that net. */
function eercPublic(net, c) {
  const p = join(REPO, 'config', 'l1', `eerc.${net}.json`);
  if (!existsSync(p)) return null;
  const e = readJson(p);
  if (Number(e.chainId) !== Number(c.chain.chainId) || e.token.toLowerCase() !== c.mvp.testUsd.toLowerCase()) return null;
  return {
    registrar: e.contracts.registrar,
    encryptedERC: e.contracts.encryptedERC,
    token: e.token,
    tokenDecimals: e.tokenDecimals,
    eercDecimals: e.eercDecimals,
    auditor: e.auditor,
    deployBlock: e.deployBlock,
    circuits: 'circuits',   // relative to the dApp page (app/circuits, scripts/eerc/deploy.sh circuits)
  };
}

// ---------------------------------------------------------------- store (backend/onboarding/data/requests.json, gitignored)
const DATA_DIR = process.env.DATA_DIR || join(HERE, 'data');
const STORE = join(DATA_DIR, `requests.${NET}.json`);
const MAX_PENDING = 1000;
export function readStore() {
  try { return readJson(STORE); } catch { return {}; }
}
function writeStore(s) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE + '.tmp', JSON.stringify(s, null, 2));
  renameSync(STORE + '.tmp', STORE);
}
export function normAddress(a) {
  if (typeof a !== 'string' || !isAddress(a, { strict: false })) return null;
  return getAddress(a);
}
export function addRequest(address) {
  const s = readStore();
  if (!s[address]) {
    if (Object.values(s).filter((r) => r.status === 'pending').length >= MAX_PENDING) throw new Error('too many pending');
    s[address] = { status: 'pending', requestedAt: new Date().toISOString() };
    writeStore(s);
  }
  return s[address];
}
function patch(address, fields) {
  const s = readStore();
  s[address] = { ...(s[address] || { requestedAt: new Date().toISOString() }), ...fields };
  writeStore(s);
  return s[address];
}

// ---------------------------------------------------------------- chain
const ROLE = ['none', 'enabled', 'admin', 'manager'];
const allowListAbi = [
  { type: 'function', name: 'readAllowList', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'setEnabled', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
];
const usdAbi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
];

let ctx;
function chainCtx() {
  if (ctx) return ctx;
  const c = loadConfig();
  if (!c) throw new Error(`config/l1/mvp.${NET}.json missing: run scripts/mvp/deploy.sh first`);
  const chain = defineChain({
    id: c.chain.chainId, name: c.chain.name,
    nativeCurrency: { name: c.chain.tokenSymbol, symbol: c.chain.tokenSymbol, decimals: 18 },
    rpcUrls: { default: { http: [c.chain.rpcUrl] } },
  });
  const transport = http(c.chain.rpcUrl);
  ctx = { c, chain, pub: createPublicClient({ chain, transport }), transport };
  return ctx;
}

export async function roleOf(address) {
  const { c, pub } = chainCtx();
  const r = await pub.readContract({ address: c.chain.precompiles.txAllowList.address, abi: allowListAbi, functionName: 'readAllowList', args: [address] });
  return { role: Number(r), roleName: ROLE[Number(r)] ?? String(r) };
}

// LOCAL defaults point at avalanche-cli's key store (LOCAL-TEST-ONLY keys). For Fuji, set the env vars explicitly.
function keyFile(envName, cliKeyName) {
  const p = process.env[envName] || (NET === 'local' && cliKeyName ? join(homedir(), '.avalanche-cli', 'key', `${cliKeyName}.pk`) : null);
  if (!p) throw new Error(`${envName} not set`);
  return p;
}
function loadAccount(envName, cliKeyName, expected) {
  let raw = readFileSync(keyFile(envName, cliKeyName), 'utf8').trim();
  if (!raw.startsWith('0x')) raw = '0x' + raw;
  const acct = privateKeyToAccount(raw);
  raw = null;
  if (expected && acct.address.toLowerCase() !== expected.toLowerCase()) throw new Error(`${envName} does not match the expected address`);
  return acct;
}
let signers;
/** Loads (and checks) the admin + gas-station keys now; throws with the reason. Used at boot when AUTO_APPROVE=1 (L-012). */
export const checkSigners = () => { getSigners(); return true; };
function getSigners() {
  if (signers) return signers;
  const { c, chain, transport } = chainCtx();
  const admin = loadAccount('ADMIN_KEY_FILE', c.chain.accounts?.admin?.cliKeyName, c.chain.accounts?.admin?.address);
  const gas = loadAccount('GAS_KEY_FILE', c.chain.accounts?.gasStation?.cliKeyName, c.mvp.onboarder);
  signers = {
    admin: createWalletClient({ account: admin, chain, transport }),
    gas: createWalletClient({ account: gas, chain, transport }),
  };
  return signers;
}

const GAS_TOPUP = parseEther(process.env.GAS_TOPUP || '1'); // native ARPB for gas
const MINT_USD = parseUnits(process.env.MINT_USD || '50', 6); // test USD, mint once per address

async function sendAndWait(promise) {
  const { pub } = chainCtx();
  const hash = await promise;
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== 'success') throw new Error(`tx reverted ${hash}`);
  return hash;
}

// One approval at a time: the admin and gas-station nonces must not race.
let queue = Promise.resolve();
export function approve(address) {
  const run = queue.then(() => doApprove(address));
  queue = run.catch(() => {});
  return run;
}
async function doApprove(address) {
  const { c, pub } = chainCtx();
  const { admin, gas } = getSigners();
  const steps = [];
  if ((await roleOf(address)).role === 0) {
    await sendAndWait(admin.writeContract({ address: c.chain.precompiles.txAllowList.address, abi: allowListAbi, functionName: 'setEnabled', args: [address] }));
    steps.push('allowlisted');
  }
  if ((await pub.getBalance({ address })) < GAS_TOPUP / 2n) {
    await sendAndWait(gas.sendTransaction({ to: address, value: GAS_TOPUP }));
    steps.push('gas');
  }
  const rec = readStore()[address];
  if (!rec?.mintedAt) {
    await sendAndWait(gas.writeContract({ address: c.mvp.testUsd, abi: usdAbi, functionName: 'mint', args: [address, MINT_USD] }));
    patch(address, { mintedAt: new Date().toISOString() }); // record at once: never mint twice
    steps.push('minted');
  }
  patch(address, { status: 'approved', approvedAt: new Date().toISOString() });
  return steps;
}
