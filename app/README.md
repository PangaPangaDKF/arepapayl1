# ArepaPay MVP test dApp (D-022)

**TESTNET ONLY, no real money.** One static page (`index.html` + `app.js`, no build step) for Split Pay on the ArepaPay L1.
It runs in the MetaMask mobile in-app browser and on desktop with MetaMask.

## Run locally (LOCAL L1 from spike S1 must be running)
```bash
# 1. deploy the test stack -> generates config/l1/mvp.local.json (needs the S1 admin key in ~/.avalanche-cli/key)
bash scripts/mvp/deploy.sh local

# 2. onboarding service (test-KYC stand-in), port 8787; it also serves the dApp config at /config/<net>
(cd backend/onboarding && npm ci || npm install)
node backend/onboarding/server.mjs                     # manual approval
AUTO_APPROVE=1 node backend/onboarding/server.mjs      # demo: approve every request at once

# 3. serve the page
cd app && python3 -m http.server 8080                  # open http://localhost:8080/
```
Admin: `node backend/onboarding/admin.mjs list` / `node backend/onboarding/admin.mjs approve 0x…`.
Approve = txAllowList `setEnabled` (admin key) + 1 ARPB gas top-up + 50 tUSD mint (gas-station key, once per address).

Service env: `PORT` (8787), `HOST` (127.0.0.1), `NET` (local), `CORS_ORIGINS` (default `http://localhost:8080,http://127.0.0.1:8080`;
`*` allowed), `AUTO_APPROVE=1`, `PUBLIC_RPC_URL` (RPC handed to wallets instead of the config one), `ADMIN_KEY_FILE`,
`GAS_KEY_FILE` (on local they default to `~/.avalanche-cli/key/<cliKeyName>.pk` from the chain config), `GAS_TOPUP`, `MINT_USD`.
Keys are read into memory only and never logged. Requests are stored in `backend/onboarding/data/` (gitignored).

Page URL params: `?net=local|fuji` (default local), `?api=<onboarding URL>` (default `<page host>:8787`), `?intent=<id>`.

End-to-end check: `bash scripts/mvp/e2e-local.sh` (`E2E_BREAK=1` proves it can fail).

## Use
1. "Agregar / cambiar a ArepaPay L1" → "Conectar" → "Solicitar acceso" (wait for approval).
2. **Comercio:** amount in USD (Bs shown with your rate) → "Crear cobro (QR)". Single payer = auto-capture; "Pago dividido"
   sets the number of payers and optional final confirmation. Show the QR / link.
3. **Cliente:** "Escanear QR" (camera) or type the charge number / paste the link (`?intent=<id>`) → see total, state
   ("Detalles del cobro" for covered, remaining, fee) → "Pagar" (approve + authorize).
   Confirm if required. If the intent is cancelled or expires, "Retirar mi parte".

Screen (D-030): once connected the main view is only the balance and the big actions; address, network, access and gas
live in the collapsed "Detalles" panel (element ids unchanged, `scripts/browser/wallet-e2e.mjs` reads them).
The network button shows only on the wrong chain, "Solicitar acceso" only while not allowlisted.
- **QR scanner:** port of v1 `QRScanner.jsx` (getUserMedia rear camera → canvas → jsQR per animation frame, tracks
  stopped on success/close/tab hidden). jsQR 1.4.0 is loaded on demand from jsDelivr, pinned with SRI. It accepts the
  v2 link (`intent` param; a different `net` is refused) or a bare number. No camera / denied / plain http → an inline
  error and the manual field. Camera access needs HTTPS (the public tunnel) or localhost.
- **Payment alert:** when the merchant's own charge goes to "Cobrado" while the page is watching it (3 s poll), a
  "¡Pago recibido!" overlay with the amount, a WebAudio beep (unlocked by the merchant's earlier tap) and
  `navigator.vibrate`; once per charge, dismiss with "Listo", the backdrop or Escape.

## Saldo privado: encrypted balances (eERC, D-032)
Third tab **Privado**. Uses Ava Labs' EncryptedERC (converter mode, `ava-labs/EncryptedERC@8dc98cd`) over the same tUSD.
1. **Ver mi saldo privado**: the wallet signs a fixed message (the official eERC SDK message); the page derives the
   BabyJubJub key from it, in memory only. The same wallet always gives the same key.
2. **Activar saldo privado** (once): registration proof (~1-2 s) + `Registrar.register`.
3. **Pasar a privado**: approve + `deposit` (the amount is public as it enters).
4. **Enviar privado**: to a registered address (type it, scan the receiver's QR, or open their `?pto=<address>` link);
   transfer proof in the page (desktop ~5-8 s, phone slower; the message shows the time) + `transfer`. The amount and both
   balances are encrypted; **sender and receiver addresses stay public**. The bank's auditor key can read every amount.
5. **Pasar a saldo normal**: withdraw proof + `withdraw` (the amount is public as it leaves).
The balance is decrypted from the on-chain PCTs and checked against the ElGamal ciphertext; if they disagree the page
says so and refuses to send. The tab re-reads the balance every 6 s, so a received payment appears by itself.

Setup (once per machine / network):
```bash
bash scripts/eerc/deploy.sh prepare     # clone EncryptedERC@8dc98cd to ~/.cache/arepapay, npm --ignore-scripts, compile
bash scripts/eerc/deploy.sh circuits    # app/circuits/ (gitignored, ~29 MB), checked against config/l1/eerc-circuits.sha256
bash scripts/eerc/deploy.sh fuji        # only if config/l1/eerc.fuji.json is missing (idempotent)
NET=fuji node scripts/eerc/audit-view.mjs   # the bank's view: decrypts every private amount with the auditor key
```
`vendor/eerc-lib.js` is built from `scripts/eerc/browser/eerc-lib.src.mjs` (`npm --prefix scripts/eerc/browser run build`);
the gate checks the committed bundle equals a fresh build and runs its tests (real proofs verified by snarkjs).

## Phone on the local L1
The local RPC is `127.0.0.1` inside this machine, so a phone can't reach it. For a LAN test, expose the node RPC and the
service on the LAN and start the service with `HOST=0.0.0.0 PUBLIC_RPC_URL=http://<lan-ip>:9654/ext/bc/<id>/rpc
CORS_ORIGINS=http://<lan-ip>:8080`. MetaMask mobile may refuse plain-HTTP RPCs; that is why "testable by anyone" needs Fuji.

## Public test on Fuji (stage B, D-019 / D-026) — live
```bash
~/.avalanche-cli-latest/bin/avalanche node local start arepapay-fuji   # after a reboot: the L1 validator + RPC
bash scripts/mvp/serve-public.sh start     # service + cloudflared tunnel; prints https://<random>.trycloudflare.com
bash scripts/mvp/serve-public.sh status    # supervisor / server / tunnel up?  url
```
- `https://<url>/` is the landing, `https://<url>/app/` the dApp, `https://<url>/rpc` the restricted RPC (MetaMask adds it).
- Testers are auto-approved (`AUTO_APPROVE=1`: allowlisted, 1 ARPB gas, 50 tUSD once). Test money only.
- Tests: `NET=fuji SKIP_DEPLOY=1 bash scripts/mvp/e2e.sh` (19 steps) and
  `node scripts/browser/wallet-e2e.mjs https://<url>/app/` (18 steps through the real UI).

## What changes for Fuji
- Deploy the Fuji L1 (S1 Fuji path) → `config/l1/arepapaybank.fuji.json`, then deploy the MVP stack with the **user's own
  keystore** (not the CLI local keys) → `config/l1/mvp.fuji.json`. `deploy.sh` refuses non-local networks on purpose.
- A public **HTTPS** RPC for the L1 (Q18), set as the config RPC or `PUBLIC_RPC_URL`.
- Host `app/` and the onboarding service over HTTPS; open `…/index.html?net=fuji&api=https://<service>`;
  set `CORS_ORIGINS` to the page origin and `NET=fuji`, `ADMIN_KEY_FILE`, `GAS_KEY_FILE` explicitly.
- The txAllowList admin must become the multisig (R3); the test-KYC stand-in is replaced by the bank's KYC (R11).
