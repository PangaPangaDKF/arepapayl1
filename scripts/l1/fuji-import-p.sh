#!/usr/bin/env bash
# Stage B — import pending C-Chain -> P-Chain atomic UTXOs for a CLI-stored key on FUJI (testnet AVAX only).
#
# Why: avalanche-cli 1.9.6/1.9.7 `key transfer` C->P issues the ExportTx and then dies on `avax.getAtomicTxStatus`,
# which the public Fuji API no longer serves, so the ImportTx is never sent. Our own node runs partial sync (P only), so
# its shared memory never sees C-Chain exports. This script builds the P-Chain ImportTx from the public API's
# `platform.getUTXOs(sourceChain=C)` with @avalabs/avalanchejs and issues it there.
#
# Usage: AVALANCHEJS_DIR=<dir with node_modules/@avalabs/avalanchejs> scripts/l1/fuji-import-p.sh [cliKeyName]
# Keys (N6): reads ~/.avalanche-cli/key/<name>.pk at runtime into memory only; never printed or written.
set -euo pipefail
set +x
KEY_NAME="${1:-arepapay-fuji}"
KEY_FILE="$HOME/.avalanche-cli/key/$KEY_NAME.pk"
URI="${FUJI_PUBLIC_URI:-https://api.avax-test.network}"
VERIFY_URI="${FUJI_NODE_URI:-http://127.0.0.1:9750}"
[ -r "$KEY_FILE" ] || { echo "key $KEY_NAME not in the avalanche-cli key store"; exit 2; }
[ -d "${AVALANCHEJS_DIR:-}/node_modules/@avalabs/avalanchejs" ] || { echo "set AVALANCHEJS_DIR (npm i --ignore-scripts @avalabs/avalanchejs@5.2.0)"; exit 2; }

cd "$AVALANCHEJS_DIR"
KEY_FILE="$KEY_FILE" URI="$URI" VERIFY_URI="$VERIFY_URI" node --input-type=module <<'EOF'
import { readFileSync } from 'node:fs';
import { pvm, utils, secp256k1, addTxSignatures, Context } from '@avalabs/avalanchejs';
const { URI, VERIFY_URI } = process.env;
let pk = utils.hexToBuffer(readFileSync(process.env.KEY_FILE, 'utf8').trim().replace(/^0x/, ''));
const pub = secp256k1.getPublicKey(pk);
const pAddr = 'P-' + utils.formatBech32('fuji', secp256k1.publicKeyBytesToAddress(pub));
const addrBytes = utils.bech32ToBytes(pAddr);
const context = await Context.getContextFromURI(URI);
const api = new pvm.PVMApi(URI);
const { utxos } = await api.getUTXOs({ sourceChain: 'C', addresses: [pAddr] });
const total = utxos.reduce((s, u) => s + u.output.amount(), 0n);
console.log(`P address ${pAddr}: ${utxos.length} pending atomic UTXO(s) from C, ${Number(total) / 1e9} AVAX`);
if (!utxos.length) process.exit(0);
const feeState = await api.getFeeState();
const tx = pvm.e.newImportTx({ fromAddressesBytes: [addrBytes], toAddressesBytes: [addrBytes], sourceChainId: context.cBlockchainID, utxos, feeState }, context);
await addTxSignatures({ unsignedTx: tx, privateKeys: [pk] });
pk = null;
const { txID } = await api.issueSignedTx(tx.getSignedTx());
console.log(`ImportTx issued: ${txID}`);
for (let i = 0; i < 30; i++) {
  const { status } = await api.getTxStatus({ txID });
  if (status === 'Committed') { console.log('ImportTx Committed'); break; }
  if (status === 'Dropped') { console.log('ImportTx Dropped'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 2000));
}
const call = async (uri) => (await fetch(`${uri}/ext/bc/P`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'platform.getBalance', params: { addresses: [pAddr] } }) })).json();
const b = await call(VERIFY_URI);
console.log(`platform.getBalance via ${VERIFY_URI}: ${b.result ? Number(b.result.balance) / 1e9 + ' AVAX' : JSON.stringify(b.error)}`);
EOF
