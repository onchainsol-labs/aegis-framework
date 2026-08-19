# Aegis Core 🔱

The framework itself — a Rust crate developers import to build Solana programs.

> **Not the CLI. Not Sentinel.** This is the library: the abstractions that
> make programs smaller, safer, and easier to read.

## Status

**v0 — design complete, implementation starting.** Phase 1 per the spec:
abstractions that work with familiar Solana program structures
(anchor-compatible) before Aegis grows its own runtime.

## What it gives you (v0)

```rust
use aegis_core::prelude::*;

// Accounts — serialization + discriminator + space, one line
aegis_account!(Config {
    admin: Pubkey,
    fee_bps: u16,
    bump: u8,
});

// Errors — registry with exit codes, one block
aegis_error!(pub enum ErrorCode {
    Unauthorized = 6000 => "Unauthorized",
    FeeTooHigh = 6001 => "Fee exceeds maximum (500 bps / 5%)",
});

// PDAs — find, sign, and validate (the #1 Solana bug class, handled)
let config = AegisPda::new(program_id, &[b"config"]);
config.validate(&account.key())?;          // wrong seeds → error
let signer = config.signer_seeds();        // ready for invoke_signed

// Tokens — checked transfers, no silent overflow, no dependency hell
aegis_core::tokens::transfer_checked(
    &token_program, &from, &mint, &to, &authority,
    amount, decimals, Some(&[&signer[..]]),
)?;

// State — transitions that can't skip steps
transition(&mut packet.status, PacketStatus::Active, PacketStatus::Closed)?;
```

## The invariant

Everything in Aegis Core exists because a real program needed it. Every
abstraction was extracted from Packet — battle-tested, not imagined.

> The total amount moved out of a vault can never exceed what went in.
> The framework makes that class of bug hard to write.

## Docs

- [`DESIGN.md`](DESIGN.md) — architecture and every design decision, with reasons
- [`ROADMAP.md`](ROADMAP.md) — v0 scope, extraction sources, future versions
