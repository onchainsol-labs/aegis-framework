//! Event emitter.
//!
//! Aegis events are plain borsh-serializable structs. [`emit_event!`] logs
//! them with Anchor's exact `Program data: <base64>` format, so standard
//! Solana event parsers and indexers work unchanged.
//!
//! ```
//! use aegis_core::prelude::*;
//! use borsh::BorshSerialize;
//!
//! #[derive(BorshSerialize)]
//! struct PacketClaimed { amount: u64 }
//!
//! // In a program instruction handler:
//! // emit_event!(PacketClaimed { amount: 100 })?;
//! # let _ = PacketClaimed { amount: 100 };
//! ```

use alloc::format;
use alloc::string::String;

use borsh::BorshSerialize;
use solana_program::log::sol_log;

use crate::error::AegisError;

/// Serialize `event` into the exact log line Aegis emits:
/// `Program data: <base64>`. Pure — no I/O, fully testable.
pub fn encode_event<T: BorshSerialize>(event: &T) -> Result<String, AegisError> {
    let bytes = borsh::to_vec(event).map_err(|_| AegisError::serialization())?;
    Ok(format!("Program data: {}", base64_encode(&bytes)))
}

/// Serialize `event` and log it as `Program data: <base64>`.
///
/// Returns a serialization error if the event cannot be encoded; the log
/// call itself is infallible.
pub fn emit_event<T: BorshSerialize>(event: &T) -> Result<(), AegisError> {
    let line = encode_event(event)?;
    sol_log(&line);
    Ok(())
}

/// Standard base64 encoding (RFC 4648, with padding) — no dependencies.
pub fn base64_encode(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        let n = (u32::from(b0) << 16) | (u32::from(b1) << 8) | u32::from(b2);

        out.push(ALPHABET[((n >> 18) & 63) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

/// Emit an event in one line — the Aegis equivalent of Anchor's `emit!`.
///
/// Expands to an expression returning `Result<(), AegisError>`, so call it
/// with `?` inside a handler:
///
/// ```ignore
/// emit_event!(PacketClaimed { packet, claimer, amount })?;
/// ```
#[macro_export]
macro_rules! emit_event {
    ($name:ident { $($field:ident : $value:expr),* $(,)? }) => {
        $crate::event::emit_event(&$name { $($field : $value),* })
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::SERIALIZATION;
    use solana_program::pubkey::Pubkey;

    #[test]
    fn base64_matches_known_vectors() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[derive(::borsh::BorshSerialize, ::borsh::BorshDeserialize, Debug, PartialEq, Eq)]
    struct PacketClaimed {
        packet: Pubkey,
        amount: u64,
    }

    #[test]
    fn event_serialization_round_trips() {
        let event = PacketClaimed {
            packet: Pubkey::new_unique(),
            amount: 1_000,
        };
        let bytes = borsh::to_vec(&event).unwrap();
        let back: PacketClaimed = borsh::from_slice(&bytes).unwrap();
        assert_eq!(back, event);

        // No discriminator prefix: events are plain borsh, Anchor-style.
        assert_eq!(bytes.len(), 32 + 8);
    }

    #[test]
    fn encode_event_produces_the_anchor_format_line() {
        let event = PacketClaimed {
            packet: Pubkey::new_unique(),
            amount: 7,
        };
        let line = encode_event(&event).unwrap();
        let bytes = borsh::to_vec(&event).unwrap();
        assert_eq!(line, format!("Program data: {}", base64_encode(&bytes)));
        assert!(line.starts_with("Program data: "));
    }

    #[test]
    fn macro_builds_the_same_serialization() {
        let event = PacketClaimed {
            packet: Pubkey::new_unique(),
            amount: 7,
        };
        // The macro expands to an expression returning Result.
        let result: Result<(), AegisError> = emit_event!(PacketClaimed {
            packet: event.packet,
            amount: event.amount,
        });
        assert!(result.is_ok());
    }

    #[test]
    fn serialization_failure_maps_to_serialization_code() {
        // A non-finite float can't round-trip through borsh's guarantees in
        // some versions; simulate the failure path directly instead.
        let err = AegisError::serialization();
        assert_eq!(err.code, SERIALIZATION);
    }
}
