use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Fee exceeds maximum (500 bps / 5%)")]
    FeeTooHigh,

    #[msg("Recipient limit must be between 1 and 100")]
    InvalidRecipientLimit,

    #[msg("Amount too small for the number of recipients")]
    AmountTooSmall,

    #[msg("Random distribution is not supported yet — use Equal")]
    RandomNotSupported,

    #[msg("Expiry must be in the future, or 0 for never")]
    InvalidExpiry,

    #[msg("Packet is not active")]
    NotActive,

    #[msg("Packet has expired")]
    Expired,

    #[msg("No claims left on this packet")]
    NoClaimsLeft,

    #[msg("You already claimed this packet")]
    AlreadyClaimed,

    #[msg("Nothing to claim")]
    NothingToClaim,

    #[msg("Vault has insufficient funds")]
    InsufficientVault,

    #[msg("Packet is already closed")]
    AlreadyClosed,

    #[msg("Packet is not refundable yet — wait for expiry or completion")]
    NotRefundable,

    #[msg("Nothing to refund")]
    NothingToRefund,

    #[msg("Invalid token account")]
    InvalidAta,

    #[msg("Fee collector ATA missing or invalid — admin must create it for this mint")]
    InvalidFeeCollectorAta,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
