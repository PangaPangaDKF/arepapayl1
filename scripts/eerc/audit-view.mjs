// D-032 — the bank's auditor view of the eERC test token (back-office tool, precursor of spike S3). TESTNET ONLY.
//
//   NET=fuji node scripts/eerc/audit-view.mjs [--from <block>] [--expect-transfer <cents>]
//
// Reads Deposit / PrivateTransfer / Withdraw events of config/l1/eerc.<net>.json and decrypts the auditor copy (auditorPCT)
// of every private transfer and withdrawal with the auditor BabyJubJub key in ~/.avalanche-cli/key/arepapay-<net>-auditor.bjj
// (written by scripts/eerc/deploy.sh, mode 0600). The key is read into memory only and never printed.
// What this proves: amounts hidden from the public chain are readable by the bank's auditor key, and by nobody else's
// (a second, random key must fail on every auditorPCT). --expect-transfer makes it exit 1 unless a transfer of exactly
// that many cents is found (used by the e2e verification).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(join(REPO, 'backend', 'onboarding', 'package.json'));
const { createPublicClient, http, parseAbiItem } = req('viem');

const NET = process.env.NET || 'fuji';
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const E = JSON.parse(readFileSync(join(REPO, 'config', 'l1', `eerc.${NET}.json`), 'utf8'));
const L1 = JSON.parse(readFileSync(join(REPO, 'config', 'l1', `arepapaybank.${NET}.json`), 'utf8'));
const lib = vm.runInThisContext(`${readFileSync(join(REPO, 'app', 'vendor', 'eerc-lib.js'), 'utf8')}; ArepaEerc`);
const keyFile = join(homedir(), '.avalanche-cli', 'key', `arepapay-${NET}-auditor.bjj`);
const K = JSON.parse(readFileSync(keyFile, 'utf8'));
if (K.address.toLowerCase() !== E.auditor.toLowerCase()) throw new Error('auditor key file is for another address');
const auditor = lib.keyFromPrivate(BigInt(K.privateKey));
const stranger = lib.keyFromPrivate(lib.genRandomBabyJubValue() % lib.BASE_POINT_ORDER);

const client = createPublicClient({ transport: http(L1.rpcUrl) });
const from = BigInt(opt('--from') || E.deployBlock);
const ev = {
  Deposit: parseAbiItem('event Deposit(address indexed user, uint256 amount, uint256 dust, uint256 tokenId)'),
  PrivateTransfer: parseAbiItem('event PrivateTransfer(address indexed from, address indexed to, uint256[7] auditorPCT, address indexed auditorAddress)'),
  Withdraw: parseAbiItem('event Withdraw(address indexed user, uint256 amount, uint256 tokenId, uint256[7] auditorPCT, address indexed auditorAddress)'),
};
const cents = (c) => `${c / 100n}.${(c % 100n).toString().padStart(2, '0')}`;
const tryDec = (k, pct) => { try { return lib.decryptPCT(k.privateKey, pct); } catch { return null; } };

const logs = (await Promise.all(Object.values(ev).map((event) => client.getLogs({ address: E.contracts.encryptedERC, event, fromBlock: from, toBlock: 'latest' }))))
  .flat().sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber)));
console.log(`== auditor view ${NET} eERC ${E.contracts.encryptedERC} from block ${from}: ${logs.length} events`);
let transfers = [], strangerReads = 0, auditorFails = 0;
for (const l of logs) {
  const a = l.args;
  if (l.eventName === 'Deposit') {
    console.log(`  #${l.blockNumber} Deposit   ${a.user} ${Number(a.amount) / 10 ** E.tokenDecimals} tUSD (public: entering the private balance)`);
  } else {
    const v = tryDec(auditor, a.auditorPCT);
    if (v === null) auditorFails++;
    if (tryDec(stranger, a.auditorPCT) !== null) strangerReads++;
    if (l.eventName === 'PrivateTransfer') {
      transfers.push(v);
      console.log(`  #${l.blockNumber} Transfer  ${a.from} -> ${a.to}  amount on chain: encrypted | auditor reads ${v === null ? 'FAIL' : cents(v)}`);
    } else {
      console.log(`  #${l.blockNumber} Withdraw  ${a.user} ${cents(a.amount)} (public) | auditor copy ${v === null ? 'FAIL' : cents(v)}`);
    }
  }
}
console.log(`   auditor key failed on ${auditorFails} events; a random key read ${strangerReads} events`);
const want = opt('--expect-transfer');
let ok = auditorFails === 0 && strangerReads === 0;
if (want !== null && !transfers.some((v) => v === BigInt(want))) { ok = false; console.log(`   no private transfer of ${want} cents found`); }
console.log(ok ? 'AUDIT VIEW: PASS' : 'AUDIT VIEW: FAIL');
process.exit(ok ? 0 : 1);
