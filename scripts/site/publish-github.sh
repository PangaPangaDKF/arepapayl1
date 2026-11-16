#!/usr/bin/env bash
# One-time launch (D-027), run by the USER: creates/uses github.com/<owner>/arepapayl1 (public: free GitHub Pages needs it),
# pushes this repo, enables Pages (built by .github/workflows/pages.yml) with the custom domain arepapay.site, and prints the
# DNS records to set at Spaceship. Re-runnable: each step skips what already exists.
#   bash scripts/site/publish-github.sh [owner] [repo]
set -uo pipefail
OWNER="${1:-PangaPangaDKF}"; NAME="${2:-arepapayl1}"; DOMAIN=arepapay.site
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$REPO"

echo "1/5 gate (secret scan, rails, landing, contracts)…"
bash tests/check.sh > /tmp/arepapay-gate.log 2>&1; rc=$?
tail -1 /tmp/arepapay-gate.log; [ $rc -eq 0 ] || { echo "gate failed (rc=$rc), nothing published. See /tmp/arepapay-gate.log"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean; commit first"; git status --short; exit 1; }

echo "2/5 repo $OWNER/$NAME…"
if gh repo view "$OWNER/$NAME" >/dev/null 2>&1; then echo "   exists"
else gh repo create "$OWNER/$NAME" --public \
  --description "ArepaPay: private bank-run Avalanche L1 for micro and small merchants (testnet MVP). Testnet only, no real money." || exit 1
fi

echo "3/5 push…"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$NAME.git"
git push -u origin main || exit 1

echo "4/5 Pages (GitHub Actions build) + custom domain…"
gh api -X POST "repos/$OWNER/$NAME/pages" -f build_type=workflow >/dev/null 2>&1 || gh api -X PUT "repos/$OWNER/$NAME/pages" -f build_type=workflow >/dev/null
gh api -X PUT "repos/$OWNER/$NAME/pages" -f cname="$DOMAIN" >/dev/null && echo "   cname = $DOMAIN"
gh workflow run landing-pages -R "$OWNER/$NAME" >/dev/null 2>&1 && echo "   deploy started: gh run list -R $OWNER/$NAME"

cat <<DNS
5/5 DNS at Spaceship (spaceship.com -> Domain list -> $DOMAIN -> Advanced DNS). Delete the two parking A records on @
    (34.216.117.25, 54.149.79.189) and any parking/URL-redirect record, then add:
      A      @     185.199.108.153
      A      @     185.199.109.153
      A      @     185.199.110.153
      A      @     185.199.111.153
      CNAME  www   ${OWNER,,}.github.io
    After DNS resolves (minutes to an hour), turn on HTTPS:
      gh api -X PUT repos/$OWNER/$NAME/pages -F https_enforced=true
DNS
