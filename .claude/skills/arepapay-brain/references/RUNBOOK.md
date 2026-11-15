# BRAIN RUNBOOK

## 1. Herdr / second agent
```
hc ls
hc run --bg --name arepapay-landing --cwd /mnt/c/Users/dulbi/arepapay-v2 -- claude --agent arepapay-landing --permission-mode acceptEdits "<task>"
hc read arepapay-landing --lines 120
hc send arepapay-landing "BOARD: new tasks for LANDING in docs/AGENT_BOARD.md (after <hash>). Read it, do them, report back."
hc attach arepapay-landing      # user takes over; ctrl+\ detaches
```

## 2. Secret hygiene
Before copying anything from v1 folders: `grep -nE '\b(0x)?[0-9a-fA-F]{64}\b|ghp_|github_pat_' <file>` must print nothing.
Deploy keys: `cast wallet import arepapay-deployer --interactive` in the **user's** shell; scripts use `--account arepapay-deployer`.

## 3. v1 sources (read-only)
Design system `/mnt/c/Users/dulbi/arepapay-clean/DESIGN_SYSTEM.md` · L1 contracts `/mnt/c/Users/dulbi/arepapay-l1/contracts/src/`
· frontend `/mnt/c/Users/dulbi/arepapay-l1/frontend/src/` · L1 runbook `/mnt/c/Users/dulbi/arepapay-l1/LOCAL_NETWORK.md` (contains a
burned key: never copy that line) · agent `/mnt/c/Users/dulbi/OneDrive/Documentos/deepseek-harness/default-workspace/arepaAgent`.
