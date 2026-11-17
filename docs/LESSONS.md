# ArepaPay lessons (error → rule ledger)

Every lesson ends in a rule enforced by something automatic. Never delete; supersede and link. Format: master-method TEMPLATES §2.
Inherited general lessons: master-method KNOWLEDGE §9 (C1–C15).

### L-001 · 2026-11-14 · BRAIN · security · v1 deployer key published
- What happened: the private key that owns every v1 contract and the L1 validator manager was written into docs and scripts and pushed to a public repo.
- Root cause: deploy scripts and progress notes held the literal key; no secret scan existed.
- RULE: no key ever enters a file; deploys use a Foundry encrypted keystore in the user's shell; admin roles go to a multisig (N6, R3).
- Enforced by: `tests/check.sh` stage 1 secret scan; `arepapay-solidity` N6.

### L-002 · 2026-11-14 · BRAIN · process · features claimed by another vendor did not exist
- What happened: a DeepSeek-harness commit described an "encrypted L1 SDK", KYC and institutional banking; code review showed undecryptable output, an unused genesis and no KYC.
- Root cause: commit messages and landing copy were trusted as state.
- RULE: inherited features are claims until a test or live check proves them (C14); public copy carries status labels (T6).
- Enforced by: `arepapay-landing-design` T6 + `landing-check.mjs` (status label check); BRAIN STATE "verified facts" list.

### L-003 · 2026-11-15 · BRAIN · analysis · steered the user's model toward an incumbent design
- What happened: D-005 v1.0 turned "the bank is the ramp" into "no bridge, bank-issued IOU" and added a no-KYC customer tier and a council of outside entities, framing the user's blockchain design through traditional-finance assumptions. The user corrected it.
- Root cause: research findings (what incumbents do) were used to redesign the user's model instead of to analyze it.
- RULE: master-method S8: analyze the user's model on its own terms first; present risks as engineering facts next to it, never as a replacement; any departure from the user's words is a question, not a decision.
- Enforced by: master-method S8 + M0 (state which part is the user's spec and which is BRAIN's analysis); ARCHITECTURE §0 quotes the user's spec verbatim before any design.

### L-004 · 2026-11-15 · BRAIN · knowledge · a "verified" skill fact was inferred, not run
- What happened: `arepapay-eerc` v1.0 said the auditor can read the transfer message. Spike S2 showed the message is raw bytes that the SDK encrypts to the receiver only.
- Root cause: the row was written from the event's existence (code read) without running a flow.
- RULE: a skill fact is marked verified only after a run that exercises it; code-read-only facts are labeled TRACED.
- Enforced by: `arepapay-eerc` §1 now cites the S2 run; skill checklist and STATE "verified facts" use PROVEN/TRACED labels.

### L-005 · 2026-11-15 · BRAIN · collaboration · committed the other lane's uncommitted line in a shared file
- What happened: `docs/AGENT_BOARD.md` was already dirty (LANDING reserving D-013) when BRAIN edited it and staged the whole file in eb1318d.
- Root cause: C1 check was done (`git status` showed ` M docs/AGENT_BOARD.md`) but not acted on for an append-only shared file.
- RULE: if a shared file is dirty before you edit it, don't stage it; finish your other paths, then edit the shared file after the other lane commits (or write your board line in the next turn).
- Enforced by: `arepapay-agent-sync` §3 line added in the same commit.

### L-006 · 2026-11-15 · BRAIN · verification · a red gate was hidden by a pipe
- What happened: `bash tests/check.sh | tail -1 && git commit …` committed fa57b5a although the gate printed a FAIL (the pipeline's exit code is `tail`'s). The re-run was green (likely a concurrent landing build), and the commit was docs only, but the gate didn't actually guard it.
- Root cause: exit code lost in a pipe.
- RULE: never pipe the gate inside an `&&` chain; run `bash tests/check.sh > /tmp/gate.log; rc=$?; tail -3 /tmp/gate.log; [ $rc -eq 0 ] && git commit …`, or use `set -o pipefail`.
- Enforced by: this lesson + `arepapay-brain` §6 gate line updated in the same commit.

### L-007 · 2026-11-15 · BRAIN · tooling · the CLI lagged a mandatory network upgrade
- What happened: Fuji's Helicon upgrade requires avalanchego ≥ 1.15, and subnet-evm moved inside the avalanchego release. avalanche-cli 1.9.7 still resolves subnet-evm v0.8.0 (plugin 44), and the public API dropped methods the CLI uses (`platform.getBalance`, `avax.getAtomicTxStatus`).
- Root cause: tool versions were assumed compatible with the live network.
- RULE: before any public-network deploy, check (1) the network's required node version and active upgrades, (2) the VM plugin version that node needs, (3) that every API method the tool calls still exists. Run your own node and use `--endpoint` when the public API is trimmed.
- Enforced by: STAGE_B_FUJI runbook preflight + this lesson (promoted to master-method G6 note).

### L-008 · 2026-11-15 · BRAIN · security · a CLI "describe" printed private keys
- What happened: `avalanche blockchain describe arepapaybankfuji` prints a key table that includes the stored keys' private keys. The two Fuji test keys (`arepapay-fuji`, `arepapay-fuji-gas`, testnet-only, user-approved test keys) appeared in BRAIN's tool output.
- Root cause: assumed a read-only "describe" command shows only public data.
- RULE: treat every unfamiliar CLI read command as able to print secrets: first run it once piped through a filter that drops 64-hex strings (`| grep -vE '[0-9a-f]{64}'`), and never paste its raw output into docs. Keys that leak are rotated before they ever hold value.
- Enforced by: this lesson; STAGE_B_RESULT §1 uses the filtered form; master-method S-rule note (V-section).

### L-009 · 2026-11-15 · BRAIN · tooling · a status command deleted a stored login
- What happened: `vercel whoami` (CLI 65.11.0) found the stored Vercel token expired, printed "Logged out" and deleted `~/.local/share/com.vercel.cli/auth.json`. The token already did not work, so nothing usable was lost, but a "read" command changed the user's machine.
- Root cause: ran an account CLI's status command without knowing its side effects on an expired session.
- RULE: before running a third-party account CLI, copy its credential file aside (permissions kept) or use `--token`/env auth; report any side effect to the user.
- Enforced by: this lesson; `arepapay-brain` RUNBOOK note.

### L-010 · 2026-11-15 · BRAIN · tooling · `pkill -f <script>` killed its own shell
- What happened: `pkill -f fuji-split-proxy.mjs; node scripts/l1/fuji-split-proxy.mjs …` in one command line matched the running bash (its command line contains the pattern) and killed the whole command (exit 144).
- RULE: stop your own processes by PID files (`kill "$(cat x.pid)"`), never `pkill -f` with a pattern that appears in the same command line.
- Enforced by: `scripts/mvp/serve-public.sh` uses PID files.

### L-011 · 2026-11-16 · BRAIN · tooling · a toolchain in a scratch folder vanished after a reboot
- What happened: the S2 eERC clone (prepared deps, compiled artifacts, circuit files) lived in a session scratch folder under
  `/tmp`; after the machine restarted it was gone and `s2-run.sh` pointed at a dead path. Rebuilding cost a clone + install.
- Root cause: a durable dependency was placed in a per-session temp folder because that was convenient during the spike.
- RULE: anything a later session or a script needs goes in a durable path (`~/.cache/arepapay/…`) created by a script with a
  `prepare` step; scratch folders are for one-off outputs only.
- Enforced by: `scripts/eerc/deploy.sh` (default `EERC_DIR=~/.cache/arepapay/EncryptedERC`, `prepare` mode, pinned commit check).

### L-012 · 2026-11-16 · BRAIN · testing · a test server started without the supervisor's key env
- What happened: for the D-032 e2e I started a second onboarding server by hand with `AUTO_APPROVE=1` on Fuji but without
  `ADMIN_KEY_FILE`/`GAS_KEY_FILE`. It started "fine", every access request returned 502, and the e2e run was wasted (3/17).
- Root cause: the service loaded the approval keys lazily, on the first request; only `serve-public.sh`/`e2e.sh` set them for Fuji.
- RULE: a service that needs keys to do its job checks them at boot and refuses to start without them.
- Enforced by: `backend/onboarding/server.mjs` calls `checkSigners()` at boot when `AUTO_APPROVE=1` (exit 2 with the reason).

### L-013 · 2026-11-17 · BRAIN · deploy · an unattended script pushed local HEAD
- What happened: `serve-public.sh publish-url` committed the /probar/ pointer and ran `git push origin HEAD`. Wiring it into
  the logon autostart (D-037) would have published every unpushed local commit with no review or gate — at that moment
  LANDING's D-036 commit with a false FAQ line ("la página te avisa").
- Root cause: a helper written for a supervised session (push = "my commits are gated") was reused unattended.
- RULE: unattended jobs never push a branch; they push exactly the one artifact they own, built on `origin/main`, and touch
  no working-tree file.
- Enforced by: `publish_url` builds one commit with a temporary index on top of `origin/main` and pushes `<commit>:main`;
  tested against a throwaway bare remote with a planted unpushed commit (stays local; only `config/public/mvp-url.json` changes).

### L-014 · 2026-11-17 · LANDING (recorded by BRAIN) · truth · a copy line described code that did not do it
- What happened: the D-036 FAQ said "Si está apagada, la página te avisa", but `/probar/` only warned when the pointer file
  failed; with the PC off it redirected to a dead tunnel (browser error).
- Root cause: copy about behaviour was written from intent, not from the code's failure path.
- RULE: a sentence that describes what the product does is a claim about code: test its failure path before publishing (T1).
- Enforced by: `/probar/` now checks `/health` before redirecting; V9 run (dead pointer → "Entorno de prueba apagado",
  old page → chrome-error) recorded in D-036; BRAIN reviews copy against code before every landing deploy.

### L-015 · 2026-11-17 · LANDING (recorded by BRAIN) · tooling · phone screenshots were cropped
- What happened: a 390 px `--shot` looked clipped while the overflow probe said clean.
- Root cause: headless Chrome lays out windows narrower than ~500 px wider and crops the capture.
- RULE: read phone-width renders only through an iframe.
- Enforced by: `scripts/landing-probe.mjs --shot` switches to an iframe below 500 px (D-036).
