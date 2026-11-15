---
name: arepapay-agent-sync
description: How ArepaPay's two Claude Code agents (BRAIN = everything except the landing, LANDING = landing/ only) split work, take turns through docs/AGENT_BOARD.md, avoid git collisions and hand tasks to each other. Load at the start of every session and before writing any shared file, committing or deploying.
---

# ArepaPay agent sync (two-lane loop)

Version 1.0 · 2026-11-14 · D-002 · Adapted from DOGEON `dogeon-agent-sync` 1.0 (D-096) and master-method C1–C11.

## 1. Lanes
| Lane | Owns (only this lane writes it) | Decides |
|---|---|---|
| **BRAIN** | everything not listed for LANDING: `contracts/`, `config/`, `backend/`, `app/`, `tests/`, `scripts/` (except `scripts/landing-*.mjs`), `docs/PLAN.md`, `docs/research/`, `docs/audits/`, `CLAUDE.md`, `AGENTS.md`, `START_HERE.md`, all skills except the landing one, `.claude/agents/arepapay-brain.md`, **every deploy** | Product rules inside the charter, architecture, which tasks each lane gets |
| **LANDING** | `landing/`, `scripts/landing-*.mjs`, `.claude/skills/arepapay-landing-design/`, `.claude/agents/arepapay-landing.md` | Landing design and copy, inside the truth rules |
Shared, append-only for both: `docs/AGENT_BOARD.md`, `docs/HANDOFF_LOOP.md`, `docs/DECISIONS.md`, `docs/LESSONS.md`. Add your own
entry; never rewrite the other lane's.

## 2. The loop (one turn = read, do, verify, commit, report, hand over, wait)
1. Read the board, the handoff loop, `git log --oneline -8`, `git status --short`. Other agent's screen: `hc ls`, then
   `hc read <address> --lines 120`.
2. Do your tasks, only in your paths. Need the other lane's file? Write a task.
3. Verify with the task's commands (always `bash tests/check.sh`; LANDING also its two landing gates).
4. Commit only your paths with your reserved D-number.
5. Report: top entry in `docs/HANDOFF_LOOP.md` + a `## Log` line on the board (what, hash, tests and results, new tasks); update `## Status`.
6. Hand over: if the other agent is `done` or `idle` in `hc ls`, send one line:
   `hc send <address> "BOARD: new tasks for <LANE> in docs/AGENT_BOARD.md (after <hash>). Read it, do them, report back."`
   Never send into a `working` agent.
7. BRAIN waits ≥ 30 min with a background command:
   `sleep 1800; git -C /mnt/c/Users/dulbi/arepapay-v2 log --oneline -5; tail -40 /mnt/c/Users/dulbi/arepapay-v2/docs/AGENT_BOARD.md`.
   Stop when the board says DONE.

## 3. Collision rules
- `git status --short` right before every write; a file you own changed by someone else → stop and ask on the board.
- Reserve D-numbers on the board and **commit that line first**.
- Never commit, revert, stash or reformat the other lane's files; never `git add -A`, `git stash`, `git reset --hard`.
- If HEAD moved while you worked: `git log --stat` the new commits and confirm they don't touch your files.
- Deploys are BRAIN only, after both lanes committed and all gates green; verify live; log it.
- Tests that start servers use their own port and kill only their own PID.

## 4. A good task for the other lane
ID (`B7`/`L7`), one-sentence goal, exact files, exact verified values, truth source (commit / D-entry / code line), verify step.
The other lane should never re-derive a fact you already checked.
