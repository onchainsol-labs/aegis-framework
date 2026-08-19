# Aegis Framework 🔱

The secure application framework for Solana — *build from Africa, build for the world.*

## What's in this folder

| Path | What |
|---|---|
| [`GOALS.md`](GOALS.md) | Why Aegis exists — the pitch, the end goals, the proof standard |
| [`SPEC.md`](SPEC.md) | The consolidated framework vision — principles, architecture, phases |
| [`PRODUCT.md`](PRODUCT.md) | The ranked build plan — what gets built first and why |
| [`docs/`](docs/) | The original source specs (framework, Packet, Aegis↔Packet relationship) |
| [`core/`](core/) | **Aegis Core** — the framework crate itself (what programs are written with) |
| [`packets/`](packets/) | Packet 🧧 — the product built on the framework (program, web, mobile, api) |

## The loop

```text
developer writes code (with Aegis Core)
→ Sentinel reviews the PR → merge
→ CLI builds → costs → deploys → real users → better Aegis ↺
```

## The pillars

- **BUILD** — developer experience (`aegis-core`, the CLI)
- **PROTECT** — security by default (the Security Engine, Sentinel)
- **SHIP** — production infrastructure (deploy pipeline, Packet)

See [`SPEC.md`](SPEC.md) for the full vision and [`PRODUCT.md`](PRODUCT.md) for the build order.
