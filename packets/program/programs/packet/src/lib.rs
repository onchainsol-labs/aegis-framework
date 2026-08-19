//! PACKET 🧧 — Money Worth Opening.
//!
//! Social on-chain money distribution on Solana.
//! Create → Drop → Share → Claim.
//!
//! Core invariant: total distributed ≤ total funded. Every path that moves
//! money out of the vault reduces `remaining_amount` by exactly the same
//! amount, checked and updated in the same instruction.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer},
};

pub mod errors;
pub use errors::ErrorCode;

declare_id!("58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

pub const CONFIG_SEED: &[u8] = b"config";
pub const PACKET_SEED: &[u8] = b"packet";
pub const VAULT_SEED: &[u8] = b"vault";

/// Upper bound for recipients in MVP (claims vec is stored inline in the
/// Packet account, so it must stay bounded). Larger limits come later via
/// per-claim ticket PDAs.
pub const MAX_RECIPIENTS: u32 = 100;

/// Absolute fee ceiling: 5% (500 bps). Protects users from config mistakes.
pub const MAX_FEE_BPS: u16 = 500;

/// 100% = 10_000 bps
pub const BPS_DENOMINATOR: u64 = 10_000;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/// Global program configuration.
#[account]
pub struct Config {
    /// Admin can update the config.
    pub admin: Pubkey,
    /// Platform fee in basis points (1% = 100).
    pub fee_bps: u16,
    /// Where withdrawn fees go.
    pub fee_collector: Pubkey,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 8 + 32 + 2 + 32 + 1;
}

/// A Packet — one funded envelope that recipients open and claim from.
#[account]
pub struct Packet {
    pub creator: Pubkey,
    pub mint: Pubkey,
    /// Total funded into the vault (never includes the fee).
    pub total_amount: u64,
    /// Unclaimed amount still in the vault. Reduced atomically with every claim.
    pub remaining_amount: u64,
    /// Equal mode: fixed share per claim (remainder goes to the last claimer).
    pub per_claim_amount: u64,
    pub recipient_limit: u32,
    pub claim_count: u32,
    pub mode: DistributionMode,
    /// Unix seconds. 0 = never expires.
    pub expires_at: i64,
    pub status: PacketStatus,
    pub vault: Pubkey,
    /// Claimers so far (double-claim prevention, bounded by MAX_RECIPIENTS).
    pub claims: Vec<Pubkey>,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Packet {
    pub fn size(recipient_limit: usize) -> usize {
        8 + // discriminator
        32 + // creator
        32 + // mint
        8 + // total_amount
        8 + // remaining_amount
        8 + // per_claim_amount
        4 + // recipient_limit
        4 + // claim_count
        1 + // mode
        8 + // expires_at
        1 + // status
        32 + // vault
        4 + recipient_limit * 32 + // claims vec
        1 + // bump
        1 // vault_bump
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DistributionMode {
    /// Everyone gets the same. Remainder dust goes to the final claimant.
    Equal,
    /// VRF-secured luck (Phase 3 — Switchboard VRF).
    Random,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PacketStatus {
    Active,
    Completed,
    Closed,
}

// ---------------------------------------------------------------------------
// Events (for indexing — no DB needed)
// ---------------------------------------------------------------------------

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub fee_collector: Pubkey,
}

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub fee_collector: Pubkey,
}

#[event]
pub struct PacketCreated {
    pub packet: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub recipient_limit: u32,
    pub mode: DistributionMode,
    pub expires_at: i64,
}

#[event]
pub struct PacketClaimed {
    pub packet: Pubkey,
    pub claimer: Pubkey,
    pub amount: u64,
    pub claim_count: u32,
}

#[event]
pub struct PacketRefunded {
    pub packet: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
}

#[event]
pub struct FeeCollected {
    pub packet: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

#[program]
pub mod packet {
    use super::*;

    /// One-time setup of the global config. Admin becomes the payer.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        fee_collector: Pubkey,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, ErrorCode::FeeTooHigh);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.fee_bps = fee_bps;
        config.fee_collector = fee_collector;
        config.bump = ctx.bumps.config;

        emit!(ConfigInitialized {
            admin: config.admin,
            fee_bps: config.fee_bps,
            fee_collector: config.fee_collector,
        });
        Ok(())
    }

    /// Admin updates fee rate, collector, or hands over admin.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        fee_collector: Option<Pubkey>,
        new_admin: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        if let Some(bps) = fee_bps {
            require!(bps <= MAX_FEE_BPS, ErrorCode::FeeTooHigh);
            config.fee_bps = bps;
        }
        if let Some(collector) = fee_collector {
            config.fee_collector = collector;
        }
        if let Some(admin) = new_admin {
            config.admin = admin;
        }

        emit!(ConfigUpdated {
            admin: config.admin,
            fee_bps: config.fee_bps,
            fee_collector: config.fee_collector,
        });
        Ok(())
    }

    /// Create the Packet + vault, fund it, and take the platform fee — all in
    /// one transaction, so dropping feels instant.
    ///
    /// Creator pays `total_amount + fee` from their ATA:
    ///   - `total_amount` → packet vault (recipients get the FULL amount)
    ///   - `fee`          → fee collector's ATA (added on top, never deducted)
    ///
    /// `nonce` is 32 random bytes generated client-side; the derived Packet
    /// PDA *is* the packet's public ID (the share-link slug).
    pub fn create_and_fund(
        ctx: Context<CreateAndFund>,
        nonce: [u8; 32],
        total_amount: u64,
        recipient_limit: u32,
        mode: DistributionMode,
        expires_at: i64,
    ) -> Result<()> {
        let _ = nonce; // used only in PDA seeds (Accounts derive)
        require!(
            recipient_limit > 0 && recipient_limit <= MAX_RECIPIENTS,
            ErrorCode::InvalidRecipientLimit
        );
        require!(
            total_amount >= recipient_limit as u64,
            ErrorCode::AmountTooSmall
        );
        require!(
            mode == DistributionMode::Equal,
            ErrorCode::RandomNotSupported
        );

        let clock = Clock::get()?;
        require!(
            expires_at == 0 || expires_at > clock.unix_timestamp,
            ErrorCode::InvalidExpiry
        );

        let fee = fee_for(total_amount, ctx.accounts.config.fee_bps)?;

        // Fund the packet vault (authority is the creator's own ATA).
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            total_amount,
        )?;

        // Take the fee on top (fee never reduces the packet amount). It goes
        // straight to the collector's ATA — no intermediate vault PDA, so no
        // attacker can pre-create a junk account to brick fee collection.
        if fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.creator_ata.to_account_info(),
                        to: ctx.accounts.fee_collector_ata.to_account_info(),
                        authority: ctx.accounts.creator.to_account_info(),
                    },
                ),
                fee,
            )?;

            emit!(FeeCollected {
                packet: ctx.accounts.packet.key(),
                creator: ctx.accounts.creator.key(),
                mint: ctx.accounts.mint.key(),
                amount: fee,
            });
        }

        let packet = &mut ctx.accounts.packet;
        packet.creator = ctx.accounts.creator.key();
        packet.mint = ctx.accounts.mint.key();
        packet.total_amount = total_amount;
        packet.remaining_amount = total_amount;
        packet.per_claim_amount = total_amount / recipient_limit as u64;
        packet.recipient_limit = recipient_limit;
        packet.claim_count = 0;
        packet.mode = mode;
        packet.expires_at = expires_at;
        packet.status = PacketStatus::Active;
        packet.vault = ctx.accounts.vault.key();
        packet.bump = ctx.bumps.packet;
        packet.vault_bump = ctx.bumps.vault;

        emit!(PacketCreated {
            packet: packet.key(),
            creator: packet.creator,
            mint: packet.mint,
            total_amount,
            recipient_limit,
            mode,
            expires_at,
        });
        Ok(())
    }

    /// Claim a share. Equal mode: everyone gets `per_claim_amount`, the final
    /// claimant receives the remainder (no dust left behind).
    ///
    /// Validation (must ALL pass):
    ///   1. Status == Active
    ///   2. Not expired
    ///   3. claim_count < recipient_limit
    ///   4. Claimer hasn't claimed this packet before
    ///   5. Vault has enough for the computed amount
    ///   6. Computed amount never exceeds remaining_amount
    pub fn claim_packet(ctx: Context<ClaimPacket>) -> Result<()> {
        let packet = &mut ctx.accounts.packet;

        require!(packet.status == PacketStatus::Active, ErrorCode::NotActive);

        let clock = Clock::get()?;
        require!(
            packet.expires_at == 0 || clock.unix_timestamp < packet.expires_at,
            ErrorCode::Expired
        );
        require!(
            packet.claim_count < packet.recipient_limit,
            ErrorCode::NoClaimsLeft
        );
        require!(
            !packet.claims.contains(&ctx.accounts.claimer.key()),
            ErrorCode::AlreadyClaimed
        );

        let is_last = packet.claim_count == packet.recipient_limit - 1;
        let amount = if is_last {
            packet.remaining_amount // final claimant sweeps the dust
        } else {
            packet.per_claim_amount
        };
        require!(amount > 0, ErrorCode::NothingToClaim);
        require!(
            packet.remaining_amount >= amount,
            ErrorCode::InsufficientVault
        );

        let packet_key = packet.key();
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, packet_key.as_ref(), &[packet.vault_bump]];

        // Move funds out of the vault — signed by the vault PDA.
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.claimer_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            amount,
        )?;

        // Update state in the SAME instruction (core invariant).
        packet.remaining_amount = packet
            .remaining_amount
            .checked_sub(amount)
            .ok_or(error!(ErrorCode::InsufficientVault))?;
        packet.claims.push(ctx.accounts.claimer.key());
        packet.claim_count += 1;

        if packet.claim_count == packet.recipient_limit {
            packet.status = PacketStatus::Completed;
        }

        emit!(PacketClaimed {
            packet: packet_key,
            claimer: ctx.accounts.claimer.key(),
            amount,
            claim_count: packet.claim_count,
        });
        Ok(())
    }

    /// Creator reclaims unclaimed funds after expiry or completion, then the
    /// vault and packet accounts are closed and rent is returned to them.
    ///
    /// The vault's FULL balance is swept (not just `remaining_amount`): anyone
    /// can send tokens directly to a vault PDA, and a leftover donated balance
    /// would make `close_account` below revert, bricking the refund forever.
    /// Donated surplus goes to the creator.
    pub fn refund_packet(ctx: Context<RefundPacket>) -> Result<()> {
        let packet = &mut ctx.accounts.packet;

        require!(
            packet.status != PacketStatus::Closed,
            ErrorCode::AlreadyClosed
        );

        let clock = Clock::get()?;
        let expired = packet.expires_at != 0 && clock.unix_timestamp >= packet.expires_at;
        let completed = packet.status == PacketStatus::Completed;
        require!(expired || completed, ErrorCode::NotRefundable);

        let amount = ctx.accounts.vault.amount;
        require!(amount > 0, ErrorCode::NothingToRefund);
        let packet_key = packet.key();
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, packet_key.as_ref(), &[packet.vault_bump]];

        // Return the remainder to the creator.
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.creator_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            amount,
        )?;

        packet.remaining_amount = 0;
        packet.status = PacketStatus::Closed;

        // Close the vault token account, rent back to the creator.
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.creator.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ))?;
        // The packet account itself is closed via `close = creator`.

        emit!(PacketRefunded {
            packet: packet_key,
            creator: ctx.accounts.creator.key(),
            amount,
        });
        Ok(())
    }
}

/// fee = amount * fee_bps / 10_000 (rounded down)
fn fee_for(amount: u64, fee_bps: u16) -> Result<u64> {
    amount
        .checked_mul(fee_bps as u64)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = Config::SIZE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(nonce: [u8; 32], total_amount: u64, recipient_limit: u32, mode: DistributionMode, expires_at: i64)]
pub struct CreateAndFund<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Creator's token account. Must hold total_amount + fee.
    #[account(
        mut,
        constraint = creator_ata.owner == creator.key() @ ErrorCode::InvalidAta,
        constraint = creator_ata.mint == mint.key() @ ErrorCode::InvalidAta
    )]
    pub creator_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = Packet::size(recipient_limit as usize),
        constraint = recipient_limit <= MAX_RECIPIENTS @ ErrorCode::InvalidRecipientLimit,
        seeds = [PACKET_SEED, creator.key().as_ref(), nonce.as_ref()],
        bump
    )]
    pub packet: Account<'info, Packet>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = vault,
        seeds = [VAULT_SEED, packet.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Fee collector's token account — fees are sent here directly on drop.
    /// Must exist before the first packet using this mint.
    #[account(
        mut,
        constraint = fee_collector_ata.owner == config.fee_collector @ ErrorCode::InvalidFeeCollectorAta,
        constraint = fee_collector_ata.mint == mint.key() @ ErrorCode::InvalidFeeCollectorAta
    )]
    pub fee_collector_ata: Account<'info, TokenAccount>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPacket<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub packet: Account<'info, Packet>,

    #[account(
        mut,
        seeds = [VAULT_SEED, packet.key().as_ref()],
        bump = packet.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Claimer's ATA — created for them if this is their first token.
    #[account(
        init_if_needed,
        payer = claimer,
        associated_token::mint = mint,
        associated_token::authority = claimer
    )]
    pub claimer_ata: Account<'info, TokenAccount>,

    #[account(constraint = mint.key() == packet.mint @ ErrorCode::InvalidAta)]
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundPacket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator @ ErrorCode::Unauthorized,
        close = creator
    )]
    pub packet: Account<'info, Packet>,

    #[account(
        mut,
        seeds = [VAULT_SEED, packet.key().as_ref()],
        bump = packet.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_ata.owner == creator.key() @ ErrorCode::InvalidAta,
        constraint = creator_ata.mint == packet.mint @ ErrorCode::InvalidAta
    )]
    pub creator_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
