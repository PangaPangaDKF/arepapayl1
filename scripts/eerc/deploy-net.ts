// D-032 — deploy the eERC converter over the MVP test USD on an ArepaPay L1 (NET=local|fuji). TESTNET ONLY.
// Run through scripts/eerc/deploy.sh (copies this file into the pinned eERC clone so its node_modules/artifacts resolve).
//
// What it does (idempotent: an existing config/l1/eerc.<net>.json whose contracts have code is kept unless FORCE=1):
//   1. admin (contractDeployerAllowList admin) deploys the 5 prod verifiers, the BabyJubJub library, Registrar and
//      EncryptedERC in converter mode (2 decimals = cents), over the tUSD from config/l1/mvp.<net>.json.
//   2. the gas station account (the bank's operations account) registers a fresh BabyJubJub key and becomes the auditor.
//      That auditor key is the bank's view key for this testnet: written to ~/.avalanche-cli/key/arepapay-<net>-auditor.bjj
//      (mode 0600), never printed, never in the repo.
//   3. writes config/l1/eerc.<net>.json (addresses only) for the onboarding service and the dApp (R7).
// Keys: admin and gas-station keys are read from avalanche-cli's key store (testnet keys), kept in memory, never printed.
import { Base8, mulPointEscalar, subOrder } from "@zk-kit/baby-jubjub";
import { ethers } from "ethers";
import { formatPrivKeyForBabyJub, genPrivKey } from "maci-crypto";
import { poseidon3 } from "poseidon-lite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs = require("snarkjs");

const REPO = process.env.AREPAPAY_REPO;
const NET = process.env.NET || "fuji";
if (!REPO) throw new Error("AREPAPAY_REPO not set (use scripts/eerc/deploy.sh)");
if (!/^(local|fuji)$/.test(NET)) throw new Error("NET must be local or fuji");
const EERC_DIR = path.resolve(__dirname, "../..");
const L1 = JSON.parse(fs.readFileSync(path.join(REPO, `config/l1/arepapaybank.${NET}.json`), "utf8"));
const MVP = JSON.parse(fs.readFileSync(path.join(REPO, `config/l1/mvp.${NET}.json`), "utf8"));
const OUT_CFG = path.join(REPO, `config/l1/eerc.${NET}.json`);
const AUDITOR_KEY = path.join(os.homedir(), ".avalanche-cli/key", `arepapay-${NET}-auditor.bjj`);
const EERC_DECIMALS = 2;
const log = (...a: unknown[]) => console.log(...a);

const art = (rel: string) => JSON.parse(fs.readFileSync(path.join(EERC_DIR, "artifacts", rel), "utf8"));
const A = {
	Registrar: art("contracts/Registrar.sol/Registrar.json"),
	EncryptedERC: art("contracts/EncryptedERC.sol/EncryptedERC.json"),
	BabyJubJub: art("contracts/libraries/BabyJubJub.sol/BabyJubJub.json"),
	RegistrationVerifier: art("contracts/prod/RegistrationVerifier.sol/RegistrationVerifier.json"),
	MintVerifier: art("contracts/prod/MintVerifier.sol/MintVerifier.json"),
	WithdrawVerifier: art("contracts/prod/WithdrawVerifier.sol/WithdrawVerifier.json"),
	TransferVerifier: art("contracts/prod/TransferVerifier.sol/TransferVerifier.json"),
	BurnVerifier: art("contracts/prod/BurnVerifier.sol/BurnVerifier.json"),
};

const provider = new ethers.JsonRpcProvider(L1.rpcUrl, undefined, { staticNetwork: true } as never);
provider.pollingInterval = 500;

function wallet(cliKeyName: string, expect: string) {
	const pk = fs.readFileSync(path.join(os.homedir(), ".avalanche-cli/key", `${cliKeyName}.pk`), "utf8").trim();
	const w = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
	if (w.address.toLowerCase() !== expect.toLowerCase()) throw new Error(`key ${cliKeyName} does not match the config address`);
	return new ethers.NonceManager(w);
}

function linkBytecode(artifact: { bytecode: string; linkReferences: Record<string, Record<string, { start: number; length: number }[]>> }, libs: Record<string, string>) {
	let bc = artifact.bytecode.slice(2);
	for (const [file, names] of Object.entries(artifact.linkReferences)) {
		for (const [name, refs] of Object.entries(names)) {
			const addr = libs[`${file}:${name}`];
			if (!addr) throw new Error(`missing lib ${file}:${name}`);
			for (const r of refs) bc = bc.slice(0, r.start * 2) + addr.slice(2).toLowerCase() + bc.slice((r.start + r.length) * 2);
		}
	}
	return `0x${bc}`;
}

async function deploy(name: string, signer: ethers.Signer, abi: ethers.InterfaceAbi, bytecode: string, args: unknown[] = []) {
	const c = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args);
	const rc = await c.deploymentTransaction()!.wait();
	const addr = await c.getAddress();
	log(`  ok  deploy ${name.padEnd(26)} gas=${rc!.gasUsed.toString().padStart(8)}  at ${addr}`);
	return { addr, block: rc!.blockNumber };
}

async function hasCode(a?: string) {
	return !!a && (await provider.getCode(a)) !== "0x";
}

async function main() {
	const chainId = (await provider.getNetwork()).chainId;
	if (chainId !== BigInt(L1.chainId)) throw new Error(`chain id ${chainId} != config ${L1.chainId}`);
	log(`== eERC deploy on ${NET} (chain ${chainId}), tUSD ${MVP.testUsd}`);

	if (fs.existsSync(OUT_CFG) && process.env.FORCE !== "1") {
		const old = JSON.parse(fs.readFileSync(OUT_CFG, "utf8"));
		if ((await hasCode(old.contracts?.encryptedERC)) && (await hasCode(old.contracts?.registrar))) {
			log(`   ${path.relative(REPO, OUT_CFG)} exists and its contracts have code: nothing to do (FORCE=1 redeploys)`);
			return;
		}
	}
	if (!(await hasCode(MVP.testUsd))) throw new Error("tUSD from mvp config has no code on this chain");

	const admin = wallet(L1.accounts.admin.cliKeyName, L1.accounts.admin.address);
	const gas = wallet(L1.accounts.gasStation.cliKeyName, MVP.onboarder);
	const gasAddr = await gas.getAddress();

	log("[1] deploy (admin)");
	const regV = await deploy("RegistrationVerifier", admin, A.RegistrationVerifier.abi, A.RegistrationVerifier.bytecode);
	const mintV = await deploy("MintVerifier", admin, A.MintVerifier.abi, A.MintVerifier.bytecode);
	const wdV = await deploy("WithdrawVerifier", admin, A.WithdrawVerifier.abi, A.WithdrawVerifier.bytecode);
	const trV = await deploy("TransferVerifier", admin, A.TransferVerifier.abi, A.TransferVerifier.bytecode);
	const burnV = await deploy("BurnVerifier", admin, A.BurnVerifier.abi, A.BurnVerifier.bytecode);
	const bjj = await deploy("BabyJubJub (library)", admin, A.BabyJubJub.abi, A.BabyJubJub.bytecode);
	const reg = await deploy("Registrar", admin, A.Registrar.abi, A.Registrar.bytecode, [regV.addr]);
	const eercD = await deploy("EncryptedERC (converter)", admin, A.EncryptedERC.abi, linkBytecode(A.EncryptedERC, { "contracts/libraries/BabyJubJub.sol:BabyJubJub": bjj.addr }), [
		{ registrar: reg.addr, isConverter: true, name: "", symbol: "", decimals: EERC_DECIMALS, mintVerifier: mintV.addr, withdrawVerifier: wdV.addr, transferVerifier: trV.addr, burnVerifier: burnV.addr },
	]);
	const registrar = new ethers.Contract(reg.addr, A.Registrar.abi, provider);
	const eerc = new ethers.Contract(eercD.addr, A.EncryptedERC.abi, provider);

	log("[2] auditor = gas station (bank operations account) with a fresh BabyJubJub key");
	const raw = genPrivKey();
	const formatted = formatPrivKeyForBabyJub(raw) % subOrder;
	const pub = mulPointEscalar(Base8, formatted).map((x) => BigInt(x));
	const input = { SenderPrivateKey: formatted, SenderPublicKey: pub, SenderAddress: BigInt(gasAddr), ChainID: chainId, RegistrationHash: poseidon3([chainId, formatted, BigInt(gasAddr)]) };
	const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, path.join(EERC_DIR, "circom/build/registration/registration.wasm"), path.join(EERC_DIR, "circom/build/registration/circuit_final.zkey"));
	const proofPoints = { a: [proof.pi_a[0], proof.pi_a[1]], b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]], c: [proof.pi_c[0], proof.pi_c[1]] };
	// store the key BEFORE the tx so a crash never leaves a registered key we cannot use
	fs.mkdirSync(path.dirname(AUDITOR_KEY), { recursive: true });
	fs.writeFileSync(AUDITOR_KEY, JSON.stringify({ note: `TESTNET auditor BabyJubJub key for eERC on ${NET} (D-032). Never commit.`, address: gasAddr, privateKey: raw.toString() }), { mode: 0o600 });
	fs.chmodSync(AUDITOR_KEY, 0o600);
	if (await registrar.isUserRegistered(gasAddr)) throw new Error("gas station already registered on this Registrar (unexpected for a fresh deploy)");
	const tx1 = await (registrar.connect(gas) as ethers.Contract).register({ proofPoints, publicSignals });
	log(`  ok  register gas station          gas=${(await tx1.wait()).gasUsed}`);
	const tx2 = await (eerc.connect(admin) as ethers.Contract).setAuditorPublicKey(gasAddr);
	log(`  ok  setAuditorPublicKey           gas=${(await tx2.wait()).gasUsed}`);
	const onchain = (await eerc.auditorPublicKey()).map(BigInt);
	if (onchain[0] !== pub[0] || onchain[1] !== pub[1]) throw new Error("auditor public key on chain does not match");
	log(`   auditor=${await eerc.auditor()} key file ${AUDITOR_KEY.replace(os.homedir(), "~")} (0600)`);

	const cfg = {
		_note: `GENERATED by scripts/eerc/deploy.sh ${NET} (D-032). Do not hand-edit. TESTNET ONLY. No keys.`,
		network: NET,
		chainId: Number(chainId),
		l1Config: `config/l1/arepapaybank.${NET}.json`,
		mvpConfig: `config/l1/mvp.${NET}.json`,
		eercSource: "ava-labs/EncryptedERC@8dc98cd (prod verifiers = shipped circom/build keys)",
		mode: "converter",
		eercDecimals: EERC_DECIMALS,
		token: MVP.testUsd,
		tokenDecimals: MVP.testUsdDecimals,
		owner: L1.accounts.admin.address,
		auditor: gasAddr,
		deployBlock: regV.block,
		contracts: {
			registrationVerifier: regV.addr,
			mintVerifier: mintV.addr,
			withdrawVerifier: wdV.addr,
			transferVerifier: trV.addr,
			burnVerifier: burnV.addr,
			babyJubJub: bjj.addr,
			registrar: reg.addr,
			encryptedERC: eercD.addr,
		},
	};
	fs.writeFileSync(OUT_CFG, `${JSON.stringify(cfg, null, 2)}\n`);
	log(`   wrote ${path.relative(REPO, OUT_CFG)}\n== eERC deploy: PASS`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error("== eERC deploy FAIL:", e instanceof Error ? e.message : e);
		process.exit(1);
	});
