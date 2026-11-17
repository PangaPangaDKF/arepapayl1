// ArepaPay eERC browser library (D-032). Bundled by scripts/eerc/browser (npm run build) into app/vendor/eerc-lib.js as the
// global `ArepaEerc`. TESTNET ONLY.
//
// Ports of ava-labs/EncryptedERC@8dc98cd src/jub, src/poseidon and test/helpers.ts (the same math spike S2 proved on chain,
// docs/spikes/S2.md), without Node APIs: randomness from crypto.getRandomValues, hashing from WebCrypto.
// Proofs: snarkjs (global `snarkjs`, app/circuits/snarkjs.min.js 0.7.5) with the shipped circuit files in app/circuits/,
// pinned by config/l1/eerc-circuits.sha256.
//
// Key: the user's BabyJubJub key is derived from a MetaMask signature of a fixed message (the message the official
// @avalabs/eerc-sdk 1.0.2 uses), so the same wallet always gets the same key and nothing has to be stored. It lives in
// page memory only. Anyone who obtains that signature can read the user's private balance (not move it): the app asks for
// it only on its own button and explains it (testnet).
import { Base8, Fr, addPoint, mulPointEscalar, subOrder } from '@zk-kit/baby-jubjub';
import { deriveSecretScalar } from '@zk-kit/eddsa-poseidon';
import { poseidonDecrypt, poseidonEncrypt } from '@zk-kit/poseidon-cipher';
import { poseidon3 } from 'poseidon-lite';

export const SNARK_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BASE_POINT_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const TWO_256 = 1n << 256n;

export const registerMessage = (address) => `eERC Registering user with  Address:${String(address).toLowerCase()}`;

// ------------------------------------------------------------------ randomness and hashing (browser)
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => Uint8Array.from((h.match(/../g) || []).map((x) => parseInt(x, 16)));
function rand32() {
  const u = new Uint8Array(32);
  crypto.getRandomValues(u);
  return BigInt(`0x${hex(u)}`);
}
/** maci-crypto genRandomBabyJubValue (no modulo bias). */
export function genRandomBabyJubValue() {
  const min = 6350874878119819312338956282401532410528162663560392320966563075034087161851n;
  let v = SNARK_FIELD_SIZE;
  do {
    const r = rand32();
    if (r >= min) v = r % SNARK_FIELD_SIZE;
  } while (v >= SNARK_FIELD_SIZE);
  return v;
}
/** eERC src/poseidon randomNonce: 16 random bytes + 1. */
function randomNonce() {
  const u = new Uint8Array(16);
  crypto.getRandomValues(u);
  return BigInt(`0x${hex(u)}`) + 1n;
}
async function sha256(u8) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
}

// ------------------------------------------------------------------ keys
/** Hash-to-field of the signature's first 32 bytes, as @avalabs/eerc-sdk 1.0.2 (rejection sampling, no modulo bias). */
export async function privateKeyFromSignature(signature) {
  const r = String(signature).replace(/^0x/, '').slice(0, 64);
  if (!/^[0-9a-fA-F]{64}$/.test(r)) throw new Error('bad signature');
  const limit = TWO_256 - (TWO_256 % BASE_POINT_ORDER);
  for (let i = 0; i < 1000; i++) {
    const c = i.toString(16);
    const b = BigInt(`0x${hex(await sha256(fromHex(r + (c.length % 2 ? `0${c}` : c))))}`);
    if (b < limit) return b % BASE_POINT_ORDER;
  }
  throw new Error('could not derive a key');
}
/** Same model as S2 BjjKey: raw private key + formatted scalar + public key. */
export function keyFromPrivate(privateKey) {
  const formattedPrivateKey = BigInt(deriveSecretScalar(privateKey.toString())) % subOrder;
  const publicKey = mulPointEscalar(Base8, formattedPrivateKey).map((x) => BigInt(x));
  return { privateKey, formattedPrivateKey, publicKey };
}
export async function keyFromSignature(signature) {
  return keyFromPrivate(await privateKeyFromSignature(signature));
}
const fmt = (privateKey) => BigInt(deriveSecretScalar(privateKey.toString()));

// ------------------------------------------------------------------ ElGamal and Poseidon encryption (src/jub, src/poseidon)
export function encryptMessage(publicKey, message) {
  let random = genRandomBabyJubValue();
  if (random >= BASE_POINT_ORDER) random = genRandomBabyJubValue() / 100n;
  const p = mulPointEscalar(Base8, message);
  const c1 = mulPointEscalar(Base8, random);
  const c2 = addPoint(p, mulPointEscalar(publicKey, random));
  return { cipher: [c1, c2], random };
}
export function decryptPoint(privateKey, c1, c2) {
  const c1x = mulPointEscalar(c1, fmt(privateKey));
  return addPoint(c2, [Fr.e(c1x[0] * -1n), c1x[1]]);
}
export function processPoseidonEncryption(inputs, publicKey) {
  const nonce = randomNonce();
  let encRandom = genRandomBabyJubValue();
  if (encRandom >= BASE_POINT_ORDER) encRandom = genRandomBabyJubValue() / 10n;
  const key = mulPointEscalar(publicKey, encRandom);
  const authKey = mulPointEscalar(Base8, encRandom);
  const ciphertext = poseidonEncrypt(inputs, key, nonce);
  return { ciphertext, nonce, encRandom, authKey };
}
export function processPoseidonDecryption(ciphertext, authKey, nonce, privateKey, length) {
  const shared = mulPointEscalar(authKey, fmt(privateKey));
  return poseidonDecrypt(ciphertext, shared, nonce, length).slice(0, length);
}
/** PCT layout uint256[7]: ciphertext[4], authKey[2], nonce. Throws if the key is wrong (Poseidon auth check). */
export function decryptPCT(privateKey, pct) {
  const p = pct.map(BigInt);
  return BigInt(processPoseidonDecryption(p.slice(0, 4), p.slice(4, 6), p[6], privateKey, 1)[0]);
}
const pctOf = (e) => [...e.ciphertext, ...e.authKey, e.nonce];

// ------------------------------------------------------------------ proof inputs (test/helpers.ts)
export function registrationInput(key, account, chainId) {
  const id = BigInt(chainId);
  return {
    SenderPrivateKey: key.formattedPrivateKey,
    SenderPublicKey: key.publicKey,
    SenderAddress: BigInt(account),
    ChainID: id,
    RegistrationHash: poseidon3([id, key.formattedPrivateKey, BigInt(account)]),
  };
}
/** amountPCT for deposit(): the deposited cents encrypted to the depositor's own key (it is how they read it back). */
export function depositPCT(key, cents) {
  return pctOf(processPoseidonEncryption([BigInt(cents)], key.publicKey));
}
export function transferInput(sender, senderBalance, senderEncBalance, receiverPublicKey, auditorPublicKey, amount) {
  const enc = senderEncBalance.map(BigInt);
  const recv = receiverPublicKey.map(BigInt);
  const aud = auditorPublicKey.map(BigInt);
  const { cipher: encSender } = encryptMessage(sender.publicKey, amount);
  const { cipher: encReceiver, random: encReceiverRandom } = encryptMessage(recv, amount);
  const r = processPoseidonEncryption([amount], recv);
  const a = processPoseidonEncryption([amount], aud);
  const s = processPoseidonEncryption([senderBalance - amount], sender.publicKey);
  return {
    input: {
      ValueToTransfer: amount,
      SenderPrivateKey: sender.formattedPrivateKey,
      SenderPublicKey: sender.publicKey,
      SenderBalance: senderBalance,
      SenderBalanceC1: enc.slice(0, 2),
      SenderBalanceC2: enc.slice(2, 4),
      SenderVTTC1: encSender[0],
      SenderVTTC2: encSender[1],
      ReceiverPublicKey: recv,
      ReceiverVTTC1: encReceiver[0],
      ReceiverVTTC2: encReceiver[1],
      ReceiverVTTRandom: encReceiverRandom,
      ReceiverPCT: r.ciphertext,
      ReceiverPCTAuthKey: r.authKey,
      ReceiverPCTNonce: r.nonce,
      ReceiverPCTRandom: r.encRandom,
      AuditorPublicKey: aud,
      AuditorPCT: a.ciphertext,
      AuditorPCTAuthKey: a.authKey,
      AuditorPCTNonce: a.nonce,
      AuditorPCTRandom: a.encRandom,
    },
    balancePCT: pctOf(s),
  };
}
export function withdrawInput(user, userBalance, userEncBalance, auditorPublicKey, amount) {
  const enc = userEncBalance.map(BigInt);
  const aud = auditorPublicKey.map(BigInt);
  const u = processPoseidonEncryption([userBalance - amount], user.publicKey);
  const a = processPoseidonEncryption([amount], aud);
  return {
    input: {
      ValueToWithdraw: amount,
      SenderPrivateKey: user.formattedPrivateKey,
      SenderPublicKey: user.publicKey,
      SenderBalance: userBalance,
      SenderBalanceC1: enc.slice(0, 2),
      SenderBalanceC2: enc.slice(2, 4),
      AuditorPublicKey: aud,
      AuditorPCT: a.ciphertext,
      AuditorPCTAuthKey: a.authKey,
      AuditorPCTNonce: a.nonce,
      AuditorPCTRandom: a.encRandom,
    },
    balancePCT: pctOf(u),
  };
}

// ------------------------------------------------------------------ balance
/**
 * Decrypts balanceOf(user, tokenId) = [eGCT{c1,c2}, nonce, amountPCTs[{pct,index}], balancePCT, transactionIndex].
 * cents = dec(balancePCT) (if set) + sum dec(amountPCTs); then proves it against the ElGamal ciphertext: cents*G must equal
 * the decrypted point. `verified: false` means the PCT history does not match the encrypted balance (never trust it).
 */
export function decryptBalance(key, bal) {
  const [eGCT, , amountPCTs, balancePCT] = bal;
  const c1 = [BigInt(eGCT[0][0] ?? eGCT.c1.x), BigInt(eGCT[0][1] ?? eGCT.c1.y)];
  const c2 = [BigInt(eGCT[1][0] ?? eGCT.c2.x), BigInt(eGCT[1][1] ?? eGCT.c2.y)];
  const egct = [...c1, ...c2];
  if (c1[0] === 0n && c1[1] === 0n) return { cents: 0n, egct, verified: true, empty: true };
  let cents = 0n;
  if (balancePCT.some((x) => BigInt(x) !== 0n)) cents += decryptPCT(key.privateKey, balancePCT);
  for (const a of amountPCTs) cents += decryptPCT(key.privateKey, a[0] ?? a.pct);
  const pt = decryptPoint(key.privateKey, c1, c2);
  const exp = mulPointEscalar(Base8, cents);
  return { cents, egct, verified: BigInt(pt[0]) === BigInt(exp[0]) && BigInt(pt[1]) === BigInt(exp[1]), empty: false };
}

// ------------------------------------------------------------------ proving
const cache = {};
async function circuit(base, name) {
  if (!cache[name]) {
    cache[name] = Promise.all(['wasm', 'zkey'].map(async (ext) => {
      const r = await fetch(`${base}/${name}.${ext}`);
      if (!r.ok) throw new Error(`${name}.${ext}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    })).catch((e) => { delete cache[name]; throw e; });
  }
  const [wasm, zkey] = await cache[name];
  return { wasm, zkey };
}
/** Download (and keep) a circuit's files ahead of time so the proof starts at once. */
export const preload = (base, name) => circuit(base, name).then(() => true);

/** snarkjs groth16.fullProve, returns the struct the contracts take ({proofPoints, publicSignals}) and the time in ms. */
export async function prove(base, name, input) {
  const { wasm, zkey } = await circuit(base, name);
  const t0 = performance.now();
  // eslint-disable-next-line no-undef
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, { type: 'mem', data: wasm }, { type: 'mem', data: zkey });
  const ms = performance.now() - t0;
  return {
    ms,
    proof: {
      proofPoints: {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        c: [proof.pi_c[0], proof.pi_c[1]],
      },
      publicSignals,
    },
  };
}
