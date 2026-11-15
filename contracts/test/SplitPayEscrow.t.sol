// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SplitPayEscrow} from "../src/SplitPayEscrow.sol";
import {MockUSD} from "./mocks/MockUSD.sol";
import {FeeToken} from "./mocks/FeeToken.sol";

/// @notice Unit + fuzz tests for Split Pay option A (D-010). Spec: docs/features/SPLIT_PAY.md.
/// Written before the contract (arepapay-solidity workflow step 2).
contract SplitPayEscrowTest is Test {
    SplitPayEscrow internal esc;
    MockUSD internal usd;

    address internal owner = makeAddr("owner"); // stands in for the bank multisig/timelock
    address internal feeRouter = makeAddr("feeRouter");
    address internal merchant = makeAddr("merchant");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant ONE = 1e6; // 6 decimals (USDT/USDC)
    uint16 internal constant FEE_BPS = 50; // 0.5 %

    function setUp() public {
        usd = new MockUSD();
        esc = new SplitPayEscrow(address(usd), feeRouter, FEE_BPS, owner);
        address[3] memory payers = [alice, bob, carol];
        for (uint256 i; i < 3; i++) {
            usd.mint(payers[i], 1_000 * ONE);
            vm.prank(payers[i]);
            usd.approve(address(esc), type(uint256).max);
        }
    }

    function _create(uint256 total, bool requireConfirm) internal returns (uint256 id) {
        vm.prank(merchant);
        id = esc.createIntent(total, uint64(block.timestamp + 10 minutes), 5, requireConfirm, 100);
    }

    // ---------- the user's example: $5 = $3 + $2 ----------

    function test_userExample_threePlusTwo_autoCapture() public {
        uint256 id = _create(5 * ONE, false);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Open));
        assertEq(esc.coveredOf(id), 3 * ONE);

        vm.prank(bob);
        esc.authorize(id, 2 * ONE);

        uint256 fee = (5 * ONE * FEE_BPS) / 10_000;
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Captured));
        assertEq(usd.balanceOf(merchant), 5 * ONE - fee, "merchant net");
        assertEq(usd.balanceOf(feeRouter), fee, "fee");
        assertEq(usd.balanceOf(address(esc)), 0, "escrow empty");
        assertEq(esc.totalHeld(), 0);
    }

    function test_userExample_confirmMode_needsEveryPayer() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Ready));
        assertEq(usd.balanceOf(merchant), 0);

        vm.prank(alice);
        esc.confirm(id);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Ready), "still waiting for bob");
        vm.prank(bob);
        esc.confirm(id);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Captured));
        assertEq(usd.balanceOf(merchant) + usd.balanceOf(feeRouter), 5 * ONE, "N0: captured == total");
    }

    // ---------- holds, caps, races ----------

    function test_lastShareCappedAtRemainder_noOverCoverage() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        uint256 bobBefore = usd.balanceOf(bob);
        vm.prank(bob);
        esc.authorize(id, 4 * ONE); // only 2 should be taken
        assertEq(esc.holdOf(id, bob), 2 * ONE);
        assertEq(bobBefore - usd.balanceOf(bob), 2 * ONE);
        assertEq(esc.coveredOf(id), 5 * ONE);
    }

    function test_raceForLastShare_secondReverts() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        vm.prank(carol);
        vm.expectRevert(SplitPayEscrow.NotOpen.selector);
        esc.authorize(id, 1 * ONE);
    }

    function test_holdIsRealLock_notABalanceCheck() public {
        uint256 id = _create(5 * ONE, true);
        uint256 before = usd.balanceOf(alice);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        assertEq(before - usd.balanceOf(alice), 3 * ONE, "funds left the payer");
        assertEq(usd.balanceOf(address(esc)), 3 * ONE, "funds held by escrow");
    }

    function test_samePayerCanTopUp() public {
        uint256 id = _create(5 * ONE, true);
        vm.startPrank(alice);
        esc.authorize(id, 1 * ONE);
        esc.authorize(id, 2 * ONE);
        vm.stopPrank();
        assertEq(esc.holdOf(id, alice), 3 * ONE);
        assertEq(esc.payerCountOf(id), 1);
    }

    function test_releaseWhileOpen_returnsShare() public {
        uint256 id = _create(5 * ONE, true);
        uint256 before = usd.balanceOf(alice);
        vm.startPrank(alice);
        esc.authorize(id, 3 * ONE);
        esc.release(id);
        vm.stopPrank();
        assertEq(usd.balanceOf(alice), before);
        assertEq(esc.coveredOf(id), 0);
        assertEq(esc.payerCountOf(id), 0);
    }

    function test_releaseWhenReady_reverts() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.NotOpen.selector);
        esc.release(id);
    }

    // F-01: dust can't fill payer slots; the last free slot must cover the remainder
    function test_dustCannotFillSlots() public {
        vm.prank(merchant);
        uint256 id = esc.createIntent(5 * ONE, uint64(block.timestamp + 10 minutes), 5, true, 100);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.ShareTooSmall.selector);
        esc.authorize(id, 1); // 1 base unit < 5.00 / 5 slots
    }

    function test_lastFreeSlotMustCoverRemainder() public {
        vm.prank(merchant);
        uint256 id = esc.createIntent(5 * ONE, uint64(block.timestamp + 10 minutes), 2, true, 100);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE); // >= 5.00 / 2
        vm.prank(bob);
        vm.expectRevert(SplitPayEscrow.ShareTooSmall.selector);
        esc.authorize(id, 1 * ONE); // last slot, remainder is 2.00
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Ready));
    }

    function test_topUpIsNotBoundByFairShare() public {
        uint256 id = _create(5 * ONE, true);
        vm.startPrank(alice);
        esc.authorize(id, 1 * ONE);
        esc.authorize(id, 1); // an existing payer may add any amount
        vm.stopPrank();
        assertEq(esc.holdOf(id, alice), 1 * ONE + 1);
    }

    // F-02: a payer who never confirms can only delay the intent by the confirm window
    function test_readyHasShortConfirmWindow_thenVoidable() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        assertEq(esc.expiryOf(id), uint64(block.timestamp) + esc.CONFIRM_TTL());
        vm.warp(block.timestamp + esc.CONFIRM_TTL());
        vm.prank(alice);
        esc.withdraw(id);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Voided));
    }

    // F-03: a token that delivers less than requested is rejected
    function test_feeOnTransferTokenRejected() public {
        FeeToken fot = new FeeToken();
        SplitPayEscrow e2 = new SplitPayEscrow(address(fot), feeRouter, FEE_BPS, owner);
        fot.mint(alice, 100 * ONE);
        vm.prank(alice);
        fot.approve(address(e2), type(uint256).max);
        vm.prank(merchant);
        uint256 id = e2.createIntent(5 * ONE, uint64(block.timestamp + 10 minutes), 5, true, 100);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.UnsupportedToken.selector);
        e2.authorize(id, 3 * ONE);
    }

    // F-07: the merchant caps the fee they accept at creation
    function test_merchantMaxFeeEnforced() public {
        vm.prank(owner);
        esc.setFeeBps(80);
        vm.prank(merchant);
        vm.expectRevert(SplitPayEscrow.FeeAboveMerchantMax.selector);
        esc.createIntent(5 * ONE, uint64(block.timestamp + 10 minutes), 5, true, 50);
    }

    // F-08: anyone can close an expired intent, even with no holds
    function test_expireClosesEmptyIntent() public {
        uint256 id = _create(5 * ONE, true);
        vm.expectRevert(SplitPayEscrow.NotVoidable.selector);
        esc.expire(id);
        vm.warp(block.timestamp + 11 minutes);
        esc.expire(id);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Voided));
    }

    function test_merchantCannotPayOwnIntent() public {
        usd.mint(merchant, 10 * ONE);
        uint256 id = _create(5 * ONE, true);
        vm.startPrank(merchant);
        usd.approve(address(esc), type(uint256).max);
        vm.expectRevert(SplitPayEscrow.MerchantCannotPay.selector);
        esc.authorize(id, 1 * ONE);
        vm.stopPrank();
    }

    function test_zeroAmountReverts() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.ZeroAmount.selector);
        esc.authorize(id, 0);
    }

    // ---------- expiry, cancel, withdraw (void path) ----------

    function test_expiryVoids_eachPayerWithdrawsExactShare() public {
        uint256 id = _create(5 * ONE, true);
        uint256 aBefore = usd.balanceOf(alice);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.warp(block.timestamp + 11 minutes);

        vm.prank(bob);
        vm.expectRevert(SplitPayEscrow.Expired.selector);
        esc.authorize(id, 2 * ONE);

        vm.prank(alice);
        esc.withdraw(id);
        assertEq(usd.balanceOf(alice), aBefore);
        assertEq(esc.totalHeld(), 0);

        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.NothingToWithdraw.selector);
        esc.withdraw(id);
    }

    function test_expiryBoundary_lastSecondStillAccepted() public {
        uint256 id = _create(5 * ONE, true);
        uint64 expiry = esc.expiryOf(id);
        vm.warp(expiry - 1);
        vm.prank(alice);
        esc.authorize(id, 1 * ONE);
        vm.warp(expiry);
        vm.prank(bob);
        vm.expectRevert(SplitPayEscrow.Expired.selector);
        esc.authorize(id, 1 * ONE);
    }

    function test_readyButNotConfirmed_expiresAndRefunds() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        vm.prank(alice);
        esc.confirm(id);
        vm.warp(block.timestamp + 11 minutes);
        vm.prank(bob);
        vm.expectRevert(SplitPayEscrow.Expired.selector);
        esc.confirm(id);
        vm.prank(alice);
        esc.withdraw(id);
        vm.prank(bob);
        esc.withdraw(id);
        assertEq(usd.balanceOf(address(esc)), 0);
        assertEq(usd.balanceOf(merchant), 0);
    }

    function test_merchantCancel_voidsAndRefunds() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(merchant);
        esc.cancel(id);
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Voided));
        vm.prank(alice);
        esc.withdraw(id);
        assertEq(usd.balanceOf(address(esc)), 0);
    }

    function test_onlyMerchantCancels() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.NotMerchant.selector);
        esc.cancel(id);
    }

    function test_cannotWithdrawAfterCapture() public {
        uint256 id = _create(5 * ONE, false);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(bob);
        esc.authorize(id, 2 * ONE);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.NothingToWithdraw.selector);
        esc.withdraw(id);
    }

    function test_cannotWithdrawWhileStillOpenAndNotExpired() public {
        uint256 id = _create(5 * ONE, true);
        vm.prank(alice);
        esc.authorize(id, 3 * ONE);
        vm.prank(alice);
        vm.expectRevert(SplitPayEscrow.NotVoidable.selector);
        esc.withdraw(id);
    }

    // ---------- intent creation limits ----------

    function test_createRejectsBadParams() public {
        vm.startPrank(merchant);
        vm.expectRevert(SplitPayEscrow.ZeroAmount.selector);
        esc.createIntent(0, uint64(block.timestamp + 10 minutes), 5, true, 100);
        vm.expectRevert(SplitPayEscrow.BadExpiry.selector);
        esc.createIntent(5 * ONE, uint64(block.timestamp + 30), 5, true, 100);
        vm.expectRevert(SplitPayEscrow.BadExpiry.selector);
        esc.createIntent(5 * ONE, uint64(block.timestamp + 2 days), 5, true, 100);
        vm.expectRevert(SplitPayEscrow.TooManyPayers.selector);
        esc.createIntent(5 * ONE, uint64(block.timestamp + 10 minutes), 11, true, 100);
        vm.expectRevert(SplitPayEscrow.TooManyPayers.selector);
        esc.createIntent(5 * ONE, uint64(block.timestamp + 10 minutes), 0, true, 100);
        vm.stopPrank();
    }

    // ---------- fee (N1) ----------

    function test_feeSnapshotAtCreation_notChangedByLaterUpdate() public {
        uint256 id = _create(5 * ONE, false);
        vm.prank(owner);
        esc.setFeeBps(100);
        vm.prank(alice);
        esc.authorize(id, 5 * ONE);
        assertEq(usd.balanceOf(feeRouter), (5 * ONE * FEE_BPS) / 10_000, "fee shown at creation is the fee charged");
    }

    function test_feeCapEnforced() public {
        vm.prank(owner);
        vm.expectRevert(SplitPayEscrow.FeeTooHigh.selector);
        esc.setFeeBps(101);
    }

    function test_onlyOwnerSetsFee() public {
        vm.prank(alice);
        vm.expectRevert();
        esc.setFeeBps(10);
    }

    function test_constructorRejectsFeeAboveCap() public {
        vm.expectRevert(SplitPayEscrow.FeeTooHigh.selector);
        new SplitPayEscrow(address(usd), feeRouter, 101, owner);
    }

    // ---------- fuzz: any split of any total settles exactly ----------

    function testFuzz_anySplitSettlesExactly(uint256 total, uint256 a, uint256 b) public {
        total = bound(total, 1, 500 * ONE);
        a = bound(a, total / 5 == 0 ? 1 : total / 5, total); // fair share (F-01)
        uint256 id = _create(total, false);
        vm.prank(alice);
        esc.authorize(id, a);
        if (a < total) {
            b = bound(b, total - a, 500 * ONE); // bob offers at least the remainder; contract caps it
            vm.prank(bob);
            esc.authorize(id, b);
        }
        assertEq(uint8(esc.stateOf(id)), uint8(SplitPayEscrow.State.Captured));
        assertEq(usd.balanceOf(merchant) + usd.balanceOf(feeRouter), total, "N0: merchant + fee == total");
        assertEq(usd.balanceOf(address(esc)), 0);
        assertEq(usd.balanceOf(alice) + usd.balanceOf(bob) + total, 2_000 * ONE, "payers paid exactly total");
    }
}
