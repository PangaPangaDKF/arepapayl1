#!/usr/bin/env bash
# ArepaPay v2 gate. Prints ALL CHECKS PASSED or exits 1. Stages grow with the code (master-method V8).
set -u
cd "$(dirname "$0")/.."
fail=0; say(){ printf '%s\n' "$*"; }; bad(){ say "FAIL: $*"; fail=1; }

say "== 1/4 secret scan (C8, N6)"
# Files git would track: tracked + untracked-not-ignored.
files=$(git ls-files -co --exclude-standard | grep -vE '^\.claude/skills/(solidity-auditor|vercel-react-best-practices|avax-|avalanche-skills|agent-browser|setup-solidity|solidity-security|find-skills|terminal-testing|investigate-first|lean-build|surgical-patch|verify-and-stop|safe-refactor)')
hits=""
for f in $files; do
  [ -f "$f" ] || continue
  # 1) keys/seeds next to a key-ish word, 2) GitHub tokens, 3) bare 64-hex not labelled as a tx/hash/id
  h=$(grep -nIiE '(private[_ -]?key|secret|mnemonic|seed|deploy_key)[^[:cntrl:]]{0,40}\b(0x)?[0-9a-f]{64}\b|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}' "$f" 2>/dev/null)
  h2=$(grep -nIE '\b(0x)?[0-9a-fA-F]{64}\b' "$f" 2>/dev/null | grep -viE 'tx|hash|blockchain|subnet|id[ :=]|sha256|checksum' | grep -vE '"0x[0-9a-fA-F]{64}" *: *"0x[0-9a-fA-F]{64}"' || true)  # genesis storage slots are public constants
  [ -n "$h$h2" ] && hits="$hits\n$f:\n$h\n$h2"
done
if [ -n "$hits" ]; then bad "possible secret(s) in:$(printf "$hits" | sed -E 's/[0-9a-fA-F]{64}/<redacted>/g')"; else say "ok"; fi

say "== 2/4 rails present (B1)"
for f in START_HERE.md CLAUDE.md AGENTS.md docs/PLAN.md docs/AGENT_BOARD.md docs/HANDOFF_LOOP.md docs/DECISIONS.md docs/LESSONS.md \
         .claude/agents/arepapay-brain.md .claude/agents/arepapay-landing.md .claude/skills/arepapay-mission/SKILL.md \
         .claude/skills/arepapay-brain/SKILL.md .claude/skills/arepapay-agent-sync/SKILL.md .claude/skills/arepapay-solidity/SKILL.md \
         .claude/skills/arepapay-landing-design/SKILL.md; do [ -f "$f" ] || bad "missing $f"; done
[ $fail -eq 0 ] && say "ok"

say "== 3/4 landing gates (T1-T8)"
if [ -f landing/package.json ]; then   # Next.js static export (D-004, D-013); gates read landing/out/ (D-015)
  if [ ! -d landing/node_modules ]; then npm --prefix landing ci --silent >/dev/null 2>&1 || bad "landing npm ci failed"; fi
  npm --prefix landing run build --silent >/dev/null 2>&1 || bad "landing build failed"
  node scripts/landing-check.mjs >/dev/null || bad "landing-check red (node scripts/landing-check.mjs)"
  node scripts/landing-probe.mjs >/dev/null || bad "landing-probe red (node scripts/landing-probe.mjs)"
  [ $fail -eq 0 ] && say "ok"
else say "skip (no landing/ yet)"; fi

say "== 4/4 contracts (N2)"
if [ -f contracts/foundry.toml ]; then (cd contracts && forge test -q) || bad "forge test red"; else say "skip (no contracts yet)"; fi

[ $fail -eq 0 ] && { say "ALL CHECKS PASSED"; exit 0; } || exit 1
