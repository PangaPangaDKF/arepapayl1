// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The fee source: the live SplitPayEscrow (its owner, the bank, is the only fee knob).
interface IFeeSource {
    function token() external view returns (IERC20);
    function feeRouter() external view returns (address);
    function feeBps() external view returns (uint16);
}

/// @title MerchantPay — pay a store straight from the contact list (D-034)
/// @notice One call: the payer sends `amount`, the store receives amount − fee and the fee router the fee, in the same
///         transaction. Same token, fee router and fee as a merchant charge (read from the SplitPayEscrow at every
///         payment), so paying a contact can't be used to skip the fee and there is one fee to govern.
/// @dev Laws: N0 amount == net + fee, nothing created; N1 fee = amount × feeBps / 10 000, capped by the escrow
///      (MAX_FEE_BPS) and by the payer's maxFeeBps; N2 this contract never holds tokens after a call; N3 CEI +
///      nonReentrant + SafeERC20 + full-delivery check. No owner, no admin, no path to anyone's funds.
contract MerchantPay is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice 0.01 of the 6-decimal token: with any fee ≥ 1 bps the fee never rounds to zero (no fee bypass by splitting).
    uint256 public constant MIN_AMOUNT = 10_000;

    IFeeSource public immutable escrow;
    IERC20 public immutable token;
    address public immutable feeRouter;
    uint256 public paymentCount;

    event MerchantPaid(uint256 indexed id, address indexed payer, address indexed merchant, uint256 amount, uint256 net, uint256 fee);

    error ZeroAddress();
    error SelfPayment();
    error BelowMinimum();
    error FeeAbovePayerMax();
    error UnsupportedToken();

    constructor(address escrow_) {
        if (escrow_ == address(0)) revert ZeroAddress();
        escrow = IFeeSource(escrow_);
        token = IFeeSource(escrow_).token();
        feeRouter = IFeeSource(escrow_).feeRouter();
        if (address(token) == address(0) || feeRouter == address(0)) revert ZeroAddress();
        if (IERC20Metadata(address(token)).decimals() != 6) revert UnsupportedToken(); // MIN_AMOUNT assumes 6 decimals
    }

    /// @notice The fee charged now (the escrow's live fee).
    function feeBps() public view returns (uint16) {
        return escrow.feeBps();
    }

    /// @param merchant the store's wallet (from the directory; not the payer, not the fee router)
    /// @param amount what the payer pays, fee included (the store receives amount − fee)
    /// @param maxFeeBps the highest fee the payer saw and accepts; protects against a fee change before the tx lands
    function pay(address merchant, uint256 amount, uint16 maxFeeBps) external nonReentrant returns (uint256 id) {
        if (merchant == address(0)) revert ZeroAddress();
        // never the payer or the fee router, and never a contract of this flow that could not use or return the money
        // (review L-1: paying here or to the escrow/token would strand `net` forever)
        if (
            merchant == msg.sender || merchant == feeRouter || merchant == address(this) || merchant == address(escrow)
                || merchant == address(token)
        ) revert SelfPayment();
        if (amount < MIN_AMOUNT) revert BelowMinimum();
        uint16 bps = escrow.feeBps();
        if (bps > maxFeeBps) revert FeeAbovePayerMax();

        // effects
        uint256 fee = (amount * bps) / 10_000;
        uint256 net = amount - fee;
        id = ++paymentCount;
        emit MerchantPaid(id, msg.sender, merchant, amount, net, fee);

        // interactions: pull in full, then pay out; nothing stays here
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnsupportedToken();
        token.safeTransfer(merchant, net);
        if (fee != 0) token.safeTransfer(feeRouter, fee);
    }
}
