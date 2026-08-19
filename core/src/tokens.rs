//! Checked SPL Token CPIs — hand-encoded, zero token-crate dependency (D4, D5).
//!
//! Aegis deliberately does not depend on a token crate: the transfer and
//! close instructions are 13 bytes and 1 byte of data respectively, and
//! encoding them here keeps the dependency graph tiny and the `.so` small.
//! Everything is checked: [`checked_amount`] refuses to underflow, so a
//! silent arithmetic bug can never drain a vault.
//!
//! ```
//! use aegis_core::prelude::*;
//!
//! // Returns the NEW remaining balance after the subtraction.
//! assert_eq!(checked_amount(100, 30).unwrap(), 70);
//! assert!(checked_amount(30, 31).is_err());
//! ```

use alloc::vec;
use alloc::vec::Vec;

use solana_program::account_info::AccountInfo;
use solana_program::instruction::{AccountMeta, Instruction};
use solana_program::program::{invoke, invoke_signed};
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::error::AegisError;

/// The SPL Token program — the canonical one, on every cluster.
pub const TOKEN_PROGRAM_ID: Pubkey =
    Pubkey::from_str_const("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/// Instruction tag for `TransferChecked` in the SPL Token program.
pub const TRANSFER_CHECKED_TAG: u8 = 12;
/// Instruction tag for `CloseAccount` in the SPL Token program.
pub const CLOSE_ACCOUNT_TAG: u8 = 9;

/// Subtract `amount` from `remaining` and return the new remaining balance.
///
/// The core Aegis invariant (D5): no arithmetic on token balances is ever
/// unchecked. A vault can never go below zero, and the error tells the
/// caller exactly why.
pub fn checked_amount(remaining: u64, amount: u64) -> Result<u64, AegisError> {
    remaining
        .checked_sub(amount)
        .ok_or_else(AegisError::amount_exceeds_remaining)
}

/// Build a raw `TransferChecked` instruction (escape hatch — encode, then
/// `invoke` it yourself with any account set or signer seeds you like).
#[allow(clippy::too_many_arguments)]
pub fn transfer_checked_instruction(
    token_program: Pubkey,
    source: Pubkey,
    mint: Pubkey,
    destination: Pubkey,
    authority: Pubkey,
    amount: u64,
    decimals: u8,
) -> Instruction {
    let mut data = Vec::with_capacity(13);
    data.push(TRANSFER_CHECKED_TAG);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    Instruction {
        program_id: token_program,
        accounts: vec![
            AccountMeta::new(source, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(destination, false),
            AccountMeta::new_readonly(authority, true),
        ],
        data,
    }
}

/// Build a raw `CloseAccount` instruction — rent from the closed token
/// account goes to `destination`.
pub fn close_account_instruction(
    token_program: Pubkey,
    account: Pubkey,
    destination: Pubkey,
    authority: Pubkey,
) -> Instruction {
    Instruction {
        program_id: token_program,
        accounts: vec![
            AccountMeta::new(account, false),
            AccountMeta::new(destination, false),
            AccountMeta::new_readonly(authority, true),
        ],
        data: vec![CLOSE_ACCOUNT_TAG],
    }
}

/// CPI: SPL `TransferChecked` — amount with decimals, so a wrong-decimal
/// token account can never silently mint or burn value.
///
/// Pass `signer_seeds` when the authority is a PDA; otherwise the authority
/// account must have signed the transaction.
///
/// Errors propagate from the token program unchanged, so clients see the
/// real SPL error code.
#[allow(clippy::too_many_arguments)]
pub fn transfer_checked<'a>(
    token_program: &AccountInfo<'a>,
    source: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    destination: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    amount: u64,
    decimals: u8,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<(), ProgramError> {
    let ix = transfer_checked_instruction(
        *token_program.key,
        *source.key,
        *mint.key,
        *destination.key,
        *authority.key,
        amount,
        decimals,
    );
    let account_infos = [
        source.clone(),
        mint.clone(),
        destination.clone(),
        authority.clone(),
    ];
    match signer_seeds {
        Some(seeds) => invoke_signed(&ix, &account_infos, seeds),
        None => invoke(&ix, &account_infos),
    }
}

/// CPI: SPL `CloseAccount` — the account must be empty (zero balance), or
/// the token program rejects the close.
///
/// Pass `signer_seeds` when the authority is a PDA.
pub fn close_account<'a>(
    token_program: &AccountInfo<'a>,
    account: &AccountInfo<'a>,
    destination: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<(), ProgramError> {
    let ix = close_account_instruction(
        *token_program.key,
        *account.key,
        *destination.key,
        *authority.key,
    );
    let account_infos = [account.clone(), destination.clone(), authority.clone()];
    match signer_seeds {
        Some(seeds) => invoke_signed(&ix, &account_infos, seeds),
        None => invoke(&ix, &account_infos),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AMOUNT_EXCEEDS_REMAINING;

    #[test]
    fn checked_amount_subtracts() {
        assert_eq!(checked_amount(100, 30).unwrap(), 70);
        assert_eq!(checked_amount(5, 5).unwrap(), 0);
        assert_eq!(checked_amount(0, 0).unwrap(), 0);
    }

    #[test]
    fn checked_amount_rejects_underflow() {
        let err = checked_amount(30, 31).unwrap_err();
        assert_eq!(err.code, AMOUNT_EXCEEDS_REMAINING);
        assert!(checked_amount(0, 1).is_err());
    }

    #[test]
    fn transfer_checked_encoding_is_byte_exact() {
        let ix = transfer_checked_instruction(
            TOKEN_PROGRAM_ID,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            123_456u64,
            6,
        );

        // data = tag(12) + amount(8 LE) + decimals(1)
        assert_eq!(ix.data.len(), 10);
        assert_eq!(ix.data[0], 12);
        assert_eq!(&ix.data[1..9], &123_456u64.to_le_bytes());
        assert_eq!(ix.data[9], 6);

        // accounts: source(w), mint(r), destination(w), authority(signer)
        assert_eq!(ix.accounts.len(), 4);
        assert!(ix.accounts[0].is_writable && !ix.accounts[0].is_signer);
        assert!(!ix.accounts[1].is_writable && !ix.accounts[1].is_signer);
        assert!(ix.accounts[2].is_writable && !ix.accounts[2].is_signer);
        assert!(!ix.accounts[3].is_writable && ix.accounts[3].is_signer);
    }

    #[test]
    fn close_account_encoding_is_byte_exact() {
        let ix = close_account_instruction(
            TOKEN_PROGRAM_ID,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );

        assert_eq!(ix.data, vec![9]);
        assert_eq!(ix.accounts.len(), 3);
        assert!(ix.accounts[0].is_writable && !ix.accounts[0].is_signer);
        assert!(ix.accounts[1].is_writable && !ix.accounts[1].is_signer);
        assert!(!ix.accounts[2].is_writable && ix.accounts[2].is_signer);
    }

    #[test]
    fn token_program_id_is_canonical() {
        assert_eq!(
            TOKEN_PROGRAM_ID.to_string(),
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        );
    }
}
