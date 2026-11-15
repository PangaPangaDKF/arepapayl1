// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SplitPayEscrow — Split Pay option A (D-010)
/// @notice One merchant QR, several payers, one payment. A merchant opens a payment intent; each payer authorizes a share,
///         which LOCKS that share here (an authorization hold, not a balance check); when the shares cover the total the
///         intent is captured (automatically, or after every payer confirms) and the merchant is paid total − fee in one
///         settlement. If the total is not covered before expiry, or the merchant cancels, the intent is voided and every
///         payer withdraws exactly their share (pull payment).
/// @dev Spec: docs/features/SPLIT_PAY.md. Option A holds the bridged ERC-20 on the bank's private L1 (amounts visible only to
///      the bank's nodes). Laws: N0 captured == sum(holds) == total; N1 fee snapshot at creation, capped; N2 balance ==
///      totalHeld; N3 CEI + nonReentrant + SafeERC20 + pull refunds; no admin path moves held funds.
contract SplitPayEscrow is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        None,
        Open,
        Ready,
        Captured,
        Voided
    }

    struct Intent {
        address merchant;
        uint64 expiry;
        uint16 feeBps; // snapshot at creation: the fee the payers saw is the fee charged
        uint8 maxPayers;
        uint8 payerCount;
        uint8 confirmedCount;
        bool requireConfirm;
        State state;
        uint256 total;
        uint256 covered;
    }

    uint16 public constant MAX_FEE_BPS = 100; // hard cap 1 % (N1)
    uint8 public constant MAX_PAYERS = 10; // bounded, no unbounded loops
    uint64 public constant MIN_TTL = 60;
    uint64 public constant MAX_TTL = 1 days;
    /// @notice Once fully covered in confirm mode, payers have this long to confirm (audit F-02).
    uint64 public constant CONFIRM_TTL = 5 minutes;

    IERC20 public immutable token;
    address public immutable feeRouter;
    uint16 public feeBps;

    uint256 public nextId = 1;
    /// @notice Sum of all shares currently held (open, ready or voided-but-not-withdrawn). Invariant: token balance == totalHeld.
    uint256 public totalHeld;

    mapping(uint256 id => Intent) public intents;
    mapping(uint256 id => mapping(address payer => uint256)) public holdOf;
    mapping(uint256 id => mapping(address payer => bool)) public confirmed;

    event IntentCreated(
        uint256 indexed id,
        address indexed merchant,
        uint256 total,
        uint64 expiry,
        uint16 feeBps,
        uint8 maxPayers,
        bool requireConfirm
    );
    event Authorized(uint256 indexed id, address indexed payer, uint256 amount, uint256 covered);
    event Released(uint256 indexed id, address indexed payer, uint256 amount);
    event Ready(uint256 indexed id, uint64 confirmBy);
    event Confirmed(uint256 indexed id, address indexed payer, uint8 confirmedCount);
    event Captured(uint256 indexed id, address indexed merchant, uint256 net, uint256 fee);
    event Voided(uint256 indexed id);
    event Withdrawn(uint256 indexed id, address indexed payer, uint256 amount);
    event FeeUpdated(uint16 oldBps, uint16 newBps);

    error ZeroAddress();
    error ZeroAmount();
    error BadExpiry();
    error TooManyPayers();
    error FeeTooHigh();
    error NotOpen();
    error NotReady();
    error Expired();
    error MerchantCannotPay();
    error NotMerchant();
    error NotPayer();
    error AlreadyConfirmed();
    error NotVoidable();
    error NothingToWithdraw();
    error ShareTooSmall();
    error UnsupportedToken();
    error FeeAboveMerchantMax();

    constructor(address token_, address feeRouter_, uint16 feeBps_, address owner_) Ownable(owner_) {
        if (token_ == address(0) || feeRouter_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        token = IERC20(token_);
        feeRouter = feeRouter_;
        feeBps = feeBps_;
    }

    // ------------------------------------------------------------------ merchant

    /// @notice Open a payment intent. The QR encodes only the returned id.
    /// @param maxFeeBps the highest fee the merchant accepts; protects against a fee change just before creation (F-07).
    function createIntent(uint256 total, uint64 expiry, uint8 maxPayers, bool requireConfirm, uint16 maxFeeBps)
        external
        returns (uint256 id)
    {
        if (total == 0) revert ZeroAmount();
        if (feeBps > maxFeeBps) revert FeeAboveMerchantMax();
        if (expiry < block.timestamp + MIN_TTL || expiry > block.timestamp + MAX_TTL) revert BadExpiry();
        if (maxPayers == 0 || maxPayers > MAX_PAYERS) revert TooManyPayers();

        id = nextId++;
        Intent storage it = intents[id];
        it.merchant = msg.sender;
        it.expiry = expiry;
        it.feeBps = feeBps;
        it.maxPayers = maxPayers;
        it.requireConfirm = requireConfirm;
        it.state = State.Open;
        it.total = total;

        emit IntentCreated(id, msg.sender, total, expiry, it.feeBps, maxPayers, requireConfirm);
    }

    /// @notice Merchant voids an intent that is not captured; payers then withdraw.
    function cancel(uint256 id) external {
        Intent storage it = intents[id];
        if (msg.sender != it.merchant) revert NotMerchant();
        if (it.state != State.Open && it.state != State.Ready) revert NotOpen();
        it.state = State.Voided;
        emit Voided(id);
    }

    // ------------------------------------------------------------------ payers

    /// @notice Lock a share. The last share is capped at the remainder, so an intent is never over-covered.
    function authorize(uint256 id, uint256 amount) external nonReentrant {
        Intent storage it = intents[id];
        if (it.state != State.Open) revert NotOpen();
        if (block.timestamp >= it.expiry) revert Expired();
        if (amount == 0) revert ZeroAmount();
        if (msg.sender == it.merchant) revert MerchantCannotPay();

        uint256 remaining = it.total - it.covered;
        uint256 take = amount < remaining ? amount : remaining;

        if (holdOf[id][msg.sender] == 0) {
            if (it.payerCount == it.maxPayers) revert TooManyPayers();
            // F-01: a new payer covers at least a fair share of what is left, so the free slots can always complete the
            // total and dust can't fill them. Existing payers may top up any amount.
            if (take < remaining && take < remaining / (it.maxPayers - it.payerCount)) revert ShareTooSmall();
            it.payerCount += 1;
        }

        // effects
        holdOf[id][msg.sender] += take;
        it.covered += take;
        totalHeld += take;
        emit Authorized(id, msg.sender, take, it.covered);

        bool full = it.covered == it.total;
        bool captureNow = full && !it.requireConfirm;
        if (full && it.requireConfirm) {
            it.state = State.Ready;
            uint64 confirmBy = uint64(block.timestamp) + CONFIRM_TTL; // F-02: one payer can't freeze it until expiry
            if (confirmBy < it.expiry) it.expiry = confirmBy;
            emit Ready(id, it.expiry);
        }
        uint256 net;
        uint256 fee;
        if (captureNow) (net, fee) = _markCaptured(id, it);

        // interactions
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), take);
        if (token.balanceOf(address(this)) - before != take) revert UnsupportedToken(); // F-03: full delivery only
        if (captureNow) _payOut(it.merchant, net, fee);
    }

    /// @notice Every payer confirms (confirm mode). The last confirmation captures.
    function confirm(uint256 id) external nonReentrant {
        Intent storage it = intents[id];
        if (it.state != State.Ready) revert NotReady();
        if (block.timestamp >= it.expiry) revert Expired();
        if (holdOf[id][msg.sender] == 0) revert NotPayer();
        if (confirmed[id][msg.sender]) revert AlreadyConfirmed();

        confirmed[id][msg.sender] = true;
        it.confirmedCount += 1;
        emit Confirmed(id, msg.sender, it.confirmedCount);

        if (it.confirmedCount == it.payerCount) {
            (uint256 net, uint256 fee) = _markCaptured(id, it);
            _payOut(it.merchant, net, fee);
        }
    }

    /// @notice Take your share back while the intent is still open (not yet fully covered).
    function release(uint256 id) external nonReentrant {
        Intent storage it = intents[id];
        if (it.state != State.Open) revert NotOpen();
        uint256 amount = holdOf[id][msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        holdOf[id][msg.sender] = 0;
        it.covered -= amount;
        it.payerCount -= 1;
        totalHeld -= amount;
        emit Released(id, msg.sender, amount);

        token.safeTransfer(msg.sender, amount);
    }

    /// @notice After a void (merchant cancel or expiry without capture), withdraw exactly your share.
    function withdraw(uint256 id) external nonReentrant {
        Intent storage it = intents[id];
        if (it.state == State.Captured || it.state == State.None) revert NothingToWithdraw();
        bool expired = block.timestamp >= it.expiry;
        if (it.state != State.Voided && !expired) revert NotVoidable();
        if (it.state != State.Voided) {
            it.state = State.Voided;
            emit Voided(id);
        }

        uint256 amount = holdOf[id][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        holdOf[id][msg.sender] = 0;
        totalHeld -= amount;
        emit Withdrawn(id, msg.sender, amount);

        token.safeTransfer(msg.sender, amount);
    }

    /// @notice Anyone can close an intent that expired without capture (F-08). Payers then withdraw.
    function expire(uint256 id) external {
        Intent storage it = intents[id];
        if ((it.state != State.Open && it.state != State.Ready) || block.timestamp < it.expiry) revert NotVoidable();
        it.state = State.Voided;
        emit Voided(id);
    }

    // ------------------------------------------------------------------ admin (fee only; no path to held funds)

    function setFeeBps(uint16 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(feeBps, newBps);
        feeBps = newBps;
    }

    // ------------------------------------------------------------------ views

    function stateOf(uint256 id) external view returns (State) {
        return intents[id].state;
    }

    function totalOf(uint256 id) external view returns (uint256) {
        return intents[id].total;
    }

    function coveredOf(uint256 id) external view returns (uint256) {
        return intents[id].covered;
    }

    function payerCountOf(uint256 id) external view returns (uint8) {
        return intents[id].payerCount;
    }

    function expiryOf(uint256 id) external view returns (uint64) {
        return intents[id].expiry;
    }

    // ------------------------------------------------------------------ internal

    function _markCaptured(uint256 id, Intent storage it) private returns (uint256 net, uint256 fee) {
        it.state = State.Captured;
        totalHeld -= it.total;
        fee = (it.total * it.feeBps) / 10_000;
        net = it.total - fee;
        emit Captured(id, it.merchant, net, fee);
    }

    function _payOut(address merchant, uint256 net, uint256 fee) private {
        token.safeTransfer(merchant, net);
        if (fee != 0) token.safeTransfer(feeRouter, fee);
    }
}
