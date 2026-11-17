# Hosting the ArepaPay test stack (D-037)

Where things run (2026-11-17):
- **Landing** `https://arepapay.site` — GitHub Pages (repo `PangaPangaDKF/arepapayl1`). Always on, free. Nothing to do.
- **App + service + RPC** — this PC, published through a Cloudflare tunnel.
- **Fuji L1 (chain 77078)** — its only validator node runs on this PC. PC off = chain paused (it resumes when the PC is back).

The user chose **option A**: keep this PC, give the app a fixed address `https://app.arepapay.site`, and start everything
with one command (or automatically at Windows logon). Option B (a VPS so it runs with the PC off) stays open for later.

## Everyday use (no Claude session needed)
```bash
cd /mnt/c/Users/dulbi/arepapay-v2
bash scripts/arepapay.sh up        # starts whatever is down: L1 node, service, tunnel; fixes /probar/ if the address changed
bash scripts/arepapay.sh status    # node / service / tunnel, the public URL and a live HTTP check
bash scripts/arepapay.sh logs      # if something looks wrong
```
Start it by itself at every Windows logon (one time; puts a hidden starter in your Windows Startup folder, no admin):
```bash
bash scripts/arepapay.sh install-autostart     # undo: bash scripts/arepapay.sh remove-autostart
```
After that, a new terminal also has the short form `arepapay up | status | down | logs`.
Keep the PC from sleeping while plugged in (Windows Settings → System → Power) or the chain pauses while it sleeps.

## One-time: the fixed address app.arepapay.site (about 10 minutes, all free)
Today the DNS of arepapay.site is at Spaceship (nameservers `launch1/launch2.spaceship.net`) with these records, which
must keep working because they serve the landing:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | pangapangadkf.github.io |

1. **Cloudflare account** (free): https://dash.cloudflare.com/sign-up → *Add a domain* → `arepapay.site` → plan **Free**.
2. **Check the imported records**: Cloudflare scans the DNS and should list the 5 records above. Add any that are missing,
   and set **all 5 to "DNS only" (grey cloud, proxy OFF)** — GitHub Pages needs that for its HTTPS certificate.
3. **Change the nameservers at Spaceship**: Spaceship → Domains → arepapay.site → Nameservers → *Custom* → paste the 2
   nameservers Cloudflare shows (e.g. `xxx.ns.cloudflare.com`). Save.
4. **Wait until Cloudflare says "Active"** for arepapay.site (minutes to a few hours). `https://arepapay.site` keeps
   working during the switch.
5. **Authorize the tunnel** (in this Ubuntu terminal): `~/cloudflared tunnel login` → a browser opens → pick
   `arepapay.site` → *Authorize*. This writes `~/.cloudflared/cert.pem` (a credential: never share it, never commit it).
6. **Switch the app to the fixed address**: `bash scripts/arepapay.sh fixed-address`
   (creates the tunnel `arepapay-mvp`, adds the DNS record `app` → tunnel, restarts on `https://app.arepapay.site`,
   updates `https://arepapay.site/probar/`).
7. Check: `bash scripts/arepapay.sh status` shows `https://app.arepapay.site` and HTTP 200. Then tell BRAIN; it runs the
   browser tests against the new address and closes D-028.

If step 6 fails, nothing breaks: the quick tunnel keeps serving the app at a trycloudflare address.

## Option B later (runs with the PC off)
A VPS (Avalanche lists 2 cores / 4 GB RAM / 100 GB disk as the minimum for a low-traffic test L1 validator with
`--partial-sync-primary-network`; ≈ €8–20/month, check live prices). Needs from the user: the server's IP and SSH user
(runbook `docs/spikes/STAGE_B_FUJI.md` U-B1). BRAIN then moves the node (new L1 validator via the PoA ValidatorManager),
service and tunnel there.
