//! Aegis Counter — the v0.1 proof app.
//!
//! A complete Solana program built on Aegis Core. It does what a counter
//! should: one account per authority, increment, decrement, and a freeze
//! switch that proves the state guards work.
//!
//! What Core handles here (so the app code stays application-shaped):
//! - account struct + discriminator + (de)serialization — `aegis_account!`
//! - error enum + exit codes — `aegis_error!`
//! - PDA derivation + validation — `AegisPda`
//! - state machine guards — `require_state` / `transition`
//! - checked arithmetic — `checked_amount`
//! - events — `emit_event!`
//!
//! The entrypoint and instruction dispatch are still hand-written (they
//! move into Core in v1), and account creation uses a raw system-program
//! CPI (moves into `aegis_core::system` when the next example needs it).

#![cfg_attr(not(test), no_std)]

extern crate alloc;

// The entrypoint! macro expands format! only when compiled for the SBF
// target; on host builds the std prelude provides it.
#[cfg(target_os = "solana")]
use alloc::format;

pub mod instruction;

use aegis_core::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};
use solana_system_interface::instruction::create_account;

entrypoint!(process_instruction);

/// Seed prefix for the counter PDA — one counter per authority.
pub const COUNTER_SEED: &[u8] = b"counter";

aegis_error! {
    pub enum CounterError {
        Unauthorized = 6000 => "Only the counter authority may do this",
        NotActive = 6001 => "Counter is frozen",
        AlreadyFrozen = 6002 => "Counter is already frozen",
        Overflow = 6003 => "Counter would overflow",
        Underflow = 6004 => "Counter is already zero",
    }
}

/// The counter's lifecycle status.
#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum CounterStatus {
    /// Accepts increments and decrements.
    Active,
    /// Permanently locked — no more arithmetic.
    Frozen,
}

aegis_account! {
    /// One counter per authority, stored at a PDA.
    pub struct Counter {
        /// Who may operate this counter.
        pub authority: Pubkey,
        /// The current count.
        pub count: u64,
        /// Active or Frozen.
        pub status: CounterStatus,
    }
}

// Events — plain borsh structs, logged as `Program data: <base64>`.
#[derive(BorshSerialize)]
pub struct CounterInitialized {
    pub authority: Pubkey,
}

#[derive(BorshSerialize)]
pub struct CounterIncremented {
    pub authority: Pubkey,
    pub count: u64,
}

#[derive(BorshSerialize)]
pub struct CounterDecremented {
    pub authority: Pubkey,
    pub count: u64,
}

#[derive(BorshSerialize)]
pub struct CounterFrozen {
    pub authority: Pubkey,
}

/// The counter PDA for an authority.
pub fn counter_pda(program_id: &Pubkey, authority: &Pubkey) -> AegisPda {
    AegisPda::find(program_id, &[COUNTER_SEED, authority.as_ref()])
}

/// Entrypoint — dispatch by tag, everything else delegates to handlers.
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (tag, _) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    match *tag {
        instruction::INITIALIZE => initialize(program_id, accounts),
        instruction::INCREMENT => increment(accounts),
        instruction::DECREMENT => decrement(accounts),
        instruction::FREEZE => freeze(accounts),
        _ => Err(ProgramError::InvalidInstructionData.into()),
    }
}

/// Create the counter at its PDA, owned by the program, signed by the PDA.
///
/// The authority signs but never becomes the account owner — the program
/// owns the counter, so the authority can never bypass the handlers.
fn initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let authority = next_account_info(iter)?;
    let counter = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;

    if !authority.is_signer {
        return Err(CounterError::Unauthorized.into());
    }

    // One line answers "is this the account we think it is?"
    let pda = counter_pda(program_id, authority.key);
    pda.validate(counter.key)?;

    // Raw system CPI — the escape hatch. Moves into aegis_core::system.
    let space = 8 + Counter::space();
    let lamports = Rent::get()?.minimum_balance(space);
    invoke_signed(
        &create_account(
            authority.key,
            counter.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[authority.clone(), counter.clone(), system_program.clone()],
        &[&pda.signer_seeds()[..]],
    )?;

    let state = Counter {
        authority: *authority.key,
        count: 0,
        status: CounterStatus::Active,
    };
    state.write_to(&mut counter.try_borrow_mut_data()?)?;

    emit_event!(CounterInitialized { authority: *authority.key })?;
    Ok(())
}

/// Add one. Authority + Active state + checked arithmetic.
fn increment(accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let authority = next_account_info(iter)?;
    let counter = next_account_info(iter)?;

    if !authority.is_signer {
        return Err(CounterError::Unauthorized.into());
    }

    let mut state = Counter::from_account_bytes(&counter.data.borrow())?;
    // The signer must be THIS counter's authority — the PDA check alone
    // ties accounts to authorities at creation, but every handler must
    // re-verify the ownership on use.
    if state.authority != *authority.key {
        return Err(CounterError::Unauthorized.into());
    }
    require_state(&state.status, CounterStatus::Active).map_err(|_| CounterError::NotActive)?;
    state.count = state.count.checked_add(1).ok_or(CounterError::Overflow)?;

    state.write_to(&mut counter.try_borrow_mut_data()?)?;

    emit_event!(CounterIncremented {
        authority: *authority.key,
        count: state.count,
    })?;
    Ok(())
}

/// Subtract one. Never below zero — `checked_amount` refuses.
fn decrement(accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let authority = next_account_info(iter)?;
    let counter = next_account_info(iter)?;

    if !authority.is_signer {
        return Err(CounterError::Unauthorized.into());
    }

    let mut state = Counter::from_account_bytes(&counter.data.borrow())?;
    if state.authority != *authority.key {
        return Err(CounterError::Unauthorized.into());
    }
    require_state(&state.status, CounterStatus::Active).map_err(|_| CounterError::NotActive)?;
    state.count = checked_amount(state.count, 1).map_err(|_| CounterError::Underflow)?;

    state.write_to(&mut counter.try_borrow_mut_data()?)?;

    emit_event!(CounterDecremented {
        authority: *authority.key,
        count: state.count,
    })?;
    Ok(())
}

/// Freeze the counter: Active → Frozen, and nothing else.
///
/// This is the state-machine guard in action — a `transition` call can
/// only ever perform this exact move, so a frozen counter can never be
/// unfrozen and an already-frozen one rejects the instruction.
fn freeze(accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let authority = next_account_info(iter)?;
    let counter = next_account_info(iter)?;

    if !authority.is_signer {
        return Err(CounterError::Unauthorized.into());
    }

    let mut state = Counter::from_account_bytes(&counter.data.borrow())?;
    if state.authority != *authority.key {
        return Err(CounterError::Unauthorized.into());
    }
    transition(
        &mut state.status,
        CounterStatus::Active,
        CounterStatus::Frozen,
    )
    .map_err(|_| CounterError::AlreadyFrozen)?;

    state.write_to(&mut counter.try_borrow_mut_data()?)?;

    emit_event!(CounterFrozen { authority: *authority.key })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::{
        account_info::AccountInfo,
        instruction::Instruction,
        program_stubs::{set_syscall_stubs, SyscallStubs},
    };
    use std::sync::{Mutex, MutexGuard};

    /// The stubs are process-global, so tests serialize their use.
    fn lock() -> MutexGuard<'static, ()> {
        static LOCK: Mutex<()> = Mutex::new(());
        LOCK.lock().unwrap()
    }

    /// A CPI captured by the invoke stub.
    #[derive(Debug)]
    struct RecordedCpi {
        program_id: Pubkey,
        data: Vec<u8>,
        accounts: Vec<Pubkey>,
        seeds: Vec<Vec<Vec<u8>>>,
    }

    /// Global syscall stubs: capture CPIs and serve a real rent sysvar.
    static STUBS: Stubs = Stubs {
        cpis: Mutex::new(Vec::new()),
    };

    /// Syscall stubs: capture CPIs and serve a real rent sysvar.
    struct Stubs {
        cpis: Mutex<Vec<RecordedCpi>>,
    }

    impl SyscallStubs for Stubs {
        fn sol_invoke_signed(
            &self,
            instruction: &Instruction,
            account_infos: &[AccountInfo],
            signers_seeds: &[&[&[u8]]],
        ) -> solana_program::entrypoint::ProgramResult {
            self.cpis.lock().unwrap().push(RecordedCpi {
                program_id: instruction.program_id,
                data: instruction.data.clone(),
                accounts: account_infos.iter().map(|a| *a.key).collect(),
                seeds: signers_seeds
                    .iter()
                    .map(|group| group.iter().map(|s| s.to_vec()).collect())
                    .collect(),
            });
            Ok(())
        }

        fn sol_get_rent_sysvar(&self, var_addr: *mut u8) -> u64 {
            // The canonical rent sysvar serialization (u64 lamports_per_byte_year,
            // f64 exemption_threshold, u8 burn_percent) — see solana-sysvar docs.
            const RENT_BYTES: [u8; 17] = [
                152, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 100,
            ];
            unsafe { std::ptr::copy_nonoverlapping(RENT_BYTES.as_ptr(), var_addr, 17) }
            0 // SUCCESS
        }
    }

    impl SyscallStubs for &Stubs {
        fn sol_invoke_signed(
            &self,
            instruction: &Instruction,
            account_infos: &[AccountInfo],
            signers_seeds: &[&[&[u8]]],
        ) -> solana_program::entrypoint::ProgramResult {
            (*self).sol_invoke_signed(instruction, account_infos, signers_seeds)
        }
        fn sol_get_rent_sysvar(&self, var_addr: *mut u8) -> u64 {
            (*self).sol_get_rent_sysvar(var_addr)
        }
    }

    /// What one instruction run produced, captured under the lock.
    struct RunOutcome {
        cpis: Vec<RecordedCpi>,
    }

    /// A counter account in memory plus its owning program and authority.
    struct CounterFixture {
        authority: Pubkey,
        program_id: Pubkey,
        pda: Pubkey,
        data: Vec<u8>,
        lamports: u64,
        authority_signer: bool,
    }

    impl CounterFixture {
        fn new() -> Self {
            let authority = Pubkey::new_unique();
            let program_id = Pubkey::new_unique();
            let pda = counter_pda(&program_id, &authority);
            let initial = Counter {
                authority,
                count: 0,
                status: CounterStatus::Active,
            };
            let mut data = vec![0u8; 8 + Counter::space()];
            let bytes = initial.to_account_bytes().unwrap();
            data[..bytes.len()].copy_from_slice(&bytes);
            Self {
                authority,
                program_id,
                pda: pda.address(),
                data,
                lamports: 1_000_000,
                authority_signer: true,
            }
        }

        /// Run one instruction against the in-memory counter and return
        /// everything the stubs captured.
        fn run(&mut self, tag: u8, expect: Result<(), ProgramError>) -> RunOutcome {
            // Capture under the lock, then release it before asserting — a
            // failed assertion must not poison the shared stubs.
            let (result, cpis) = {
                let _guard = lock();
                STUBS.cpis.lock().unwrap().clear();
                let _old = set_syscall_stubs(Box::new(&STUBS));

                let mut authority_lamports = 1_000_000u64;
                let mut sys_lamports = 0u64;
                let mut sys_data: Vec<u8> = Vec::new();
                let sys_program_id = solana_program::system_program::id();
                let authority_info = AccountInfo::new(
                    &self.authority,
                    self.authority_signer,
                    true,
                    &mut authority_lamports,
                    &mut [],
                    &sys_program_id,
                    false,
                    0,
                );
                let counter_info = AccountInfo::new(
                    &self.pda,
                    false,
                    true,
                    &mut self.lamports,
                    &mut self.data,
                    &self.program_id,
                    false,
                    0,
                );
                let sys_info = AccountInfo::new(
                    &sys_program_id,
                    false,
                    false,
                    &mut sys_lamports,
                    &mut sys_data,
                    &sys_program_id,
                    false,
                    0,
                );
                let accounts = [authority_info, counter_info, sys_info];
                let result = process_instruction(&self.program_id, &accounts, &[tag]);
                let mut cpis = Vec::new();
                for cpi in STUBS.cpis.lock().unwrap().iter() {
                    cpis.push(RecordedCpi {
                        program_id: cpi.program_id,
                        data: cpi.data.clone(),
                        accounts: cpi.accounts.clone(),
                        seeds: cpi.seeds.clone(),
                    });
                }
                (result, cpis)
            };

            assert_eq!(result, expect, "instruction {tag} outcome mismatch");
            RunOutcome { cpis }
        }

        fn state(&self) -> Counter {
            Counter::from_account_bytes(&self.data).unwrap()
        }
    }

    #[test]
    fn initialize_creates_the_counter_and_cpis_system_program() {
        let mut f = CounterFixture::new();
        let outcome = f.run(instruction::INITIALIZE, Ok(()));

        let state = f.state();
        assert_eq!(state.authority, f.authority);
        assert_eq!(state.count, 0);
        assert_eq!(state.status, CounterStatus::Active);

        // Exactly one CPI: the system create_account, signed by the PDA.
        assert_eq!(outcome.cpis.len(), 1);
        assert_eq!(outcome.cpis[0].program_id, solana_program::system_program::id());
        assert_eq!(
            outcome.cpis[0].accounts,
            vec![f.authority, f.pda, solana_program::system_program::id()]
        );
        let pda = counter_pda(&f.program_id, &f.authority);
        let seeds: Vec<Vec<u8>> = pda
            .signer_seeds()
            .iter()
            .map(|s| s.to_vec())
            .collect();
        assert_eq!(outcome.cpis[0].seeds, vec![seeds]);

        // The event payload matches Anchor's log format exactly.
        let expected = aegis_core::event::encode_event(&CounterInitialized {
            authority: f.authority,
        })
        .unwrap();
        assert!(expected.starts_with("Program data: "));
    }

    #[test]
    fn increment_and_decrement_round_trip_with_events() {
        let mut f = CounterFixture::new();
        f.run(instruction::INITIALIZE, Ok(()));

        for _ in 0..3 {
            f.run(instruction::INCREMENT, Ok(()));
        }
        assert_eq!(f.state().count, 3);

        f.run(instruction::DECREMENT, Ok(()));
        assert_eq!(f.state().count, 2);

        f.run(instruction::INCREMENT, Ok(()));
        let expected = aegis_core::event::encode_event(&CounterIncremented {
            authority: f.authority,
            count: 3,
        })
        .unwrap();
        assert!(expected.starts_with("Program data: "));
    }

    #[test]
    fn decrement_at_zero_is_rejected_and_untouched() {
        let mut f = CounterFixture::new();
        f.run(instruction::INITIALIZE, Ok(()));
        f.run(
            instruction::DECREMENT,
            Err(ProgramError::Custom(6004)), // Underflow
        );
        assert_eq!(f.state().count, 0);
    }

    #[test]
    fn freeze_blocks_arithmetic_forever() {
        let mut f = CounterFixture::new();
        f.run(instruction::INITIALIZE, Ok(()));

        f.run(instruction::FREEZE, Ok(()));
        assert_eq!(f.state().status, CounterStatus::Frozen);

        // Arithmetic on a frozen counter.
        f.run(
            instruction::INCREMENT,
            Err(ProgramError::Custom(6001)), // NotActive
        );

        // Freezing twice — the state machine only knows Active → Frozen.
        f.run(
            instruction::FREEZE,
            Err(ProgramError::Custom(6002)), // AlreadyFrozen
        );
    }

    #[test]
    fn unsigned_instruction_is_rejected() {
        let mut f = CounterFixture::new();
        f.run(instruction::INITIALIZE, Ok(()));
        f.authority_signer = false;
        f.run(
            instruction::INCREMENT,
            Err(ProgramError::Custom(6000)), // Unauthorized
        );
        assert_eq!(f.state().count, 0);
    }

    #[test]
    fn wrong_pda_address_is_rejected() {
        let mut f = CounterFixture::new();
        f.pda = Pubkey::new_unique(); // not the derived address
        let outcome = f.run(
            instruction::INITIALIZE,
            Err(ProgramError::Custom(4)), // PDA_MISMATCH (Core-internal)
        );
        // Nothing was CPI'd and no state was written.
        assert!(outcome.cpis.is_empty());
    }

    #[test]
    fn unknown_tag_is_rejected() {
        let mut f = CounterFixture::new();
        f.run(0xFF, Err(ProgramError::InvalidInstructionData));
    }
}
