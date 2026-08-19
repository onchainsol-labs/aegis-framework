# AEGIS PRODUCT 🔱

## What we're building

One framework at the center, tools around it, one proof:

```text
                    AEGIS CORE 🔱 (the framework)
        a Rust crate developers import to build Solana programs
        account/state/PDA/CPI/error/event abstractions
                            │
     ┌──────────────┬───────┴───────┬──────────────┐
     │              │               │              │
 Aegie CLI ⚙️   Aegie Sentinel 🛡️  Aegis DSL ✍️   Aegis SDK 📦
 BUILD+SHIP       PROTECT          Intent→Program   clients
 (tool)           (tool)           (compiler)       (tool)
                            │
                     PACKET 🧧 — the proof
              the first product built ON the framework
```

**The framework is NOT the CLI.** The CLI deploys programs; the framework is
what those programs are written with. Per `docs/About.txt` §8.1, Aegis Core
owns: program structure, account abstractions, instruction abstractions,
state management, errors, events, serialization, PDA utilities, CPI
abstractions. Everything else consumes it.

The loop (from `docs/` + `Aegis/Aegis Agent/Product.txt`):

```text
developer writes code (with Aegis Core)
→ Sentinel reviews the PR → merge
→ CLI builds → costs → deploys → real users → better Aegis ↺
```

---

## Build order — first to last, ranked by simplicity + resources

> Rule: finish what's nearly done first; the framework core comes before any
> tool that depends on it; Packet proves every tier.

| # | Item | Simplicity | Resources | Why now |
|---|---|---|---|---|
| **1** | **Aegis Core v0 — the framework crate** | ⭐⭐ Medium (extract patterns we already built in Packet) | ~free | **This IS the framework. Everything else consumes it.** |
| 2 | Dogfood: Packet migrates onto Aegis Core | ⭐⭐ Medium | ~free | Proves the core is real, not a toy |
| 3 | `aegis new` — project scaffolding (CLI) | ⭐ High (templates exist) | ~free | Completes the CLI's create step |
| 4 | `aegis test` — validator + test runner (CLI) | ⭐ High (pipeline proven on Packet) | ~free | Completes the V0 dev loop |
| 5 | `aegis audit` — rule-based IDL security checks | ⭐⭐ Medium | ~free | Security Engine slice; doubles as Sentinel's detector core |
| 6 | Packet: `close_packet` + random mode + devnet deploy | ⭐⭐ Medium | ~free | First real users |
| 7 | **Sentinel MVP** — GitHub PR bot on the `audit` engine | ⭐⭐⭐ Hard | $$ (hosting, LLM keys) | The revenue wedge |
| 8 | Aegis Components — `payments`, `vault`, `escrow`, `tokens` on Core | ⭐⭐⭐ Hard | ~free | From framework → platform |
| 9 | Sentinel Phase 2 — repo indexing, cross-file reasoning | ⭐⭐⭐ Hard | $$$ (vector DB, RAG) | After MVP traction |
| 10 | Aegis DSL + Compiler (Intent → Program) | ⭐⭐⭐⭐ Very hard | $$$$ | The moonshot — only after the loop is proven |
| 11 | Aegis SDK (TS/Rust clients) | ⭐⭐ Medium | $ | After program shapes stabilize |
| ∞ | Aegis Africa — docs, workshops, grants | — | ongoing | Parallel; never blocks code |

---

## Tier details

### Tier 1 — Aegis Core v0 (THE framework, free, weeks)

A Rust crate (`aegis-core`, in `aegis framework/core/`) with the abstractions
we already hand-built and battle-tested in Packet. Per the spec's Phase 1,
Core v0 is an **abstractions layer that works with familiar Solana program
structures** (anchor-compatible) before Aegis grows its own runtime.

- `Account` trait + `aegis_account!` — serialize/deserialize + discriminator + space calc
- PDA utilities — seeds, bumps, derived-signer wrappers
- `aegis_error!` — error registry with exit codes
- Checked token CPI wrappers (transfer, close) — no silent overflow, ever
- Vault authority pattern — one-liner PDA-signed accounts
- State transition guards — status enums that can't skip steps
- Event emitter

**Definition of done:** the same `Config` + `initialize` we wrote in Packet,
rebuilt on `aegis-core`, passes the same tests — with measurably less
boilerplate. That's the V0 benchmark from the spec: **Aegis vs Anchor**.

### Tier 2 — Dogfood + CLI (free)

- **Dogfood:** Packet migrates onto Aegis Core (checked CPI, vault pattern,
  error registry first; accounts later)
- **`aegis new <name>`** — scaffold project (keypair + program + tests + config)
- **`aegis test`** — one command: validator up → program preloaded → tests → down

Done = the developer loop `new → test → build → cost → deploy` works end-to-end
AND the core is proven inside Packet.

### Tier 3 — Security + Packet completion (free)

- **`aegis audit`** — reads the IDL + source; checks the top Solana bug classes
  (missing signer, missing owner check, uninitialized accounts, PDA bump
  mistakes, unsafe CPI, missing rent checks); severity-scored report.
  *This rule engine becomes Sentinel's detector core — built once, used twice.*
- Packet: `close_packet` (fix the rent lock), random mode (Switchboard VRF),
  and a devnet deploy through the CLI.

### Tier 4 — Sentinel MVP (the wedge, first real spend)

- GitHub App reviewing PRs with the `audit` rules + LLM explanations
- Inline comments + severity scores + JSON API for agents
- Free/Pro tiers ($49–99/mo) — the first revenue

### Tier 5 — Platform (only when funded/proven)

- Aegis Components: `aegis::payments`, `aegis::vault`, `aegis::escrow`,
  `aegis::tokens` — standardized primitives on Core
- Sentinel Phase 2/3: RAG indexing, cross-file exploit reasoning, auto-fix PRs
- Aegis DSL + Compiler: the `Intent → Program` language
- Aegis SDK: generated clients

---

## Rationale

- **Core before tools:** the DSL, SDK, Components, and `audit` all consume
  Aegis Core. Building them first would mean rebuilding their foundation later.
- **Core is free and we've already written it once** — every abstraction in
  Core v0 exists inside Packet today, hand-rolled. Extracting it is the
  cheapest possible way to "build the framework."
- **Dogfooding is the spec's law** (`To know.txt`, `About.txt` §14–16): no
  framework capability ships until Packet proves it.
- **The audit engine is built once, monetized twice** — free CLI command now,
  Sentinel's detector later. No LLM bills until the rules are proven.
- **First real money goes out at Sentinel MVP** (hosting + LLM). Everything
  before it costs only our time.
