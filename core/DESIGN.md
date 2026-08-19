# Aegis Core — Design 🔱

Architecture and every design decision for `aegis-core`, with reasons.

---

## 1. Goals (v0)

- Make the top Solana bug classes **hard to express** (PDA mistakes, unchecked
  arithmetic, skipped state transitions, wrong discriminators).
- Keep programs **smaller and more readable** than the hand-rolled equivalent.
- **Zero dependency hell**: `borsh` + `solana-program` only.
- **Anchor-compatible** where it matters (discriminators), so existing
  clients/tooling keep working (spec: Phase 1 — coexist, don't declare war).

## Non-goals (v0)

- No own runtime/entrypoint (that's Phase 2 per the spec).
- No proc-macro magic yet — `macro_rules!` only, boring and auditable.
- No IDL generation (the CLI's job, later).

---

## 2. Module map

```text
aegis-core
├── account   — AegisAccount trait + aegis_account! (struct, disc, space, (de)serialize)
├── error     — AegisError + aegis_error! registry (codes + messages + exit codes)
├── pda       — AegisPda: find / validate / signer-seeds (bump included)
├── tokens    — checked transfer + close CPI, hand-rolled instruction encoding
├── state     — require_state / transition guards (no skipped steps)
└── prelude   — everything a program imports in one line
```

---

## 2.1 Progressive abstraction — the three levels (Early Info.txt §2-③)

The framework must be **one development experience with multiple abstraction
levels** — a beginner stays at the top, an expert descends, and no one hits a
dead end:

```text
                    AEGIS
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       Simple       Standard    Advanced
       DSL/API       Rust       Low-level
          │           │           │
          └───────────┼───────────┘
                      ↓
                 Solana program
```

### Where each level lives

| Level | What it is | Where it lands |
|---|---|---|
| **Simple** — DSL/API | Describe intent (`app payments { action deposit(amount) {...} }`), the compiler generates the program | Aegis DSL + Compiler (ROADMAP v2) |
| **Standard** — Rust | `aegis-core` macros and traits: accounts, PDAs, checked CPI, state guards | **Aegis Core v0 — this crate, now** |
| **Advanced** — Low-level | Raw `solana-program`: accounts, instructions, CPIs, serialization — nothing hidden | Always available: every Core abstraction exposes its raw pieces (`Pubkey`s, `AccountInfo`s, seed slices) so a developer can drop down mid-instruction |

### The v0 rule (escape hatches)

Every Core abstraction must return or expose the underlying Solana primitive:
`AegisPda` hands back its seeds, the account trait works on raw slices, the
token CPI takes `AccountInfo`s. **Aegis is a path into Solana, not a wall**
(Early Info.txt §4) — that rule is enforced in code reviews from day one.

---

## 3. Design decisions

### D1 — Phase-1 abstractions layer, anchor-compatible
Per `SPEC.md` §7: Aegis starts by making familiar program structures safer,
not by replacing the runtime. Core v0 is a library you use *inside* an anchor
or native program. Phase 2 (own runtime) comes after v0 is proven on Packet.

### D2 — Anchor-compatible discriminators
Account discriminators are `sha256("account:<Name>")[..8]` — exactly
Anchor's scheme. Consequence: an account written by `aegis_account!` is
readable by Anchor clients and vice versa. The dogfooding migration of
Packet becomes non-breaking.

### D3 — Custom error registry, two code ranges
- Core-internal errors: `1..=999` (wrong discriminator, illegal transition,
  amount exceeds remaining, PDA mismatch, serialization).
- App errors: `6000+` via `aegis_error!` (mirrors Packet's exit-code range so
  existing tooling and tests keep their numbers).

### D4 — No token crate dependency
`transfer_checked` and `close_account` CPIs are encoded by hand
(tag + amount + decimals + account metas) instead of pulling `spl-token`.
One less crate, one less version conflict, and the encoding is 15 lines
that a reviewer can verify at a glance.

### D5 — Checked arithmetic as a framework invariant
Extracted from Packet's core invariant: *"every path that moves money out of
a vault reduces `remaining_amount` by exactly the same amount, checked and
updated in the same instruction."* Core provides `checked_amount(remaining,
amount)` — the subtraction and the error in one call.

### D6 — State transitions via guards
`transition(&mut status, from, to)` rejects anything that isn't the exact
legal move. Status enums can't skip steps or be set arbitrarily.

### D7 — PDA validation built in
`AegisPda::validate(actual)` re-derives the address and compares — the #1
Solana bug class (missing bump/seed checks) becomes one line.

---

## 4. API surface (v0)

```rust
// account.rs
pub trait AegisAccount {
    const DISCRIMINATOR: [u8; 8];
    fn space() -> usize;
    fn try_from_slice(data: &[u8]) -> Result<Self, AegisError>;
    fn try_to_vec(&self) -> Result<Vec<u8>, AegisError>;
}
aegis_account!(Name { field: Type, ... });   // fixed-size types only in v0

// error.rs
pub struct AegisError { code: u32, message: &'static str }
aegis_error!(pub enum AppError { Variant = 6000 => "message", ... });

// pda.rs
pub struct AegisPda<'a> { address: Pubkey, bump: u8, seeds: &'a [&'a [u8]] }
impl AegisPda<'_> {
    pub fn new(program_id: &Pubkey, seeds: &[&[u8]]) -> Self;
    pub fn validate(&self, actual: &Pubkey) -> Result<(), AegisError>;
    pub fn signer_seeds(&self) -> Vec<&[u8]>;   // seeds + [bump]
}

// tokens.rs
pub fn checked_amount(remaining: u64, amount: u64) -> Result<u64, AegisError>;
pub fn transfer_checked(...) -> Result<(), AegisError>;
pub fn close_account(...) -> Result<(), AegisError>;

// state.rs
pub fn require_state<T: PartialEq>(current: T, expected: T) -> Result<(), AegisError>;
pub fn transition<T: PartialEq + Copy>(slot: &mut T, from: T, to: T) -> Result<(), AegisError>;
```

---

## 5. Testing strategy

The conformance test is Packet itself. For each abstraction, the test is:

1. A unit test in `aegis-core` covering the happy path + every rejection path.
2. The Packet migration: same behavior, same test suite (14 tests), measurably
   less code.
3. The V0 benchmark from the spec: **Aegis vs Anchor** on lines of code,
   compile time, program size, compute units.
