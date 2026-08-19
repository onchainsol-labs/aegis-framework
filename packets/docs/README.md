# PACKET 🧧

## Money Worth Opening.

Social on-chain money distribution on Solana. Create → Drop → Share → Claim.

| Doc | What's inside |
|---|---|
| [PLAN.md](./PLAN.md) | Full build plan (Anchor program, web, Seeker mobile) |
| [DESCRIPTION.md](./DESCRIPTION.md) | Short/medium/long project descriptions |
| [TECH-STACK.md](./TECH-STACK.md) | Every tool and framework we use |
| [TOKENS.md](./TOKENS.md) | Supported tokens now + future token plan |
| [ADD-TOKEN.md](./ADD-TOKEN.md) | How to add a new token (BONK, JUP…) in ~5 minutes |
| [REVENUE.md](./REVENUE.md) | How Packet makes money (fees + more) |
| [DATABASE.md](./DATABASE.md) | Neon Postgres setup + Helius webhook (persistent history) |
| [BLINKS-ACTIONS.md](./BLINKS-ACTIONS.md) | Solana Actions & Blinks roadmap |

---

## What Packet does

Send $10 → boring.
**Drop a $100 Packet — 10 people can claim it.** 🧧

- Equal distribution (everyone gets the same)
- Random distribution (VRF-secured luck)
- Share by link, QR, or any chat
- Expiring packets, refunds of unclaimed funds
- Built with Anchor today, rebuilt on Aegis 🔱 later

## Repo layout

```text
packets/
├── docs/      # all product/design docs (this file lives here)
├── program/   # Anchor Solana program
├── sdk/       # Shared TS SDK (web + mobile)
├── web/       # Vite + React app
├── api/       # Hono server (OG previews + Blinks)
└── mobile/    # React Native app (Solana Seeker)
```

## Status

Foundational Product Specification → MVP build in progress.
Devnet first, mainnet after audits and testing.

> Built with Aegis. Powered by Solana. Built from Africa. Built for the world.
