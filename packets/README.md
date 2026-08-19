# PACKET 🧧

## Money Worth Opening.

Social on-chain money distribution on Solana. Create → Drop → Share → Claim.

Send $10 → boring.
**Drop a $100 Packet — 10 people can claim it.** 🧧

## Repo layout

```text
packets/
├── README.md            ← this file
├── TODO.md              ← master build checklist (update as we go)
├── docs/                 ← all product/design docs
│   ├── PLAN.md           ← full build plan (Anchor program, web, Seeker mobile)
│   ├── DATABASE.md       ← Neon Postgres + Helius webhook (persistent history)
│   ├── DESCRIPTION.md    ← short/medium/long project descriptions
│   ├── TECH-STACK.md    ← every tool and framework we use
│   ├── TOKENS.md        ← supported tokens now + future token plan
│   ├── ADD-TOKEN.md     ← how to add a new token (BONK, JUP…) in ~5 minutes
│   ├── REVENUE.md       ← how Packet makes money (fees + more)
│   ├── BLINKS-ACTIONS.md← Solana Actions & Blinks roadmap
│   └── UI-MOCKUPS.md    ← wireframes + design direction
├── program/             ← Anchor Solana program
├── sdk/                 ← shared TS SDK (web + mobile)
├── web/                 ← Vite + React app
├── api/                 ← Hono server (OG previews + Blinks)
└── mobile/              ← React Native app (Solana Seeker)
```

## Quickstart

```bash
# Build the program
cd program
anchor build

# Run the test suite (localnet)
anchor test
```

## Status

Foundational Product Specification → MVP build in progress.
Devnet first, mainnet after audits and testing.

> Built with Aegis. Powered by Solana. Built from Africa. Built for the world.
