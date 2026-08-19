//! PDA utilities: find, validate, sign (D7).
//!
//! The single most common Solana bug class is a missing or wrong PDA check.
//! [`AegisPda`] bundles the three things every PDA needs — deriving the
//! address, validating an account against it, and producing signer seeds
//! for `invoke_signed` — so the check and the signing always use the same
//! seeds.
//!
//! ```
//! use aegis_core::prelude::*;
//! use solana_program::pubkey::Pubkey;
//!
//! let program = Pubkey::new_unique();
//! let pda = AegisPda::find(&program, &[b"vault", b"packet-1"]);
//!
//! assert!(pda.validate(&pda.address()).is_ok());
//! assert!(pda.validate(&Pubkey::new_unique()).is_err());
//!
//! let seeds = pda.signer_seeds();
//! assert_eq!(seeds[0], b"vault");
//! assert_eq!(seeds[1], b"packet-1");
//! assert_eq!(seeds[2], &[pda.bump()]);
//! ```

use alloc::vec::Vec;

use solana_program::pubkey::Pubkey;

use crate::error::AegisError;

/// A derived program address plus everything needed to use it safely.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AegisPda {
    program_id: Pubkey,
    seeds: Vec<Vec<u8>>,
    address: Pubkey,
    /// Stored as a single-byte array so `signer_seeds()` can lend it out.
    bump: [u8; 1],
}

impl AegisPda {
    /// Derive the canonical PDA (the first valid bump) for `seeds`.
    pub fn find(program_id: &Pubkey, seeds: &[&[u8]]) -> Self {
        let (address, bump) = Pubkey::find_program_address(seeds, program_id);
        Self::from_parts(
            *program_id,
            seeds.iter().map(|s| s.to_vec()).collect(),
            address,
            bump,
        )
    }

    /// Derive a PDA with an explicit bump (e.g. a stored non-canonical bump).
    pub fn find_with_bump(
        program_id: &Pubkey,
        seeds: &[&[u8]],
        bump: u8,
    ) -> Result<Self, AegisError> {
        let mut all: Vec<&[u8]> = seeds.to_vec();
        let bump_slice = [bump];
        all.push(&bump_slice);
        let address = Pubkey::create_program_address(&all, program_id)
            .map_err(|_| AegisError::invalid_pda_seed())?;
        Ok(Self::from_parts(
            *program_id,
            seeds.iter().map(|s| s.to_vec()).collect(),
            address,
            bump,
        ))
    }

    fn from_parts(program_id: Pubkey, seeds: Vec<Vec<u8>>, address: Pubkey, bump: u8) -> Self {
        Self {
            program_id,
            seeds,
            address,
            bump: [bump],
        }
    }

    /// The derived address of this PDA.
    pub fn address(&self) -> Pubkey {
        self.address
    }

    /// The canonical bump byte (escape hatch: usable anywhere a bump is needed).
    pub fn bump(&self) -> u8 {
        self.bump[0]
    }

    /// The program that owns this PDA.
    pub fn program_id(&self) -> Pubkey {
        self.program_id
    }

    /// The raw seeds without the bump (escape hatch).
    pub fn seeds(&self) -> &[Vec<u8>] {
        &self.seeds
    }

    /// Re-derive and compare — one line answers "is this the account we think?"
    pub fn validate(&self, actual: &Pubkey) -> Result<(), AegisError> {
        if self.address == *actual {
            Ok(())
        } else {
            Err(AegisError::pda_mismatch())
        }
    }

    /// Seeds plus bump, ready for `invoke_signed`.
    ///
    /// ```ignore
    /// let seeds = pda.signer_seeds();
    /// invoke_signed(&ix, &accounts, &[&seeds[..]])?;
    /// ```
    pub fn signer_seeds(&self) -> Vec<&[u8]> {
        let mut out: Vec<&[u8]> = self.seeds.iter().map(|s| s.as_slice()).collect();
        out.push(&self.bump);
        out
    }
}

/// Re-exported so callers can pattern-match derivation failures.
pub use solana_program::pubkey::PubkeyError as PdaDerivationError;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{INVALID_PDA_SEED, PDA_MISMATCH};

    #[test]
    fn find_derives_and_validates() {
        let program = Pubkey::new_unique();
        let pda = AegisPda::find(&program, &[b"vault", b"packet-1"]);
        assert_eq!(pda.program_id(), program);
        assert!(pda.validate(&pda.address()).is_ok());
        assert!(pda.bump() < 255);
    }

    #[test]
    fn wrong_address_fails_validation() {
        let program = Pubkey::new_unique();
        let pda = AegisPda::find(&program, &[b"vault"]);
        let err = pda.validate(&Pubkey::new_unique()).unwrap_err();
        assert_eq!(err.code, PDA_MISMATCH);
    }

    #[test]
    fn signer_seeds_match_the_derivation() {
        let program = Pubkey::new_unique();
        let pda = AegisPda::find(&program, &[b"vault", b"packet-1"]);
        let seeds = pda.signer_seeds();
        assert_eq!(seeds.len(), 3);
        assert_eq!(seeds[0], b"vault");
        assert_eq!(seeds[1], b"packet-1");
        assert_eq!(seeds[2], &[pda.bump()]);
    }

    #[test]
    fn explicit_bump_recreates_the_canonical_address() {
        let program = Pubkey::new_unique();
        let canonical = AegisPda::find(&program, &[b"vault"]);
        let explicit = AegisPda::find_with_bump(&program, &[b"vault"], canonical.bump()).unwrap();
        assert_eq!(explicit.address(), canonical.address());
        assert!(explicit.validate(&canonical.address()).is_ok());
    }

    #[test]
    fn wrong_explicit_bump_is_rejected_either_way() {
        let program = Pubkey::new_unique();
        let canonical = AegisPda::find(&program, &[b"vault"]);
        let wrong_bump = canonical.bump().wrapping_add(1).min(255);
        match AegisPda::find_with_bump(&program, &[b"vault"], wrong_bump) {
            // Some bumps are off-curve and cannot derive at all — also a rejection.
            Err(err) => assert_eq!(err.code, INVALID_PDA_SEED),
            // Others derive but to a different address — validation must fail.
            Ok(pda) => assert!(pda.validate(&canonical.address()).is_err()),
        }
    }

    #[test]
    fn seed_that_cannot_derive_errors_cleanly() {
        // A bump of 255 with seeds longer than 32 bytes is un-derivable in
        // practice; the important part is the error maps to INVALID_PDA_SEED.
        let program = Pubkey::new_unique();
        let long_seed = [7u8; 40];
        let result = AegisPda::find_with_bump(&program, &[&long_seed[..]], 0);
        if let Err(err) = result {
            assert_eq!(err.code, INVALID_PDA_SEED);
        } else if let Ok(pda) = result {
            // Some seed/bump pairs still derive; in that case validation
            // against the canonical PDA must simply not falsely pass.
            let canonical = AegisPda::find(&program, &[&long_seed[..]]);
            if pda.bump() != canonical.bump() {
                assert!(pda.validate(&canonical.address()).is_err());
            }
        }
    }
}
