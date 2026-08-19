//! State transition guards (D6).
//!
//! Solana state lives in accounts, and every status change is an attack
//! surface: a claim moving `Active → Closed` skipping `Completed`, a refund
//! after a close. These guards make the legal moves explicit and everything
//! else a compile-checked failure.
//!
//! ```
//! use aegis_core::prelude::*;
//!
//! #[derive(Debug, Clone, Copy, PartialEq, Eq)]
//! enum Status { Active, Completed, Closed }
//!
//! let mut status = Status::Active;
//! require_state(&status, Status::Active).unwrap();
//! transition(&mut status, Status::Active, Status::Completed).unwrap();
//! assert!(transition(&mut status, Status::Active, Status::Closed).is_err());
//! ```

use core::fmt::Debug;

use crate::error::AegisError;

/// Require the current state to equal `expected` before proceeding.
///
/// The cheapest guard in the framework and the most common one in real
/// programs: "this instruction only makes sense while the packet is Active".
pub fn require_state<T: PartialEq + Debug>(current: &T, expected: T) -> Result<(), AegisError> {
    if *current == expected {
        Ok(())
    } else {
        Err(AegisError::illegal_state_transition())
    }
}

/// Move a state slot from `from` to `to` — and reject any other move.
///
/// This is the stronger form of [`require_state`]: it checks the current
/// value *and* performs the assignment, so the check and the write can
/// never drift apart:
///
/// ```ignore
/// transition(&mut packet.status, PacketStatus::Active, PacketStatus::Completed)?;
/// ```
pub fn transition<T: PartialEq + Copy + Debug>(
    slot: &mut T,
    from: T,
    to: T,
) -> Result<(), AegisError> {
    if *slot == from {
        *slot = to;
        Ok(())
    } else {
        Err(AegisError::illegal_state_transition())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ILLEGAL_STATE_TRANSITION;

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum Status {
        Active,
        Completed,
        Closed,
    }

    #[test]
    fn require_state_passes_on_match() {
        let status = Status::Active;
        assert!(require_state(&status, Status::Active).is_ok());
    }

    #[test]
    fn require_state_fails_on_mismatch() {
        let status = Status::Closed;
        let err = require_state(&status, Status::Active).unwrap_err();
        assert_eq!(err.code, ILLEGAL_STATE_TRANSITION);
    }

    #[test]
    fn legal_transition_moves_the_slot() {
        let mut status = Status::Active;
        transition(&mut status, Status::Active, Status::Completed).unwrap();
        assert_eq!(status, Status::Completed);
    }

    #[test]
    fn failed_transition_leaves_the_slot_untouched() {
        let mut status = Status::Active;
        // The slot is Active but the handler declared Completed → Closed.
        // The mismatch is rejected and nothing is written.
        let err = transition(&mut status, Status::Completed, Status::Closed).unwrap_err();
        assert_eq!(err.code, ILLEGAL_STATE_TRANSITION);
        assert_eq!(status, Status::Active);
    }

    #[test]
    fn moving_from_the_wrong_current_state_is_rejected() {
        let mut status = Status::Completed;
        let err = transition(&mut status, Status::Active, Status::Closed).unwrap_err();
        assert_eq!(err.code, ILLEGAL_STATE_TRANSITION);
        assert_eq!(status, Status::Completed);
    }

    #[test]
    fn guards_work_on_non_enum_copies() {
        let mut level: u8 = 3;
        transition(&mut level, 3, 4).unwrap();
        assert_eq!(level, 4);
        assert!(transition(&mut level, 3, 5).is_err());
    }
}
