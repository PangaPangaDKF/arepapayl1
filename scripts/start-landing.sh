#!/usr/bin/env bash
# Starts the LANDING agent (BRAIN-owned launcher). Usage: bash scripts/start-landing.sh ["first task"]
cd /mnt/c/Users/dulbi/arepapay-v2 || exit 1
TASK="${1:-You are LANDING for ArepaPay v2. Follow your agent file and the arepapay-landing-design skill section 0. Do tasks L1, L2, L3 on docs/AGENT_BOARD.md. Apply rule M0 from master-method before each decision. Truth rules T1-T8 are hard: no invented contacts, numbers, addresses or present-tense claims for unbuilt features. Commit only your paths, report on the board and in docs/HANDOFF_LOOP.md, then stop and wait.}"
exec claude --agent arepapay-landing --permission-mode acceptEdits "$TASK"
