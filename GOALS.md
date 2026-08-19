# Aegis Goals 🔱

Why Aegis exists, what it's trying to become, how we'll know we got there — and
what to say when someone asks *"why Aegis over Anchor?"*

---

## 1. The end goals

- **Vision** — Make Solana application development accessible to every capable developer, regardless of their blockchain background.
- **Mission** — Build the safest, simplest, and most productive application-development layer for Solana.
- **Long-term goal** — Become the default application framework through which the next generation of Solana applications is built.
- **Regional ambition** — Build from Africa. Build for the world.

---

## 2. Why Aegis over Anchor — the message

### The one-liner

> Anchor made Solana programs easier to **write**. Aegis makes Solana
> applications easier to **build**, safer to **ship**, and easier for the
> **next generation** to understand.

### The 30-second version

Anchor is great — we're not anti-Anchor. But Anchor answered one question:
*how do I write a Solana program with less boilerplate?* Aegis asks the next
one: *how does an app developer build a safe, production Solana application
without becoming a blockchain engineer?*

Three things make it different:

1. **Secure by default** — dangerous patterns (bad PDA checks, skipped state
   transitions, unchecked math) become hard to write, and the Security Engine
   checks continuously instead of once at the end.
2. **Three levels, one path** — a simple DSL on top, Rust in the middle, raw
   Solana at the bottom. No dead ends. You learn Solana *through* Aegis
   instead of being hidden from it.
3. **Proven on a real product** — Packet, our own live app, is built with it.
   If the framework doesn't measurably beat the normal workflow, we don't
   ship it.

### The full comparison

| | Anchor | Aegis |
|---|---|---|
| Solves | Writing programs with less boilerplate | Building **applications** safer and faster |
| Security | Checks you remember to add | **Secure by default** + Security Engine + `aegis audit` + Sentinel (continuous AI review — audits that don't end) |
| Abstraction levels | One (Rust + macros) | **Three** — Simple DSL → Standard Rust → Advanced raw Solana — move between them freely |
| Building blocks | None app-level | `payments`, `vault`, `escrow`, `tokens`, `rewards` as standardized components |
| Tooling | Anchor CLI | **Agent-native** CLI (`--json`, exit codes — AI agents can deploy autonomously) + the Sentinel PR-review loop |
| Cost | N/A | `aegis cost` predicts deploy + rent to the lamport *before* you spend |
| Philosophy | A framework | A **path into Solana** — the DSL generates readable Rust, escape hatches hand back raw primitives, so beginners end up understanding the chain deeply |
| Proof standard | — | Every abstraction is dogfooded on a real consumer product (Packet). **Measured, not claimed.** |

**The honest bit:** Anchor is mature and we respect it — Phase 1 of Aegis
works *alongside* Anchor, not against it. And the V0 benchmark decides
everything: if Aegis doesn't win on lines of code, program size, compute
units, or security — the docs say don't ship the abstraction. We bet the
product will make that true, not the marketing.

---

## 3. Every path to the end goal — and why it's possible

| Step | Is it possible? | Proof |
|---|---|---|
| Core abstractions (v0) | ✅ Already proven | Every abstraction exists in Packet today, hand-written — extraction, not invention |
| Own runtime (v1) | ✅ Prior art | Anchor itself is the evidence a runtime can be built |
| DSL → codegen (v2) | ✅ Very possible | The DSL is a **generator that outputs Rust** (cargo compiles it) — not a compiler to bytecode. solang already compiles Solidity→SBF; DSL→Rust is easier |
| Security Engine + `audit` | ✅ Possible | Rule-based checks over the IDL — the bug classes are known |
| Components | ✅ Possible | More crates on the same abstractions |
| Sentinel | ✅ Possible | GitHub Apps + LLM APIs are mature tech; the hard part (rules) is shared with `audit` |

**The rule that keeps us honest** (from the spec): *if Aegis doesn't
demonstrably improve something, we don't ship the abstraction just because it
looks cool.*

---

## 4. What a developer learns along the way

The framework is a **curriculum**, not a wall:

```text
Simple (DSL):        learns app thinking — accounts as balances, actions, rules
       ↓  reads the generated code (it's the textbook)
Standard (aegis-core): learns Rust + the abstractions, sees the machinery
       ↓  escape hatches expose the raw pieces
Advanced (solana-program): learns PDAs, CPIs, serialization, signers
       ↓
Can now build on raw Solana with or without Aegis — fully capable either way
```

A beginner ends up understanding Solana deeply — because the DSL generates
readable Rust, the escape hatches hand back raw `AccountInfo`s, and nothing
is hidden. That's the spec's "don't hide Solana" made concrete.

---

## 5. The proof standard

The V0 benchmark answers one question: *can a developer build a useful Solana
program with dramatically less code and complexity than the normal workflow?*

Measured against Anchor on: lines of code, development time, generated
program size, compute units, compile time, test complexity, security checks,
developer experience.

**If Aegis loses, Aegis changes. If Aegis wins, we say so with numbers.**
