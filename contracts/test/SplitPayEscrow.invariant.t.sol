// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SplitPayEscrow} from "../src/SplitPayEscrow.sol";
import {MockUSD} from "./mocks/MockUSD.sol";

/// @notice Random sequences of create / authorize / release / confirm / cancel / warp / withdraw.
contract SplitPayHandler is Test {
    SplitPayEscrow internal esc;
    MockUSD internal usd;
    address internal merchant;
    address[4] internal payers;
    uint256[] public ids;

    uint256 public ghostIn; // total pulled from payers
    uint256 public ghostOut; // total returned to payers
    uint256 public ghostCaptured; // total of captured intents (merchant net + fee)

    constructor(SplitPayEscrow _esc, MockUSD _usd, address _merchant) {
        esc = _esc;
        usd = _usd;
        merchant = _merchant;
        for (uint256 i; i < 4; i++) {
            payers[i] = address(uint160(0xA11CE + i));
            usd.mint(payers[i], 1e12);
            vm.prank(payers[i]);
            usd.approve(address(esc), type(uint256).max);
        }
    }

    function _id(uint256 seed) internal view returns (uint256) {
        return ids[seed % ids.length];
    }

    function create(uint256 total, uint8 maxPayers, bool confirmMode) external {
        total = bound(total, 1, 1e9);
        maxPayers = uint8(bound(maxPayers, 1, 10));
        vm.prank(merchant);
        ids.push(esc.createIntent(total, uint64(block.timestamp + 10 minutes), maxPayers, confirmMode, 100));
    }

    function authorize(uint256 seed, uint256 p, uint256 amount) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        address payer = payers[p % 4];
        amount = bound(amount, 1, 1e9);
        uint256 before = usd.balanceOf(payer);
        SplitPayEscrow.State s0 = esc.stateOf(id);
        uint256 total = esc.totalOf(id);
        vm.prank(payer);
        try esc.authorize(id, amount) {
            ghostIn += before - usd.balanceOf(payer);
            if (s0 != SplitPayEscrow.State.Captured && esc.stateOf(id) == SplitPayEscrow.State.Captured) ghostCaptured += total;
        } catch {}
    }

    function release(uint256 seed, uint256 p) external {
        if (ids.length == 0) return;
        address payer = payers[p % 4];
        uint256 before = usd.balanceOf(payer);
        vm.prank(payer);
        try esc.release(_id(seed)) {
            ghostOut += usd.balanceOf(payer) - before;
        } catch {}
    }

    function confirm(uint256 seed, uint256 p) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        SplitPayEscrow.State s0 = esc.stateOf(id);
        vm.prank(payers[p % 4]);
        try esc.confirm(id) {
            if (s0 != SplitPayEscrow.State.Captured && esc.stateOf(id) == SplitPayEscrow.State.Captured) {
                ghostCaptured += esc.totalOf(id);
            }
        } catch {}
    }

    function cancel(uint256 seed) external {
        if (ids.length == 0) return;
        vm.prank(merchant);
        try esc.cancel(_id(seed)) {} catch {}
    }

    function withdraw(uint256 seed, uint256 p) external {
        if (ids.length == 0) return;
        address payer = payers[p % 4];
        uint256 before = usd.balanceOf(payer);
        vm.prank(payer);
        try esc.withdraw(_id(seed)) {
            ghostOut += usd.balanceOf(payer) - before;
        } catch {}
    }

    function expire(uint256 seed) external {
        if (ids.length == 0) return;
        try esc.expire(_id(seed)) {} catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 15 minutes));
    }

    function idsLength() external view returns (uint256) {
        return ids.length;
    }

    function idAt(uint256 i) external view returns (uint256) {
        return ids[i];
    }
}

contract SplitPayEscrowInvariantTest is Test {
    SplitPayEscrow internal esc;
    MockUSD internal usd;
    SplitPayHandler internal handler;
    address internal feeRouter = makeAddr("feeRouter");
    address internal merchant = makeAddr("merchant");

    function setUp() public {
        usd = new MockUSD();
        esc = new SplitPayEscrow(address(usd), feeRouter, 50, makeAddr("owner"));
        handler = new SplitPayHandler(esc, usd, merchant);
        targetContract(address(handler));
    }

    /// N2 solvency: the escrow holds exactly what it owes to open holds. No more, no less.
    function invariant_balanceEqualsTotalHeld() public view {
        assertEq(usd.balanceOf(address(esc)), esc.totalHeld());
    }

    /// N0 conservation: everything pulled from payers is either still held, returned, or captured.
    function invariant_conservation() public view {
        assertEq(handler.ghostIn(), esc.totalHeld() + handler.ghostOut() + handler.ghostCaptured());
    }

    /// Merchant + fee router received exactly the totals of captured intents.
    function invariant_capturedPaidExactly() public view {
        assertEq(usd.balanceOf(merchant) + usd.balanceOf(feeRouter), handler.ghostCaptured());
    }

    /// No intent is ever covered beyond its total.
    function invariant_neverOverCovered() public view {
        uint256 n = handler.idsLength();
        for (uint256 i; i < n; i++) {
            uint256 id = handler.idAt(i);
            assertLe(esc.coveredOf(id), esc.totalOf(id));
        }
    }
}
