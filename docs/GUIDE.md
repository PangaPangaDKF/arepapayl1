# ArepaPay — your guide (updated 2026-11-17)

Everything you need without opening a Claude session: what is live, how to start it, how to test it, and what is still waiting on you.
Testnet only: test dollars, no real money.

## 1. What is live

| What | Where | Hosted on |
|---|---|---|
| Landing page | https://arepapay.site | GitHub Pages (always on, free) |
| "Probar el MVP" link | https://arepapay.site/probar/ | Follows the app's current address; shows "Entorno de prueba apagado" if the app is off |
| The app | via /probar/ (today a temporary `*.trycloudflare.com` address) | This PC, through a Cloudflare tunnel |
| The chain (Fuji L1, chain 77078) | this PC | Its only validator runs here: PC off = chain paused |

Always share **arepapay.site/probar/**, never the trycloudflare link (it changes when the app restarts).

## 2. Start everything (one command, no Claude needed)

Open the Ubuntu terminal:
```bash
cd /mnt/c/Users/dulbi/arepapay-v2
bash scripts/arepapay.sh up        # starts whatever is down: chain node, app, tunnel; updates /probar/ if the address changed
bash scripts/arepapay.sh status    # what is running, the public address, and a live check (HTTP 200 = good)
bash scripts/arepapay.sh logs      # if something looks wrong
bash scripts/arepapay.sh down      # stop the app and tunnel (the chain node keeps running)
```
It is safe to run `up` any number of times.

**Start it automatically at every Windows login (do this once):**
```bash
bash scripts/arepapay.sh install-autostart      # undo: bash scripts/arepapay.sh remove-autostart
```
After that, any new terminal also has the short form: `arepapay up`, `arepapay status`, `arepapay logs`.
Keep the PC from sleeping while plugged in (Windows Settings → System → Power), or the chain pauses while it sleeps.

## 3. Get a permanent address: app.arepapay.site (one time, about 10 minutes, free)

Today the DNS of arepapay.site is at Spaceship with these 5 records. They serve the landing and **must survive the move**:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | pangapangadkf.github.io |

1. Create a free Cloudflare account: https://dash.cloudflare.com/sign-up → **Add a domain** → `arepapay.site` → plan **Free**.
2. Check that Cloudflare imported the 5 records above (add any missing one). Set **all 5 to "DNS only" (grey cloud)**.
3. At Spaceship: Domains → arepapay.site → Nameservers → **Custom** → paste the 2 nameservers Cloudflare gives you → Save.
4. Wait until Cloudflare shows arepapay.site as **Active** (minutes to a few hours). The landing keeps working meanwhile.
5. In the Ubuntu terminal: `~/cloudflared tunnel login` → a browser opens → pick `arepapay.site` → **Authorize**.
   (This creates `~/.cloudflared/cert.pem`, a credential: never share it.)
6. Run: `bash scripts/arepapay.sh fixed-address`
7. Check: `bash scripts/arepapay.sh status` shows `https://app.arepapay.site` and HTTP 200. Then tell Claude, which runs the full tests.

If step 6 fails, nothing breaks: the app keeps running on the temporary address.

**Later (option B):** a rented server (VPS, about €8–20/month, check live prices) so the app and chain run even with this PC off.
Avalanche's minimum for a small test L1 validator: 2 cores, 4 GB RAM, 100 GB disk. You would give Claude the server IP and SSH user.

## 4. Test it on your phone

Your test wallet `0x9C0b3216C281aB78BF8b2475c5865924f15DceeD` is already approved (1 ARPB for gas, 50 test dollars).

1. Open **arepapay.site/probar/** inside the **MetaMask** app's browser → **Conectar** → add/switch to the ArepaPay network if asked.
2. **Pagar** tab: tap a store (for example "Recarga de agua"), type `1`, check the fee line, **Pagar**.
3. **Cobrar** tab: **Mi negocio** → pick a type and a name → Guardar. Your store now appears in everyone's Pagar list.
   Create a charge → show the QR → another wallet pays it → you see "¡Pago recibido!".
4. **Privado** tab: **Ver mi saldo privado** (sign) → **Activar** → **Pasar a privado** 10 → **Enviar privado** to another
   wallet that also activated Privado. The message shows **"prueba X s"**: send that time and your phone model to Claude.
   The first private send downloads about 15 MB once, so use Wi-Fi.

A second test wallet: add another account in MetaMask, open the app with it and tap **Solicitar acceso** (approved at once).

## 5. What the app does today

- **Cobrar**: create a charge with a QR; one or several people can pay it (Split Pay); "¡Pago recibido!" alert with sound.
- **Pagar**: every registered store is already a contact (types: carrito de perros, panadería, recarga de agua, otro),
  plus 3 demo stores; pay any of them with the fee shown before paying; or scan a charge's QR.
- **Fee**: 0.5 %, the same for charges and for paying a store; the store receives the rest in the same transaction.
- **Privado**: encrypted balance (Avalanche eERC). Amounts and balances are encrypted on the chain. Who pays whom, and what
  enters or leaves Privado, stays visible. In this test one bank account holds the audit key and can read the amounts.
- **Avisos por Telegram**: ready; it needs a bot token from you to turn on (see 6).
- Amounts show as money ($50.00) in test dollars; the red bar at the top always says it is a test.

## 6. Waiting on you

1. Permanent address: section 3.
2. Autostart: `bash scripts/arepapay.sh install-autostart` (section 2).
3. Phone test of Privado: the "prueba X s" time (section 4).
4. Payment-app UI examples you like, for the next redesign.
5. Telegram alerts: create a bot with @BotFather and save its token in `~/.arepapay-telegram.token`, then `arepapay down && arepapay up`.
6. Security from the first day (still open): make the old `arepaAgent` repo private, revoke the old GitHub token, move any
   funds off the old v1 keys.
7. Optional: should the bank pitch (reserves, economics, plan) come back as a separate page on the landing?

## 7. What was built in this session (for the record)

| Decision | What |
|---|---|
| D-032 | Encrypted balances (eERC) on the Fuji chain + the Privado tab; bank audit view tool |
| D-033 | Landing privacy text updated to match |
| D-034 | Stores as payment contacts (MerchantPay contract, same 0.5 % fee), store types, 3 demo stores, no "Detalles" |
| D-035 | App design pass: money as $, Spanish messages, fewer buttons, better contrast |
| D-036 | Landing cut to 250 words; /probar/ warns when the app is off |
| D-037 | One-command start, autostart, permanent-address steps; safe publishing (only the address pointer is pushed) |

Every change was tested (contract tests 117/117, browser tests 29/29 on a test server and on the public link, gate
`bash tests/check.sh` → ALL CHECKS PASSED) before it went live. Full details: `docs/DECISIONS.md`, `docs/HOSTING.md`,
`app/README.md`.
