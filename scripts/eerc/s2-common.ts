// S2 shared helpers (LOCAL ONLY). Runs from inside the eERC clone (ava-labs/EncryptedERC@8dc98cd) so that its
// node_modules (snarkjs 0.7.5, ethers 6.13, maci-crypto, @zk-kit/baby-jubjub) and src/ helpers resolve.
// s2-run.sh copies this file to <EERC_DIR>/scripts/arepapay/. Never prints or writes a private key.
import { Base8, mulPointEscalar, subOrder } from "@zk-kit/baby-jubjub";
import { ethers } from "ethers";
import { formatPrivKeyForBabyJub, genPrivKey } from "maci-crypto";
import { poseidon3 } from "poseidon-lite";
import { performance } from "node:perf_hooks";
import * as path from "node:path";
import { encryptMessage } from "../../src/jub/jub";
import { processPoseidonDecryption, processPoseidonEncryption } from "../../src/poseidon/poseidon";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs = require("snarkjs");

export const EERC_DIR = path.resolve(__dirname, "../..");

export type CircuitName = "registration" | "transfer" | "withdraw";
export const CIRCUITS: Record<CircuitName, { wasm: string; zkey: string }> = {
	registration: {
		wasm: path.join(EERC_DIR, "circom/build/registration/registration.wasm"),
		zkey: path.join(EERC_DIR, "circom/build/registration/circuit_final.zkey"),
	},
	transfer: {
		wasm: path.join(EERC_DIR, "circom/build/transfer/transfer.wasm"),
		zkey: path.join(EERC_DIR, "circom/build/transfer/transfer.zkey"),
	},
	withdraw: {
		wasm: path.join(EERC_DIR, "circom/build/withdraw/withdraw.wasm"),
		zkey: path.join(EERC_DIR, "circom/build/withdraw/circuit_final.zkey"),
	},
};

/** BabyJubJub identity for eERC (same derivation as test/user.ts). Kept in memory only. */
export class BjjKey {
	readonly privateKey: bigint; // raw; src/ decrypt helpers format it internally
	readonly formattedPrivateKey: bigint;
	readonly publicKey: bigint[];
	constructor() {
		this.privateKey = genPrivKey();
		this.formattedPrivateKey = formatPrivKeyForBabyJub(this.privateKey) % subOrder;
		this.publicKey = mulPointEscalar(Base8, this.formattedPrivateKey).map((x) => BigInt(x));
	}
	toJSON() {
		return { publicKey: this.publicKey.map(String) }; // never serialise the private key
	}
}

export type ProofPoints = { a: string[]; b: string[][]; c: string[] };
export type Proved = { ms: number; proofPoints: ProofPoints; publicSignals: string[] };

/** snarkjs groth16 fullProve (witness + prove), timed. Same prover the browser SDK uses. */
export async function prove(circuit: CircuitName, input: Record<string, unknown>): Promise<Proved> {
	const { wasm, zkey } = CIRCUITS[circuit];
	const t0 = performance.now();
	const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
	const ms = performance.now() - t0;
	return {
		ms,
		proofPoints: {
			a: [proof.pi_a[0], proof.pi_a[1]],
			b: [
				[proof.pi_b[0][1], proof.pi_b[0][0]],
				[proof.pi_b[1][1], proof.pi_b[1][0]],
			],
			c: [proof.pi_c[0], proof.pi_c[1]],
		},
		publicSignals,
	};
}

export function registrationInput(key: BjjKey, account: string, chainId: bigint) {
	const registrationHash = poseidon3([chainId, key.formattedPrivateKey, BigInt(account)]);
	return {
		SenderPrivateKey: key.formattedPrivateKey,
		SenderPublicKey: key.publicKey,
		SenderAddress: BigInt(account),
		ChainID: chainId,
		RegistrationHash: registrationHash,
	};
}

/** Port of test/helpers.ts privateTransfer input building. */
export function transferInput(
	sender: BjjKey,
	senderBalance: bigint,
	senderEncBalance: bigint[],
	receiverPublicKey: bigint[],
	auditorPublicKey: bigint[],
	amount: bigint,
) {
	const newBalance = senderBalance - amount;
	const { cipher: encSender } = encryptMessage(sender.publicKey, amount);
	const { cipher: encReceiver, random: encReceiverRandom } = encryptMessage(receiverPublicKey, amount);
	const r = processPoseidonEncryption([amount], receiverPublicKey);
	const a = processPoseidonEncryption([amount], auditorPublicKey);
	const s = processPoseidonEncryption([newBalance], sender.publicKey);
	const input = {
		ValueToTransfer: amount,
		SenderPrivateKey: sender.formattedPrivateKey,
		SenderPublicKey: sender.publicKey,
		SenderBalance: senderBalance,
		SenderBalanceC1: senderEncBalance.slice(0, 2),
		SenderBalanceC2: senderEncBalance.slice(2, 4),
		SenderVTTC1: encSender[0],
		SenderVTTC2: encSender[1],
		ReceiverPublicKey: receiverPublicKey,
		ReceiverVTTC1: encReceiver[0],
		ReceiverVTTC2: encReceiver[1],
		ReceiverVTTRandom: encReceiverRandom,
		ReceiverPCT: r.ciphertext,
		ReceiverPCTAuthKey: r.authKey,
		ReceiverPCTNonce: r.nonce,
		ReceiverPCTRandom: r.encRandom,
		AuditorPublicKey: auditorPublicKey,
		AuditorPCT: a.ciphertext,
		AuditorPCTAuthKey: a.authKey,
		AuditorPCTNonce: a.nonce,
		AuditorPCTRandom: a.encRandom,
	};
	return { input, balancePCT: [...s.ciphertext, ...s.authKey, s.nonce] };
}

/** Port of test/helpers.ts withdraw input building. */
export function withdrawInput(
	user: BjjKey,
	userBalance: bigint,
	userEncBalance: bigint[],
	auditorPublicKey: bigint[],
	amount: bigint,
) {
	const u = processPoseidonEncryption([userBalance - amount], user.publicKey);
	const a = processPoseidonEncryption([amount], auditorPublicKey);
	const input = {
		ValueToWithdraw: amount,
		SenderPrivateKey: user.formattedPrivateKey,
		SenderPublicKey: user.publicKey,
		SenderBalance: userBalance,
		SenderBalanceC1: userEncBalance.slice(0, 2),
		SenderBalanceC2: userEncBalance.slice(2, 4),
		AuditorPublicKey: auditorPublicKey,
		AuditorPCT: a.ciphertext,
		AuditorPCTAuthKey: a.authKey,
		AuditorPCTNonce: a.nonce,
		AuditorPCTRandom: a.encRandom,
	};
	return { input, balancePCT: [...u.ciphertext, ...u.authKey, u.nonce] };
}

/** PCT layout: ciphertext[4], authKey[2], nonce. Throws if the key is wrong (poseidon auth check). */
export function decryptPCT(privateKey: bigint, pct: bigint[]): bigint {
	const out = processPoseidonDecryption(pct.slice(0, 4), pct.slice(4, 6), pct[6], privateKey, 1);
	return BigInt(out[0]);
}

// --- metadata (same byte format as src/metadata.ts, re-implemented to avoid its `hardhat` import) ---
function str2chunks(s: string): bigint[] {
	const v = BigInt(`0x${Buffer.from(s, "utf8").toString("hex")}`);
	const size = 2n ** 250n;
	const out: bigint[] = [];
	let rem = v;
	while (rem > 0n) {
		out.push(rem % size);
		rem /= size;
	}
	return out.length ? out : [0n];
}
function chunks2str(chunks: bigint[]): string {
	const size = 2n ** 250n;
	let v = 0n;
	for (let i = chunks.length - 1; i >= 0; i--) v = v * size + chunks[i];
	let hex = v.toString(16);
	if (hex.length % 2) hex = `0${hex}`;
	return Buffer.from(hex, "hex").toString("utf8").replace(/\u0000/g, "");
}
const pad = (x: bigint) => ethers.zeroPadValue(ethers.toBeHex(x), 32);
export function encryptMetadata(publicKey: bigint[], message: string): string {
	const chunks = str2chunks(message);
	const { ciphertext, nonce, authKey } = processPoseidonEncryption(chunks, publicKey);
	return ethers.concat([pad(BigInt(chunks.length)), pad(nonce), pad(authKey[0]), pad(authKey[1]), ...ciphertext.map(pad)]);
}
export function decryptMetadata(privateKey: bigint, bytes: string): string {
	const h = bytes.replace(/^0x/, "");
	const word = (i: number) => BigInt(`0x${h.slice(i * 64, i * 64 + 64)}`);
	const len = Number(word(0));
	const ct: bigint[] = [];
	for (let i = 4; i * 64 < h.length; i++) ct.push(word(i));
	return chunks2str(processPoseidonDecryption(ct, [word(2), word(3)], word(1), privateKey, len).map(BigInt));
}

export const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
