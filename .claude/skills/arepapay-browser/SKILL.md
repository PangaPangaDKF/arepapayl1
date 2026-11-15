---
name: arepapay-browser
description: Load when you need to drive or test the ArepaPay dApp (app/) or any web page in a headless browser - end-to-end UI tests with an injected MetaMask-like wallet, screenshots, checking a page for JS errors, or clicking/typing through a flow from Node. Zero-dependency Chrome DevTools Protocol tools in scripts/browser/.
---

# ArepaPay browser tools (headless Chrome over CDP)

Zero npm dependencies: Node 22+ (global `WebSocket`/`fetch`) plus a local Chrome. Chrome is found at
`~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`, then
`/usr/bin/google-chrome|chromium`; override with `CHROME=<path>`. `HEADFUL=1` shows a window (needs a display).

## Tools

- `scripts/browser/cdp.mjs` - reusable helper. `launch()` starts Chrome with a temp profile and a random debugging port;
  `browser.newPage()` opens a tab (open several, e.g. one per wallet). Page methods: `goto(url)`, `evaluate(expr)`,
  `waitFor(jsPredicate, ms)`, `click(selector)` (real mouse event, fails if hidden), `type(selector, text)` (clears,
  then real text input), `text(sel)`, `visible(sel)`, `screenshot(path)` (full page PNG), `addInitScript(src)`
  (`Page.addScriptToEvaluateOnNewDocument`), `addBinding(name, fn)` (raw `Runtime.addBinding`), `exposeFunction(name,
  asyncFn)` (promise-returning page -> Node call), `send(method, params)` for raw CDP. `page.errors` collects JS
  exceptions and `console.error`; `page.logs` collects browser log entries (404s etc.). `browser.close()` cleans up.
- `scripts/browser/wallet-e2e.mjs <pageUrl> [--shots <dir>]` - full MVP scenario through the real UI.
- `scripts/mvp/smoke-page.mjs <pageUrl>` - older no-wallet smoke (page renders, config loads, no JS errors).

## Running the wallet e2e

The page must be served by the onboarding service with `AUTO_APPROVE=1` (and `SINGLE_ORIGIN=1`, so `/config` and
`/rpc` share the page's origin). Against the local L1:

```bash
cd /mnt/c/Users/dulbi/arepapay-v2
NET=local SINGLE_ORIGIN=1 AUTO_APPROVE=1 PORT=8795 DATA_DIR=$(mktemp -d) node backend/onboarding/server.mjs &   # ~60 s to start from /mnt/c
node scripts/browser/wallet-e2e.mjs http://127.0.0.1:8795/ --shots /tmp/shots
```

For Fuji, point it at the public URL of a service running `NET=fuji` with `AUTO_APPROVE=1`. It prints `PASS`/`FAIL` per
step, `== n/m passed`, exits 1 on any failure (stops at the first one and dumps UI text + recent wallet calls), and
saves screenshots (default: a temp dir). Local run takes about 75 s.

Scenario: three fresh wallets (merchant, alice, bob) each load the page, connect, add/switch network (the wallet starts
on chain 0x1, so the 4902 -> `wallet_addEthereumChain` path is exercised), request access (allowlist + 1 ARPB + 50
tUSD); merchant creates a 5 tUSD split intent for 2 payers; alice opens the `?intent=` share link and pays 3, bob pays
2 (approve + authorize each); asserts the UI shows "Cobrado" and on chain merchant = 54.975, alice = 47, bob = 48 tUSD
(0.5% fee). Any page JS exception or `console.error` fails the step.

## Injected wallet design

An init script defines `window.ethereum` (`isMetaMask: true`, `request`, `on`, `removeListener`). `request()` goes
through a CDP binding to Node, where a `Wallet` object holds a viem account made with `generatePrivateKey()` (viem is
loaded from `backend/onboarding/node_modules` via `createRequire`). Node answers `eth_requestAccounts`/`eth_accounts`
(empty until authorized, like MetaMask), `eth_chainId`, `wallet_switchEthereumChain`/`wallet_addEthereumChain` (then
emits `chainChanged` into the page), `eth_sendTransaction` (signed with a viem walletClient against the RPC the page
advertised in `/config` or in `wallet_addEthereumChain`), `personal_sign`, `eth_signTypedData_v4`; every other method
is forwarded to that RPC. Authorization and chain survive navigation, so the share link reconnects silently.

## Limits

- It is not real MetaMask: no popups, no user confirmation step, no MetaMask gas/fee logic, no extension quirks, no
  mobile in-app browser. Real MetaMask (especially mobile MetaMask) still needs a human check before calling the
  public MVP done.
- It auto-accepts everything; rejection paths (code 4001) are not tested unless you add them.
- The page loads ethers and qrcode-generator from jsDelivr, so the machine needs internet access.

## Rules

- Never print, log, screenshot or write private keys. Test keys exist only in Node memory for one run; only addresses
  are printed. Do not add key material to wallet call logs or error messages.
- Testnet only. Kill only the service PID you started.
