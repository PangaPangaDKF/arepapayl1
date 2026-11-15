// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FxLedger} from "../src/FxLedger.sol";

/// @notice Random sequences of open / accept / markSent / confirm / dispute / cancel / expire / reconcile / setBankRate / warp,
///         by right and wrong actors. After every call the handler compares each order's state with the last one it saw.
contract FxHandler is Test {
    FxLedger internal fx;
    address internal admin;
    address internal signer;
    address internal recon;
    address[2] internal merchants;
    address[3] internal customers;
    address[] internal actors;

    uint256[] public ids;
    mapping(uint256 => FxLedger.State) public lastState;
    mapping(uint256 => FxLedger.Recon) public lastRecon;
    mapping(uint256 => bytes32) public lastTx;
    uint256 public violations;
    uint256 public txCounter;
    uint256 public settledOrDisputed;
    uint256 public expiredFromSent;

    uint256 internal constant MAX_ORDERS = 40;

    constructor(FxLedger _fx, address _admin, address _signer, address _recon, address[2] memory _m) {
        fx = _fx;
        admin = _admin;
        signer = _signer;
        recon = _recon;
        merchants = _m;
        customers = [address(0xC1), address(0xC2), address(0xC3)];
        actors.push(_m[0]);
        actors.push(_m[1]);
        actors.push(customers[0]);
        actors.push(customers[1]);
        actors.push(customers[2]);
        actors.push(_recon);
        actors.push(_admin);
    }

    // ------------------------------------------------------------------ monotonicity check

    function _rank(FxLedger.State s) internal pure returns (uint256) {
        if (s == FxLedger.State.None) return 0;
        if (s == FxLedger.State.Open) return 1;
        if (s == FxLedger.State.Accepted) return 2;
        if (s == FxLedger.State.Sent) return 3;
        return 4; // Settled, Disputed, Expired, Cancelled: terminal
    }

    function _check() internal {
        for (uint256 i; i < ids.length; i++) {
            uint256 id = ids[i];
            FxLedger.Order memory o = fx.getOrder(id);
            FxLedger.State prev = lastState[id];
            if (_rank(o.state) < _rank(prev)) violations++; // went backwards
            if (_rank(prev) == 4 && o.state != prev) violations++; // terminal changed
            if (lastRecon[id] != FxLedger.Recon.None && o.recon != lastRecon[id]) violations++; // reconciled twice
            if (lastTx[id] != bytes32(0) && o.eercTxHash != lastTx[id]) violations++; // tx link rewritten
            if (o.eercTxHash != bytes32(0) && fx.orderIdOfTx(o.eercTxHash) != id) violations++; // N4 one tx -> one order
            if (
                o.recon != FxLedger.Recon.None && o.state != FxLedger.State.Settled
                    && o.state != FxLedger.State.Disputed
                    && !(o.state == FxLedger.State.Expired && o.eercTxHash != bytes32(0)) // D-020: expired after delivery
            ) {
                violations++;
            }
            lastState[id] = o.state;
            lastRecon[id] = o.recon;
            lastTx[id] = o.eercTxHash;
        }
    }

    function _id(uint256 seed) internal view returns (uint256) {
        return ids[seed % ids.length];
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    /// 3 of 4 calls use the right actor (so orders actually progress); 1 of 4 uses a random one (wrong-actor coverage).
    function _cust(uint256 id, uint256 a) internal view returns (address) {
        return a % 4 == 0 ? _actor(a / 4) : fx.getOrder(id).customer;
    }

    function _merch(uint256 id, uint256 a) internal view returns (address) {
        return a % 4 == 0 ? _actor(a / 4) : fx.getOrder(id).merchant;
    }

    // ------------------------------------------------------------------ actions

    function open(uint256 m, uint256 c, uint256 rateSeed, uint256 ttl) external {
        if (ids.length >= MAX_ORDERS) return;
        (uint256 lo, uint256 hi) = fx.rateBand();
        uint256 rate = bound(rateSeed, lo, hi);
        uint64 expiry = uint64(block.timestamp + bound(ttl, 1 minutes, 1 days));
        vm.prank(merchants[m % 2]);
        try fx.openOrder(customers[c % 3], rate, keccak256(abi.encode("c", ids.length, rateSeed)), expiry) returns (
            uint256 id
        ) {
            ids.push(id);
        } catch {}
        _check();
    }

    function accept(uint256 seed, uint256 a) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        vm.prank(_cust(id, a));
        try fx.acceptOrder(id) {} catch {}
        _check();
    }

    function markSent(uint256 seed, uint256 a, bool reuse) external {
        if (ids.length == 0) return;
        bytes32 h = keccak256(abi.encode("tx", reuse && txCounter > 0 ? txCounter - 1 : txCounter));
        uint256 id = _id(seed);
        vm.prank(_merch(id, a));
        try fx.markSent(id, h) {
            txCounter++;
        } catch {}
        _check();
    }

    function confirm(uint256 seed, uint256 a) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        vm.prank(_cust(id, a));
        try fx.confirmReceived(id) {
            settledOrDisputed++;
        } catch {}
        _check();
    }

    function dispute(uint256 seed, uint256 a) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        vm.prank(_cust(id, a));
        try fx.dispute(id) {
            settledOrDisputed++;
        } catch {}
        _check();
    }

    function cancel(uint256 seed, uint256 a) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        vm.prank(_merch(id, a));
        try fx.cancel(id) {} catch {}
        _check();
    }

    function expire(uint256 seed) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        FxLedger.State s0 = fx.stateOf(id);
        try fx.expire(id) {
            if (s0 == FxLedger.State.Sent) expiredFromSent++;
        } catch {}
        _check();
    }

    function reconcile(uint256 seed, uint256 a, bool ok) external {
        if (ids.length == 0) return;
        vm.prank(a % 4 == 0 ? _actor(a / 4) : recon);
        try fx.reconcile(_id(seed), ok) {} catch {}
        _check();
    }

    function setBankRate(uint256 r) external {
        uint256 cur = fx.bankRate();
        r = bound(r, (cur * 8_000 + 9_999) / 10_000, (cur * 12_000) / 10_000);
        if (r == 0) return;
        vm.prank(signer);
        try fx.setBankRate(r) {} catch {}
        _check();
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 6 hours));
        _check();
    }

    function idsLength() external view returns (uint256) {
        return ids.length;
    }
}

contract FxLedgerInvariantTest is Test {
    FxLedger internal fx;
    FxHandler internal handler;
    address internal admin = makeAddr("admin");
    address internal signer = makeAddr("signer");
    address internal recon = makeAddr("recon");

    function setUp() public {
        fx = new FxLedger(admin, signer, recon, 4500, 200);
        address[2] memory m = [makeAddr("m1"), makeAddr("m2")];
        vm.startPrank(admin);
        fx.setMerchant(m[0], true);
        fx.setMerchant(m[1], true);
        vm.stopPrank();
        handler = new FxHandler(fx, admin, signer, recon, m);
        targetContract(address(handler));
    }

    /// States only move forward; terminal states (Settled/Disputed/Expired/Cancelled) never change; reconciliation is
    /// written once and only on Settled/Disputed; a tx hash links to exactly one order (N4).
    function invariant_monotonicAndTerminal() public view {
        assertEq(handler.violations(), 0);
    }

    /// N0: the ledger never holds value.
    function invariant_holdsNoValue() public view {
        assertEq(address(fx).balance, 0);
    }

    /// Ids are dense: every handed-out id is below nextId.
    function invariant_nextIdCoversOrders() public view {
        assertEq(fx.nextId(), handler.idsLength() + 1);
    }
}
