# SplitPayEscrow audit (Split Pay option A)

Date: 2026-11-15 · Auditor: independent agent (read-only) · Target: `contracts/src/SplitPayEscrow.sol` (270 lines, Solidity 0.8.24, OZ v5.1.0)
Spec: `docs/features/SPLIT_PAY.md` §2, §4 · Laws: `.claude/skills/arepapay-solidity/SKILL.md` N0–N7

## Method

- I followed the `solidity-auditor` method's three passes by hand: value flow, then attacks, then solvency. Each pass was told what the earlier passes had found.
- I did not run the skill's 12-agent fan-out. That fan-out writes `.solidity-auditor/` and `.audit-*` into the repo, which this read-only audit is not allowed to do.
- **Baseline:** I ran `forge test` in `contracts/`. All 28 tests passed (24 unit/fuzz, 4 invariants at 128 runs × 64 depth).
- **PoCs:** the proof tests are in `/tmp/claude-1000/-home-panga/9175df3d-cd88-4613-9f2f-8bb72c0ae070/scratchpad/poc/test/PoC.t.sol`, with odd-token mocks in `test/mocks/OddTokens.sol`.
  - Command: `forge test --match-contract PoC -vv`.
  - Result: **10 passed, 0 failed**. Every "PROVEN" below refers to one of these tests passing.

## Findings

### F-01 · MEDIUM · N0/N3 (spec §4 "max payers", liveness): dust holds fill every payer slot at zero net cost
`SplitPayEscrow.sol:146-149`
```solidity
if (holdOf[id][msg.sender] == 0) {
    if (it.payerCount == it.maxPayers) revert TooManyPayers();
    it.payerCount += 1;
}
```
- **Scenario:**
  1. An attacker authorizes 1 base unit (0.000001 USDT) from `maxPayers` different addresses.
  2. Every honest payer then reverts with `TooManyPayers`. The intent can never be covered.
  3. The attacker calls `release()` at any time and gets every unit back (`:191-204`).
- **Cost:** gas only, which is near zero on the bank L1, plus `maxPayers` base units locked for a while. The attacker can repeat this on every new intent id. The ids are sequential (`nextId++`) and public, so they are easy to target.
- **Variant:** the attacker does not need every slot. Front-running the honest payer that would take the last free slot is enough.
- **What limits it:** KYC on the chain's txAllowList means the attacker needs `maxPayers` KYC'd addresses, and their identities are known.
- **Evidence:** PROVEN. `test_F01_dustSquatBlocksAllPayers` logs `attacker locked (base units): 10` and `attacker net cost after release: 0 tokens (gas only)`, and Alice's `authorize` reverts `TooManyPayers`.
- **Fix (smallest):** set a minimum share for the payer who opens a new slot, for example `if (take < it.total / it.maxPayers && take != remaining) revert ShareTooSmall();`. With this rule `maxPayers` holders always cover the total. Alternatives: the merchant sets `minShare` at creation, or the merchant can evict a non-confirmed payer.

### F-02 · MEDIUM · spec §2 Option 2 / liveness: in confirm mode one payer can freeze an intent in `Ready` until expiry
`SplitPayEscrow.sol:184` and `:193`
```solidity
if (it.confirmedCount == it.payerCount) {
...
if (it.state != State.Open) revert NotOpen();
```
- **Scenario:**
  1. Honest payers cover `total - 1`.
  2. An attacker authorizes the last 1 unit. The intent becomes `Ready` (`:159-161`).
  3. The attacker never confirms, so capture never happens.
  4. Honest payers cannot `release` (Ready is not Open) and cannot `withdraw` before expiry. Their funds stay locked for up to `MAX_TTL` (1 day). The sale fails, the merchant gets 0, and the attacker loses nothing.
- **Spec gap:** the spec's escape hatch "or the merchant presses charge" (§2) is not implemented. The merchant can only `cancel`.
- **Evidence:** PROVEN. `test_F02_lastWeiGriefInConfirmMode`: after Alice confirms, `release` reverts `NotOpen` and `withdraw` reverts `NotVoidable`. After expiry Alice gets a refund and the merchant has received 0.
- **Fix (smallest):** add `merchantCapture(id)`, callable by the merchant when `state == Ready && block.timestamp < expiry`. Every share was already locked by an explicit payer `authorize`, so this matches the spec's "merchant presses charge". Also apply F-01's minimum share. Otherwise, document that only Option 1 (auto-capture) ships.

### F-03 · MEDIUM · N2 (solvency): fee-on-transfer token makes the escrow insolvent and pays one intent with other intents' holds
`SplitPayEscrow.sol:152-154, 168`
```solidity
holdOf[id][msg.sender] += take;
it.covered += take;
totalHeld += take;
...
token.safeTransferFrom(msg.sender, address(this), take);
```
- **Scenario:** the contract books `take` without measuring what actually arrived.
  - USDT has a dormant `basisPointsRate` fee switch, and a bridged token may also have one. If it is ever turned on, each pull credits `take` but receives less.
  - On capture, `_payOut` sends the full `total`, and the missing part comes out of other intents' holds.
  - The last payer to withdraw on another intent then reverts.
- **Evidence:** PROVEN with a 0.1 % FOT mock in `test_F03_feeOnTransferInsolvency`. The log shows `balance: 1993000` against `totalHeld: 2000000`, and Alice's `release` of her 2.0 hold on a different intent reverts.
- **Fix (smallest):** in `authorize`, measure `balanceOf(this)` before and after the pull and `revert` if `received != take` (refuse FOT). Put the pull before the effects, which `nonReentrant` already makes safe. Pin the deployed token to one confirmed to have no fee, and say so in NatSpec.

### F-04 · LOW · N3 (push payout) / liveness: blacklisted `feeRouter` blocks every capture; blacklisted merchant blocks its intents
`SplitPayEscrow.sol:48, 169, 266-269`
```solidity
address public immutable feeRouter;
...
if (captureNow) _payOut(it.merchant, net, fee);
...
token.safeTransfer(merchant, net);
if (fee != 0) token.safeTransfer(feeRouter, fee);
```
- **Scenario:** payouts are pushed, not pulled.
  - If the USDC/USDT issuer (or the bridge's freeze function) blacklists the immutable `feeRouter`, every completing `authorize` and final `confirm` across all intents reverts, with no admin way to repoint it.
  - A blacklisted merchant causes the same failure on its own intents.
  - No funds are lost: holds are refunded through `withdraw` after expiry.
- **Evidence:** PROVEN. `test_F04_blacklistedFeeRouterBricksAllCaptures`: both cases revert with `"blacklisted"`, and Alice withdraws her full balance after expiry.
- **Fix (smallest):** pay out with pull accounting, for example `owed[merchant] += net; owed[feeRouter] += fee;` plus a `claim()`. Count `owed` in the N2 obligations. Alternatively make `feeRouter` settable through the multisig/timelock.

### F-05 · INFO · N4 (indexer correctness): stale `holdOf` after capture
`SplitPayEscrow.sol:258-264` (`_markCaptured` clears `totalHeld` but not `holdOf`)
```solidity
it.state = State.Captured;
totalHeld -= it.total;
```
- **Scenario:** after capture, `holdOf(id, payer)` still returns the share.
- **Can it be abused?** No. `Captured` is terminal, and every money path rejects it:
  - `withdraw` (`:209`) reverts `NothingToWithdraw`;
  - `release`, `authorize` and `cancel` revert `NotOpen`;
  - `confirm` reverts `NotReady`.
  - Ids never repeat (`nextId++`), so the stale entry cannot be reused.
- **Risk:** only off-chain. A UI or ledger that reads `holdOf` as "money still held" will show the wrong figure.
- **Evidence:** PROVEN. `test_F05_staleHoldOfAfterCapture` shows `holdOf == 3e6` after capture, and all five paths revert.
- **Fix:** document that `holdOf` means "share contributed", or add a view `heldOf(id, p)` that returns 0 unless the state is Open, Ready or Voided.

### F-06 · INFO · N2: the strict `balance == totalHeld` gate breaks on a donation, and donated tokens are stuck
`SplitPayEscrow.sol:52-53`; invariant `test/SplitPayEscrow.invariant.t.sol` `assertEq(usd.balanceOf(address(esc)), esc.totalHeld())`
- **Scenario:** anyone can transfer tokens directly to the escrow. The balance then exceeds `totalHeld`. There is no sweep, so the tokens are stuck. An on-chain or off-chain monitor that checks `==` will fire. N2 only requires `≥`.
- **Evidence:** PROVEN. `test_F06_donationBreaksStrictEquality`.
- **Fix:** have the monitor and the invariant use `>=` (and keep `==` only inside the handler, where no donations happen). Optionally add an owner `sweepExcess()` limited to `balance - totalHeld`.

### F-07 · LOW · N1: no merchant-side fee bound; the owner can raise the fee just before `createIntent`
`SplitPayEscrow.sol:115` and `:228-232`
```solidity
it.feeBps = feeBps;
```
- **Scenario:** the merchant signs `createIntent` without a maximum fee.
  - A `setFeeBps(100)` mined first (by timelock execution or a front-run) silently applies 1 %.
  - The cap and the snapshot work as intended, and payers are unaffected because they pay `total`.
  - The merchant, who carries the fee, did not see it before signing, which N1 requires ("the app shows the fee before signing").
- **Evidence:** PROVEN. `test_F07_feeRaiseFrontRunsCreate`: the merchant's net at 1 % is `4950000` instead of 4975000.
- **Fix:** add a `uint16 maxFeeBps` argument to `createIntent` and `revert` if `feeBps > maxFeeBps`.

### F-08 · LOW · spec §4 "Expiry always ends in a terminal state": state is lazy and an empty expired intent stays `Open` forever
`SplitPayEscrow.sol:209-218`
```solidity
if (it.state != State.Voided) {
    it.state = State.Voided;
    emit Voided(id);
}
uint256 amount = holdOf[id][msg.sender];
if (amount == 0) revert NothingToWithdraw();
```
- **Scenario:** an intent only moves to `Voided` when a holder withdraws, and the revert at `:218` rolls back that state change for anyone with no hold.
  - An expired intent with 0 holders (all released, or nobody joined) keeps `stateOf == Open` permanently, and no `Voided` event is ever emitted.
  - An expired `Ready` intent reads `Ready` until a holder withdraws.
  - No funds are at risk, but the N4 indexer cannot rely on an on-chain terminal event.
- **Evidence:** PROVEN. `test_F08_stateNotTerminalAfterExpiry`.
- **Fix:** add a permissionless `expire(id)` that sets `Voided` and emits once `block.timestamp >= expiry`, and/or make `stateOf` return `Voided` when expired and not captured.

### F-09 · INFO · N3: CEI ordering in `authorize()` is safe for a standard token
`SplitPayEscrow.sol:165-169`
```solidity
if (captureNow) (net, fee) = _markCaptured(id, it);
// interactions
token.safeTransferFrom(msg.sender, address(this), take);
if (captureNow) _payOut(it.merchant, net, fee);
```
- **Why it is safe:**
  - All state (`Captured`, `totalHeld -= total`) is final before any external call.
  - The pull happens before the payout, so the payout is funded by this intent's holds plus the share pulled in the same call.
  - If the pull fails, the whole transaction reverts.
  - `authorize`, `confirm`, `release` and `withdraw` are all `nonReentrant`. `cancel` (`:125`) is not, but during the callback window the state is already Captured, so `cancel` reverts `NotOpen`.
- **Only real risk:** a token that delivers less than `take` (F-03).
- **Evidence:** TRACED.
- **Fix:** none needed. Add `nonReentrant` to `cancel` for consistency.

### F-10 · INFO · N3: USDT's missing return values are handled
`SplitPayEscrow.sol:19` `using SafeERC20 for IERC20;`. Every transfer goes through `safeTransfer`/`safeTransferFrom`.
- **Evidence:** PROVEN. `test_USDT_noReturnValues_handledBySafeERC20` uses a token whose `transfer`/`transferFrom`/`approve` return nothing. The full split settles with merchant `5e6 - 25000`, router `25000`, escrow `0`.
- **Not applicable:** USDT's approve-to-nonzero quirk, because the contract never calls `approve`.

### F-11 · INFO · N1: fee rounds down to 0 on very small totals
`SplitPayEscrow.sol:261` `fee = (it.total * it.feeBps) / 10_000;`
- **Impact:** at 50 bps any `total < 200` base units (< $0.0002) pays no fee. A merchant could in theory split a sale into tiny intents to avoid the fee, but gas and UX make that pointless. Rounding favours payers and merchant, never the contract, and N0 still holds (`net + fee == total`).
- **Evidence:** TRACED.
- **Fix:** none, or a minimum `total`.

### F-12 · INFO · test coverage
- **Gaps:** the invariant handler uses only `MockUSD`, 4 fixed payers, no dust or sybil payers, no FOT/blacklist token, and no donations. It also reports `reverts: 0` because every call is wrapped in try/catch, so it cannot show how often each path really succeeded.
- **Effect:** none of F-01 to F-04 could be caught by the existing suite.
- **Fix:** add the PoCs above as regression tests, plus a ghost counter of successful calls per selector.

## Answers to the specific questions

1. **Can a payer block others with dust holds?** Yes (F-01). It takes `maxPayers` addresses × 1 base unit, fully refundable, so the cost is gas only. In confirm mode, one 1-unit payer can also freeze the intent in `Ready` until expiry (F-02).
2. **Can anyone lock funds forever?** No, not with a standard token. Every hold leaves the escrow through `release` (Open), `withdraw` (after cancel, or after expiry, which is at most 1 day), or capture. The exceptions:
   - a payer blacklisted by the token issuer cannot withdraw their own hold;
   - a fee-on-transfer token causes a real shortfall (F-03);
   - donated tokens are stuck (F-06).
3. **Can the merchant steal or redirect funds?** No. The merchant is fixed to `msg.sender` at creation (`:113`), and payout happens only when `covered == total`. The merchant can only `cancel`, which gives refunds. The merchant cannot pay their own intent from the same address (`:141`), but can from a second address. That is harmless (they pay themselves minus the fee), though it enables F-01/F-02 griefing. QR phishing (a fake merchant's id) is an off-chain/UI matter.
4. **Can the owner touch held funds?** No. The owner can only call `setFeeBps` (≤ 100 bps, snapshotted per intent) and the Ownable2Step transfer. There is no sweep or rescue path (PROVEN in `test_Q_ownerAndMerchantCannotMoveHolds`, together with the code read). The fee front-run is covered in F-07.
5. **Is the CEI ordering in `authorize()` safe?** Yes for a standard token (F-09). It is not safe for a fee-on-transfer token (F-03).
6. **payerCount after release in Ready?** There is no issue. `release` requires `Open` (`:193`), so `payerCount` is frozen once the intent is `Ready`, and `confirmedCount == payerCount` counts exactly the non-zero holders. The state cannot go from Ready back to Open, so the `confirmed[]` flags can never go stale. In Open, a top-up does not increase the count (`:146`), and `take > 0` always holds because Open implies `covered < total`.
7. **Holds after capture, and stale `holdOf`?** The holds are consumed into the payout (`totalHeld -= total`), but `holdOf` is not cleared. It cannot be abused because Captured is terminal and every money path rejects it (F-05, PROVEN). The risk is only display or indexing.

## Verdict

| ID | Severity | Law | Title | Evidence |
|---|---|---|---|---|
| F-01 | MEDIUM | N0/N3, §4 | Dust holds fill all payer slots (gas-only cost) | PROVEN |
| F-02 | MEDIUM | §2 Opt 2 | One payer freezes a `Ready` intent until expiry; no merchant charge | PROVEN |
| F-03 | MEDIUM | N2 | Fee-on-transfer token → insolvency, cross-intent payout | PROVEN |
| F-04 | LOW | N3 | Push payout: blacklisted immutable feeRouter/merchant blocks captures | PROVEN |
| F-05 | INFO | N4 | Stale `holdOf` after capture (not exploitable) | PROVEN |
| F-06 | INFO | N2 | Donation breaks strict `==` gate; no sweep | PROVEN |
| F-07 | LOW | N1 | No merchant `maxFeeBps`; fee raise front-runs `createIntent` | PROVEN |
| F-08 | LOW | §4 expiry | Empty/expired intents never reach a terminal state on chain | PROVEN |
| F-09 | INFO | N3 | CEI in `authorize` safe for a standard token | TRACED |
| F-10 | INFO | N3 | USDT no-return handled by SafeERC20 | PROVEN |
| F-11 | INFO | N1 | Fee rounds to 0 below 200 units at 50 bps | TRACED |
| F-12 | INFO | N2 gate | Test suite blind to F-01 to F-04 | TRACED |

**Overall:** I found no CRITICAL or HIGH issue. With a standard token, neither the owner nor the merchant can steal, and every hold can be refunded.

**Before production:**
- Fix the liveness and griefing issues (F-01, F-02), or ship only the auto-capture mode with a minimum share.
- Add FOT protection (F-03) or confirm in writing that the bridged token has no fee.
- Move payouts to pull accounting (F-04).
