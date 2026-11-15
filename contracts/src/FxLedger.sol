// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title FxLedger — merchant FX sales coordination ledger (D-020)
/// @notice Registered merchants act as exchange houses: they sell encrypted USDT/USDC (eERC) to KYC'd customers for Bs. Every
///         sale is an order on this ledger: the merchant opens it at a rate inside the bank's band, the named customer accepts
///         it (and states they paid the Bs), the merchant links the eERC transfer, and the customer confirms or disputes. The
///         bank's reconciler then attests whether the decrypted transfer matches the order's commitment.
/// @dev Spec: docs/features/MERCHANT_FX.md §1, §4. Laws:
///      - N0: this contract moves NO tokens and holds no value. It has no payable function, no receive/fallback and no token
///        calls. It records and checks; amounts stay encrypted in eERC and only a commitment is stored here.
///      - N4: an eERC tx hash can be linked to one order only, ever (one transfer can't settle two orders).
///      - Bounded: no loops at all.
///      Roles: Ownable2Step + single-address roles instead of OZ AccessControl. The bank has exactly ONE rate signer key and
///      ONE reconciler service key; a single slot per role makes "who can do this right now" a one-read answer for auditors,
///      rotation is an atomic replace (no forgotten second holder), and there is no role self-administration or renounce
///      surface. Ownable2Step protects the admin (bank multisig) handoff from a typo. Merchants are a plain allowlist mapping.
contract FxLedger is Ownable2Step {
    /// @notice Open → Accepted → Sent → Settled. Disputed (from Accepted/Sent), Expired (from Open/Accepted/Sent once past
    ///         expiry) and Cancelled (from Open, by the merchant) are terminal, as is Settled.
    enum State {
        None,
        Open,
        Accepted,
        Sent,
        Settled,
        Disputed,
        Expired,
        Cancelled
    }

    /// @notice Bank reconciliation result, written once, only on Settled or Disputed orders.
    enum Recon {
        None,
        Ok,
        Flagged
    }

    struct Order {
        address merchant;
        uint64 expiry;
        uint64 openedAt;
        State state;
        Recon recon;
        address customer;
        uint256 rate; // Bs per USD, 2-decimal fixed point (4500 = 45.00)
        uint256 bankRateAtOpen; // the bank rate the band was checked against
        bytes32 commitment; // hash(orderRef, usdAmount, bsAmount, bsMethod, bsRef, salt), built by the merchant app
        bytes32 eercTxHash; // the eERC private transfer that delivered the USD
    }

    uint256 public constant BPS = 10_000;
    /// @notice Hard cap on the rate band half-width: 3 %.
    uint16 public constant MAX_SPREAD_BPS = 300;
    /// @notice A single bank-rate update may move the rate at most ±20 % from the previous one.
    uint16 public constant MAX_RATE_STEP_BPS = 2_000;
    uint64 public constant MIN_TTL = 1 minutes;
    uint64 public constant MAX_TTL = 1 days;

    /// @notice Official rate, Bs per USD, 2-decimal fixed point. Never zero.
    uint256 public bankRate;
    /// @notice Band half-width in bps around `bankRate`. ≤ MAX_SPREAD_BPS.
    uint16 public spreadBps;
    address public rateSigner;
    address public reconciler;

    uint256 public nextId = 1;
    mapping(uint256 id => Order) internal orders;
    mapping(address account => bool) public isMerchant;
    mapping(bytes32 commitment => bool) public commitmentUsed;
    /// @notice eERC tx hash → the one order it is linked to (0 = unlinked). Used by the bank to classify transfers.
    mapping(bytes32 txHash => uint256 id) public orderIdOfTx;

    event MerchantSet(address indexed merchant, bool allowed);
    event RateSignerSet(address indexed oldSigner, address indexed newSigner);
    event ReconcilerSet(address indexed oldReconciler, address indexed newReconciler);
    event SpreadUpdated(uint16 oldBps, uint16 newBps);
    event BankRateUpdated(uint256 oldRate, uint256 newRate, address indexed signer);
    event Opened(
        uint256 indexed id,
        address indexed merchant,
        address indexed customer,
        uint256 rate,
        uint256 bankRate,
        bytes32 commitment,
        uint64 expiry
    );
    event Accepted(uint256 indexed id, address indexed customer);
    event Sent(uint256 indexed id, bytes32 indexed eercTxHash);
    event Settled(uint256 indexed id);
    event Disputed(uint256 indexed id, State from);
    event Expired(uint256 indexed id, State from);
    event Cancelled(uint256 indexed id);
    /// @notice `ok == false` is a flag for the bank's compliance team.
    event Reconciled(uint256 indexed id, bool ok, address indexed reconciler);

    error ZeroAddress();
    error ZeroRate();
    error RateStepTooLarge();
    error SpreadTooHigh();
    error NotMerchant();
    error NotOrderMerchant();
    error NotCustomer();
    error NotRateSigner();
    error NotReconciler();
    error BadCustomer();
    error RateOutOfBand();
    error BadExpiry();
    error ZeroCommitment();
    error CommitmentUsed();
    error ZeroTxHash();
    error TxHashUsed();
    error WrongState(State current);
    error PastExpiry();
    error NotExpired();
    error AlreadyReconciled();
    error RenounceDisabled();

    constructor(address owner_, address rateSigner_, address reconciler_, uint256 bankRate_, uint16 spreadBps_)
        Ownable(owner_)
    {
        if (rateSigner_ == address(0) || reconciler_ == address(0)) revert ZeroAddress();
        if (bankRate_ == 0) revert ZeroRate();
        if (spreadBps_ > MAX_SPREAD_BPS) revert SpreadTooHigh();
        rateSigner = rateSigner_;
        reconciler = reconciler_;
        bankRate = bankRate_;
        spreadBps = spreadBps_;
        emit RateSignerSet(address(0), rateSigner_);
        emit ReconcilerSet(address(0), reconciler_);
        emit BankRateUpdated(0, bankRate_, msg.sender);
        emit SpreadUpdated(0, spreadBps_);
    }

    // ------------------------------------------------------------------ admin (bank multisig)

    /// @notice Register or remove an exchange-house merchant. Removal blocks NEW orders only; the merchant can still finish
    ///         (markSent / cancel) orders it already opened, so a customer who paid Bs is never stranded.
    function setMerchant(address merchant, bool allowed) external onlyOwner {
        if (merchant == address(0)) revert ZeroAddress();
        isMerchant[merchant] = allowed;
        emit MerchantSet(merchant, allowed);
    }

    function setRateSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit RateSignerSet(rateSigner, newSigner);
        rateSigner = newSigner;
    }

    function setReconciler(address newReconciler) external onlyOwner {
        if (newReconciler == address(0)) revert ZeroAddress();
        emit ReconcilerSet(reconciler, newReconciler);
        reconciler = newReconciler;
    }

    /// @notice Set the band half-width. Applies to orders opened afterwards; open orders keep the rate they were checked at.
    function setSpreadBps(uint16 newBps) external onlyOwner {
        if (newBps > MAX_SPREAD_BPS) revert SpreadTooHigh();
        emit SpreadUpdated(spreadBps, newBps);
        spreadBps = newBps;
    }

    /// @notice Disabled: losing the admin would freeze merchant, signer and reconciler management forever.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    // ------------------------------------------------------------------ rate signer

    /// @notice Publish the official rate. Bounded to ±MAX_RATE_STEP_BPS of the previous rate per update, so a compromised or
    ///         fat-fingered signer can't jump the band in one call. Larger moves take several updates (each with an event).
    function setBankRate(uint256 newRate) external {
        if (msg.sender != rateSigner) revert NotRateSigner();
        if (newRate == 0) revert ZeroRate();
        uint256 old = bankRate;
        uint256 diff = newRate > old ? newRate - old : old - newRate;
        if (diff * BPS > old * MAX_RATE_STEP_BPS) revert RateStepTooLarge();
        bankRate = newRate;
        emit BankRateUpdated(old, newRate, msg.sender);
    }

    // ------------------------------------------------------------------ merchant

    /// @notice Quote an FX sale to `customer`. The rate must lie in [bankRate·(1−spread), bankRate·(1+spread)] (inclusive,
    ///         exact integer comparison, no rounding).
    /// @param commitment non-zero, never used before; hides amounts and Bs payment data (only the bank opens it).
    /// @param expiry absolute timestamp in [now + MIN_TTL, now + MAX_TTL]; accept and markSent must happen before it.
    function openOrder(address customer, uint256 rate, bytes32 commitment, uint64 expiry)
        external
        returns (uint256 id)
    {
        if (!isMerchant[msg.sender]) revert NotMerchant();
        if (customer == address(0) || customer == msg.sender) revert BadCustomer();
        uint256 b = bankRate;
        uint256 s = spreadBps;
        if (rate * BPS < b * (BPS - s) || rate * BPS > b * (BPS + s)) revert RateOutOfBand();
        if (expiry < block.timestamp + MIN_TTL || expiry > block.timestamp + MAX_TTL) revert BadExpiry();
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (commitmentUsed[commitment]) revert CommitmentUsed();

        commitmentUsed[commitment] = true;
        id = nextId++;
        Order storage o = orders[id];
        o.merchant = msg.sender;
        o.expiry = expiry;
        o.openedAt = uint64(block.timestamp);
        o.state = State.Open;
        o.customer = customer;
        o.rate = rate;
        o.bankRateAtOpen = b;
        o.commitment = commitment;

        emit Opened(id, msg.sender, customer, rate, b, commitment, expiry);
    }

    /// @notice Link the eERC transfer that delivered the USD. Only after the customer accepted, before expiry.
    function markSent(uint256 id, bytes32 eercTxHash) external {
        Order storage o = orders[id];
        if (msg.sender != o.merchant) revert NotOrderMerchant();
        if (o.state != State.Accepted) revert WrongState(o.state);
        if (block.timestamp >= o.expiry) revert PastExpiry();
        if (eercTxHash == bytes32(0)) revert ZeroTxHash();
        if (orderIdOfTx[eercTxHash] != 0) revert TxHashUsed();

        orderIdOfTx[eercTxHash] = id;
        o.eercTxHash = eercTxHash;
        o.state = State.Sent;
        emit Sent(id, eercTxHash);
    }

    /// @notice Withdraw a quote nobody accepted yet. Once accepted, the customer may have paid Bs: no cancel.
    function cancel(uint256 id) external {
        Order storage o = orders[id];
        if (msg.sender != o.merchant) revert NotOrderMerchant();
        if (o.state != State.Open) revert WrongState(o.state);
        o.state = State.Cancelled;
        emit Cancelled(id);
    }

    // ------------------------------------------------------------------ customer

    /// @notice Agree to the quote and state that the Bs were paid. Before expiry only.
    function acceptOrder(uint256 id) external {
        Order storage o = orders[id];
        if (msg.sender != o.customer) revert NotCustomer();
        if (o.state != State.Open) revert WrongState(o.state);
        if (block.timestamp >= o.expiry) revert PastExpiry();
        o.state = State.Accepted;
        emit Accepted(id, msg.sender);
    }

    /// @notice Confirm the USD arrived → Settled. Allowed while the order is Sent, even past expiry if nobody has expired it
    ///         yet: a truthful confirmation only helps reconciliation.
    function confirmReceived(uint256 id) external {
        Order storage o = orders[id];
        if (msg.sender != o.customer) revert NotCustomer();
        if (o.state != State.Sent) revert WrongState(o.state);
        o.state = State.Settled;
        emit Settled(id);
    }

    /// @notice Raise a dispute for the bank's compliance review. From Accepted (paid Bs, nothing sent) or Sent (wrong/no
    ///         amount). Allowed past expiry while the order has not been expired, so a customer who paid is never silenced.
    function dispute(uint256 id) external {
        Order storage o = orders[id];
        if (msg.sender != o.customer) revert NotCustomer();
        State from = o.state;
        if (from != State.Accepted && from != State.Sent) revert WrongState(from);
        o.state = State.Disputed;
        emit Disputed(id, from);
    }

    // ------------------------------------------------------------------ anyone

    /// @notice Close an order at or past its expiry that is still Open, Accepted or Sent. Terminal.
    function expire(uint256 id) external {
        Order storage o = orders[id];
        State from = o.state;
        if (from != State.Open && from != State.Accepted && from != State.Sent) revert WrongState(from);
        if (block.timestamp < o.expiry) revert NotExpired();
        o.state = State.Expired;
        emit Expired(id, from);
    }

    // ------------------------------------------------------------------ reconciler (bank service)

    /// @notice Post the bank's reconciliation result once per Settled or Disputed order, or per Expired order that already has a
    ///         delivering eERC transfer (a customer who received the USD and let the order run out is still checked, R12).
    ///         Does not change the order state.
    function reconcile(uint256 id, bool ok) external {
        if (msg.sender != reconciler) revert NotReconciler();
        Order storage o = orders[id];
        bool expiredWithTransfer = o.state == State.Expired && o.eercTxHash != bytes32(0);
        if (o.state != State.Settled && o.state != State.Disputed && !expiredWithTransfer) revert WrongState(o.state);
        if (o.recon != Recon.None) revert AlreadyReconciled();
        o.recon = ok ? Recon.Ok : Recon.Flagged;
        emit Reconciled(id, ok, msg.sender);
    }

    // ------------------------------------------------------------------ views

    function getOrder(uint256 id) external view returns (Order memory) {
        return orders[id];
    }

    function stateOf(uint256 id) external view returns (State) {
        return orders[id].state;
    }

    /// @notice Inclusive integer bounds a quote must fall in right now: [ceil(b·(1−s)), floor(b·(1+s))].
    function rateBand() external view returns (uint256 lo, uint256 hi) {
        uint256 b = bankRate;
        uint256 s = spreadBps;
        lo = (b * (BPS - s) + BPS - 1) / BPS;
        hi = (b * (BPS + s)) / BPS;
    }
}
