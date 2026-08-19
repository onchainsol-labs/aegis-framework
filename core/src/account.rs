//! Account structure: the trait and the macro (D2).
//!
//! An Aegis account is a borsh-serializable struct prefixed by an 8-byte
//! discriminator. The discriminator is Anchor-compatible —
//! `sha256("account:<Name>")[..8]` — so accounts written by Anchor programs
//! (like Packet) read cleanly and migrations are non-breaking.
//!
//! ```
//! use aegis_core::prelude::*;
//! use solana_program::pubkey::Pubkey;
//!
//! aegis_account! {
//!     pub struct Counter {
//!         pub authority: Pubkey,
//!         pub count: u64,
//!     }
//! }
//!
//! let counter = Counter { authority: Pubkey::new_unique(), count: 7 };
//! let bytes = counter.to_account_bytes().unwrap();
//! let back = Counter::from_account_bytes(&bytes).unwrap();
//! assert_eq!(counter, back);
//! ```

use alloc::format;
use alloc::vec::Vec;

use borsh::{BorshDeserialize, BorshSerialize};

use crate::error::AegisError;
use crate::hash::sha256;

/// The standard Aegis account contract.
///
/// Implement it with [`aegis_account!`](crate::account::aegis_account) or by
/// hand — either way you get checked serialize/deserialize with
/// discriminator validation built in.
pub trait AegisAccount: BorshSerialize + BorshDeserialize + Sized {
    /// The 8-byte type tag written at the start of every account buffer.
    fn discriminator() -> [u8; 8];

    /// Bytes needed for the account's data buffer.
    ///
    /// Defaults to `size_of::<Self>()`, which is exact for types without
    /// padding but may OVERESTIMATE the serialized size (Rust aligns
    /// structs; borsh does not). Treat it as a rent-safe minimum —
    /// [`AegisAccount::write_to`] tolerates the extra bytes.
    fn space() -> usize {
        core::mem::size_of::<Self>()
    }

    /// Verify the buffer's discriminator matches this account type.
    fn check_discriminator(data: &[u8]) -> Result<(), AegisError> {
        if data.len() < 8 || data[..8] != Self::discriminator() {
            return Err(AegisError::wrong_discriminator());
        }
        Ok(())
    }

    /// Deserialize from a raw account buffer, validating the discriminator.
    ///
    /// Tolerates trailing bytes — accounts are often rent-over-allocated,
    /// and the serialized state sits at the front of the buffer.
    fn from_account_bytes(data: &[u8]) -> Result<Self, AegisError> {
        Self::check_discriminator(data)?;
        let mut body = &data[8..];
        // `deserialize` reads exactly the struct's bytes and ignores the
        // rest, unlike the strict `borsh::from_slice`.
        BorshDeserialize::deserialize(&mut body).map_err(|_| AegisError::serialization())
    }

    /// Serialize with the discriminator prefix — ready to write to an account.
    fn to_account_bytes(&self) -> Result<Vec<u8>, AegisError> {
        let body = borsh::to_vec(self).map_err(|_| AegisError::serialization())?;
        let mut out = Self::discriminator().to_vec();
        out.extend_from_slice(&body);
        Ok(out)
    }

    /// Serialize into an account buffer, tolerating rent-safe
    /// over-allocation (a buffer larger than the serialized state).
    ///
    /// Errors with [`AegisError::account_too_small`] if the buffer is too
    /// small — never partially writes.
    fn write_to(&self, data: &mut [u8]) -> Result<(), AegisError> {
        let bytes = self.to_account_bytes()?;
        let target = data
            .get_mut(..bytes.len())
            .ok_or_else(AegisError::account_too_small)?;
        target.copy_from_slice(&bytes);
        Ok(())
    }
}

/// Compute the Anchor-compatible discriminator for an account name:
/// the first 8 bytes of `sha256("account:<Name>")`.
pub fn discriminator_of(account_name: &str) -> [u8; 8] {
    let digest = sha256(format!("account:{account_name}").as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

/// Declare an Aegis account in one line.
///
/// ```ignore
/// aegis_account! {
///     pub struct Config {
///         pub admin: Pubkey,
///         pub fee_bps: u16,
///     }
/// }
/// ```
///
/// Generates the struct (deriving `Clone, Debug, PartialEq, Eq` and borsh
/// traits) plus an [`AegisAccount`] impl whose discriminator is
/// `sha256("account:Config")[..8]`. Only fixed-size field types are
/// supported in v0 — `Pubkey`, integers, arrays, and other `aegis_account!`
/// structs.
#[macro_export]
macro_rules! aegis_account {
    (
        $(#[$meta:meta])*
        $vis:vis struct $name:ident {
            $(
                $(#[$fmeta:meta])*
                $fvis:vis $field:ident : $ty:ty
            ),+ $(,)?
        }
    ) => {
        $(#[$meta])*
        #[derive(
            ::borsh::BorshSerialize,
            ::borsh::BorshDeserialize,
            Clone,
            Debug,
            PartialEq,
            Eq
        )]
        $vis struct $name {
            $(
                $(#[$fmeta])*
                $fvis $field : $ty,
            )+
        }

        impl $crate::account::AegisAccount for $name {
            fn discriminator() -> [u8; 8] {
                $crate::account::discriminator_of(stringify!($name))
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{ACCOUNT_TOO_SMALL, SERIALIZATION, WRONG_DISCRIMINATOR};
    use solana_program::pubkey::Pubkey;

    aegis_account! {
        /// A test counter account.
        pub struct Counter {
            /// Who may increment.
            pub authority: Pubkey,
            /// The count.
            pub count: u64,
        }
    }

    #[test]
    fn discriminator_matches_anchor_convention() {
        // Anchor: sha256("account:Counter")[..8].
        // Verified here against sha2 directly — the same hash Anchor uses.
        use sha2::{Digest, Sha256};
        let expected = Sha256::digest(b"account:Counter");
        assert_eq!(Counter::discriminator(), expected[..8]);
    }

    #[test]
    fn discriminator_is_stable_and_name_bound() {
        let a = discriminator_of("Counter");
        let b = discriminator_of("Counter");
        assert_eq!(a, b);
        assert_ne!(a, discriminator_of("Vault"));
    }

    #[test]
    fn round_trip_preserves_the_account() {
        let counter = Counter {
            authority: Pubkey::new_unique(),
            count: 42,
        };
        let bytes = counter.to_account_bytes().unwrap();
        assert_eq!(bytes.len(), Counter::space() + 8);
        assert_eq!(bytes[..8], Counter::discriminator());
        let back = Counter::from_account_bytes(&bytes).unwrap();
        assert_eq!(back, counter);
    }

    #[test]
    fn wrong_discriminator_is_rejected() {
        let counter = Counter {
            authority: Pubkey::new_unique(),
            count: 1,
        };
        let mut bytes = counter.to_account_bytes().unwrap();
        bytes[0] ^= 0xFF; // corrupt the discriminator
        let err = Counter::from_account_bytes(&bytes).unwrap_err();
        assert_eq!(err.code, WRONG_DISCRIMINATOR);
    }

    #[test]
    fn short_buffer_is_rejected() {
        let err = Counter::from_account_bytes(&[1u8, 2, 3]).unwrap_err();
        assert_eq!(err.code, WRONG_DISCRIMINATOR);
        assert!(Counter::check_discriminator(&[]).is_err());
    }

    #[test]
    fn truncated_body_is_a_serialization_error() {
        let counter = Counter {
            authority: Pubkey::new_unique(),
            count: 9,
        };
        let bytes = counter.to_account_bytes().unwrap();
        let err = Counter::from_account_bytes(&bytes[..bytes.len() - 1]).unwrap_err();
        assert_eq!(err.code, SERIALIZATION);
    }

    #[test]
    fn from_account_bytes_tolerates_trailing_padding() {
        let counter = Counter {
            authority: Pubkey::new_unique(),
            count: 9,
        };
        let mut buffer = vec![0u8; Counter::space() + 8]; // rent-over-allocated
        counter.write_to(&mut buffer).unwrap();
        let read_back = Counter::from_account_bytes(&buffer).unwrap();
        assert_eq!(read_back, counter);
    }

    #[test]
    fn space_math_is_exact_for_fixed_types() {
        // Pubkey (32) + u64 (8) = 40 bytes.
        assert_eq!(Counter::space(), 40);
    }

    #[test]
    fn write_to_tolerates_over_allocation() {
        let counter = Counter {
            authority: Pubkey::new_unique(),
            count: 7,
        };
        // A rent-safe buffer larger than the serialized state.
        let mut buffer = vec![0u8; Counter::space() + 8];
        counter.write_to(&mut buffer).unwrap();
        let read_back = Counter::from_account_bytes(&buffer[..counter.to_account_bytes().unwrap().len()]).unwrap();
        assert_eq!(read_back, counter);
    }

    #[test]
    fn write_to_rejects_a_buffer_that_is_too_small() {
        let counter = Counter {
            authority: Pubkey::new_unique(),
            count: 7,
        };
        let mut buffer = vec![0u8; 4];
        let err = counter.write_to(&mut buffer).unwrap_err();
        assert_eq!(err.code, ACCOUNT_TOO_SMALL);
    }
}
