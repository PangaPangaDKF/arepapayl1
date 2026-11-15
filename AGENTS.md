# AGENTS.md — rules for any coding agent (Claude Code, Antigravity, Codex, DeepSeek harness, …)

Read `START_HERE.md` first and pick a lane or ask the user. `CLAUDE.md` is the authority; this file mirrors its rules for CLIs that
auto-load AGENTS.md. Method: the user's `master-method` skill (`~/.claude/skills/master-method/` or `~/.agents/skills/master-method/`).

1. M0: before any decision, state what you think, which rule applies, and why.
2. Charter `arepapay-mission` wins conflicts; money rules `arepapay-solidity` N0–N7; public truth T1–T8.
3. Clean tree in, clean tree out; reserve D-numbers on `docs/AGENT_BOARD.md` first; commit only your paths; never `git add -A`, stash or reset.
4. Never handle, print or commit keys or seeds; v1 keys are burned.
5. Done = `bash tests/check.sh` → ALL CHECKS PASSED, quoted. Then a `docs/DECISIONS.md` entry and a Conventional Commit.
6. Another agent's or vendor's claim is unverified until you run it.
7. No caveman style.
