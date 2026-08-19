//! The Aegis error registry (D3).
//!
//! Every Aegis program error is a `u32` code plus a `&'static str` message.
//! Codes `1..=999` are reserved for Aegis Core itself; application errors
//! start at `6000` (the same convention Anchor uses, so migrations are
//! non-breaking).
//!
//! ```
//! use aegis_core::prelude::*;
//!
//! aegis_error! {
//!     pub enum CounterError {
//!         Unauthorized = 6000 => "Only the authority may do this",
//!         Overflow = 6001, // no message: the variant name is used
//!     }
//! }
//!
//! assert_eq!(CounterError::Unauthorized.code(), 6000);
//! assert_eq!(CounterError::Overflow.message(), "Overflow");
//! ```

use core::fmt;

use solana_program::program_error::ProgramError;

/// Core-internal error: an account's discriminator did not match its type.
pub const WRONG_DISCRIMINATOR: u32 = 1;
/// Core-internal error: a state machine was asked to make an illegal move.
pub const ILLEGAL_STATE_TRANSITION: u32 = 2;
/// Core-internal error: subtracting `amount` from `remaining` would underflow.
pub const AMOUNT_EXCEEDS_REMAINING: u32 = 3;
/// Core-internal error: an account's address is not the expected PDA.
pub const PDA_MISMATCH: u32 = 4;
/// Core-internal error: borsh serialization or deserialization failed.
pub const SERIALIZATION: u32 = 5;
/// Core-internal error: a checked arithmetic operation overflowed.
pub const ARITHMETIC_OVERFLOW: u32 = 6;
/// Core-internal error: a PDA seed could not derive an address.
pub const INVALID_PDA_SEED: u32 = 7;
/// Core-internal error: an account buffer is too small for the serialized state.
pub const ACCOUNT_TOO_SMALL: u32 = 8;

/// The universal Aegis error: a code plus a human-readable message.
///
/// App enums created with [`aegis_error!`](crate::error::aegis_error) convert
/// into this type, which then converts into `ProgramError::Custom(code)`
/// — so one error shape flows through the whole framework.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AegisError {
    /// Numeric exit code reported back to the client.
    pub code: u32,
    /// Static, human-readable description (no allocation).
    pub message: &'static str,
}

impl AegisError {
    /// Build an error from a code and a static message.
    pub const fn new(code: u32, message: &'static str) -> Self {
        Self { code, message }
    }

    /// The account discriminator did not match the expected type.
    pub const fn wrong_discriminator() -> Self {
        Self::new(WRONG_DISCRIMINATOR, "Account discriminator mismatch")
    }

    /// A state machine was asked to make an illegal move.
    pub const fn illegal_state_transition() -> Self {
        Self::new(
            ILLEGAL_STATE_TRANSITION,
            "Illegal state transition — the status cannot move that way",
        )
    }

    /// Subtracting `amount` from `remaining` would underflow.
    pub const fn amount_exceeds_remaining() -> Self {
        Self::new(
            AMOUNT_EXCEEDS_REMAINING,
            "Amount exceeds the remaining balance",
        )
    }

    /// An account address is not the expected PDA.
    pub const fn pda_mismatch() -> Self {
        Self::new(PDA_MISMATCH, "Account is not the expected PDA")
    }

    /// Borsh serialization or deserialization failed.
    pub const fn serialization() -> Self {
        Self::new(SERIALIZATION, "Serialization failed")
    }

    /// A checked arithmetic operation overflowed.
    pub const fn arithmetic_overflow() -> Self {
        Self::new(ARITHMETIC_OVERFLOW, "Arithmetic overflow")
    }

    /// A PDA seed could not derive an address.
    pub const fn invalid_pda_seed() -> Self {
        Self::new(INVALID_PDA_SEED, "Invalid PDA seed")
    }

    /// An account buffer is too small for the serialized state.
    pub const fn account_too_small() -> Self {
        Self::new(ACCOUNT_TOO_SMALL, "Account buffer too small")
    }
}

impl fmt::Display for AegisError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "AegisError {}: {}", self.code, self.message)
    }
}

impl From<AegisError> for ProgramError {
    fn from(err: AegisError) -> Self {
        ProgramError::Custom(err.code)
    }
}

/// Declare an application error enum in one line per variant.
///
/// ```ignore
/// aegis_error! {
///     pub enum PacketError {
///         Unauthorized = 6000 => "Unauthorized",
///         Expired = 6001, // message defaults to the variant name
///     }
/// }
/// ```
///
/// The macro generates the enum (with `Debug, Clone, Copy, PartialEq, Eq`),
/// a `code()` accessor, a `message()` accessor, `Display`, and conversions
/// to both [`AegisError`] and [`ProgramError`].
///
/// The message string is optional — without one, the variant name is used.
/// (Variant attributes arrive with proc-macros in v1.)
#[macro_export]
macro_rules! aegis_error {
    ($vis:vis enum $name:ident { $($body:tt)* }) => {
        $crate::__aegis_error_munch! {
            $vis $name () ()
            $($body)*
        }
    };
}

/// Internal TT-muncher for [`aegis_error!`](crate::error::aegis_error).
///
/// Eats variants one at a time, collecting enum defs and `(variant, code,
/// message)` triples, then emits the enum and its impls. The
/// `$(, $($rest:tt)*)?` tail makes trailing commas legal in every position.
#[doc(hidden)]
#[macro_export]
macro_rules! __aegis_error_munch {
    // A variant WITH an explicit message.
    (
        $vis:vis $name:ident
        ($($defs:tt)*) ($($triples:tt)*)
        $variant:ident = $code:expr => $msg:expr
        $(, $($rest:tt)*)?
    ) => {
        $crate::__aegis_error_munch! {
            $vis $name
            ($($defs)* $variant = $code,)
            ($($triples)* ($variant, $code, $msg))
            $($($rest)*)?
        }
    };
    // A variant WITHOUT a message — the variant name becomes the message.
    (
        $vis:vis $name:ident
        ($($defs:tt)*) ($($triples:tt)*)
        $variant:ident = $code:expr
        $(, $($rest:tt)*)?
    ) => {
        $crate::__aegis_error_munch! {
            $vis $name
            ($($defs)* $variant = $code,)
            ($($triples)* ($variant, $code, stringify!($variant)))
            $($($rest)*)?
        }
    };
    // Done — emit the enum and everything attached to it.
    (
        $vis:vis $name:ident
        ($($defs:tt)*) ($(($variant:ident, $code:expr, $msg:expr))*)
    ) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        $vis enum $name {
            $($defs)*
        }

        impl $name {
            /// Numeric exit code reported back to the client.
            pub fn code(&self) -> u32 {
                match self {
                    $(Self::$variant => $code,)*
                }
            }

            /// Static, human-readable description.
            pub fn message(&self) -> &'static str {
                match self {
                    $(Self::$variant => $msg,)*
                }
            }
        }

        impl core::fmt::Display for $name {
            fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
                write!(f, "{}", self.message())
            }
        }

        impl From<$name> for $crate::error::AegisError {
            fn from(err: $name) -> Self {
                Self::new(err.code(), err.message())
            }
        }

        impl From<$name> for ::solana_program::program_error::ProgramError {
            fn from(err: $name) -> Self {
                ::solana_program::program_error::ProgramError::Custom(err.code())
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    aegis_error! {
        pub enum TestError {
            Unauthorized = 6000 => "Only the authority may do this",
            Overflow = 6001,
        }
    }

    #[test]
    fn explicit_message_round_trips() {
        let err = TestError::Unauthorized;
        assert_eq!(err.code(), 6000);
        assert_eq!(err.message(), "Only the authority may do this");
        assert_eq!(format!("{err}"), "Only the authority may do this");
    }

    #[test]
    fn variant_name_is_the_default_message() {
        assert_eq!(TestError::Overflow.code(), 6001);
        assert_eq!(TestError::Overflow.message(), "Overflow");
    }

    #[test]
    fn converts_to_aegis_error() {
        let aegis: AegisError = TestError::Unauthorized.into();
        assert_eq!(aegis.code, 6000);
        assert_eq!(aegis.message, "Only the authority may do this");
    }

    #[test]
    fn converts_to_program_error() {
        let program: ProgramError = TestError::Overflow.into();
        assert_eq!(program, ProgramError::Custom(6001));
    }

    #[test]
    fn single_variant_with_trailing_comma_works() {
        aegis_error! {
            enum Solo {
                Only = 6000 => "just one",
            }
        }
        assert_eq!(Solo::Only.code(), 6000);
    }

    #[test]
    fn internal_codes_stay_below_1000() {
        assert_eq!(AegisError::wrong_discriminator().code, WRONG_DISCRIMINATOR);
        assert_eq!(
            AegisError::illegal_state_transition().code,
            ILLEGAL_STATE_TRANSITION
        );
        assert_eq!(
            AegisError::amount_exceeds_remaining().code,
            AMOUNT_EXCEEDS_REMAINING
        );
        assert_eq!(AegisError::pda_mismatch().code, PDA_MISMATCH);
        assert_eq!(AegisError::serialization().code, SERIALIZATION);
        assert_eq!(AegisError::arithmetic_overflow().code, ARITHMETIC_OVERFLOW);
        assert_eq!(AegisError::invalid_pda_seed().code, INVALID_PDA_SEED);
        assert_eq!(AegisError::account_too_small().code, ACCOUNT_TOO_SMALL);
        for ctor in [
            AegisError::wrong_discriminator,
            AegisError::illegal_state_transition,
            AegisError::amount_exceeds_remaining,
            AegisError::pda_mismatch,
            AegisError::serialization,
            AegisError::arithmetic_overflow,
            AegisError::invalid_pda_seed,
            AegisError::account_too_small,
        ] {
            assert!(ctor().code < 1000, "internal code must stay below 1000");
        }
    }

    #[test]
    fn displays_full_error() {
        let err = AegisError::new(7, "boom");
        assert_eq!(format!("{err}"), "AegisError 7: boom");
    }
}
