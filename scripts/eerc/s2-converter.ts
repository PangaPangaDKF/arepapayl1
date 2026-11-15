// S2 — eERC converter mode on the LOCAL arepapaybank L1 (chain 77077). Run via scripts/eerc/s2-run.sh.
//
// Steps: deploy test USD (6 dp) + eERC verifiers/Registrar/EncryptedERC (converter) as the S1 admin; enable + fund fresh
// local wallets; register alice/bob/merchant/auditor/eve; set auditor; deposits, private transfers with messages,
// withdraw; visibility proof; contract-account (S2Forwarder) registration + receive + send; timings and gas.
//
// Keys: the admin key is read from avalanche-cli's local key store (arepapay-local-admin, LOCAL-TEST-ONLY). All other
// EVM and BabyJubJub keys are generated in memory and discarded at exit. Nothing secret is printed or written.
import { Base8, mulPointEscalar } from "@zk-kit/baby-jubjub";
import { ethers } from "ethers";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { decryptPoint } from "../../src/jub/jub";
import {
	BjjKey,
	EERC_DIR,
	type Proved,
	decryptMetadata,
	decryptPCT,
	encryptMetadata,
	prove,
	registrationInput,
	transferInput,
	withdrawInput,
} from "./s2-common";

const REPO = process.env.AREPAPAY_REPO;
if (!REPO) throw new Error("AREPAPAY_REPO not set (use scripts/eerc/s2-run.sh)");
const L1 = JSON.parse(fs.readFileSync(path.join(REPO, "config/l1/arepapaybank.local.json"), "utf8"));
const OUT_CFG = path.join(REPO, "config/l1/eerc.local.json");
const EERC_DECIMALS = 2; // as scripts/constants.ts of the eERC repo (cents)
const USD_DECIMALS = 6; // stands in for bridged USDC

const art = (rel: string) => JSON.parse(fs.readFileSync(path.join(EERC_DIR, "artifacts", rel), "utf8"));
const A = {
	Registrar: art("contracts/Registrar.sol/Registrar.json"),
	EncryptedERC: art("contracts/EncryptedERC.sol/EncryptedERC.json"),
	BabyJubJub: art("contracts/libraries/BabyJubJub.sol/BabyJubJub.json"),
	SimpleERC20: art("contracts/tokens/SimpleERC20.sol/SimpleERC20.json"),
	RegistrationVerifier: art("contracts/prod/RegistrationVerifier.sol/RegistrationVerifier.json"),
	MintVerifier: art("contracts/prod/MintVerifier.sol/MintVerifier.json"),
	WithdrawVerifier: art("contracts/prod/WithdrawVerifier.sol/WithdrawVerifier.json"),
	TransferVerifier: art("contracts/prod/TransferVerifier.sol/TransferVerifier.json"),
	BurnVerifier: art("contracts/prod/BurnVerifier.sol/BurnVerifier.json"),
	S2Forwarder: art("contracts/arepapay/S2Forwarder.sol/S2Forwarder.json"),
};
const TX_ALLOWLIST_ABI = ["function setEnabled(address)", "function readAllowList(address) view returns (uint256)"];

const provider = new ethers.JsonRpcProvider(L1.rpcUrl, undefined, { staticNetwork: true, polling: true, pollingInterval: 250 } as never);
provider.pollingInterval = 250;

type Row = { step: string; who: string; proofMs?: number; gas: bigint; costArpb: string; sendToReceiptMs: number; e2eMs: number; tx: string };
const rows: Row[] = [];
const fmtUsd = (cents: bigint) => `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
const log = (...a: unknown[]) => console.log(...a);

async function send(step: string, who: string, fn: () => Promise<ethers.TransactionResponse>, proofMs?: number) {
	const t0 = performance.now();
	const tx = await fn();
	const rc = await tx.wait();
	const dt = performance.now() - t0;
	if (!rc || rc.status !== 1) throw new Error(`${step}: tx failed ${tx.hash}`);
	const cost = rc.gasUsed * rc.gasPrice;
	rows.push({ step, who, proofMs, gas: rc.gasUsed, costArpb: ethers.formatEther(cost), sendToReceiptMs: dt, e2eMs: dt + (proofMs ?? 0), tx: tx.hash });
	log(`  ok  ${step.padEnd(34)} gas=${rc.gasUsed.toString().padStart(8)}  send->receipt=${dt.toFixed(0)}ms${proofMs !== undefined ? `  proof=${proofMs.toFixed(0)}ms` : ""}  block=${rc.blockNumber}`);
	return rc;
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
	const f = new ethers.ContractFactory(abi, bytecode, signer);
	const t0 = performance.now();
	const c = await f.deploy(...args);
	const rc = await c.deploymentTransaction()!.wait();
	const dt = performance.now() - t0;
	const addr = await c.getAddress();
	rows.push({ step: `deploy ${name}`, who: "admin", gas: rc!.gasUsed, costArpb: ethers.formatEther(rc!.gasUsed * rc!.gasPrice), sendToReceiptMs: dt, e2eMs: dt, tx: rc!.hash });
	log(`  ok  deploy ${name.padEnd(27)} gas=${rc!.gasUsed.toString().padStart(8)}  at ${addr}`);
	return { addr, block: rc!.blockNumber };
}

const eg = (b: { eGCT: { c1: { x: bigint; y: bigint }; c2: { x: bigint; y: bigint } } }) => [b.eGCT.c1.x, b.eGCT.c1.y, b.eGCT.c2.x, b.eGCT.c2.y];
const sameBigs = (a: bigint[], b: bigint[]) => a.length === b.length && a.every((x, i) => BigInt(x) === BigInt(b[i]));

async function main() {
	log(`== S2 eERC converter @ ${L1.rpcUrl}`);
	const chainId = (await provider.getNetwork()).chainId;
	if (chainId !== BigInt(L1.chainId)) throw new Error(`chain id ${chainId} != config ${L1.chainId}`);
	log(`   chainId=${chainId}  block=${await provider.getBlockNumber()}  cpu="${os.cpus()[0].model}" x${os.cpus().length}  node=${process.version}`);

	// --- admin from the local CLI key store (LOCAL-TEST-ONLY) ---
	const keyFile = path.join(os.homedir(), ".avalanche-cli/key", `${L1.accounts.admin.cliKeyName}.pk`);
	const pk = fs.readFileSync(keyFile, "utf8").trim();
	const admin = new ethers.NonceManager(new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider));
	if ((await admin.getAddress()).toLowerCase() !== L1.accounts.admin.address.toLowerCase()) throw new Error("admin key does not match config");
	log(`   admin=${await admin.getAddress()}  balance=${ethers.formatEther(await provider.getBalance(await admin.getAddress()))} ARPB`);

	// --- 1. deploy ---
	log("\n[1] deploy (admin; deployer allowlist admin)");
	const usd = await deploy("TestUSD (6dp)", admin, A.SimpleERC20.abi, A.SimpleERC20.bytecode, ["ArepaPay Test USD", "tUSD", USD_DECIMALS]);
	const regV = await deploy("RegistrationVerifier", admin, A.RegistrationVerifier.abi, A.RegistrationVerifier.bytecode);
	const mintV = await deploy("MintVerifier", admin, A.MintVerifier.abi, A.MintVerifier.bytecode);
	const wdV = await deploy("WithdrawVerifier", admin, A.WithdrawVerifier.abi, A.WithdrawVerifier.bytecode);
	const trV = await deploy("TransferVerifier", admin, A.TransferVerifier.abi, A.TransferVerifier.bytecode);
	const burnV = await deploy("BurnVerifier", admin, A.BurnVerifier.abi, A.BurnVerifier.bytecode);
	const bjj = await deploy("BabyJubJub (library)", admin, A.BabyJubJub.abi, A.BabyJubJub.bytecode);
	const reg = await deploy("Registrar", admin, A.Registrar.abi, A.Registrar.bytecode, [regV.addr]);
	const eercBc = linkBytecode(A.EncryptedERC, { "contracts/libraries/BabyJubJub.sol:BabyJubJub": bjj.addr });
	const eercD = await deploy("EncryptedERC (converter)", admin, A.EncryptedERC.abi, eercBc, [
		{ registrar: reg.addr, isConverter: true, name: "", symbol: "", decimals: EERC_DECIMALS, mintVerifier: mintV.addr, withdrawVerifier: wdV.addr, transferVerifier: trV.addr, burnVerifier: burnV.addr },
	]);
	const registrar = new ethers.Contract(reg.addr, A.Registrar.abi, provider);
	const eerc = new ethers.Contract(eercD.addr, A.EncryptedERC.abi, provider);
	const token = new ethers.Contract(usd.addr, A.SimpleERC20.abi, provider);
	log(`   isConverter=${await eerc.isConverter()}  decimals=${await eerc.decimals()}  owner=${await eerc.owner()}`);

	// --- fresh local wallets: enable in txAllowList + fund ---
	log("\n[2] fresh local wallets (in memory) -> txAllowList.setEnabled + 5 ARPB each");
	const names = ["alice", "bob", "merchant", "auditor", "eve", "safeOwner"] as const;
	const W: Record<string, ethers.NonceManager> = {};
	const addr: Record<string, string> = {};
	const allow = new ethers.Contract(L1.precompiles.txAllowList.address, TX_ALLOWLIST_ABI, admin);
	for (const n of names) {
		const w = ethers.Wallet.createRandom().connect(provider);
		W[n] = new ethers.NonceManager(w);
		addr[n] = w.address;
		const before = await allow.readAllowList(w.address);
		await send(`txAllowList.setEnabled(${n})`, "admin", () => allow.setEnabled(w.address));
		await send(`fund ${n} 5 ARPB`, "admin", () => admin.sendTransaction({ to: w.address, value: ethers.parseEther("5") }));
		log(`      ${n.padEnd(9)} ${w.address} role ${before} -> ${await allow.readAllowList(w.address)}`);
	}

	// contract account: owner-controlled forwarder (stands in for a Safe)
	const fwdD = await deploy("S2Forwarder (owner=safeOwner)", admin, A.S2Forwarder.abi, A.S2Forwarder.bytecode, [addr.safeOwner]);
	const fwd = new ethers.Contract(fwdD.addr, A.S2Forwarder.abi, W.safeOwner);
	addr.fwd = fwdD.addr;
	log(`   S2Forwarder role in txAllowList: ${await allow.readAllowList(fwdD.addr)} (contracts are never tx.origin)`);

	// write config early (addresses only)
	const writeCfg = (extra: Record<string, unknown> = {}) => {
		const cfg = {
			_note: "Generated by scripts/eerc/s2-run.sh (spike S2). LOCAL ONLY. No keys. User/test addresses are ephemeral (keys were in memory only and are gone).",
			network: "local",
			chainId: Number(chainId),
			rpcUrl: L1.rpcUrl,
			l1Config: "config/l1/arepapaybank.local.json",
			eercSource: "ava-labs/EncryptedERC@8dc98cd (prod verifiers = circom/build keys)",
			mode: "converter",
			eercDecimals: EERC_DECIMALS,
			deployer: L1.accounts.admin.address,
			owner: L1.accounts.admin.address,
			deployBlock: usd.block,
			contracts: {
				testUSD: { address: usd.addr, decimals: USD_DECIMALS, symbol: "tUSD", note: "stand-in for bridged USDC; SimpleERC20 with open mint (test only)" },
				registrationVerifier: regV.addr,
				mintVerifier: mintV.addr,
				withdrawVerifier: wdV.addr,
				transferVerifier: trV.addr,
				burnVerifier: burnV.addr,
				babyJubJub: bjj.addr,
				registrar: reg.addr,
				encryptedERC: eercD.addr,
				s2Forwarder: fwdD.addr,
			},
			ephemeralAccounts: addr,
			...extra,
		};
		fs.writeFileSync(OUT_CFG, `${JSON.stringify(cfg, null, 2)}\n`);
	};
	writeCfg();
	log(`   wrote ${path.relative(REPO, OUT_CFG)}`);

	// --- 2. register ---
	log("\n[3] register (proof off-chain, register(proof) on-chain)");
	const K: Record<string, BjjKey> = {};
	const proofMs: Record<string, number[]> = { registration: [], transfer: [], withdraw: [] };
	for (const n of ["alice", "bob", "merchant", "auditor", "eve"]) {
		K[n] = new BjjKey();
		const p = await prove("registration", registrationInput(K[n], addr[n], chainId));
		proofMs.registration.push(p.ms);
		await send(`register ${n}`, n, () => (registrar.connect(W[n]) as ethers.Contract).register({ proofPoints: p.proofPoints, publicSignals: p.publicSignals }), p.ms);
	}
	// contract account: proof for the FORWARDER's address, tx sent through the forwarder by its owner
	K.fwd = new BjjKey();
	{
		const p = await prove("registration", registrationInput(K.fwd, addr.fwd, chainId));
		proofMs.registration.push(p.ms);
		// negative control: the owner EOA cannot register the forwarder's proof directly (msg.sender != SenderAddress)
		try {
			await (registrar.connect(W.safeOwner) as ethers.Contract).register.staticCall({ proofPoints: p.proofPoints, publicSignals: p.publicSignals });
			log("  !! direct register by owner EOA unexpectedly succeeded in simulation");
		} catch (e) {
			log(`      control: owner EOA calling register(fwd proof) directly -> revert ${registrar.interface.parseError((e as { data: string }).data)?.name ?? (e as Error).message.slice(0, 80)}`);
		}
		const data = registrar.interface.encodeFunctionData("register", [{ proofPoints: p.proofPoints, publicSignals: p.publicSignals }]);
		await send("register S2Forwarder (via execute)", "safeOwner->fwd", () => fwd.execute(reg.addr, data), p.ms);
	}
	for (const n of ["alice", "bob", "merchant", "auditor", "eve", "fwd"]) {
		const onchain = (await registrar.getUserPublicKey(addr[n])).map(BigInt);
		if (!(await registrar.isUserRegistered(addr[n])) || !sameBigs(onchain, K[n].publicKey)) throw new Error(`registration check failed for ${n}`);
	}
	log("   all 6 accounts registered with the expected public keys (incl. the contract account)");

	await send("setAuditorPublicKey(auditor)", "admin", () => (eerc.connect(admin) as ethers.Contract).setAuditorPublicKey(addr.auditor));
	const auditorPub = (await eerc.auditorPublicKey()).map(BigInt);
	log(`   auditor=${await eerc.auditor()}  isAuditorKeySet=${await eerc.isAuditorKeySet()}  matches auditor BJJ key: ${sameBigs(auditorPub, K.auditor.publicKey)}`);

	// --- 3. flows ---
	const plain: Record<string, bigint> = { alice: 0n, bob: 0n, merchant: 0n, auditor: 0n, eve: 0n, fwd: 0n };
	let tokenId = 0n;
	const encBal = async (n: string) => eg(await eerc.balanceOf(addr[n], tokenId));
	const checkBal = async (n: string) => {
		const e = await encBal(n);
		const pt = decryptPoint(K[n].privateKey, e.slice(0, 2), e.slice(2, 4)).map(BigInt);
		const exp = mulPointEscalar(Base8, plain[n]).map(BigInt);
		if (!sameBigs(pt, exp)) throw new Error(`balance mismatch for ${n}: expected ${plain[n]}`);
		return `${n}=${fmtUsd(plain[n])}`;
	};

	const deposit = async (n: string, cents: bigint) => {
		const raw = cents * 10n ** BigInt(USD_DECIMALS - EERC_DECIMALS);
		await send(`mint tUSD ${fmtUsd(cents)} -> ${n}`, "admin", () => (token.connect(admin) as ethers.Contract).mint(addr[n], raw));
		await send(`approve eERC (${n})`, n, () => (token.connect(W[n]) as ethers.Contract).approve(eercD.addr, raw));
		const { ciphertext, nonce, authKey } = (await import("../../src/poseidon/poseidon")).processPoseidonEncryption([cents], K[n].publicKey);
		await send(`deposit ${fmtUsd(cents)} (${n})`, n, () => (eerc.connect(W[n]) as ethers.Contract)["deposit(uint256,address,uint256[7])"](raw, usd.addr, [...ciphertext, ...authKey, nonce]));
		tokenId = await eerc.tokenIds(usd.addr);
		plain[n] += cents;
	};

	// sender may be an EOA (direct) or the forwarder (proof off-chain, tx through execute)
	const transfer = async (from: string, to: string, cents: bigint, message: string) => {
		const recvPub = (await registrar.getUserPublicKey(addr[to])).map(BigInt);
		const { input, balancePCT } = transferInput(K[from], plain[from], await encBal(from), recvPub, auditorPub, cents);
		const p: Proved = await prove("transfer", input);
		proofMs.transfer.push(p.ms);
		const msg = encryptMetadata(recvPub, message);
		const args = [addr[to], tokenId, { proofPoints: p.proofPoints, publicSignals: p.publicSignals }, balancePCT, msg];
		const sig = "transfer(address,uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[32]),uint256[7],bytes)";
		if (from === "fwd") {
			const data = eerc.interface.encodeFunctionData(sig, args);
			await send(`transfer ${fmtUsd(cents)} fwd->${to} (via execute)`, "safeOwner->fwd", () => fwd.execute(eercD.addr, data), p.ms);
		} else {
			await send(`transfer ${fmtUsd(cents)} ${from}->${to} +msg`, from, () => (eerc.connect(W[from]) as ethers.Contract)[sig](...args), p.ms);
		}
		plain[from] -= cents;
		plain[to] += cents;
	};

	const withdraw = async (n: string, cents: bigint) => {
		const { input, balancePCT } = withdrawInput(K[n], plain[n], await encBal(n), auditorPub, cents);
		const p = await prove("withdraw", input);
		proofMs.withdraw.push(p.ms);
		const before = await token.balanceOf(addr[n]);
		await send(`withdraw ${fmtUsd(cents)} (${n})`, n, () => (eerc.connect(W[n]) as ethers.Contract)["withdraw(uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[16]),uint256[7])"](tokenId, { proofPoints: p.proofPoints, publicSignals: p.publicSignals }, balancePCT), p.ms);
		plain[n] -= cents;
		log(`      ${n} tUSD (ERC-20) ${ethers.formatUnits(before, USD_DECIMALS)} -> ${ethers.formatUnits(await token.balanceOf(addr[n]), USD_DECIMALS)}`);
	};

	log("\n[4] alice deposits 10.00, alice -> merchant 3.00 (+message); bob deposits 10.00, bob -> merchant 2.00; merchant withdraws 5.00");
	await deposit("alice", 1000n);
	log(`      ${await checkBal("alice")}  tokenId=${tokenId}`);
	await transfer("alice", "merchant", 300n, "intent:SPLIT-0001 part 1/2");
	await deposit("bob", 1000n);
	await transfer("bob", "merchant", 200n, "intent:SPLIT-0001 part 2/2");
	log(`      ${await checkBal("alice")}  ${await checkBal("bob")}  ${await checkBal("merchant")}`);
	await withdraw("merchant", 500n);
	log(`      ${await checkBal("merchant")}  eERC contract holds tUSD ${ethers.formatUnits(await token.balanceOf(eercD.addr), USD_DECIMALS)}`);

	log("\n[5] contract account: alice -> S2Forwarder 1.00, then S2Forwarder -> merchant 0.40 (proof off-chain by the BJJ key holder, tx by the owner through execute)");
	await transfer("alice", "fwd", 100n, "escrow-in:SPLIT-0002");
	log(`      ${await checkBal("fwd")}`);
	await transfer("fwd", "merchant", 40n, "escrow-out:SPLIT-0002");
	log(`      ${await checkBal("fwd")}  ${await checkBal("merchant")}  ${await checkBal("alice")}`);

	// --- 4. visibility ---
	log("\n[6] who can see what");
	const fromBlock = eercD.block;
	const nameOf = (a: string) => Object.entries(addr).find(([, v]) => v.toLowerCase() === a.toLowerCase())?.[0] ?? a;
	const dep = await eerc.queryFilter(eerc.filters.Deposit(), fromBlock);
	for (const e of dep as ethers.EventLog[]) log(`   Deposit   user=${nameOf(e.args.user)} amount=${ethers.formatUnits(e.args.amount, USD_DECIMALS)} tUSD (PLAINTEXT on chain) dust=${e.args.dust}`);
	const wd = await eerc.queryFilter(eerc.filters.Withdraw(), fromBlock);
	for (const e of wd as ethers.EventLog[]) log(`   Withdraw  user=${nameOf(e.args.user)} amount=${fmtUsd(e.args.amount)} (PLAINTEXT on chain, eERC units)`);
	const msgs = (await eerc.queryFilter(eerc.filters.PrivateMessage(), fromBlock)) as ethers.EventLog[];
	const pts = (await eerc.queryFilter(eerc.filters.PrivateTransfer(), fromBlock)) as ethers.EventLog[];
	const visibility: Record<string, unknown>[] = [];
	const tryDec = (f: () => unknown) => {
		try {
			return String(f());
		} catch (e) {
			return `FAILS (${(e as Error).message.slice(0, 60)})`;
		}
	};
	for (const e of pts) {
		const from = nameOf(e.args.from);
		const to = nameOf(e.args.to);
		const tx = await provider.getTransaction(e.transactionHash);
		// receiver PCT is publicSignals[16..22] of the transfer proof; for forwarder txs unwrap execute() first
		let calldata = tx!.data;
		if (tx!.to?.toLowerCase() === addr.fwd.toLowerCase()) calldata = fwd.interface.decodeFunctionData("execute", calldata)[1];
		const parsed = eerc.interface.parseTransaction({ data: calldata })!;
		const ps = (parsed.args[2].publicSignals as bigint[]).map(BigInt);
		const receiverPCT = ps.slice(16, 23);
		const auditorPCT = (e.args.auditorPCT as bigint[]).map(BigInt);
		const m = msgs.find((x) => x.transactionHash === e.transactionHash);
		const row = {
			tx: e.transactionHash,
			from,
			to,
			auditorAddressInEvent: nameOf(e.args.auditorAddress),
			receiverDecrypts: tryDec(() => fmtUsd(decryptPCT(K[to].privateKey, receiverPCT))),
			auditorDecrypts: tryDec(() => fmtUsd(decryptPCT(K.auditor.privateKey, auditorPCT))),
			eveOnReceiverPCT: tryDec(() => fmtUsd(decryptPCT(K.eve.privateKey, receiverPCT))),
			eveOnAuditorPCT: tryDec(() => fmtUsd(decryptPCT(K.eve.privateKey, auditorPCT))),
			messageByReceiver: m ? tryDec(() => decryptMetadata(K[to].privateKey, m.args.metadata.encryptedMsg)) : "-",
			messageByEve: m ? tryDec(() => decryptMetadata(K.eve.privateKey, m.args.metadata.encryptedMsg)) : "-",
			messageTypeInClear: m ? m.args.metadata.messageType : "-",
		};
		visibility.push(row);
		log(`   PrivateTransfer from=${from} to=${to} (addresses in clear; auditorAddress=${row.auditorAddressInEvent})`);
		log(`      receiver(${to}) key -> ${row.receiverDecrypts} | auditor key -> ${row.auditorDecrypts} | eve on receiverPCT -> ${row.eveOnReceiverPCT} | eve on auditorPCT -> ${row.eveOnAuditorPCT}`);
		log(`      message(${row.messageTypeInClear}) receiver -> "${row.messageByReceiver}" | eve -> ${row.messageByEve}`);
	}
	// eve vs merchant's encrypted balance (ElGamal): decrypting with the wrong key gives a point that is not amount*G
	{
		const e = await encBal("merchant");
		const wrong = decryptPoint(K.eve.privateKey, e.slice(0, 2), e.slice(2, 4)).map(BigInt);
		const right = decryptPoint(K.merchant.privateKey, e.slice(0, 2), e.slice(2, 4)).map(BigInt);
		let found = -1;
		for (let v = 0n; v <= 100000n; v++) {
			if (sameBigs(mulPointEscalar(Base8, v).map(BigInt), wrong)) {
				found = Number(v);
				break;
			}
			if (v > 2000n) break; // brute-force window kept small for runtime; the point is not in it
		}
		log(`   merchant encrypted balance: merchant key -> ${sameBigs(right, mulPointEscalar(Base8, plain.merchant).map(BigInt)) ? fmtUsd(plain.merchant) : "??"} | eve key -> point not equal to v*G for v in 0..20.00 (${found < 0 ? "no match" : `match ${found}?!`})`);
	}

	// --- summary ---
	log("\n[7] gas / latency table");
	for (const r of rows) log(`   ${r.step.padEnd(40)} ${r.who.padEnd(15)} gas=${r.gas.toString().padStart(8)} cost=${Number(r.costArpb).toFixed(6)} ARPB  proof=${r.proofMs !== undefined ? `${r.proofMs.toFixed(0)}ms` : "-"}  send->receipt=${r.sendToReceiptMs.toFixed(0)}ms  e2e=${r.e2eMs.toFixed(0)}ms`);
	const stats = (xs: number[]) => (xs.length ? { n: xs.length, min: Math.min(...xs).toFixed(0), max: Math.max(...xs).toFixed(0), runs: xs.map((x) => Math.round(x)) } : null);
	log(`   proof ms (in-flow, first call includes curve init): ${JSON.stringify({ registration: stats(proofMs.registration), transfer: stats(proofMs.transfer), withdraw: stats(proofMs.withdraw) })}`);
	writeCfg({ tokenIds: { testUSD: Number(tokenId) }, auditor: addr.auditor, lastRun: { finalPlainBalancesCents: Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, Number(v)])) } });
	log(`   wrote ${path.relative(REPO, OUT_CFG)}`);
	log("== S2 converter flow: PASS");
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error("== S2 FAIL:", e instanceof Error ? e.message : e);
		process.exit(1);
	});
