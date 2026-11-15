# ArepaPay v2 decisions (newest first) — why things are the way they are

Template: master-method TEMPLATES §1. Reserve the D-number on `docs/AGENT_BOARD.md` before writing it anywhere.

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
