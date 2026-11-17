// D-032 offline test of eerc-lib.src.mjs (what the browser bundle runs). TESTNET ONLY, throwaway keys.
// 1. key derivation is deterministic, in range and matches the S2 model (maci formatPrivKeyForBabyJub == deriveSecretScalar)
// 2. PCT encrypt/decrypt round trip; a wrong key fails
// 3. balance decryption from a simulated balanceOf (deposit PCTs + ElGamal sum) is verified; a forged PCT is caught
// 4. if app/circuits/ exists (scripts/eerc/deploy.sh circuits): registration, transfer and withdraw proofs built from these
//    inputs verify with snarkjs against the verification key exported from the same pinned zkey (V9: a tampered public
//    signal must fail).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Base8, addPoint, mulPointEscalar } from '@zk-kit/baby-jubjub';
import * as L from './.test-bundle.mjs'; // eerc-lib.src.mjs through esbuild (npm test builds it)

const HERE = dirname(fileURLToPath(import.meta.url));
const CIRC = join(HERE, '..', '..', '..', 'app', 'circuits');
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// 1. keys
const sigA = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '1b';
const sigB = '0x' + '12'.repeat(32) + 'cd'.repeat(32) + '1c';
const kA = await L.keyFromSignature(sigA);
const kA2 = await L.keyFromSignature(sigA);
const kB = await L.keyFromSignature(sigB);
ok(kA.privateKey === kA2.privateKey && kA.publicKey[0] === kA2.publicKey[0], 'same signature -> same key');
ok(kA.privateKey !== kB.privateKey, 'different signature -> different key');
ok(kA.privateKey > 0n && kA.privateKey < L.BASE_POINT_ORDER, 'private key in [1, base point order)');
const pub = mulPointEscalar(Base8, kA.formattedPrivateKey);
ok(pub[0] === kA.publicKey[0] && pub[1] === kA.publicKey[1], 'public key = formatted * Base8');
ok(L.registerMessage('0xAbC') === 'eERC Registering user with  Address:0xabc', 'register message = SDK 1.0.2 message');

// 2. PCT round trip
const pct = L.depositPCT(kA, 1234n);
ok(pct.length === 7, 'PCT has 7 words');
ok(L.decryptPCT(kA.privateKey, pct) === 1234n, 'owner decrypts own PCT');
let wrong = false;
try { L.decryptPCT(kB.privateKey, pct); } catch { wrong = true; }
ok(wrong, 'another key cannot decrypt the PCT (auth check throws)');

// 3. balance = sum of deposit PCTs, checked against the ElGamal sum
const e1 = L.encryptMessage(kA.publicKey, 500n).cipher;
const e2 = L.encryptMessage(kA.publicKey, 250n).cipher;
const c1 = addPoint(e1[0], e2[0]);
const c2 = addPoint(e1[1], e2[1]);
const bal = [[c1, c2], 0n, [[L.depositPCT(kA, 500n), 0n], [L.depositPCT(kA, 250n), 1n]], [0n, 0n, 0n, 0n, 0n, 0n, 0n], 2n];
const d = L.decryptBalance(kA, bal);
ok(d.cents === 750n && d.verified, `balance 7.50 decrypted and verified (got ${d.cents}, ${d.verified})`);
const forged = [[c1, c2], 0n, [[L.depositPCT(kA, 900n), 0n], [L.depositPCT(kA, 250n), 1n]], [0n, 0n, 0n, 0n, 0n, 0n, 0n], 2n];
ok(L.decryptBalance(kA, forged).verified === false, 'forged PCT history is caught by the ElGamal check');
ok(L.decryptBalance(kA, [[[0n, 0n], [0n, 0n]], 0n, [], [0n, 0n, 0n, 0n, 0n, 0n, 0n], 0n]).cents === 0n, 'empty balance = 0');

// 4. proofs against the pinned circuits
if (!existsSync(join(CIRC, 'transfer.zkey'))) {
  console.log('SKIP  proofs: app/circuits/ missing (run scripts/eerc/deploy.sh circuits)');
} else {
  const snarkjs = await import('snarkjs');
  globalThis.snarkjs = snarkjs;
  globalThis.fetch = async (u) => ({ ok: true, arrayBuffer: async () => { const b = readFileSync(String(u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
  const vk = async (n) => snarkjs.zKey.exportVerificationKey(new Uint8Array(readFileSync(join(CIRC, `${n}.zkey`))));
  const check = async (name, input) => {
    const { proof, ms } = await L.prove(CIRC, name, input);
    const v = await vk(name);
    const raw = { pi_a: [...proof.proofPoints.a, '1'], pi_b: [[proof.proofPoints.b[0][1], proof.proofPoints.b[0][0]], [proof.proofPoints.b[1][1], proof.proofPoints.b[1][0]], ['1', '0']], pi_c: [...proof.proofPoints.c, '1'], protocol: 'groth16', curve: 'bn128' };
    const good = await snarkjs.groth16.verify(v, proof.publicSignals, raw);
    const bad = proof.publicSignals.slice(); bad[0] = (BigInt(bad[0]) + 1n).toString();
    const neg = await snarkjs.groth16.verify(v, bad, raw);
    ok(good && !neg, `${name} proof verifies (${Math.round(ms)} ms), tampered signal rejected`);
  };
  const audit = await L.keyFromSignature('0x' + '77'.repeat(64) + '1b');
  await check('registration', L.registrationInput(kA, '0x9769D591AA88558BB812Cc95908dc4c87a5cF2fF', 77078n));
  const enc = L.encryptMessage(kA.publicKey, 1000n).cipher;
  const encBal = [...enc[0], ...enc[1]];
  const t = L.transferInput(kA, 1000n, encBal, kB.publicKey, audit.publicKey, 300n);
  await check('transfer', t.input);
  ok(L.decryptPCT(kA.privateKey, t.balancePCT) === 700n, 'sender balancePCT after transfer = 7.00');
  const w = L.withdrawInput(kA, 1000n, encBal, audit.publicKey, 400n);
  await check('withdraw', w.input);
  await snarkjs.curves?.getCurveFromName?.('bn128').then((c) => c.terminate()).catch(() => {});
}

console.log(fails ? `EERC LIB: ${fails} FAILED` : 'EERC LIB: ALL PASS');
process.exit(fails ? 1 : 0);
