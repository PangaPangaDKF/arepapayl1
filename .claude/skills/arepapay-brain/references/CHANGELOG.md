# arepapay-brain changelog and lessons (newest first)

## 1.2 · 2026-11-16 · D-034 — store contacts
- Lesson: an unanchored review subagent (code only, no conclusions) found a PROVED low (L-1, stranded funds when the payee is a
  contract of the same flow). Rule kept: every new money contract gets that review before its first deploy, and its PoC becomes
  a repo test before the fix.
- Lesson: a new money path that reuses an existing fee should read it from the same source (here the escrow) instead of a copy.

## 1.1 · 2026-11-16 · D-032 — encrypted balances in the MVP
- Lesson (L-011): durable toolchains go in `~/.cache/arepapay` via a script with a `prepare` step, never in a scratch `/tmp` folder.
- Lesson (L-012): services check their keys at boot; start Fuji test servers with the same env as `serve-public.sh`.
- Lesson: before deploying third-party verifiers, export the zkey verification keys and match every constant against the
  verifier source (142/142 for eERC); cheap, and it is the only proof the shipped circuits fit the contracts.
- STATE gained a "Live" section (what runs where, how to recover after a reboot).

## 1.0 · 2026-11-14 · D-002 — skill created
- Lesson: another vendor's "done" is a claim. DeepSeek's "encrypted L1 SDK / KYC / bank" commit was verified against code and was
  mostly false (C14). Verify every inherited feature before planning on it.
- Lesson: a key that reached a remote is burned (C15). The gate now scans for keys and tokens.
- Lesson: research subagents are fast but their claims were re-checked by BRAIN before reporting (master-method §3.3).
