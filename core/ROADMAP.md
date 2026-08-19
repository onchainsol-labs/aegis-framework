# Aegis Core — Roadmap 🔱

Scope, extraction sources, and definitions of done.

---

## v0.1 — The abstraction layer (current)

| # | Abstraction | Extracted from (Packet) | Source location |
|---|---|---|---|
| 1 | `aegis_account!` + `AegisAccount` trait | `Config` / `Packet` structs + manual size impls | `programs/packet/src/lib.rs` §Accounts |
| 2 | `aegis_error!` registry | `ErrorCode` enum with `#[msg]` + exit codes | `programs/packet/src/errors.rs` |
| 3 | `AegisPda` (find/validate/signer) | `CONFIG_SEED`/`VAULT_SEED` + manual `vault_seeds` stacks | `lib.rs` claim/refund paths |
| 4 | `checked_amount` + checked token CPI | the core invariant: `remaining_amount` checked_sub | `lib.rs` `claim_packet` |
| 5 | Token transfer/close CPI (hand-rolled) | `token::transfer` / `close_account` CPI blocks | `lib.rs` `create_and_fund` / `refund_packet` |
| 6 | State transition guards | `PacketStatus` Active→Completed→Closed moves | `lib.rs` claim/refund |
| 7 | Event emitter | `#[event]` structs (ConfigInitialized, PacketCreated…) | `lib.rs` §Events |

**Definition of done (v0.1):**
- `cargo check` + unit tests green for all seven abstractions
- Each rejection path tested (wrong discriminator, wrong seeds, bad bump,
  amount > remaining, illegal transition)

## v0.2 — Dogfooding: Packet migrates onto Core

- Packet adopts items 2–6 first (non-breaking, anchor-compatible)
- Same 14-test suite passes, zero behavior change
- **Benchmark recorded:** lines of code, compile time, program size, compute
  units — Aegis vs the current hand-rolled Packet (the V0 benchmark from the spec)

## v0.3 — CLI integration

- `aegis new` scaffolds a project that imports `aegis-core`
- `aegis test` runs the suite against the generated program
- `aegis audit` starts reading the same patterns Core prevents (rules reused
  later by Sentinel)

## v1 — Own runtime (spec Phase 2)

- Own entrypoint + account/instruction dispatch (proc macros)
- IDL generation
- Keeps anchor-compatible discriminators so clients keep working

## v2 — Components + the Simple level (spec §9, Early Info §2-③)

- **Simple (DSL/API):** the `app payments { action deposit(amount) {...} }`
  language — Intent → Program — compiled down to Core + Components
- **Components:** `aegis::payments`, `aegis::vault`, `aegis::escrow`,
  `aegis::tokens`, `aegis::permissions`, `aegis::rewards` — standardized
  primitives on Core, each proven by a Packet feature

> The three levels stay in lockstep: Simple compiles to Standard, Standard
> exposes Advanced. A developer can start at any level and move between them
> without leaving the framework.

## v3 — Sentinel's engine (see PRODUCT.md tier 3)

The `audit` rule engine — the same patterns Core prevents, detected in code
that *didn't* use Core.

---

## Tracking

Each v0.1 item lands as: module + unit tests + a line in the V0 benchmark table.
Progress is measured against the spec's one question:

> Can a developer build a useful Solana program with dramatically less code
> and complexity than the normal workflow?
