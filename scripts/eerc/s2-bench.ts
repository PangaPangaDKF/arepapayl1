// S2 — offline proof benchmark (no chain). Run via `scripts/eerc/s2-run.sh bench [N]`.
// Times snarkjs groth16.fullProve (witness + prove) for registration, transfer and withdraw with valid synthetic inputs,
// after one warm-up call per circuit. Also writes sample inputs (public test values, fresh throwaway keys) to
// <EERC_DIR>/s2-phone/inputs/ for the phone benchmark page (scripts/eerc/s2-phone-bench.sh).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Wallet } from "ethers";
import { encryptMessage } from "../../src/jub/jub";
import { BjjKey, CIRCUITS, type CircuitName, EERC_DIR, median, prove, registrationInput, transferInput, withdrawInput } from "./s2-common";

const N = Number(process.argv[2] ?? 10);
const CHAIN_ID = 77077n;

function makeInput(c: CircuitName): Record<string, unknown> {
	const me = new BjjKey();
	if (c === "registration") return registrationInput(me, Wallet.createRandom().address, CHAIN_ID);
	const bal = 1000n;
	const { cipher } = encryptMessage(me.publicKey, bal);
	const enc = [...cipher[0], ...cipher[1]].map(BigInt);
	const auditor = new BjjKey();
	if (c === "transfer") return transferInput(me, bal, enc, new BjjKey().publicKey, auditor.publicKey, 300n).input;
	return withdrawInput(me, bal, enc, auditor.publicKey, 500n).input;
}

const toJson = (o: unknown) => JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

async function main() {
	console.log(`== S2 proof bench: N=${N} per circuit, cpu="${os.cpus()[0].model}" x${os.cpus().length}, RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB, node ${process.version}, snarkjs groth16.fullProve`);
	const outDir = path.join(EERC_DIR, "s2-phone/inputs");
	fs.mkdirSync(outDir, { recursive: true });
	const result: Record<string, unknown> = {};
	for (const c of ["registration", "transfer", "withdraw"] as CircuitName[]) {
		const size = (f: string) => (fs.statSync(f).size / 2 ** 20).toFixed(1);
		fs.writeFileSync(path.join(outDir, `${c}.json`), toJson(makeInput(c)));
		const warm = await prove(c, makeInput(c));
		const ms: number[] = [];
		for (let i = 0; i < N; i++) ms.push((await prove(c, makeInput(c))).ms);
		const r = { warmupMs: Math.round(warm.ms), medianMs: Math.round(median(ms)), minMs: Math.round(Math.min(...ms)), maxMs: Math.round(Math.max(...ms)), wasmMiB: size(CIRCUITS[c].wasm), zkeyMiB: size(CIRCUITS[c].zkey) };
		result[c] = r;
		console.log(`   ${c.padEnd(12)} ${JSON.stringify(r)}  runs=${JSON.stringify(ms.map(Math.round))}`);
	}
	console.log(`   sample inputs for the phone page: ${outDir}`);
	console.log(`RESULT ${JSON.stringify(result)}`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error("bench failed:", e);
		process.exit(1);
	});
