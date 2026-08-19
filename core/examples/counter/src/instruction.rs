//! Instruction builders and tags for the counter app.
//!
//! Clients (and the tests below) build instructions through these helpers,
//! so the wire format lives in exactly one place.

use alloc::vec;

use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
};
use solana_sdk_ids::system_program;

/// Instruction tag: create the counter account.
pub const INITIALIZE: u8 = 0;
/// Instruction tag: add one to the count.
pub const INCREMENT: u8 = 1;
/// Instruction tag: subtract one from the count.
pub const DECREMENT: u8 = 2;
/// Instruction tag: freeze the counter (Active → Frozen).
pub const FREEZE: u8 = 3;

/// Create the counter account owned by the program at its PDA.
pub fn initialize(program_id: &Pubkey, authority: &Pubkey, counter: &Pubkey) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new(*counter, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: vec![INITIALIZE],
    }
}

/// Add one to the count. The authority must sign.
pub fn increment(program_id: &Pubkey, authority: &Pubkey, counter: &Pubkey) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*counter, false),
        ],
        data: vec![INCREMENT],
    }
}

/// Subtract one from the count. The authority must sign.
pub fn decrement(program_id: &Pubkey, authority: &Pubkey, counter: &Pubkey) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*counter, false),
        ],
        data: vec![DECREMENT],
    }
}

/// Freeze the counter. The authority must sign.
pub fn freeze(program_id: &Pubkey, authority: &Pubkey, counter: &Pubkey) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*counter, false),
        ],
        data: vec![FREEZE],
    }
}
