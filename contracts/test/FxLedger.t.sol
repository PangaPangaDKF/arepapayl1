// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FxLedger} from "../src/FxLedger.sol";

/// @notice Unit + fuzz tests for the FX coordination ledger (D-020). Spec: docs/features/MERCHANT_FX.md §1, §4.
/// Written before the contract (arepapay-solidity workflow step 2).
contract FxLedgerTest is Test {
    FxLedger internal fx;

    address internal admin = makeAddr("admin"); // stands in for the bank multisig/timelock
    address internal signer = makeAddr("rateSigner");
    address internal recon = makeAddr("reconciler");
    address internal merchant = makeAddr("merchant");
    address internal merchant2 = makeAddr("merchant2");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant RATE = 4500; // 45.00 Bs per USD
    uint16 internal constant SPREAD = 200; // 2 % -> band [4410, 4590]
    uint256 internal constant LO = 4410;
    uint256 internal constant HI = 4590;

    bytes32 internal constant TX1 = keccak256("eerc-tx-1");
    bytes32 internal constant TX2 = keccak256("eerc-tx-2");

    uint256 internal salt;

    function setUp() public {
        fx = new FxLedger(admin, signer, recon, RATE, SPREAD);
        vm.startPrank(admin);
        fx.setMerchant(merchant, true);
        fx.setMerchant(merchant2, true);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ helpers

    function _c() internal returns (bytes32) {
        return keccak256(abi.encode("commitment", ++salt));
    }

    function _exp() internal view returns (uint64) {
        return uint64(block.timestamp + 10 minutes);
    }

    function _open() internal returns (uint256 id) {
        vm.prank(merchant);
        id = fx.openOrder(alice, RATE, _c(), _exp());
    }

    function _accepted() internal returns (uint256 id) {
        id = _open();
        vm.prank(alice);
        fx.acceptOrder(id);
    }

    function _sent() internal returns (uint256 id) {
        id = _accepted();
        vm.prank(merchant);
        fx.markSent(id, TX1);
    }

    function _settled() internal returns (uint256 id) {
        id = _sent();
        vm.prank(alice);
        fx.confirmReceived(id);
    }

    function _st(uint256 id) internal view returns (FxLedger.State) {
        return fx.stateOf(id);
    }

    function _wrong(FxLedger.State s) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(FxLedger.WrongState.selector, s);
    }

    // ------------------------------------------------------------------ constructor / config

    function test_constructor_setsConfig() public view {
        assertEq(fx.owner(), admin);
        assertEq(fx.rateSigner(), signer);
        assertEq(fx.reconciler(), recon);
        assertEq(fx.bankRate(), RATE);
        assertEq(fx.spreadBps(), SPREAD);
        assertEq(fx.nextId(), 1);
        (uint256 lo, uint256 hi) = fx.rateBand();
        assertEq(lo, LO);
        assertEq(hi, HI);
    }

    function test_constructor_rejectsBadParams() public {
        vm.expectRevert(FxLedger.ZeroAddress.selector);
        new FxLedger(admin, address(0), recon, RATE, SPREAD);
        vm.expectRevert(FxLedger.ZeroAddress.selector);
        new FxLedger(admin, signer, address(0), RATE, SPREAD);
        vm.expectRevert(FxLedger.ZeroRate.selector);
        new FxLedger(admin, signer, recon, 0, SPREAD);
        vm.expectRevert(FxLedger.SpreadTooHigh.selector);
        new FxLedger(admin, signer, recon, RATE, 301);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new FxLedger(address(0), signer, recon, RATE, SPREAD);
    }

    // ------------------------------------------------------------------ admin

    function test_admin_setMerchant_emitsAndToggles() public {
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.MerchantSet(bob, true);
        vm.prank(admin);
        fx.setMerchant(bob, true);
        assertTrue(fx.isMerchant(bob));
        vm.prank(admin);
        fx.setMerchant(bob, false);
        assertFalse(fx.isMerchant(bob));
    }

    function test_admin_setMerchant_zeroReverts() public {
        vm.prank(admin);
        vm.expectRevert(FxLedger.ZeroAddress.selector);
        fx.setMerchant(address(0), true);
    }

    function test_admin_setRoles() public {
        address s2 = makeAddr("s2");
        address r2 = makeAddr("r2");
        vm.startPrank(admin);
        vm.expectEmit(true, true, false, false, address(fx));
        emit FxLedger.RateSignerSet(signer, s2);
        fx.setRateSigner(s2);
        vm.expectEmit(true, true, false, false, address(fx));
        emit FxLedger.ReconcilerSet(recon, r2);
        fx.setReconciler(r2);
        vm.expectRevert(FxLedger.ZeroAddress.selector);
        fx.setRateSigner(address(0));
        vm.expectRevert(FxLedger.ZeroAddress.selector);
        fx.setReconciler(address(0));
        vm.stopPrank();
        assertEq(fx.rateSigner(), s2);
        assertEq(fx.reconciler(), r2);
    }

    function test_admin_setSpread_capAndEvent() public {
        vm.startPrank(admin);
        vm.expectEmit(false, false, false, true, address(fx));
        emit FxLedger.SpreadUpdated(SPREAD, 300);
        fx.setSpreadBps(300); // exactly at the cap passes
        vm.expectRevert(FxLedger.SpreadTooHigh.selector);
        fx.setSpreadBps(301);
        fx.setSpreadBps(0);
        vm.stopPrank();
        assertEq(fx.spreadBps(), 0);
    }

    function test_admin_onlyOwner() public {
        bytes memory err = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger);
        vm.startPrank(stranger);
        vm.expectRevert(err);
        fx.setMerchant(bob, true);
        vm.expectRevert(err);
        fx.setRateSigner(bob);
        vm.expectRevert(err);
        fx.setReconciler(bob);
        vm.expectRevert(err);
        fx.setSpreadBps(100);
        vm.stopPrank();
    }

    function test_admin_renounceDisabled() public {
        vm.prank(admin);
        vm.expectRevert(FxLedger.RenounceDisabled.selector);
        fx.renounceOwnership();
    }

    function test_admin_ownershipIsTwoStep() public {
        address newAdmin = makeAddr("newAdmin");
        vm.prank(admin);
        fx.transferOwnership(newAdmin);
        assertEq(fx.owner(), admin);
        vm.prank(newAdmin);
        fx.acceptOwnership();
        assertEq(fx.owner(), newAdmin);
    }

    function test_N0_ledgerRejectsNativeValue() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(fx).call{value: 1}("");
        assertFalse(ok, "ledger must not accept value");
    }

    // ------------------------------------------------------------------ bank rate

    function test_rate_onlySigner() public {
        vm.prank(stranger);
        vm.expectRevert(FxLedger.NotRateSigner.selector);
        fx.setBankRate(4600);
        vm.prank(admin); // even the admin can't set the rate directly
        vm.expectRevert(FxLedger.NotRateSigner.selector);
        fx.setBankRate(4600);
    }

    function test_rate_updateEmits() public {
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.BankRateUpdated(RATE, 4600, signer);
        vm.prank(signer);
        fx.setBankRate(4600);
        assertEq(fx.bankRate(), 4600);
    }

    function test_rate_zeroReverts() public {
        vm.prank(signer);
        vm.expectRevert(FxLedger.ZeroRate.selector);
        fx.setBankRate(0);
    }

    function test_rate_stepBound_edges() public {
        // +20 % of 4500 = 5400 exactly passes; 5401 reverts
        vm.prank(signer);
        vm.expectRevert(FxLedger.RateStepTooLarge.selector);
        fx.setBankRate(5401);
        vm.prank(signer);
        fx.setBankRate(5400);
        assertEq(fx.bankRate(), 5400);
        // -20 % of 5400 = 4320 exactly passes; 4319 reverts
        vm.prank(signer);
        vm.expectRevert(FxLedger.RateStepTooLarge.selector);
        fx.setBankRate(4319);
        vm.prank(signer);
        fx.setBankRate(4320);
        assertEq(fx.bankRate(), 4320);
    }

    function testFuzz_rate_stepBound(uint256 newRate) public {
        newRate = bound(newRate, 1, 100_000);
        bool ok = newRate * 10_000 <= RATE * 12_000 && newRate * 10_000 >= RATE * 8_000;
        vm.prank(signer);
        if (!ok) vm.expectRevert(FxLedger.RateStepTooLarge.selector);
        fx.setBankRate(newRate);
        assertEq(fx.bankRate(), ok ? newRate : RATE);
    }

    function test_rate_changeDoesNotTouchOpenOrders() public {
        uint256 id = _open();
        vm.prank(signer);
        fx.setBankRate(5400);
        FxLedger.Order memory o = fx.getOrder(id);
        assertEq(o.rate, RATE);
        assertEq(o.bankRateAtOpen, RATE);
        vm.prank(alice);
        fx.acceptOrder(id); // still acceptable at its quoted rate
    }

    // ------------------------------------------------------------------ openOrder

    function test_open_recordsOrderAndEmits() public {
        bytes32 c = keccak256("c");
        uint64 exp = _exp();
        vm.expectEmit(true, true, true, true, address(fx));
        emit FxLedger.Opened(1, merchant, alice, 4500, RATE, c, exp);
        vm.prank(merchant);
        uint256 id = fx.openOrder(alice, 4500, c, exp);
        assertEq(id, 1);
        assertEq(fx.nextId(), 2);
        FxLedger.Order memory o = fx.getOrder(id);
        assertEq(o.merchant, merchant);
        assertEq(o.customer, alice);
        assertEq(o.rate, 4500);
        assertEq(o.bankRateAtOpen, RATE);
        assertEq(o.commitment, c);
        assertEq(o.expiry, exp);
        assertEq(o.openedAt, block.timestamp);
        assertEq(uint8(o.state), uint8(FxLedger.State.Open));
        assertEq(uint8(o.recon), uint8(FxLedger.Recon.None));
        assertEq(o.eercTxHash, bytes32(0));
        assertTrue(fx.commitmentUsed(c));
    }

    function test_open_onlyRegisteredMerchant() public {
        bytes32 c = _c();
        uint64 e = _exp();
        vm.prank(stranger);
        vm.expectRevert(FxLedger.NotMerchant.selector);
        fx.openOrder(alice, RATE, c, e);
    }

    function test_open_removedMerchantCannotOpen_butCanFinishExisting() public {
        uint256 id = _accepted();
        vm.prank(admin);
        fx.setMerchant(merchant, false);
        bytes32 c = _c();
        uint64 e = _exp();
        vm.prank(merchant);
        vm.expectRevert(FxLedger.NotMerchant.selector);
        fx.openOrder(alice, RATE, c, e);
        vm.prank(merchant);
        fx.markSent(id, TX1); // a customer who already paid Bs is not stranded
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Sent));
    }

    function test_open_badCustomer() public {
        bytes32 c = _c();
        uint64 e = _exp();
        vm.startPrank(merchant);
        vm.expectRevert(FxLedger.BadCustomer.selector);
        fx.openOrder(address(0), RATE, c, e);
        vm.expectRevert(FxLedger.BadCustomer.selector);
        fx.openOrder(merchant, RATE, c, e);
        vm.stopPrank();
    }

    function test_open_rateBandEdges() public {
        uint64 e = _exp();
        vm.startPrank(merchant);
        fx.openOrder(alice, LO, _c(), e); // exactly lower bound
        fx.openOrder(alice, HI, _c(), e); // exactly upper bound
        bytes32 c = _c();
        vm.expectRevert(FxLedger.RateOutOfBand.selector);
        fx.openOrder(alice, LO - 1, c, e);
        vm.expectRevert(FxLedger.RateOutOfBand.selector);
        fx.openOrder(alice, HI + 1, c, e);
        vm.stopPrank();
    }

    function test_open_rateZeroSpreadMeansExact() public {
        vm.prank(admin);
        fx.setSpreadBps(0);
        uint64 e = _exp();
        vm.startPrank(merchant);
        fx.openOrder(alice, RATE, _c(), e);
        bytes32 c = _c();
        vm.expectRevert(FxLedger.RateOutOfBand.selector);
        fx.openOrder(alice, RATE + 1, c, e);
        vm.expectRevert(FxLedger.RateOutOfBand.selector);
        fx.openOrder(alice, RATE - 1, c, e);
        vm.stopPrank();
    }

    /// Band with a non-round result: 4501 * 0.98 = 4410.98 -> lowest integer rate inside is 4411; 4501 * 1.02 = 4591.02 -> 4591.
    function test_open_rateBandRoundsInward() public {
        vm.prank(signer);
        fx.setBankRate(4501);
        (uint256 lo, uint256 hi) = fx.rateBand();
        assertEq(lo, 4411);
        assertEq(hi, 4591);
        uint64 e = _exp();
        vm.startPrank(merchant);
        fx.openOrder(alice, 4411, _c(), e);
        fx.openOrder(alice, 4591, _c(), e);
        bytes32 c = _c();
        vm.expectRevert(FxLedger.RateOutOfBand.selector);
        fx.openOrder(alice, 4410, c, e);
        vm.expectRevert(FxLedger.RateOutOfBand.selector);
        fx.openOrder(alice, 4592, c, e);
        vm.stopPrank();
    }

    function testFuzz_open_rateBand(uint256 bank, uint16 spread, uint256 rate) public {
        bank = bound(bank, 1, 1e30);
        spread = uint16(bound(spread, 0, 300));
        rate = bound(rate, 0, 2e30);
        FxLedger f = new FxLedger(admin, signer, recon, bank, spread);
        vm.prank(admin);
        f.setMerchant(merchant, true);
        bool inBand = rate * 10_000 >= bank * (10_000 - spread) && rate * 10_000 <= bank * (10_000 + spread);
        (uint256 lo, uint256 hi) = f.rateBand();
        assertEq(inBand, rate >= lo && rate <= hi, "view agrees with check");
        uint64 e = _exp();
        vm.prank(merchant);
        if (!inBand) vm.expectRevert(FxLedger.RateOutOfBand.selector);
        f.openOrder(alice, rate, keccak256("c"), e);
    }

    function test_open_expiryBoundaries() public {
        bytes32 c = _c();
        vm.startPrank(merchant);
        vm.expectRevert(FxLedger.BadExpiry.selector);
        fx.openOrder(alice, RATE, c, uint64(block.timestamp + 1 minutes - 1));
        vm.expectRevert(FxLedger.BadExpiry.selector);
        fx.openOrder(alice, RATE, c, uint64(block.timestamp + 1 days + 1));
        fx.openOrder(alice, RATE, _c(), uint64(block.timestamp + 1 minutes)); // exactly min
        fx.openOrder(alice, RATE, _c(), uint64(block.timestamp + 1 days)); // exactly max
        vm.stopPrank();
    }

    function test_open_zeroCommitmentReverts() public {
        uint64 e = _exp();
        vm.prank(merchant);
        vm.expectRevert(FxLedger.ZeroCommitment.selector);
        fx.openOrder(alice, RATE, bytes32(0), e);
    }

    function test_open_duplicateCommitmentReverts_evenAcrossMerchants() public {
        bytes32 c = keccak256("same");
        uint64 e = _exp();
        vm.prank(merchant);
        fx.openOrder(alice, RATE, c, e);
        vm.prank(merchant);
        vm.expectRevert(FxLedger.CommitmentUsed.selector);
        fx.openOrder(bob, RATE, c, e);
        vm.prank(merchant2);
        vm.expectRevert(FxLedger.CommitmentUsed.selector);
        fx.openOrder(bob, RATE, c, e);
    }

    function test_open_commitmentStaysUsedAfterCancel() public {
        bytes32 c = keccak256("reuse");
        uint64 e = _exp();
        vm.prank(merchant);
        uint256 id = fx.openOrder(alice, RATE, c, e);
        vm.prank(merchant);
        fx.cancel(id);
        vm.prank(merchant);
        vm.expectRevert(FxLedger.CommitmentUsed.selector);
        fx.openOrder(alice, RATE, c, e);
    }

    // ------------------------------------------------------------------ happy path (every valid forward transition)

    function test_happyPath_openAcceptSentSettled_emitsEach() public {
        uint256 id = _open();

        vm.expectEmit(true, true, false, false, address(fx));
        emit FxLedger.Accepted(id, alice);
        vm.prank(alice);
        fx.acceptOrder(id);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Accepted));

        vm.expectEmit(true, true, false, false, address(fx));
        emit FxLedger.Sent(id, TX1);
        vm.prank(merchant);
        fx.markSent(id, TX1);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Sent));
        assertEq(fx.getOrder(id).eercTxHash, TX1);
        assertEq(fx.orderIdOfTx(TX1), id);

        vm.expectEmit(true, false, false, false, address(fx));
        emit FxLedger.Settled(id);
        vm.prank(alice);
        fx.confirmReceived(id);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Settled));
    }

    function test_dispute_fromAccepted() public {
        uint256 id = _accepted();
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.Disputed(id, FxLedger.State.Accepted);
        vm.prank(alice);
        fx.dispute(id);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Disputed));
    }

    function test_dispute_fromSent() public {
        uint256 id = _sent();
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.Disputed(id, FxLedger.State.Sent);
        vm.prank(alice);
        fx.dispute(id);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Disputed));
    }

    function test_dispute_allowedAfterExpiryIfNotYetExpired() public {
        uint256 id = _accepted();
        vm.warp(block.timestamp + 11 minutes);
        vm.prank(alice); // customer paid Bs and got nothing: can still raise a flag until someone expires it
        fx.dispute(id);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Disputed));
    }

    function test_cancel_whileOpen() public {
        uint256 id = _open();
        vm.expectEmit(true, false, false, false, address(fx));
        emit FxLedger.Cancelled(id);
        vm.prank(merchant);
        fx.cancel(id);
        assertEq(uint8(_st(id)), uint8(FxLedger.State.Cancelled));
    }

    function test_expire_fromOpenAcceptedSent() public {
        uint256 a = _open();
        uint256 b = _accepted();
        uint256 c = _sent();
        vm.warp(block.timestamp + 10 minutes);
        vm.startPrank(stranger); // anyone
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.Expired(a, FxLedger.State.Open);
        fx.expire(a);
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.Expired(b, FxLedger.State.Accepted);
        fx.expire(b);
        vm.expectEmit(true, false, false, true, address(fx));
        emit FxLedger.Expired(c, FxLedger.State.Sent);
        fx.expire(c);
        vm.stopPrank();
        assertEq(uint8(_st(a)), uint8(FxLedger.State.Expired));
        assertEq(uint8(_st(b)), uint8(FxLedger.State.Expired));
        assertEq(uint8(_st(c)), uint8(FxLedger.State.Expired));
    }

    function test_reconcile_settledOk_and_disputedFlagged() public {
        uint256 s = _settled();
        uint256 d = _accepted();
        vm.prank(alice);
        fx.dispute(d);

        vm.expectEmit(true, true, false, true, address(fx));
        emit FxLedger.Reconciled(s, true, recon);
        vm.prank(recon);
        fx.reconcile(s, true);
        assertEq(uint8(fx.getOrder(s).recon), uint8(FxLedger.Recon.Ok));
        assertEq(uint8(_st(s)), uint8(FxLedger.State.Settled), "state unchanged");

        vm.expectEmit(true, true, false, true, address(fx));
        emit FxLedger.Reconciled(d, false, recon);
        vm.prank(recon);
        fx.reconcile(d, false);
        assertEq(uint8(fx.getOrder(d).recon), uint8(FxLedger.Recon.Flagged));
        assertEq(uint8(_st(d)), uint8(FxLedger.State.Disputed));
    }

    // ------------------------------------------------------------------ wrong actor

    function test_wrongActor_accept() public {
        uint256 id = _open();
        address[3] memory bad = [merchant, bob, stranger];
        for (uint256 i; i < 3; i++) {
            vm.prank(bad[i]);
            vm.expectRevert(FxLedger.NotCustomer.selector);
            fx.acceptOrder(id);
        }
    }

    function test_wrongActor_markSent() public {
        uint256 id = _accepted();
        address[3] memory bad = [alice, merchant2, stranger];
        for (uint256 i; i < 3; i++) {
            vm.prank(bad[i]);
            vm.expectRevert(FxLedger.NotOrderMerchant.selector);
            fx.markSent(id, TX1);
        }
    }

    function test_wrongActor_confirm() public {
        uint256 id = _sent();
        address[3] memory bad = [merchant, bob, recon];
        for (uint256 i; i < 3; i++) {
            vm.prank(bad[i]);
            vm.expectRevert(FxLedger.NotCustomer.selector);
            fx.confirmReceived(id);
        }
    }

    function test_wrongActor_dispute() public {
        uint256 id = _sent();
        address[3] memory bad = [merchant, bob, admin];
        for (uint256 i; i < 3; i++) {
            vm.prank(bad[i]);
            vm.expectRevert(FxLedger.NotCustomer.selector);
            fx.dispute(id);
        }
    }

    function test_wrongActor_cancel() public {
        uint256 id = _open();
        address[3] memory bad = [alice, merchant2, admin];
        for (uint256 i; i < 3; i++) {
            vm.prank(bad[i]);
            vm.expectRevert(FxLedger.NotOrderMerchant.selector);
            fx.cancel(id);
        }
    }

    function test_wrongActor_reconcile() public {
        uint256 id = _settled();
        address[4] memory bad = [admin, merchant, alice, signer];
        for (uint256 i; i < 4; i++) {
            vm.prank(bad[i]);
            vm.expectRevert(FxLedger.NotReconciler.selector);
            fx.reconcile(id, true);
        }
    }

    // ------------------------------------------------------------------ wrong state / ordering

    function test_cancel_afterAcceptReverts() public {
        uint256 id = _accepted();
        vm.prank(merchant);
        vm.expectRevert(_wrong(FxLedger.State.Accepted));
        fx.cancel(id);
    }

    function test_cancel_afterSentReverts() public {
        uint256 id = _sent();
        vm.prank(merchant);
        vm.expectRevert(_wrong(FxLedger.State.Sent));
        fx.cancel(id);
    }

    function test_markSent_beforeAcceptReverts() public {
        uint256 id = _open();
        vm.prank(merchant);
        vm.expectRevert(_wrong(FxLedger.State.Open));
        fx.markSent(id, TX1);
    }

    function test_confirm_beforeSentReverts() public {
        uint256 id = _accepted();
        vm.prank(alice);
        vm.expectRevert(_wrong(FxLedger.State.Accepted));
        fx.confirmReceived(id);
    }

    function test_accept_twiceReverts() public {
        uint256 id = _accepted();
        vm.prank(alice);
        vm.expectRevert(_wrong(FxLedger.State.Accepted));
        fx.acceptOrder(id);
    }

    function test_dispute_fromOpenReverts() public {
        uint256 id = _open();
        vm.prank(alice);
        vm.expectRevert(_wrong(FxLedger.State.Open));
        fx.dispute(id);
    }

    function test_unknownOrder_reverts() public {
        // a None order has customer/merchant == 0, so actor checks fire first for user calls
        vm.prank(alice);
        vm.expectRevert(FxLedger.NotCustomer.selector);
        fx.acceptOrder(99);
        vm.expectRevert(_wrong(FxLedger.State.None));
        fx.expire(99);
        vm.prank(recon);
        vm.expectRevert(_wrong(FxLedger.State.None));
        fx.reconcile(99, true);
    }

    function test_terminalStatesAreFinal() public {
        uint256 settled = _settled();
        uint256 disputed = _accepted();
        vm.prank(alice);
        fx.dispute(disputed);
        uint256 cancelled = _open();
        vm.prank(merchant);
        fx.cancel(cancelled);
        uint256 expired = _open();
        vm.warp(block.timestamp + 10 minutes);
        fx.expire(expired);
        vm.warp(block.timestamp + 2 days);

        uint256[4] memory ids = [settled, disputed, cancelled, expired];
        for (uint256 i; i < 4; i++) {
            uint256 id = ids[i];
            FxLedger.State s = _st(id);
            vm.prank(alice);
            vm.expectRevert(_wrong(s));
            fx.acceptOrder(id);
            vm.prank(alice);
            vm.expectRevert(_wrong(s));
            fx.confirmReceived(id);
            vm.prank(alice);
            vm.expectRevert(_wrong(s));
            fx.dispute(id);
            vm.prank(merchant);
            vm.expectRevert(_wrong(s));
            fx.markSent(id, keccak256(abi.encode(i)));
            vm.prank(merchant);
            vm.expectRevert(_wrong(s));
            fx.cancel(id);
            vm.expectRevert(_wrong(s));
            fx.expire(id);
            assertEq(uint8(_st(id)), uint8(s));
        }
    }

    // ------------------------------------------------------------------ expiry

    function test_expiry_acceptBoundary() public {
        uint256 id = _open();
        uint64 e = fx.getOrder(id).expiry;
        vm.warp(e - 1);
        vm.expectRevert(FxLedger.NotExpired.selector);
        fx.expire(id);
        vm.prank(alice);
        fx.acceptOrder(id); // last second still works
        uint256 id2 = _open();
        vm.warp(fx.getOrder(id2).expiry);
        vm.prank(alice);
        vm.expectRevert(FxLedger.PastExpiry.selector);
        fx.acceptOrder(id2);
        fx.expire(id2); // at expiry exactly, expirable
        assertEq(uint8(_st(id2)), uint8(FxLedger.State.Expired));
    }

    function test_expiry_markSentAfterExpiryReverts() public {
        uint256 id = _accepted();
        vm.warp(fx.getOrder(id).expiry);
        vm.prank(merchant);
        vm.expectRevert(FxLedger.PastExpiry.selector);
        fx.markSent(id, TX1);
    }

    function test_expiry_beforeExpiryReverts() public {
        uint256 id = _sent();
        vm.expectRevert(FxLedger.NotExpired.selector);
        fx.expire(id);
    }

    function test_expiry_reconcileOnExpiredWithoutTransferReverts() public {
        uint256 id = _accepted(); // expired before any transfer: nothing to reconcile (rule changed in D-020)
        vm.warp(block.timestamp + 10 minutes);
        fx.expire(id);
        vm.prank(recon);
        vm.expectRevert(_wrong(FxLedger.State.Expired));
        fx.reconcile(id, true);
    }

    // ------------------------------------------------------------------ N4: tx hash uniqueness

    function test_markSent_zeroHashReverts() public {
        uint256 id = _accepted();
        vm.prank(merchant);
        vm.expectRevert(FxLedger.ZeroTxHash.selector);
        fx.markSent(id, bytes32(0));
    }

    function test_markSent_duplicateTxHashReverts_acrossOrdersAndMerchants() public {
        _sent(); // uses TX1
        uint256 id2 = _accepted();
        vm.prank(merchant);
        vm.expectRevert(FxLedger.TxHashUsed.selector);
        fx.markSent(id2, TX1);

        vm.prank(merchant2);
        uint256 id3 = fx.openOrder(bob, RATE, _c(), _exp());
        vm.prank(bob);
        fx.acceptOrder(id3);
        vm.prank(merchant2);
        vm.expectRevert(FxLedger.TxHashUsed.selector);
        fx.markSent(id3, TX1);

        vm.prank(merchant);
        fx.markSent(id2, TX2);
    }

    function test_markSent_txHashStaysUsedAfterExpiry() public {
        uint256 id = _sent();
        vm.warp(block.timestamp + 10 minutes);
        fx.expire(id);
        uint256 id2 = _accepted();
        vm.prank(merchant);
        vm.expectRevert(FxLedger.TxHashUsed.selector);
        fx.markSent(id2, TX1);
    }

    // ------------------------------------------------------------------ reconcile

    // BRAIN D-020: a customer who received the USD and let the order expire must still be reconcilable (R12 gap)
    function test_reconcile_expiredAfterSent_isAllowed() public {
        uint256 id = _sent();
        vm.warp(block.timestamp + 2 days);
        fx.expire(id);
        vm.prank(recon);
        fx.reconcile(id, false);
        assertEq(uint8(fx.getOrder(id).recon), uint8(FxLedger.Recon.Flagged));
    }

    function test_reconcile_expiredWithoutTransfer_reverts() public {
        uint256 id = _accepted();
        vm.warp(block.timestamp + 2 days);
        fx.expire(id);
        vm.prank(recon);
        vm.expectRevert(_wrong(FxLedger.State.Expired));
        fx.reconcile(id, true);
    }

    function test_reconcile_twiceReverts() public {
        uint256 id = _settled();
        vm.prank(recon);
        fx.reconcile(id, true);
        vm.prank(recon);
        vm.expectRevert(FxLedger.AlreadyReconciled.selector);
        fx.reconcile(id, false);
    }

    function test_reconcile_onNonFinalStatesReverts() public {
        uint256 o = _open();
        uint256 a = _accepted();
        uint256 s = _sent();
        uint256 c = _open();
        vm.prank(merchant);
        fx.cancel(c);
        vm.startPrank(recon);
        vm.expectRevert(_wrong(FxLedger.State.Open));
        fx.reconcile(o, true);
        vm.expectRevert(_wrong(FxLedger.State.Accepted));
        fx.reconcile(a, true);
        vm.expectRevert(_wrong(FxLedger.State.Sent));
        fx.reconcile(s, true);
        vm.expectRevert(_wrong(FxLedger.State.Cancelled));
        fx.reconcile(c, true);
        vm.stopPrank();
    }

    function test_reconcile_newReconcilerTakesOver() public {
        uint256 id = _settled();
        address r2 = makeAddr("r2");
        vm.prank(admin);
        fx.setReconciler(r2);
        vm.prank(recon);
        vm.expectRevert(FxLedger.NotReconciler.selector);
        fx.reconcile(id, true);
        vm.prank(r2);
        fx.reconcile(id, true);
    }

    // ------------------------------------------------------------------ §4 reconciliation simulator

    struct Transfer {
        bytes32 txHash;
        address from;
        address to;
    }

    /// Off-chain bank check (MERCHANT_FX §2 layers 3–4), simulated against the ledger: every merchant→customer transfer must map
    /// to a Settled order with the same pair; anything else is flagged.
    function _explained(Transfer memory t) internal view returns (bool) {
        uint256 id = fx.orderIdOfTx(t.txHash);
        if (id == 0) return false;
        FxLedger.Order memory o = fx.getOrder(id);
        return o.state == FxLedger.State.Settled && o.merchant == t.from && o.customer == t.to;
    }

    function test_reconSimulator_flagsUnexplainedTransfers() public {
        uint256 id = _settled(); // merchant -> alice, TX1
        Transfer[4] memory seen = [
            Transfer(TX1, merchant, alice), // declared sale: OK
            Transfer(TX2, merchant, bob), // undeclared sale (no order): flag
            Transfer(keccak256("resale"), alice, bob), // customer -> customer resale: flag
            Transfer(TX1, merchant2, alice) // wrong pair reusing a declared hash: flag
        ];
        bool[4] memory expectOk = [true, false, false, false];
        for (uint256 i; i < 4; i++) {
            assertEq(_explained(seen[i]), expectOk[i]);
        }
        vm.prank(recon);
        fx.reconcile(id, true);
    }
}
