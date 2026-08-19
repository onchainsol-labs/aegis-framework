# Aegis Core v0.1 — Build TODO 🔱

Derived from `ROADMAP.md` + `DESIGN.md`. Tick boxes as they land.
Every item references its design decision (D#).

> v0.1 is written from scratch — the Anchor-built Packet contract is NOT an
extraction source, only a future migration target (dogfooding, v0.2).

---

## 0. Crate scaffold

- [x] `core/Cargo.toml` — name `aegis-core`, deps: `borsh` (derive, no default features for no_std), `solana-program` only (D4)
- [x] `src/lib.rs` — crate docs + module declarations + `prelude` export
- [x] `.gitignore` — `/target`, `Cargo.lock` not ignored (program crates commit it)

## 1. `error` — registry (D3)

- [x] `AegisError { code: u32, message: &'static str }` + `Display` + `From<AegisError> for ProgramError`
- [x] Core-internal codes `1..=999`: WrongDiscriminator, IllegalStateTransition, AmountExceedsRemaining, PdaMismatch, Serialization, ArithmeticOverflow, InvalidPdaSeed
- [x] `aegis_error!` macro — enum + `code()` + `message()` + `From` impls
- [x] Unit tests: code/message round-trip, conversion to `ProgramError::Custom`

## 2. `state` — transition guards (D6)

- [x] `require_state(current, expected) -> Result<(), AegisError>`
- [x] `transition(slot, from, to) -> Result<(), AegisError>` — rejects anything but the exact legal move
- [x] Unit tests: legal move passes, illegal move errors

## 3. `pda` — find / validate / sign (D7)

- [x] `AegisPda::new(program_id, seeds) -> (address, bump)`
- [x] `validate(&self, actual: &Pubkey) -> Result<(), AegisError>` — re-derives and compares
- [x] `signer_seeds(&self) -> Vec<&[u8]>` — seeds + `[bump]`, ready for `invoke_signed`
- [x] Unit tests: correct seeds pass, wrong seeds fail, wrong bump fails

## 4. `account` — trait + macro (D2)

- [x] `AegisAccount` trait: `discriminator()`, `space()`, `from_account_bytes`, `to_account_bytes`
- [x] `aegis_account!(Name { field: Type, ... })` — struct + trait impl (fixed-size types only in v0)
- [x] Discriminator = `sha256("account:<Name>")[..8]` — anchor-compatible (D2), verified against sha2 in tests
- [x] `hash` module — plain SHA-256 (solana's `hashv` length-prefixes, so we ship our own, NIST-verified)
- [x] Unit tests: round-trip serialize, wrong discriminator rejected, space math

## 5. `tokens` — checked CPI (D4, D5)

- [x] `checked_amount(remaining, amount) -> Result<u64, AegisError>` — the invariant in one call
- [x] `transfer_checked(...)` — hand-rolled instruction encoding (tag 12 + amount + decimals), `invoke`/`invoke_signed` support
- [x] `close_account(...)` — hand-rolled (tag 9), rent to destination
- [x] Unit tests: checked_amount underflow rejected; instruction encoding byte-exact

## 6. `event` — emitter

- [x] `emit_event!(EventName { .. })` — borsh-serializes the struct and emits it via `sol_log` + base64 tagging
- [x] Unit tests: serialization round-trip, base64 known vectors

## 7. `prelude`

- [x] Re-export everything a program imports in one line: `use aegis_core::prelude::*;`

## 8. The proof suite — framework test projects (standalone, NOT Packet)

Aegis Core is built from scratch — no dependency on the Anchor-built Packet
contract. Packet is just a future migration target, not an extraction source.
The framework proves itself by building these, in this order (simple → hard):

- [x] **`examples/counter`** — hello-world proof: init → increment → decrement,
  authority check, state guards, events. Compiles to a real `.so` (92 KB),
  passes 7/7 handler tests (no validator needed — syscall-stub tests).
  Benchmarked vs Anchor in `examples/counter/README.md`. CUs pending devnet.
- [ ] **`examples/vault`** — deposit / withdraw, owner authority, balance guards
- [ ] **`examples/escrow`** — two-party trade: deposit → release (seller) /
  cancel-refund (buyer), PDA-signed escrow state
- [ ] **`examples/multisig`** — threshold approvals, proposal → sign → execute
- [ ] **`examples/payment-splitter`** — one payment, N recipients, percentages
- [ ] **`examples/vesting`** — locked schedule, cliff, linear unlock
- [ ] **`examples/subscription`** — recurring payments with expiry checks
- [ ] **`examples/marketplace`** — listing → buy, fee collection
- [ ] Devnet deploy of the small test samples once they pass locally —
  **then we shoot Aegis Framework off the roof** 🚀

Rule: each example adds at most ONE new Core capability. Dogfooding drives
expansion — nothing speculative enters the crate.

> The counter proof already forced three Core capabilities into existence
> (the right way): `write_to` (rent-safe over-allocation), trailing-byte
> tolerant reads, and `encode_event` (pure, testable event encoding).

## 9. Definition of done (v0.1)

- [x] `cargo check` — zero warnings
- [x] `cargo test` — Core 44/44 + counter 7/7, every rejection path covered
- [x] README examples compile against the real API
- [x] `examples/counter` passing + benchmark recorded (lines, `.so` size; CUs pending devnet)
- [x] Commit + push to `main`

---

## What the core still needs AFTER v0.1 (not in this TODO — later versions)

v0.1 is the **foundation slice** — the full Core grows tier by tier, driven by
what Packet needs next (dogfooding drives expansion).

| Missing today | Arrives in | From SPEC.md |
|---|---|---|
| Program structure — entrypoint, instruction dispatch | v1 (own runtime) | §8.1 |
| Instruction abstractions | v1 | §8.1 |
| IDL generation | v1 | §8.1 |
| Proc-macro derives (`#[aegis::program]`) | v1 | §11 Level 2 |
| Components — `payments`, `vault`, `escrow`, `tokens`, `permissions`, `rewards` | v2 | §9 |
| System-program helpers (create account, rent, ATA) | when Packet needs them | dogfooding |
| Randomness integration (Switchboard VRF) | when Packet ships random mode | packets.txt §20 |

> The rule stays: nothing enters Core until a real Packet feature needs it.
