// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {MerchantPay} from "../src/MerchantPay.sol";
import {SplitPayEscrow} from "../src/SplitPayEscrow.sol";
import {MockUSD} from "./mocks/MockUSD.sol";
import {FeeToken} from "./mocks/FeeToken.sol";

/// @notice D-034: pay a store from the contact list. Same token, fee router and fee (read live from the SplitPayEscrow)
///         as a merchant charge, so there is one fee and one admin knob (N1). Written before the contract.
contract MerchantPayTest is Test {
    MerchantPay internal mp;
    SplitPayEscrow internal esc;
    MockUSD internal usd;

    address internal owner = makeAddr("owner");
    address internal feeRouter = makeAddr("feeRouter");
    address internal store = makeAddr("store");
    address internal alice = makeAddr("alice");

    uint256 internal constant ONE = 1e6;
    uint16 internal constant FEE_BPS = 50;

    event MerchantPaid(uint256 indexed id, address indexed payer, address indexed merchant, uint256 amount, uint256 net, uint256 fee);

    function setUp() public {
        usd = new MockUSD();
        esc = new SplitPayEscrow(address(usd), feeRouter, FEE_BPS, owner);
        mp = new MerchantPay(address(esc));
        usd.mint(alice, 1_000 * ONE);
        vm.prank(alice);
        usd.approve(address(mp), type(uint256).max);
    }

    function test_constructor_copiesTokenAndRouterFromEscrow() public view {
        assertEq(address(mp.token()), address(usd));
        assertEq(mp.feeRouter(), feeRouter);
        assertEq(address(mp.escrow()), address(esc));
        assertEq(mp.feeBps(), FEE_BPS);
    }

    function test_constructor_zeroEscrowReverts() public {
        vm.expectRevert(MerchantPay.ZeroAddress.selector);
        new MerchantPay(address(0));
    }

    function test_pay_splitsExactFee_andHoldsNothing() public {
        uint256 amount = 2 * ONE;
        uint256 fee = (amount * FEE_BPS) / 10_000; // 0.01
        vm.expectEmit(true, true, true, true, address(mp));
        emit MerchantPaid(1, alice, store, amount, amount - fee, fee);
        vm.prank(alice);
        uint256 id = mp.pay(store, amount, 100);
        assertEq(id, 1);
        assertEq(usd.balanceOf(store), amount - fee, "store net");
        assertEq(usd.balanceOf(feeRouter), fee, "fee");
        assertEq(usd.balanceOf(alice), 1_000 * ONE - amount, "payer");
        assertEq(usd.balanceOf(address(mp)), 0, "holds nothing");
        assertEq(mp.paymentCount(), 1);
    }

    function test_pay_idsIncrease() public {
        vm.startPrank(alice);
        assertEq(mp.pay(store, ONE, 100), 1);
        assertEq(mp.pay(store, ONE, 100), 2);
        vm.stopPrank();
    }

    function test_pay_usesTheEscrowFeeAfterAChange() public {
        vm.prank(owner);
        esc.setFeeBps(80);
        vm.prank(alice);
        mp.pay(store, 10 * ONE, 100);
        assertEq(usd.balanceOf(feeRouter), (10 * ONE * 80) / 10_000);
    }

    function test_pay_feeAbovePayerMaxReverts() public {
        vm.prank(owner);
        esc.setFeeBps(80);
        vm.prank(alice);
        vm.expectRevert(MerchantPay.FeeAbovePayerMax.selector);
        mp.pay(store, ONE, 50);
    }

    function test_pay_zeroFee_paysAllToStore() public {
        vm.prank(owner);
        esc.setFeeBps(0);
        vm.prank(alice);
        mp.pay(store, ONE, 0);
        assertEq(usd.balanceOf(store), ONE);
        assertEq(usd.balanceOf(feeRouter), 0);
    }

    function test_pay_belowMinimumReverts() public {
        uint256 min = mp.MIN_AMOUNT();
        vm.prank(alice);
        vm.expectRevert(MerchantPay.BelowMinimum.selector);
        mp.pay(store, min - 1, 100);
        vm.prank(alice);
        mp.pay(store, min, 100); // exactly the minimum is fine
    }

    function test_pay_minimumStillChargesAFee() public view {
        // tiny payments must not round the fee to zero (no fee bypass by splitting)
        assertGt((mp.MIN_AMOUNT() * FEE_BPS) / 10_000, 0);
    }

    function test_pay_zeroMerchantReverts() public {
        vm.prank(alice);
        vm.expectRevert(MerchantPay.ZeroAddress.selector);
        mp.pay(address(0), ONE, 100);
    }

    function test_pay_selfPayReverts() public {
        vm.prank(alice);
        vm.expectRevert(MerchantPay.SelfPayment.selector);
        mp.pay(alice, ONE, 100);
    }

    function test_pay_toFeeRouterReverts() public {
        vm.prank(alice);
        vm.expectRevert(MerchantPay.SelfPayment.selector);
        mp.pay(feeRouter, ONE, 100);
    }

    // review L-1: paying to a contract that cannot use or return the money strands it
    function test_pay_toThisContractEscrowOrTokenReverts() public {
        address[3] memory bad = [address(mp), address(esc), address(usd)];
        for (uint256 i; i < 3; i++) {
            vm.prank(alice);
            vm.expectRevert(MerchantPay.SelfPayment.selector);
            mp.pay(bad[i], ONE, 100);
        }
        assertEq(usd.balanceOf(address(mp)), 0);
    }

    function test_pay_withoutAllowanceReverts() public {
        address bob = makeAddr("bob");
        usd.mint(bob, 10 * ONE);
        vm.prank(bob);
        vm.expectRevert();
        mp.pay(store, ONE, 100);
    }

    function test_pay_feeOnTransferTokenReverts() public {
        FeeToken ft = new FeeToken();
        SplitPayEscrow esc2 = new SplitPayEscrow(address(ft), feeRouter, FEE_BPS, owner);
        MerchantPay mp2 = new MerchantPay(address(esc2));
        ft.mint(alice, 100 * ONE);
        vm.startPrank(alice);
        ft.approve(address(mp2), type(uint256).max);
        vm.expectRevert(MerchantPay.UnsupportedToken.selector);
        mp2.pay(store, ONE, 100);
        vm.stopPrank();
    }

    function testFuzz_pay_conservesValue(uint256 amount, uint16 bps) public {
        bps = uint16(bound(bps, 0, esc.MAX_FEE_BPS()));
        amount = bound(amount, mp.MIN_AMOUNT(), 1_000 * ONE);
        vm.prank(owner);
        esc.setFeeBps(bps);
        vm.prank(alice);
        mp.pay(store, amount, bps);
        uint256 fee = (amount * bps) / 10_000;
        assertEq(usd.balanceOf(store) + usd.balanceOf(feeRouter), amount, "N0: nothing created or lost");
        assertEq(usd.balanceOf(feeRouter), fee, "N1: exact fee");
        assertEq(usd.balanceOf(address(mp)), 0, "N2: holds nothing");
    }
}

/// @notice Invariant: MerchantPay never holds tokens, and everything that left payers reached stores + the fee router.
contract MerchantPayHandler is Test {
    MerchantPay internal mp;
    MockUSD internal usd;
    address[3] internal payers;
    address[3] internal stores;
    uint256 public paidIn;

    constructor(MerchantPay mp_, MockUSD usd_) {
        mp = mp_;
        usd = usd_;
        for (uint256 i; i < 3; i++) {
            payers[i] = makeAddr(string.concat("payer", vm.toString(i)));
            stores[i] = makeAddr(string.concat("store", vm.toString(i)));
            usd.mint(payers[i], 1_000_000e6);
            vm.prank(payers[i]);
            usd.approve(address(mp), type(uint256).max);
        }
    }

    function pay(uint256 p, uint256 s, uint256 amount) external {
        address payer = payers[p % 3];
        amount = bound(amount, mp.MIN_AMOUNT(), 10_000e6);
        vm.prank(payer);
        mp.pay(stores[s % 3], amount, 100);
        paidIn += amount;
    }

    function storeTotal() external view returns (uint256 t) {
        for (uint256 i; i < 3; i++) t += usd.balanceOf(stores[i]);
    }
}

contract MerchantPayInvariantTest is StdInvariant, Test {
    MerchantPay internal mp;
    MockUSD internal usd;
    MerchantPayHandler internal h;
    address internal feeRouter = makeAddr("feeRouter");

    function setUp() public {
        usd = new MockUSD();
        SplitPayEscrow esc = new SplitPayEscrow(address(usd), feeRouter, 50, makeAddr("owner"));
        mp = new MerchantPay(address(esc));
        h = new MerchantPayHandler(mp, usd);
        targetContract(address(h));
    }

    function invariant_holdsNothing() public view {
        assertEq(usd.balanceOf(address(mp)), 0);
    }

    function invariant_conservation() public view {
        assertEq(h.storeTotal() + usd.balanceOf(feeRouter), h.paidIn());
    }
}
