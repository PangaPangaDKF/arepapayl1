# ArepaPay v2 decisions (newest first) — why things are the way they are

Template: master-method TEMPLATES §1. Reserve the D-number on `docs/AGENT_BOARD.md` before writing it anywhere.

### D-036 · 2026-11-17 · LANDING: short page, 2,150 → 250 visible words, word budget in the gate (L8) (Claude Opus 5.5, LANDING lane run by a BRAIN subagent)
- What: `landing/app/page.js` rebuilt as hero (H1 "Pagos con QR para micro y pequeños comercios", one line, "Probar el MVP",
  disclaimer), 3 Red-de-pruebas points (Cobra con QR; Paga a un comercio de la lista, with the D-034 store types and 0,5 %;
  Saldo privado), one privacy line, Cómo probar (3 steps), 3 FAQ (dinero real, token, enlace), footer (disclaimer, X @ArepaPay).
  Cut: problema, 6 solution lines, comercios como casas de cambio, reservas, privacy table, economía, plan A/B/C + riesgos,
  pedimos, 3 FAQ. Dead CSS removed; meta description no longer says "operada por un banco". `scripts/landing-check.mjs` fails
  the main page above 250 visible words; `scripts/landing-probe.mjs --shot` renders widths < 500 px through an iframe.
- Why: user (2026-11-16): "the landing page should be more simple and less text" (board L8, target ≤ 250 words).
- Truth kept: every remaining feature carries a T6 label (6 labeled, all testnet; hero + footer disclaimer, T7). The privacy line
  keeps the D-032/D-033 honesty: who pays whom and what enters/leaves Privado is visible; in the test one bank account holds the
  audit key and can read amounts. FAQ keeps "no token" (ARPB is gas only) and real money as Planned (R1). Sources: `app/README.md`
  (Use; Stores as payment contacts; Saldo privado), `config/l1/mvp.fuji.json` feeBps 50, D-032, D-034.
- Alternatives rejected: a "Más detalles" page for the cut pitch (the user asked for less; the pitch lives in `docs/PITCH.md`
  and `docs/ECONOMICS.md`, and no remaining sentence depends on it); keeping a Planned roadmap strip (adds words, the FAQ already
  states real money is planned); dropping the privacy caveat to save words (would overstate privacy, T7).
- Verify: build rc 0; `node scripts/landing-check.mjs` rc 0 (250 visible words, 6 features labeled, disclaimer 2x); the word rule
  failed first at 300 and 258 words (V9); `node scripts/landing-probe.mjs` rc 0 (390/360 clean); `bash tests/check.sh` ALL CHECKS
  PASSED; full-page 1280 px and 390 px (iframe) renders read.
- Commit: this commit (landing-lane + shared-doc paths only; BRAIN deploys).

### D-033 · 2026-11-16 · LANDING: privacy copy flipped to live eERC in the testnet MVP (L7) (Claude Opus 4.8, LANDING lane)
- What: `landing/app/page.js` — encrypted balances were out of date. The #solucion "Saldos y montos cifrados" line went from
  `in-development` ("todavía no está en el MVP público") to `testnet` ("Red de pruebas · MVP") and was rewritten; the #privacidad
  table row "Saldos y montos", the #privacidad note, the Stage B paragraph and the "¿Las transacciones son privadas?" FAQ answer
  were all updated to say the Privado tab is live in the test MVP.
- Why: D-032 shipped eERC (converter mode) in the public testnet MVP (wallet e2e 24/24 LIVE, `audit-view` PASS); task L7. T6
  requires the label to match what is live; T1/T2 require every claim to trace to code/D-entry.
- Honesty (T7): the copy keeps the public parts explicit — who pays whom, and the amounts entering/leaving the private balance,
  stay public; in this test one bank account holds the audit key and can read every private amount (the multisig split is Planned,
  S3); phone proof time is unmeasured (desktop ~5-9 s). Removed the old "y el banco tampoco" claim, which the single-account audit
  key makes false. Truth sources: D-032, `app/README.md` "Saldo privado", `config/l1/eerc.fuji.json`.
- Alternatives rejected: leaving #privacidad section status at `in-development` only (kept — multisig/freeze oversight is still
  Planned, so the section as a whole is not live); claiming full privacy from the bank (false under the single audit key).
- Verify: `npm --prefix landing run build` rc 0; `node scripts/landing-check.mjs` 0 problems (15 feature sections labeled, chainId
  77078 from config, no forbidden words); `node scripts/landing-probe.mjs` 390/360 px nothing overflows; `bash tests/check.sh`
  ALL CHECKS PASSED; 1280 px renders of #solucion and #privacidad read.
- Commit: this commit (landing-lane + shared-doc paths only; BRAIN owns deploy).

### D-035 · 2026-11-16 · App design pass with the design-critique skill (Claude Opus 5.5, BRAIN lane)
- What: amounts formatted as money ($50.00, $54.975: at least 2 decimals, never rounded away) with "Dólares de prueba" under the
  balance; status messages in Spanish ("Acceso aprobado") that fade after 8 s (progress messages stay); Cobrar/Pagar chooser
  tiles removed (the bottom bar does it; the app opens on Pagar); "PRUEBA" pill and the footer paragraph removed (the red
  TESTNET bar stays); manual charge entry collapsed into "Escribir el número del cobro"; footer text in AA-contrast brown.
- Why: user: "if you can find a skill to use it for a improve do it"; the installed `design:design-critique` skill was run on
  the live screenshots; findings: money read like a token ("50.0 tUSD"), English raw status, triple test labelling, duplicate
  navigation, footer contrast ~2.6:1.
- Verify: wallet e2e 29/29 on a Fuji test instance (assertions moved to the $ format); 390 px screenshots read; gate rc=0.
- Commit: this commit.

### D-034 · 2026-11-16 · Stores as payment contacts (MerchantPay, same 0.5 % fee) + store types + cleaner app (Claude Opus 5.5, BRAIN lane)
- What: `contracts/src/MerchantPay.sol` (pay a store in one call: store gets amount − fee, fee router the fee; token, router and
  fee read from the live SplitPayEscrow; payer's `maxFeeBps` cap; MIN_AMOUNT 0.01; no owner, holds nothing) deployed on Fuji
  `0x4db4A0EDD355d039f6beec04020677BF67aB478b` (`config/l1/merchantpay.fuji.json`, `scripts/mvp/deploy-merchantpay.sh`).
  Store directory `backend/onboarding/stores.mjs` (`GET/POST /stores`; wallet-signed, ≤10 min, allowlisted wallets only,
  2-40 plain characters, types perros / panaderia / agua / otro) + 3 demo stores paying to the gas-station test wallet.
  App: Cobrar "Mi negocio", Pagar "Comercios" (every store is a contact; fee line before paying), "¡Pago recibido!" and
  Telegram alerts for direct payments; account "Detalles" removed, charge details reduced to one "Comisión · Falta" line,
  no host URL on screen (4901dd3).
- Why: user: "i want it more clean and remove the details too, also i want a carros de perros, panaderia y recarga de agua
  option, every single merchant store should be already added as a contact for payments"; asked (AskUserQuestion) and chose
  "through the escrow, 0.5 % fee" and "3 demo stores labelled demo".
- Tool: arepapay-solidity workflow (failing tests first), independent review subagent (nothing above low; L-1 PROVED: paying
  the contract itself, the escrow or the token stranded `net` → fixed test-first), master-method M0.
- Alternatives rejected: a function added to SplitPayEscrow (touches an audited contract and needs a redeploy that drops open
  charges); a plain transfer with no fee (fee bypass, breaks D-021 economics); stores on chain (gas + PII-free names don't need it now).
- Accepted (review): USDC/USDT blacklisting of the fee router would stop payments in both contracts (immutable router; real
  stablecoins are Phase 8); fee changes are immediate (timelock is N1 governance work on the escrow); outgoing transfers are not
  balance-checked (fine for 6-dp test token and USDC/USDT).
- Verify: forge 117/117 (MerchantPay 16 unit/fuzz + 2 invariants x 8192 calls); mutations caught (delivery check removed → 1
  red; fee skewed → 3 red; L-1 test red before the fix); store API refusals (403 not allowlisted, 401 forged / altered name,
  400 stale / bad type / control chars); wallet e2e 29/29 on a Fuji test instance (store registered; 4 contacts; pay 2 → alice
  −2, store +1.99, fee router +0.01; "Pago directo" alert; demo store paid); screenshots read; `bash tests/check.sh` rc=0.
- Notes: the Bs rate input is hidden with Detalles (Bs amounts show only if a rate was saved earlier).
- Commit: this commit.

### D-032 · 2026-11-16 · Encrypted balances (eERC converter) on the Fuji L1 + "Privado" tab in the MVP dApp (Claude Opus 5.5, BRAIN lane)
- What: Ava Labs EncryptedERC@8dc98cd deployed in converter mode over the MVP tUSD on chain 77078 (`config/l1/eerc.fuji.json`,
  EncryptedERC `0x384f185983Ac8DB53a82Ea06D1C1839a2CfF19BC`, Registrar `0x39c7Ef2a263172c951d4b7bbceB24A7A3e51Ae58`); the
  gas-station account (bank operations) registered and set as auditor (key `~/.avalanche-cli/key/arepapay-fuji-auditor.bjj`,
  0600, testnet). dApp tab **Privado** (`app/private.js`): key from a wallet signature (the SDK 1.0.2 message), activate
  (registration proof), Pasar a privado (deposit), Enviar privado (transfer proof, address / QR / `?pto=` link), Pasar a saldo
  normal (withdraw proof); balance decrypted from the PCTs and checked against the ElGamal ciphertext; auto-refresh 6 s.
  Browser crypto `app/vendor/eerc-lib.js` built from `scripts/eerc/browser/eerc-lib.src.mjs` (port of the repo's src/jub,
  src/poseidon, test helpers; WebCrypto randomness). Circuits served from `app/circuits/` (gitignored, pinned by
  `config/l1/eerc-circuits.sha256`). Tools: `scripts/eerc/deploy.sh prepare|circuits|local|fuji`, `scripts/eerc/audit-view.mjs`
  (the bank's view). Gate stage 5. Service: eERC in `/config`, `.wasm` MIME, 1-day cache for circuit files, boot check of
  approval keys (L-012).
- Why: mission priority 4 ("privacy that is real, never cosmetic") and PLAN Phase 5b ("eERC register / deposit / private pay");
  the pitch and landing promise encrypted balances while the public MVP moved plain tUSD. The user accepts slow proofs ("no
  importa el tiempo"), and a phone run of this tab gives the S2 §8 phone measurement.
- Honesty: amounts and balances are encrypted; sender/receiver addresses and the amounts entering/leaving are public; the
  bank's auditor key reads every amount (proven below). The page says this in one line.
- Tool: master-method M0; `arepapay-eerc` checklist; S2 code as the reference; zkey verification keys checked against the prod
  verifiers before deploying (142/142 constants match).
- Alternatives rejected: `@avalabs/eerc-sdk` (React/wagmi/viem hooks; the dApp has no build step); proving on the server (the
  server would see the user's key: not private); our own trusted setup (the shipped audited circuits match the prod verifiers).
- Verify: lib test 15/15 incl. registration/transfer/withdraw proofs verified by snarkjs and tampered signals rejected; wallet
  e2e on Fuji **24/24** through the real UI (register x2, deposit 10, private send 3, receiver auto-refresh 3.00, withdraw 1;
  plain tUSD moved only on deposit/withdraw; transfer proof 8.6 s in headless Chrome); `audit-view --expect-transfer 300` PASS
  (auditor reads 3.00, a random key reads 0 of 2 PCTs), `--expect-transfer 301` exits 1; gate V9: a stale bundle turns stage 5
  red; `bash tests/check.sh` rc=0. **Live** (public tunnel, after restarting the service): `/config/fuji` carries eERC; wallet
  e2e 24/24 against the public HTTPS URL (transfer proof 10.4 s); audit-view PASS over both runs; circuit files cached 1 day.
- Limits: 1.5 MB JS bundle + 15 MB transfer zkey on the first private send (cached a day); phone proof time unmeasured
  (expected 25-60 s, S2 §7); the read key is derivable by anyone who obtains that signature (the page warns); one auditor key
  held by one account (S3 splits it).
- Commit: this commit.

### D-031 · 2026-11-16 · Merchant payment alerts over Telegram, also with the app closed (Claude Opus 5.5, BRAIN lane)
- What: `backend/onboarding/telegram.mjs` (bot long-poll + escrow log watcher, started by `server.mjs`), routes `GET /tg/info`, `POST /tg/link` (rate-limited), `GET /tg/message`; app button "Avisos por Telegram" in Cobrar; `scripts/browser/telegram-mock.mjs` + optional e2e steps (`TG_MOCK=…`).
- Flow: merchant signs a dated message (personal_sign) -> server verifies (<=10 min) -> one-time `t.me/<bot>?start=<token>` -> Start binds that chat. Alerts: every `Authorized` ("Te pagaron X en el cobro #N (van a de b)") and `Captured` ("Cobrado: recibiste net"). `/stop` unlinks. First run starts at the chain head (no old alerts).
- Why: user (relayed by the D-029 subagent, then confirmed by their repeated "brain trabaja"): the merchant must get the payment notice even with the app closed; suggested a Telegram bot.
- Security: off unless `~/.arepapay-telegram.token` (TELEGRAM_TOKEN_FILE) exists; token only in memory, never logged/returned; links need a wallet signature so nobody can subscribe to someone else's payments; store `backend/onboarding/data/telegram.<net>.json` is gitignored.
- Alternatives rejected: web push (needs a service worker + VAPID, unreliable inside the MetaMask in-app browser); `/start <address>` without a signature (anyone could watch any merchant).
- Verify: mocked-Telegram unit run (forged sig 401, other address 401, stale 400, link + /start binds); wallet e2e with `TG_MOCK` 20/20 incl. both alerts; `bash tests/check.sh` rc=0.
- Pending (user): create the bot with @BotFather and save the token file; then restart `serve-public.sh`.
- Commit: this commit.

### D-030 · 2026-11-16 · Minimal connected screen, v1 camera QR scanner, in-app "¡Pago recibido!" alert (Claude Opus 5.5, BRAIN lane; built by a subagent, re-verified by BRAIN)
- What: after connecting only balance + big actions show; address/network/access in a collapsed "Detalles" (ids kept for the e2e); Cobrar/Pagar tiles; customer "Escanear QR" (v1 `QRScanner.jsx` port: getUserMedia + canvas + jsQR 1.4.0 from jsDelivr with SRI) with manual number/link fallback; merchant overlay + beep + vibrate when its charge turns Cobrado; thinner 1.5px gold-tinted borders, soft shadows.
- Why: user: hide technical data, minimal comfortable screen, reuse v1's camera reader, live payment notice "that banks don't have".
- Verify: wallet e2e 18/18 (subagent) and 20/20 with the D-031 steps (BRAIN); 390 px screenshots read; `bash tests/check.sh` rc=0.
- Limits: camera, beep and vibration need a real phone check in MetaMask mobile (headless has no camera; iOS has no vibrate).
- Commit: this commit.

### D-029 · 2026-11-16 · MVP app restyled with the original ArepaPay design (Claude Opus 5.5, BRAIN lane; built by a subagent, re-verified by BRAIN)
- What: `app/index.html` restyled, new `app/styles.css` and `app/assets/arepa.svg`, `app/app.js` +6 display-only lines. v1 design (`arepapay-clean/DESIGN_SYSTEM.md` + the L1 React frontend): cream background, navy brand, gold-bordered cards with offset shadow, 3D pill buttons, navy header with the arepa logo, red/white checkered stripe, navy bottom tab bar (Cobrar / Pagar), navy balance panel, state badges, framed QR. Inter via Google Fonts. No raffle/rewards/NFT/WiFi/savings/credit/OTC brought back.
- Why: user: "why the app dont have the same ui from the main arepapay project? the buttons and the style?" — D-022 built a bare test screen; the brand only reached the landing.
- Alternatives rejected: port the React app (build step + features the user removed); landing tokens only (user asked for v1's buttons and style).
- Verify: browser e2e 18/18 (subagent, local service on Fuji) and 18/18 by BRAIN on the public `/app/`; 390/1280 px renders read; gate rc 0. All element ids kept; click handlers unchanged (K8).

### D-027 · 2026-11-16 · Launch: repo `arepapayl1`, landing on GitHub Pages at arepapay.site (Claude Opus 5.5, BRAIN lane)
- What: `.github/workflows/pages.yml` (Next static export with `NEXT_PUBLIC_SITE_URL=https://arepapay.site`, truth gate in CI, CNAME, `mvp-url.json` copied from `config/public/`), `scripts/site/publish-github.sh` (gate → create/use the repo → push → enable Pages + custom domain → print Spaceship DNS records), `serve-public.sh` now boots the Fuji node when its RPC is down and `publish-url` updates the pointer (commit + push of that one file when a remote exists).
- Why: user: "create or use a arepapayl1 git hub repo and launching the landing page with arepapay.site". The site stays static and stable; only the MVP pointer changes when the test tunnel restarts.
- Who runs what: creating the repo from this session was refused twice by the permission classifier, so the user runs the publish script once (`!` prefix). DNS lives at Spaceship (NS launch1/2.spaceship.net) and needs the user's login.
- Public: the repo is public (free Pages needs it). History scanned before: no stored test key and no token appears in any commit; the commit author email becomes public.
- Alternatives rejected: Vercel (login expired, L-009); a private repo (Pages needs a paid plan); cloudflared named tunnel for the landing (DNS would have to move to Cloudflare).
- Verify (2026-11-16): user ran the publish script and set the Spaceship DNS; workflow `landing-pages` success (48 s); `https://arepapay.site/`, `/probar/`, `/mvp-url.json` 200; HTTPS enforced, `http://` and `www` 301 → `https://arepapay.site/`; `node scripts/browser/site-check.mjs` SITE PASS 4/4 (landing → probar/ → dApp with Fuji config); browser e2e 18/18 on the tunnel after the reboot.

### D-024 · 2026-11-15 · LANDING: announcement + pitch landing, merchants as exchange houses, Learn and remember, probar/ link (Claude Opus 5.5, LANDING lane run by a BRAIN subagent; the LANDING session was not running)
- What: rewrote the landing as the announcement (6 status-labeled solution lines, "Cómo probar" on testnet, merchants as exchange houses, 1:1 reserves, privacy, economics with SUPUESTO tags, A/B/C plan, the ask); removed raffles/WiFi; added `probar/` (reads `../mvp-url.json` and redirects); `NEXT_BASE_PATH` + `NEXT_PUBLIC_SITE_URL`; gate: chain ids checked against `config/`, `probar/` rules, relative links checked; lane skill v1.5 §5a (L5).
- Why: user goal L6 ("a normal and basic landing page to show what the project is about and to pitch it"), D-014, D-023, BRAIN's verified testnet facts (D-019).
- Alternatives rejected: hardcoding the tunnel URL (T5, dies on restart); a sideways-scrolling table on phones (rows stack instead).
- Verify: build 0, landing-check 0, landing-probe 0 (390/360), sub-path build 0, three V9 negatives exit 1, 1280 px renders read by the subagent; BRAIN re-ran the full gate (ALL CHECKS PASSED) and read the full-page render served from the public origin; `probar/` → `/app/?net=fuji` PASS in Chrome.

### D-026 · 2026-11-15 · One public origin: landing at /, dApp at /app/, served by the onboarding service through the tunnel (Claude Opus 5.5, BRAIN lane)
- What: `backend/onboarding/server.mjs` in SINGLE_ORIGIN mode serves `landing/out` at `/` when it exists, the dApp at `/app/`, `/mvp-url.json` (own origin), a restricted `/rpc` and `/config`. `scripts/mvp/serve-public.sh` supervises service + cloudflared quick tunnel (PID files, auto-restart, URL in `backend/onboarding/data/public-url.fuji.txt`).
- Why: the user wants a basic landing to show and pitch the project plus a testable MVP, finished autonomously. A stable external host was not available: the stored Vercel login was expired (and the CLI removed it, L-009) and creating a public GitHub Pages repo was refused by the session's permission classifier. One origin is the lightest path that needs no new account and keeps landing and app consistent.
- Alternatives rejected: Vercel `--temporary` (new URL per deploy, expiry unclear); GitHub Pages (blocked, needs the user); hardcoding a trycloudflare URL in the landing (dies on restart, T5).
- Limits: the URL changes when the tunnel restarts and everything stops when this PC sleeps. Stable domain `arepapay.site` needs the user: either a Cloudflare named tunnel (`cloudflared tunnel login`, one browser click) or a host login.
- Verify: public origin serves `/` (landing), `/probar/`, `/mvp-url.json`, `/app/`, `/config/fuji` (all 200); browser e2e at `<url>/app/` 18/18; `probar/` redirect PASS in headless Chrome.

### D-025 · 2026-11-15 · Browser test tool + `arepapay-browser` skill (Claude Opus 5.5, BRAIN lane; built by a subagent, re-run by BRAIN)
- What: `scripts/browser/cdp.mjs` (zero-dep Chrome DevTools helper) and `scripts/browser/wallet-e2e.mjs` (three injected EIP-1193 wallets drive the real dApp UI: add network, request access, split-pay 5 = 3 + 2, assert UI + chain); skill `.claude/skills/arepapay-browser/`.
- Why: user: "add a skill or a tool to manage the browser and everything you need to make it possible"; scripted e2e alone does not prove the UI a MetaMask user clicks.
- Verify: 18/18 on local (subagent) and 18/18 over the public HTTPS Fuji URL (BRAIN re-run). Limit: not real MetaMask; mobile check stays human.

### D-019 · 2026-11-15 · Stage B: ArepaPay L1 on Fuji + MVP + public endpoint — DONE (Claude Opus 5.5, BRAIN lane)
- What: subnet-evm v1.15.3 (plugin 47) installed with the user's permission; L1 created, deployed, converted (subnet `2sntWm2…`, blockchain `pyHdg4sk…`, chain 77078), node tracking, PoA manager initialized, validator balance 2.99948 AVAX (~67 days). `NET=fuji s1-verify` 15/15; MVP deployed (`config/l1/mvp.fuji.json`); `NET=fuji e2e.sh` 19/19; public HTTPS endpoint up; browser e2e 18/18. New: `scripts/l1/fuji-split-proxy.mjs`, `config/l1/arepapaybank.fuji.json`, NET-aware `s1-verify.sh` / `deploy.sh` / `e2e.sh` (renamed from e2e-local.sh), `scripts/mvp/serve-public.sh`.
- Why: user: "quiero la b" (Fuji) and "finish the loop … without my intervention".
- Decision taken alone: AUTO_APPROVE=1 on the public test service so anyone can test while the admin sleeps; it is the testnet stand-in for bank KYC (R11 stays the rule for anything real; admin approval is the default everywhere else).
- Details and exact commands: `docs/spikes/STAGE_B_RESULT.md` v1.0. Lessons L-008..L-010.

### D-023 · 2026-11-15 · Learning + memory loop in master-method and lane skills (Claude Opus 5.5, BRAIN lane)
- What: master-method v1.3 §5.7 (three memory layers, PROVEN/TRACED/SUSPECTED labels, immediate LESSONS entries, promotion of general rules, auto-memory for user corrections, 5-line retro, subagent lessons verified) + checklist item 11; `arepapay-brain` §7b; LANDING task L5 for its own skill; auto-memory updated (project state, test keys).
- Why: user: "improve the skills we are using with learning and memories features to enhance it with the best llm practices and with the style we are creating".
- Verify: docs/skills only; `bash tests/check.sh` → ALL CHECKS PASSED (exit code).
- Commit: this commit.

### D-019 · 2026-11-15 · Stage B execution, part 1: test keys, funds on the Fuji P-Chain, own Fuji node, Fuji genesis (Claude Opus 5.5, BRAIN lane + subagent) — part 1, completed in the D-019 DONE entry above
- What: CLI test keys `arepapay-fuji` (C 0x3A7e…5Fc8) and `arepapay-fuji-gas` (0x9769…F2fF); 4.19 Fuji AVAX swept once from the burned v1 `deployer` key (it gets no role anywhere); own Fuji node (CLI cluster `arepapay-fuji`, avalanchego v1.15.3, :9750/:9751, partial sync, bootstrapped); `scripts/l1/fuji-import-p.sh` (avalanchejs ImportTx, because the public API dropped `avax.getAtomicTxStatus`); `config/l1/genesis.arepapaybank.fuji.json` (chain 77078, admins = arepapay-fuji, allowlist = gas key, minter off, warp at genesis time, 20M gas, no ewoq/deployer); `docs/spikes/STAGE_B_RESULT.md`.
- Why: user: "you can create and save the keys just for test … just continue the loop and do what you need to do to at least have something testable".
- Verify (BRAIN): our node's `platform.getBalance` for P-fuji1rg4s98axcsj6wewqhmwxeqf3larw8rjamg8lq4 → 3609992904 nAVAX; genesis grep for the burned/ewoq addresses → 0; key scan clean.
- Blocked: Fuji requires avalanchego ≥ 1.15 (Helicon) → subnet-evm plugin v47, which now ships inside the avalanchego release; the CLI (1.9.7) only knows subnet-evm v0.8.0 (plugin 44). Installing the official binary was denied by the permission classifier; BRAIN did not work around it. **Needs the user:** run STAGE_B_RESULT §2 Option A (verify sha256, extract to `~/.avalanche-cli/bin/subnet-evm/subnet-evm-v1.15.3/`) or grant that permission. Then steps 4–9.
- Commit: this commit.

### D-022 · 2026-11-15 · MVP test dApp + onboarding (test-KYC) on the local L1 (Claude Opus 5.5, BRAIN lane; built by a subagent, re-verified by BRAIN)
- What: `app/` (one static page + app.js: add/switch ArepaPay L1, connect, balances + allowlist status, request access, merchant mode creates a Split Pay intent with QR/link, customer mode authorizes a share, confirm, withdraw; EVM provider picked from `providers[]`, refresh on chain/account change, instant wallet popup, Spanish, testnet disclaimer); `backend/onboarding/` (request/status API, admin CLI approve → txAllowList enable + gas + 50 test USD, AUTO_APPROVE flag, serves generated config; keys read from CLI key files at runtime, never logged); `contracts/script/DeployMvp.s.sol` (test USD with capped minter + SplitPayEscrow 50 bps); `scripts/mvp/{deploy.sh,e2e-local.sh,smoke-page.mjs}`; generated `config/l1/mvp.local.json`.
- Why: user: "continue the loop and do what you need to do to at least have something testable … just a functional MVP"; D-014 minimal app for the MetaMask mobile browser.
- Tool: subagent; BRAIN re-ran `bash scripts/mvp/e2e-local.sh` → "19 PASS … E2E PASS, rc=0" (onboard 3 wallets, $5 = 3 + 2 captured, merchant got 4.975, fee 0.025, expire + withdraw, escrow balance == totalHeld == 0, no key in service log); `E2E_BREAK=1` makes it fail (V9). Key scan of new files clean.
- Found: an idle chain estimates gas with the last block's timestamp, so expiry-dependent calls fail estimation → fixed gas limit for expire/withdraw.
- Alternatives rejected: a framework/build step for the app (minimal rule R8).
- Verify: see Tool; `bash tests/check.sh` → ALL CHECKS PASSED (exit code).
- Commit: this commit.

### D-021 · 2026-11-15 · Economics ("tokenomics") of the bank chain + pitch (Claude Opus 5.5, BRAIN lane; decision memo by a subagent, reviewed by BRAIN)
- What: `docs/ECONOMICS.md` (every unit: ARPB gas coin from genesis, bridged USDT/USDC 1:1 with reserves on C-Chain, eERC 1:1; money flows; fee options with worked examples marked ASSUMPTION; costs; risks; recommendation F2) and `docs/PITCH.md` (Spanish, English summary; honest roadmap A built/B in preparation/C planned; disclaimer; no yield promises).
- Why: user: "a strong plan [and] tokenomics for centralized banking system people or clients to understand it"; "use the sub agents for decisions".
- Recommendation (F2, pending the user): 0 % payment fee during the pilot (fee kept in code, multisig + timelock to change, 1 % cap); merchants keep the FX band markup; the bank charges a flat bridge-exit fee and runs its USD↔Bs desk; gas free for users; payment fee only after stage C data.
- Key findings: the ~$1,000 is the bank's FX float, not the backing (the 1:1 lock backs withdrawals); fees exist in code only where money leaves encryption (SplitPayEscrow); the pilot doesn't pay for itself at stage C caps (costs rest on ASSUMED prices); the biggest economic risk is which reference rate anchors the band.
- Verify (BRAIN): grep of PITCH for unsupported claims (audited/live/guaranteed/yield) → none; assumptions labeled SUPUESTO; `bash tests/check.sh` → ALL CHECKS PASSED.
- Open (needs the user): Q19–Q29 (ECONOMICS §7).
- Commit: this commit.

### D-020 · 2026-11-15 · FxLedger contract (Claude Opus 5.5, BRAIN lane; built by a subagent, verified and amended by BRAIN)
- What: `contracts/src/FxLedger.sol` (no value moved, N0; merchant registry; rate signer with ±20 % per-update bound; spread cap 3 %; band check in exact integers; orders Open→Accepted→Sent→Settled / Disputed / Expired / Cancelled; unique commitments and eERC tx hashes with `orderIdOfTx`; reconciler result stored separately); tests `FxLedger.t.sol` (62) + `FxLedger.invariant.t.sol` (3).
- Why: user: "un registro que muestre que se realizó para que el comerciante no mueva fondos y no los declare" (D-014, R12).
- Tool: tests written first against a stub (59 failed); mutations caught (cancel-after-accept, expire-on-settled → invariant handler improved); BRAIN re-ran `forge test` → 97 passed, then fixed ambiguity #1 test-first (reconcile Expired orders that have a transfer; old test and invariant updated to the new rule) → 99 passed.
- Alternatives rejected: AccessControl multi-holder roles (a forgotten second holder is a risk; one key per role, rotated in one step).
- Verify: `forge test` → "99 tests passed, 0 failed"; `bash tests/check.sh` → ALL CHECKS PASSED (exit code).
- Commit: this commit.

### D-018 · 2026-11-15 · Two-brain protocol (P-NNN proposals) + duplicate landing session closed (Claude Opus 5.5, BRAIN lane)
- What: `arepapay-agent-sync` §4 two-brain rules; board §Proposals with P-001 to LANDING; stopped herdr terminal t1c (BRAIN-started duplicate LANDING session, PID 26227, still at the trust prompt, no work done).
- Why: user started the landing session in their own tab ("ya hice esto y el agente está corriendo"), and D-017 made both sessions part of the main brain; two LANDING agents and two unruled deciders would collide (C1).
- Tool: `hc kill arepapay-landing`; `pgrep -x claude` showed PIDs 3466 (BRAIN), 31741 (user's LANDING) afterwards. ListAgents still shows no reachable peer, so the board stays the channel.
- Alternatives rejected: reverting D-017's START_HERE edit (the user asked for it; S8); keeping both landing sessions.
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED (exit code checked).
- Commit: this commit.

### D-017 · 2026-11-15 · Session context doc (next session = main brain for the loop) + landing skill v1.4 (Claude Opus 4.8, LANDING lane)
- What: `docs/SESSION_CONTEXT.md` — the next session's "read first": it sets the **main-brain role** (primary decision-maker that drives the loop), snapshots the current state, folds in the landing knowledge, lists the decision queue and restates the laws. Added a pointer at the top of `START_HERE.md`. Bumped `arepapay-landing-design` to v1.4 (new §7 static-export playbook) + CHANGELOG.
- Why: user (2026-11-15): "we need to start making commits and save context session md file with a improvement of the skill for this landing page with what we have learned … i will run a new session and i want the md context to say that you will be part of the main brain to take decisions for the loop."
- Tool: the live-preview session itself — `next dev` crashed (`Cannot find module './627.js'`) the moment `check.sh` ran `next build` on the shared `landing/.next`; switched the preview to a static `http.server` over `landing/out/`. That lesson is now in the skill §7 and the context doc. master-method §5.4 closeout, §0 skill-editing.
- Alternatives rejected: rewrite the charter to collapse LANDING into BRAIN (heavier, and would clobber BRAIN's active lane) — instead the context doc sets the main-brain role while keeping the lane split as a work/truth-check organizer; keep `next dev` for preview (it collides with the landing build, D-015).
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED (docs/skill only; no landing output changed). Landing gates still green from D-013.
- Commit: this commit.

### D-016 · 2026-11-15 · Stage B on Fuji (runbook) + LANDING session started in herdr (Claude Opus 5.5, BRAIN lane)
- What: `docs/spikes/STAGE_B_FUJI.md` (user steps U-B1 server, U-B2 Fuji key, U-B3 faucet + C→P transfer, U-B4 DNS `rpc.arepapay.site`; BRAIN steps: `avalanche node setup`, Fuji genesis without ewoq, deploy with `--bootstrap-endpoints` and `--balance`, Caddy HTTPS RPC exposing only the L1 path, verify, eERC redeploy, MetaMask add-network from config, manual tester approval as test-KYC). LANDING launched as herdr terminal `arepapay-landing` (t1c) with task L4.
- Why: user: "quiero la b, realiza tú la opción 1".
- Tool: avalanche-cli v1.9.6 help (deploy flags `--fuji --key --bootstrap-endpoints --balance --use-local-machine`; `node setup` over SSH).
- Alternatives rejected: this PC as Fuji validator via `--use-local-machine` (WSL NAT, needs router/Windows port forwarding, stops when the PC sleeps).
- Notes: the new LANDING session waits on the user's one-time folder-trust confirmation (consent gate, not answered by BRAIN); the user's older landing session (PID 1217, started as plain `claude` in /home/panga) should be closed to avoid two LANDING agents (C1).
- Verify: docs only; `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-015 · 2026-11-15 · check.sh landing stage runs the Next.js static export and both landing gates (Claude Opus 5.5, BRAIN lane)
- What: `tests/check.sh` stage 3 now does `npm ci` (if needed) → `npm run build` → `landing-check.mjs` → `landing-probe.mjs` when `landing/package.json` exists.
- Why: LANDING's ask in the D-013 board log.
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED; an earlier run during a concurrent LANDING build reported "landing build failed" (the stage can fail, V9).
- Commit: this commit.

### D-014 · 2026-11-15 · Merchants as exchange houses + FX ledger; unbreakable no-resale rule; raffles/WiFi removed; minimal app tested in MetaMask mobile browser (user decision, designed by BRAIN)
- What: `docs/features/MERCHANT_FX.md` (FX order flow on `FxLedger`: open with rate in the bank band + commitment, customer accepts, eERC transfer linked by tx hash, customer confirms, bank reconciles with the auditor key; 6 enforcement layers for R12); charter v1.3 (R12, minimal scope, raffles/WiFi removed); PLAN v1.3 (Phase 5b test dApp, Q16–Q18); ARCHITECTURE §3a (who sees addresses); LANDING task L4.
- Why: user: "los comercios van a vender usdt o usdc a los clientes y serán casas de cambio … un registro que muestre que se realizó para que el comerciante no mueva fondos y no los declare … evitar acciones deshonestas como revender los usdt o crear mercados negros … es una regla que no se puede quebrar"; "no importa el tiempo"; "se debe probar dentro del explorador de la app de metamask … agregarás el rpc de arepapay l1"; "deberás quitar la parte de las rifas o los vouchers de internet … mientras más minimalista y sencilla mejor"; "recuerda decirle eso al otro agente".
- Tool: eERC facts from S2 (addresses visible to the bank, amounts only to the auditor) used as the R12 detection basis.
- Alternatives rejected: storing FX amounts in plaintext on chain (leaks amounts to any RPC reader); modifying audited eERC to block customer→customer transfers by default (left as Q16).
- Verify: docs only; `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-013 · 2026-11-15 · Landing v0: Next.js static-export scaffold + truth/overflow gates + Spanish page (Claude Opus 4.8, LANDING lane)
- What: `landing/` as a Next.js App Router static export — `package.json` (pinned `next@15.1.6`, `react@19.0.0`), `next.config.mjs` (`output:'export'`, `images.unoptimized`, `trailingSlash`), `app/{layout,page,ui}.js`, `app/globals.css` (§3 tokens), `public/brand/arepapay-logo.png`, `app/icon.png`. Gates: `scripts/landing-check.mjs` (truth gate over `landing/out`) and `scripts/landing-probe.mjs` (390/360 px overflow + `--shot`). Spanish-first v0 with every section from STATE §2, status labels (T6) and the testnet disclaimer in hero + footer (T7); footer links X `@ArepaPay`.
- Why: the user gave the launch domain `arepapay.site` and X `@ArepaPay` and said "continue". D-004 set the stack. Copy comes only from the charter role line and the settled architecture (D-005/D-007); everything is In development / Planned (R4/T6). Future tense throughout — never present tense for an unbuilt feature.
- Tool: `npm run build` (Next 15.1.6 static export → `out/`), zero-dep node gates, Playwright Chromium 1208 for the overflow probe; master-method V9 (negative test).
- Alternatives rejected: reuse the old TryNoah / infographic copy (false for v2 — STATE §3 forbidden sources, would repeat the DeepSeek-v1 failure); a single-file HTML page (superseded by D-004); present-tense feature copy (T6).
- Verify: `node scripts/landing-check.mjs` → "Landing is truthful and labeled." (0 problems, 9 status-labeled features, disclaimer 2×); planted emoji + forbidden words + an unlabeled feature → exit 1 (V9); `node scripts/landing-probe.mjs` → 390/360 px nothing overflows; hero + "cómo funciona" 1280 px screenshots read by me; `bash tests/check.sh` → ALL CHECKS PASSED (its landing step still skips — it probes `landing/index.html`; repoint is BRAIN's, below).
- Open (BRAIN): repoint `tests/check.sh` landing step to `npm --prefix landing ci && npm --prefix landing run build && node scripts/landing-check.mjs && node scripts/landing-probe.mjs`; B4 deploy target = a static host serving `landing/out/`. Open (LANDING, pre-launch): cleaned transparent logo + crisp wordmark + a real 1200×630 OG image + `favicon.ico` (today `app/icon.png` is the 1024 px watermarked brand PNG).
- Commit: this commit.

### D-012 · 2026-11-15 · Spike S2: eERC converter on the bank's L1, visibility proof, contract account, proof times (Claude Opus 5.5, BRAIN lane, run by a subagent and spot-verified)
- What: `scripts/eerc/s2-{run.sh,common.ts,converter.ts,bench.ts,phone-bench.sh}`, `config/l1/eerc.local.json` (generated), `docs/spikes/S2.md`; corrections to the `arepapay-eerc` skill (v1.1) and ARCHITECTURE §2/§3b.
- Why: the go/no-go for "la cadena encriptada con sdk" (user, 2026-11-15).
- Results: deploy + register + deposit → transfer with message → withdraw works on chain 77077 (merchant received 5.000000 tUSD); from/to visible, receiver and auditor decrypt amounts, an outsider (eve) can't; a contract-controlled account registered and moved encrypted funds; transfer proof 4.4–7.6 s on an i5-6500 desktop; transfer ~1.1M gas (~3.5 private tx/s at 8M gas).
- Findings: the transfer message is encrypted to the receiver only (the skill wrongly said the auditor sees it, L-004); deposit ciphertexts are deterministic (`EncryptedERC.sol:661-668`); contract accounts act through executors, so freeze executors; upstream postinstall re-runs a trusted setup (`--ignore-scripts`).
- Verify (BRAIN): read `EncryptedMetadata.sol:95` and `EncryptedERC.sol:661-668`; `cast code` shows bytecode at the deployed eERC, verifiers, token and forwarder addresses; key scan of the new files clean; `bash tests/check.sh` → ALL CHECKS PASSED.
- Open (needs the user): measure proof time on a low-end Android (S2 §8); kill criterion > 10 s.
- Commit: this commit.

### D-010 · 2026-11-15 · Split Pay option A: SplitPayEscrow contract, tests, independent audit, fixes (Claude Opus 5.5, BRAIN lane)
- What: `contracts/` Foundry project (OZ v5.1.0, forge-std v1.9.4 pinned; installed by `scripts/setup-contracts.sh`, `contracts/lib/` ignored); `src/SplitPayEscrow.sol` (multi-payer intent: authorization holds, cap at remainder, fair share, auto or confirm capture with 5-min confirm window, merchant cancel, anyone-expire, pull refunds, fee snapshot + merchant max fee + 1 % hard cap, full-delivery check, no admin path to held funds); tests: 30 unit/fuzz + 4 invariants (balance == totalHeld, conservation, captured paid exactly, never over-covered); audit report `docs/audits/2026-11-15/split-pay-A.md`.
- Why: user: "realiza la A".
- Tool: arepapay-solidity workflow (tests written first and seen failing); 2 planted mutations caught by the invariants (V9); independent read-only auditor subagent (3 passes, 10 PoCs).
- Audit verdicts: F-01 MEDIUM dust fills payer slots → FIXED (fair share); F-02 MEDIUM Ready freeze → FIXED (confirm window); F-03 MEDIUM fee-on-transfer insolvency → FIXED (delivery check); F-07 LOW merchant fee bound → FIXED (maxFeeBps); F-08 LOW empty expired intents stay Open → FIXED (`expire`); F-04 LOW blacklisted feeRouter/merchant blocks capture → ACCEPTED (bridged token on the bank's own chain has no blacklist; adding a settable router adds an admin power); F-05/F-06/F-09/F-10/F-11/F-12 INFO → noted (stale holdOf is display-only; donations stuck by design, no sweep power; fee rounds to 0 under 200 units at 50 bps).
- Alternatives rejected: merchant force-capture for F-02 (overrides the payers' confirm step the user designed); owner-settable fee router for F-04 (admin power over the payout path).
- Verify: `forge test` → "34 tests passed, 0 failed"; `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-011 · 2026-11-15 · Split Pay option C: eERC knowledge skill + dual-control escrow algorithm (Claude Opus 5.5, BRAIN lane)
- What: skill `.claude/skills/arepapay-eerc/` (verified eERC facts with file:line, visibility table, limits, patterns, checklist); `docs/features/SPLIT_PAY_C.md` (coordinator contract + Safe-registered eERC escrow account + bank escrow service with HSM proving key; attested holds keyed by txHash+logIndex; A's invariants adapted incl. reconciliation; build order).
- Why: user: "realiza la A y luego adaptar alguna documentación o skill o algoritmo que use ese conocimiento para realizar la C".
- Tool: read `EncryptedERC.sol` (transfer with `message` metadata, ReceiverPCT/AuditorPCT), `circom/registration.circom` + `Registrar.sol:82-110` (registration binds a public SenderAddress and requires msg.sender == it → a Safe can be an eERC account), Go/gnark prover in `zk/`.
- Alternatives rejected: contract-held encrypted escrow (impossible without an off-chain proving key); single-key bank escrow (one key can move funds; dual control requires key + t-of-n Safe).
- Verify: docs/skill only; `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-008 · 2026-11-15 · Spike S1: the bank's private L1 on the local network (Claude Opus 5.5, BRAIN lane, run by a subagent and re-verified)
- What: `config/l1/genesis.arepapaybank.json`, `config/l1/arepapaybank.local.json` (single source of truth: chain 77077, RPC, ids, precompiles), `scripts/l1/s1-create.sh`, `scripts/l1/s1-verify.sh`, `docs/spikes/S1.md`; `tests/check.sh` secret scan now skips genesis storage-slot pairs (public constants) and still fails on a planted key.
- Why: user: "sí, crea la L1 y migra todo allí".
- Tool: avalanche-cli v1.9.6 (`~/bin/avalanche`), avalanchego v1.14.0, cast; sovereign L1, PoA, 1 validator.
- Verify: BRAIN re-ran `bash scripts/l1/s1-verify.sh` → "15/15 checks passed, RESULT: PASS" (allowlist rejects a fresh funded address, setEnabled lets it send, setNone freezes it again, deployer allowlist blocks deploys, native minter inactive and mints nothing); `EXPECT_CHAIN_ID=13370` makes it fail (V9).
- Notes: the CLI's local test key (ewoq, public) is in `enabledAddresses` because the CLI signs validator setup with it: local only, never on Fuji/mainnet. Fee for stage B/C confirmed: 512 nAVAX/s ≈ 1.33 AVAX/validator/month (ACP-77). Not yet: gateway RPC, ICM (needed for S6).
- Commit: this commit.

### D-009 · 2026-11-15 · Split Pay QR feature: design + reusable prompt (Claude Opus 5.5, BRAIN lane)
- What: `docs/features/SPLIT_PAY.md` (user's spec, names, step mapping, eERC escrow options A/B/C, contract rules), `prompts/SPLIT_PAY_PROMPT.md`; PLAN spike S7, Q13–Q15.
- Why: user: "si el cliente quiere pagar 5$ pero un cliente tiene 3$ y el otro el resto … el contrato del qr será una transacción abierta … es como cuando el cliente hace lo mismo pero con diferentes tarjetas"; "ayúdame a descifrar cómo promptear".
- Tool: web research (split tender + authorization/capture in card gateways, Algorand atomic group payments, EIP-3009/Circle batched settlement); eERC `Registrar.sol:82-89` (a contract can't hold an eERC balance without an off-chain proving key).
- Alternatives rejected: balance check without a lock (stale between check and pay); an AI agent triggering payments (money flows must be deterministic, N4).
- Verify: docs only; `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-007 · 2026-11-15 · User correction: bank-run bridge, real USDT/USDC collateral, mandatory KYC, real IRL pilot (user decision, recorded by BRAIN)
- What: ARCHITECTURE v1.1 (bridge + liquidity on chain, eERC converter over bridged USDT/USDC, auditor/freeze multisigs bank-led, KYC for everyone, staged pilot A/B/C with ~$1,000 initial liquidity and ~$100 real collateral per merchant); charter v1.2 (R1 staged money, R9 one bank-run bridge, R10 bank-led logged oversight, R11 KYC mandatory); PLAN v1.2 (S6 bridge spike, Q2/Q4/Q8/Q9/Q11/Q12).
- Why: user: "la parte centralizada y que el banco controla o es la rampa significa que sí existirá un puente y una liquidez inicial, los micro negocios colocarán el colateral de usdt o usdc"; "el testing a nivel de prueba en IRL es real, 100$ por micro negocio"; "si se cierra la cadena la liquidez está allí dentro y no en el banco"; "no quiero que los balances de las personas o las transacciones sean trazadas"; "quiero que el kyc sea obligatorio"; "estás para analizar, no para inclinar lo que estoy pensando".
- Tool: eERC source (converter `Deposit`/`Withdraw` amounts visible, transfers/balances encrypted); master-method M0.
- Alternatives rejected: D-005 v1.0 choices (no bridge, bank-issued IOU, light KYC tier) — they replaced the user's model with an incumbent-style one (L-003).
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED (docs only).
- Commit: this commit.

### D-006 · 2026-11-15 · Avalanche MCP + 16 avaxskills (Claude Opus 5.5, BRAIN lane)
- What: `.mcp.json` with `avalanche` (community, avalanche-mcp.dev, repo Eelvanpsd/Avalanche-mcp@a1ff0a0) and `avalanche-official` (Ava Labs hosted build.avax.network/api/mcp); 16 `avax-*` skills from avaxskills.com (precompiles, subnet-deployment, subnet-evm-config, validator-manager-contract, validator-management, safe-multisig, kyc-aml-integration, avalanche-sdk, upgradeable-contracts, avalanche-l1-economics, tmpnet, avacloud-indexing, event-driven-backend, account-abstraction, contract-verification, local-dev-environment).
- Why: user: "this is the mcp, the avalanche dev repo … and the skills".
- Tool: cloned and grepped the MCP source (no signing, no wallet client, no key handling; exec/fs writes only in the dev index builder; hosted mode proxies to Ava Labs' official MCP); fetched each skill and scanned for injected agent instructions (none; only official installer docs).
- Alternatives rejected: run the MCP locally from source — extra install of third-party code for no gain while it is read-only; the hosted endpoint sees our doc queries only (no secrets).
- Notes: skills load env-var private keys in examples; `arepapay-solidity` N6 (encrypted keystore) overrides. MCP servers appear in the next session (`/mcp` to verify).
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: e35c379.

### D-005 · 2026-11-15 · Architecture: encrypted consortium chain (Claude Opus 5.5, BRAIN lane)
- What: `docs/ARCHITECTURE.md`; PLAN v1.1 (spikes S1–S5, Q1/Q3/Q4 resolved, Q8–Q11 added); charter v1.1 (role line, R9 never bridged, R10 split oversight, scope).
- Why: user: "i want it with sdk encrypted chain … a multisig system for data cooperation because banks need privacy and customers too, they can freeze funds and watch who has your money if you get hacked … you can't track trxs like in a normal evm … centralized privacy … a centralized banking chain for micro and small business … banks will be the ramps … it always will be a private chain for merchants".
- Tool: eERC source read (`EncryptedERC.sol`: amounts/balances encrypted, from/to public, single owner-set auditor, owner-only mint, token-level blacklist); market research subagent (`docs/research/market_landscape.md`), key claims re-checked by BRAIN (OFAC GL 57, Drex shutdown, Kontigo bank ramps).
- Alternatives rejected: see ARCHITECTURE §3 (public chain + eERC; signed ledger first — kept as fallback; Canton/Besu; single auditor key; clawback power).
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED (docs only).
- Open (needs the user): Q8–Q11, pilot partners (one bank, one distributor).
- Commit: this commit.

### D-004 · 2026-11-15 · Landing launch stack = Next.js static export; load vercel-react-best-practices (Claude Opus 4.8, LANDING lane)
- What: the launch landing is built as a Next.js (App Router) app with static export (`output: 'export'`) in `landing/`,
  superseding the single-file/no-framework practice (`arepapay-landing-design` §4). Added `vercel-react-best-practices` to the
  `arepapay-landing` agent's skills. Stopped the idle duplicate landing terminal `t1b` (turn 0) to avoid a two-agent collision (C1).
- Why: user (2026-11-15): "i will buy a domain and we will use it to launch the project, follow the best practices for a front end
  dev"; chose Next.js; "add the skills that we already have and used and built to this new session". Static export gives
  first-class SEO/OpenGraph/Twitter-card and image optimization for a public launch while still emitting plain HTML the gates probe.
- Tool: master-method (S2 recommendation, M0), `vercel-react-best-practices`; Next `output: 'export'`.
- Alternatives rejected: single-file HTML (board L2) — lighter but weaker SEO/OG/social and image handling for a real launch;
  plain React/Vite (the app's stack) — no first-class metadata/OG or static export.
- Verify: pending — landing not built yet. `bash tests/check.sh` → ALL CHECKS PASSED after this doc/skill change (no code touched).
- Open (needs the user): brand logo + exact palette (from their X account) + X link; domain; footer contact channel. Deploy
  target is BRAIN's call — flagged as board task B4.
- Commit: this commit.

### D-003 · 2026-11-14 · LANDING lane skill and agent (Claude Opus 5.5, BRAIN lane)
- What: `.claude/skills/arepapay-landing-design/` (SKILL + STATE/RUNBOOK/CHANGELOG), `.claude/agents/arepapay-landing.md`.
- Why: user: "you have the control of the other agent and that agent will be on charge of make the landing page like we did on dogeon".
- Tool: adapted DOGEON `dogeon-landing-design` 2.1; truth rules rewritten for a regulated fintech (T6 status labels, T7 disclaimer, T8 no invented contacts).
- Alternatives rejected: BRAIN builds the landing itself — loses the independent truth reviewer and costs BRAIN tokens; reuse the DeepSeek landing — broken JSX, false claims, fake contacts.
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED.
- Commit: this commit.

### D-002 · 2026-11-14 · Rails: two-lane method, charter, money nerves, gate (Claude Opus 5.5, BRAIN lane)
- What: repo `arepapay-v2`, START_HERE, CLAUDE/AGENTS, PLAN, board/handoff/decisions/lessons, skills `arepapay-{mission,brain,agent-sync,solidity}`, `tests/check.sh` (secret scan, rails, landing, forge), caveman plugin disabled in project settings, 20 third-party skills copied (list in `skills-lock.json`). User-level skill `master-method` created with the full method and its whys.
- Why: user: "get the knowledge of the skills used on dogeon … extract what is worth to copy and apply to this new project"; "those master skills and prompts are mine … a file explaining every single style and decision and why … always repeat what we think and why"; "don't use caveman".
- Tool: two research subagents (ArepaPay ground truth, DOGEON method), claims re-verified by BRAIN; DOGEON skills as templates.
- Alternatives rejected: continue in an old ArepaPay folder — 12 diverging copies, burned keys in history; copy all 50+ installed skills — game/Solana/caveman skills conflict with the charter.
- Verify: `bash tests/check.sh` → ALL CHECKS PASSED; secret scan made to fail once on a planted key (V9).
- Commit: this commit.

### D-001 · 2026-11-14 · Direction: permissioned L1 + KYC + encrypted balances + bank-style management; rebuild, not migrate (user decision, recorded by BRAIN)
- What: ArepaPay v2 targets a permissioned Avalanche L1 on testnet with KYC-gated access, encrypted balances and a bank-style back office.
- Why: user: "he change from fuji testnet to a testnet l1 and also it is now a centralize dapp and a encrypted one with full bank manage and with kyc". Ground truth (`docs/research/arepapay_ground_truth.md` §4) showed those features were claims, not code, so v2 builds them for real.
- Alternatives rejected: keep v1's "no KYC, self-custody" pitch — contradicts the user's stated direction; patch v1 code — contracts lack fees and have money bugs, owner key is public.
- Open (needs the user): Q1–Q7 in `docs/PLAN.md` §2.
- Commit: this commit.
