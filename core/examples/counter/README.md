# Aegis Counter — the v0.1 proof 🔱

A complete Solana counter app built on **Aegis Core**, proving the thesis:
> "Can a developer build a useful Solana program with dramatically less
> code and complexity than the normal workflow?"

## What it does

One counter per authority, stored at a PDA (`["counter", authority]`):

| Instruction | Behavior |
|---|---|
| `initialize` | Creates the counter at its PDA (system CPI, PDA-signed), emits `CounterInitialized` |
| `increment` | +1 — requires signer + authority match + Active state + checked add |
| `decrement` | −1 — same guards + `checked_amount` (can never go below zero) |
| `freeze` | `Active → Frozen` via `transition` — the only legal move, permanently |

Every rejection path is tested (7/7 green):
- unsigned instruction → `6000`
- arithmetic on a frozen counter → `6001`
- freezing twice → `6002`
- decrement at zero → `6004`
- wrong PDA address → Core code `4` (PDA_MISMATCH)
- unknown tag → `InvalidInstructionData`

## How the app uses Core

```text
app code (this crate)              aegis-core (the framework)
─────────────────────              ───────────────────────────
aegis_error!  CounterError         error registry + codes 1..=999
aegis_account! Counter             discriminator + (de)serialization + write_to
AegisPda::find + validate          PDA derivation/checking
require_state + transition         state machine guards
checked_amount                     checked arithmetic
emit_event!                        Anchor-format events
```

What is still hand-written in the app (moves into Core in v1+):
the entrypoint, instruction dispatch, and the raw system create_account CPI.

## The benchmark (recorded 2026-08-16)

| Metric | Aegis counter | Anchor (Packet, same machine) |
|---|---|---|
| App logic lines | ~230 (incl. dispatch) | ~470 (lib.rs only, hand-rolled) |
| Framework lines reused | 0 (all in `aegis-core`) | n/a (Anchor crate) |
| `.so` size | **92 KB** | 278 KB |
| Tests | 7/7 green, no validator needed | 14/14 via Anchor |
| Errors/PDA/state/tokens/events | one line each from Core | macros + boilerplate |

The `.so` gap is structural: Anchor links its full runtime support
(accounts validation, IDL machinery, CPI wrappers). Aegis Core links only
what the app imports — the framework costs ~nothing until you use it.

Compute units: pending a local validator run (Windows validator has known
genesis issues); devnet deploy will capture real CUs.

## Run it

```bash
cargo test --manifest-path examples/counter/Cargo.toml   # 7/7 handler tests
cargo build-sbf --manifest-path examples/counter/Cargo.toml  # → target/deploy/aegis_counter.so
```
