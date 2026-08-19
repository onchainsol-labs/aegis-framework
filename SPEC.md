# AEGIS 🔱

## The Secure Application Framework for Solana

**Status:** Foundational Specification (consolidated from `About.txt`, `Early Info.txt`, `To know.txt`, `packets.txt`)
**Project Type:** Open-source blockchain developer infrastructure
**Target Ecosystem:** Solana
**Tagline:** *The secure application framework for Solana.*

---

## 1. Vision, Mission, Goals

- **Vision** — Make Solana application development accessible to every capable developer, regardless of their blockchain background.
- **Mission** — Build the safest, simplest, and most productive application-development layer for Solana.
- **Long-term goal** — Become the default application framework through which the next generation of Solana applications is built.
- **Regional ambition** — *Build from Africa. Build for the world.*

---

## 2. The Problem

Solana developers must reason about a huge amount of machinery before writing a single line of application logic:

Rust → accounts → ownership → instructions → transactions → PDAs → serialization → validation → signers → CPI → token programs → initialization → state transitions → compute units → security → testing → deployment → client generation.

Anchor collapsed much of this. **Aegis asks the next question:**

> What is the next layer of developer experience Solana needs?

**Anchor's direction:** Raw Solana → structured program development.
**Aegis's direction:** Solana primitives → *application development*.

> **Aegis makes Solana application development accessible without hiding Solana itself.**

---

## 3. Core Principles

| # | Principle | Meaning |
|---|---|---|
| 1 | **Intent Over Infrastructure** | Describe what the app does; the framework handles the plumbing |
| 2 | **Secure by Default** | Unsafe patterns should be hard to express (signers, ownership, PDAs, reinit, arithmetic, CPI, state transitions) |
| 3 | **Progressive Abstraction** | App API → Program API → Low-level API → Solana primitives; descend when needed |
| 4 | **Don't Hide Solana** | The framework is a *path into* Solana, not a wall |
| 5 | **Composability** | Reusable primitives (payments, escrow, vaults, tokens, subscriptions…) |
| 6 | **Production First** | Every abstraction is tested against real applications |

---

## 4. Architecture

```text
                         AEGIS
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
      Aegis CLI        Aegis DSL        Aegis SDK
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    Aegis Compiler
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      Security Engine            Code Generator
              │                         │
              └────────────┬────────────┘
                           ▼
                    Solana Program → sBPF
```

### Components

- **Aegis Core** — program structure, accounts, instructions, state, errors, events, serialization, PDA + CPI abstractions
- **Aegis CLI** — `init · dev · build · test · audit · deploy · generate · inspect`
- **Aegis DSL** — high-level application intent language (conceptual: `app payments { account User { balance: u64 } action deposit(amount) {...} }`)
- **Aegis SDK** — TypeScript / Rust / mobile clients
- **Aegis Security Engine** — static analysis, authorization/PDA/CPI/state-transition checks, generated security reports (`aegis audit`)
- **Aegis Components** — `accounts · payments · tokens · escrow · permissions · subscriptions · rewards · vaults · marketplace · identity · randomness`

---

## 5. Intent → Program

The defining concept. A developer describes intent:

```text
User deposits funds.
User owns a balance.
Authorized users can withdraw.
Each withdrawal must satisfy defined rules.
```

Aegis generates the machinery: accounts, instructions, state, validation, serialization, PDAs, CPI, errors, events, tests.

**Progressive abstraction levels:**

1. **Application** — payments, escrow, rewards, marketplace, subscription
2. **Program** — `#[aegis::program]` style control
3. **Low Level** — direct accounts/instructions/PDA/CPI access

---

## 6. Performance & Benchmarking

DX cannot cost runtime overhead. Aegis must benchmark against Anchor, Pinocchio, and native Rust:

- compute units, generated program size, transaction performance, compile time, runtime overhead, developer code size

> **If Aegis doesn't demonstrably improve something, we don't ship the abstraction just because it looks cool.**

---

## 7. Relationship with Anchor

Five phases — coexist first, replace nothing:

1. Learn from existing Solana tooling
2. Provide higher-level abstractions
3. Introduce its own application architecture
4. Develop its own compiler/code-generation pipeline
5. Become independently capable of producing optimized programs

---

## 8. Dogfooding: Packet 🧧

**Packet** is the first serious application built with Aegis:

- **Thesis:** *Money Worth Opening.* Social on-chain money distribution (Create → Fund → Drop → Share → Claim)
- **Modes:** Equal, Random, First-Come (Weighted, Tiered, Invite-only… later)
- **Revenue:** small transparent platform fee on top of packet amounts
- **Evolution:** dApp → protocol → distribution infrastructure (`createPacket({...})` inside games, wallets, social apps)

The dogfooding loop drives the framework:

```text
Aegis → Build Packet → Encounter problem → Improve Aegis → Rebuild Packet
      → Deploy → Real users → Edge cases → Improve Aegis ↺
```

Every Packet feature is a framework test: state → state abstractions, token transfers → payment primitives, claims → concurrency, randomness → randomness integration, security → security engine, client → SDK.

**Core security invariant:** *total distributed ≤ total funded* — tested extensively.

---

## 9. Packet MVP

**Required:** wallet connection, create/fund packet, equal + random distribution, claim, status, shareable link, basic history, one stablecoin, basic fee.
**Not required:** social profiles, dashboards, complex eligibility, dozens of tokens, analytics.
**Success test:** connect → create → fund → share → open → claim, without understanding blockchain infrastructure.

---

## 10. Africa Strategy

Africa is the home market and developer community — not the ceiling.

- Use cases: payments, stablecoins, remittances, commerce, creator economies, mobile apps, identity, community economies
- Ecosystem: documentation, university programs, workshops, hackathons, grants, open source, templates, local communities
- Goal: a generation of developers fluent in **application engineering + blockchain infrastructure**

---

## 11. Brand

The 🔱 is the architecture itself:

```text
              BUILD
                ▲
               / \
              / 🔱 \
             /     \
       PROTECT ─── SHIP
```

- **BUILD** — developer experience
- **PROTECT** — security by default
- **SHIP** — production infrastructure

---

## 12. Current Implementation Status

### Aegis CLI (`Aegis/Aegis CLI` — binary name `aegie`)

| Command | Status |
|---|---|
| `build` | ✅ Works — anchor/native build detection, JSON output |
| `cost` | ✅ Works — exact rent math for legacy + 0.30 IDLs, float/locked/refund breakdown |
| `deploy` | 🟡 Written with balance pre-check — not yet proven on-chain |
| `upgrade` / `reclaim` / `secure` / `burn` | 🟡 Written, untested |
| `init` (scaffold) / `dev` / `test` / `audit` | ❌ Missing — next V0 milestones |

### Packet (`aegis framework/packets/`)

| Piece | Status |
|---|---|
| Program (`programs/packet`) | ✅ Builds (`packet.so` 284 KB), **14/14 tests green** |
| Web (`web`) | ✅ Live (api.joyblox.fun) |
| Mobile (`mobile`) | ✅ Android debug APK builds |
| API (`api`) | ✅ Live |

---

## 13. V0 Milestone (per Early Info.txt)

The V0 must answer one question:

> **Can a developer build a useful Solana program with dramatically less code and complexity than the normal workflow?**

Target workflow: `aegis init <name>` → `aegis dev` → `aegis test` → `aegis build` → `aegis deploy`

Then benchmark **Aegis vs Anchor** on: lines of code, dev time, program size, compute units, compile time, test complexity, security checks, DX.

### Next actions (in order)

1. **`aegis init`** — scaffold a project from an embedded Aegis template
2. **`aegis test`** — wrap the localnet validator + test runner pipeline (pattern proven on Packet)
3. **`aegis audit`** — v1 of the security engine (IDL-driven checks)
4. **Devnet deploy proof** — `aegis deploy` on a real cluster
5. **First Aegis template program** — rebuild Packet's core using the template to prove the loop
