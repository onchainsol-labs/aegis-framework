// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// PACKET 🧧 — Money Worth Opening.
///
/// EVM port of the Solana Anchor program (`packets/program`). Same logic,
/// same invariants, different chain:
///   Create → Drop → Share → Claim.
///
/// Core invariant: total distributed ≤ total funded. Every path that moves
/// money out of the contract reduces `remaining_amount` by exactly the same
/// amount, checked and updated within the same call.
///
/// Differences from the Solana version, on purpose:
///   - Packet id is a plain counter (`/p/42`), not a PDA address.
///   - No separate vault account — packet funds live in this contract.
///   - Random mode is still not supported (same as Solana MVP).
///     Later: Chainlink VRF or a shuffled order sealed at creation.
///   - No gas sponsorship yet — claimers pay their own gas. Later: paymaster.

/// Minimal ERC20 surface — no dependency on OpenZeppelin. Works with USDC.
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Packet {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum Mode {
        Equal, // everyone gets the same; dust goes to the final claimant
        Random // not supported in MVP
    }

    enum Status {
        Active,
        Completed,
        Closed
    }

    struct PacketState {
        address creator;
        address token; // ERC20 mint (USDC on Base)
        uint96 totalAmount; // funded into the vault (never includes the fee)
        uint96 remainingAmount; // unclaimed, still held here
        uint96 perClaimAmount; // equal mode: fixed share per claim
        uint32 recipientLimit;
        uint32 claimCount;
        Mode mode;
        uint48 expiresAt; // unix seconds; 0 = never expires
        Status status;
        address[] claimers; // double-claim prevention
    }

    // ------------------------------------------------------------------
    // Errors (mirrors the Anchor error codes)
    // ------------------------------------------------------------------

    error Unauthorized();
    error FeeTooHigh();
    error InvalidRecipientLimit();
    error AmountTooSmall();
    error RandomNotSupported();
    error InvalidExpiry();
    error NotActive();
    error Expired();
    error NoClaimsLeft();
    error AlreadyClaimed();
    error NothingToClaim();
    error InsufficientVault();
    error AlreadyClosed();
    error NotRefundable();
    error NothingToRefund();
    error FeeTransferFailed();
    error PacketTransferFailed();

    // ------------------------------------------------------------------
    // Events (for indexing — the API reads these instead of a DB)
    // ------------------------------------------------------------------

    event ConfigInitialized(address admin, uint16 feeBps, address feeCollector);
    event ConfigUpdated(address admin, uint16 feeBps, address feeCollector);
    event PacketCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed token,
        uint96 totalAmount,
        uint32 recipientLimit,
        Mode mode,
        uint48 expiresAt
    );
    event PacketClaimed(uint256 indexed id, address indexed claimer, uint96 amount, uint32 claimCount);
    event PacketRefunded(uint256 indexed id, address indexed creator, uint96 amount);
    event FeeCollected(uint256 indexed id, address indexed creator, address indexed token, uint96 amount);

    // ------------------------------------------------------------------
    // Constants (same as Anchor)
    // ------------------------------------------------------------------

    uint256 public constant MAX_RECIPIENTS = 100;
    uint16 public constant MAX_FEE_BPS = 500; // 5% ceiling
    uint16 public constant BPS_DENOMINATOR = 10_000;

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    address public admin;
    uint16 public feeBps;
    address public feeCollector;

    /// Next packet id — the packet's public ID (the share-link slug).
    uint256 public nextPacketId;

    mapping(uint256 => PacketState) public packets;

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    constructor(address admin_, uint16 feeBps_, address feeCollector_) {
        require(feeBps_ <= MAX_FEE_BPS, FeeTooHigh());
        admin = admin_;
        feeBps = feeBps_;
        feeCollector = feeCollector_;
        emit ConfigInitialized(admin_, feeBps_, feeCollector_);
    }

    /// Admin updates fee rate, collector, or hands over admin.
    function updateConfig(uint16 feeBps_, address feeCollector_, address newAdmin_) external {
        require(msg.sender == admin, Unauthorized());
        if (feeBps_ != 0) {
            require(feeBps_ <= MAX_FEE_BPS, FeeTooHigh());
            feeBps = feeBps_;
        }
        if (feeCollector_ != address(0)) feeCollector = feeCollector_;
        if (newAdmin_ != address(0)) admin = newAdmin_;
        emit ConfigUpdated(admin, feeBps, feeCollector);
    }

    // ------------------------------------------------------------------
    // Create → Drop
    // ------------------------------------------------------------------

    /// Create the packet, fund it, and take the platform fee — all in one
    /// transaction, so dropping feels instant.
    ///
    /// Creator pays `totalAmount + fee` from their wallet:
    ///   - `totalAmount` → this contract (recipients get the FULL amount)
    ///   - `fee`         → fee collector directly (added on top, never deducted)
    function createPacket(address token, uint96 totalAmount, uint32 recipientLimit, Mode mode, uint48 expiresAt)
        external
        returns (uint256 id)
    {
        require(token != address(0), Unauthorized()); // sanity: no zero token
        require(recipientLimit > 0 && recipientLimit <= MAX_RECIPIENTS, InvalidRecipientLimit());
        require(totalAmount >= recipientLimit, AmountTooSmall());
        require(mode == Mode.Equal, RandomNotSupported());
        require(expiresAt == 0 || expiresAt > uint48(block.timestamp), InvalidExpiry());

        id = ++nextPacketId;

        uint96 fee = feeFor(totalAmount);

        // Fund the vault (the contract itself).
        require(IERC20Minimal(token).transferFrom(msg.sender, address(this), totalAmount), PacketTransferFailed());
        // Take the fee on top — straight to the collector, no middleman.
        if (fee > 0) {
            require(IERC20Minimal(token).transferFrom(msg.sender, feeCollector, fee), FeeTransferFailed());
            emit FeeCollected(id, msg.sender, token, fee);
        }

        PacketState storage p = packets[id];
        p.creator = msg.sender;
        p.token = token;
        p.totalAmount = totalAmount;
        p.remainingAmount = totalAmount;
        p.perClaimAmount = totalAmount / recipientLimit;
        p.recipientLimit = recipientLimit;
        p.claimCount = 0;
        p.mode = mode;
        p.expiresAt = expiresAt;
        p.status = Status.Active;

        emit PacketCreated(id, msg.sender, token, totalAmount, recipientLimit, mode, expiresAt);
    }

    // ------------------------------------------------------------------
    // Claim
    // ------------------------------------------------------------------

    /// Claim a share. Equal mode: everyone gets `perClaimAmount`, the final
    /// claimant receives the remainder (no dust left behind).
    function claimPacket(uint256 id) external {
        PacketState storage p = packets[id];
        require(p.creator != address(0), NotActive()); // packet exists & not closed
        require(p.status == Status.Active, NotActive());
        require(p.expiresAt == 0 || uint48(block.timestamp) < p.expiresAt, Expired());
        require(p.claimCount < p.recipientLimit, NoClaimsLeft());
        require(!isClaimer(p, msg.sender), AlreadyClaimed());

        bool isLast = p.claimCount == p.recipientLimit - 1;
        uint96 amount = isLast ? p.remainingAmount : p.perClaimAmount; // last sweeps dust
        require(amount > 0, NothingToClaim());
        require(p.remainingAmount >= amount, InsufficientVault());

        require(IERC20Minimal(p.token).transfer(msg.sender, amount), PacketTransferFailed());

        // Update state in the SAME call (core invariant).
        p.remainingAmount -= amount;
        p.claimers.push(msg.sender);
        p.claimCount += 1;
        if (p.claimCount == p.recipientLimit) p.status = Status.Completed;

        emit PacketClaimed(id, msg.sender, amount, p.claimCount);
    }

    // ------------------------------------------------------------------
    // Refund
    // ------------------------------------------------------------------

    /// Creator reclaims unclaimed funds after expiry or completion.
    function refundPacket(uint256 id) external {
        PacketState storage p = packets[id];
        require(p.creator != address(0) && p.status != Status.Closed, AlreadyClosed());
        require(msg.sender == p.creator, Unauthorized());

        bool expired = p.expiresAt != 0 && uint48(block.timestamp) >= p.expiresAt;
        bool completed = p.status == Status.Completed;
        require(expired || completed, NotRefundable());

        uint96 amount = p.remainingAmount;
        require(amount > 0, NothingToRefund());

        require(IERC20Minimal(p.token).transfer(p.creator, amount), PacketTransferFailed());

        p.remainingAmount = 0;
        p.status = Status.Closed;

        emit PacketRefunded(id, p.creator, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// Full packet state — the API reads this instead of a DB.
    function getPacket(uint256 id) external view returns (PacketState memory) {
        return packets[id];
    }

    function isClaimer(PacketState storage p, address who) internal view returns (bool) {
        for (uint256 i = 0; i < p.claimers.length; i++) {
            if (p.claimers[i] == who) return true;
        }
        return false;
    }

    function claimerCount(uint256 id) external view returns (uint256) {
        return packets[id].claimers.length;
    }

    /// fee = amount * feeBps / 10_000 (rounded down) — same as Anchor.
    function feeFor(uint96 amount) public view returns (uint96) {
        return uint96((uint256(amount) * feeBps) / BPS_DENOMINATOR);
    }
}
