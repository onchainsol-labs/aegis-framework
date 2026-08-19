//! Aegis Core — the secure application framework for Solana.
//!
//! Aegis Core is a Rust crate that gives Solana programs the abstractions
//! they keep hand-writing: account structure, state transition guards,
//! PDA utilities, checked token transfers, an error registry, and events.
//!
//! Every abstraction has an escape hatch — the raw Solana primitives are
//! always reachable, so Aegis never walls you off from the runtime.
//!
//! # Example
//!
//! ```ignore
//! use aegis_core::prelude::*;
//!
//! aegis_error! {
//!     pub enum CounterError {
//!         Unauthorized = 6000 => "Only the authority may do this",
//!         Overflow = 6001 => "Counter would overflow",
//!     }
//! }
//!
//! aegis_account! {
//!     pub struct Counter {
//!         pub authority: Pubkey,
//!         pub count: u64,
//!     }
//! }
//! ```

#![cfg_attr(not(test), no_std)]
#![deny(missing_docs)]
#![cfg_attr(not(test), forbid(unsafe_code))]

extern crate alloc;

pub mod account;
pub mod error;
pub mod event;
pub mod hash;
pub mod pda;
pub mod state;
pub mod tokens;

/// One-line import for everything an Aegis program needs.
pub mod prelude {
    pub use crate::account::AegisAccount;
    pub use crate::aegis_account;
    pub use crate::aegis_error;
    pub use crate::emit_event;
    pub use crate::error::AegisError;
    pub use crate::event::emit_event;
    pub use crate::hash::sha256;
    pub use crate::pda::AegisPda;
    pub use crate::state::{require_state, transition};
    pub use crate::tokens::{checked_amount, close_account, transfer_checked};
}
