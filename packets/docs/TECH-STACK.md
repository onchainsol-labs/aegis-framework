# PACKET 🧧 — Tech Stack

Everything we use, layer by layer.

---

## On-chain (Anchor program)

| Area | Choice |
|---|---|
| Language | Rust |
| Framework | Anchor (later: Aegis 🔱) |
| Programs | Single `packet` program |
| Token standard | SPL Token |
| Randomness | Switchboard VRF (later compare: ORAO) |
| Oracles | Switchboard |
| Testing | Anchor TS tests + `solana-test-validator` |
| Localnet | `solana-test-validator` |
| Devnet | Solana devnet |

## Shared SDK (`sdk/`)

| Area | Choice |
|---|---|
| Language | TypeScript |
| Anchor client | `@coral-xyz/anchor` |
| Web3 | `@solana/web3.js` |
| Token helpers | `@solana/spl-token` |
| PDA/link logic | Lives here, shared by web + mobile |

## Web app (`web/`)

| Area | Choice |
|---|---|
| Build tool | Vite |
| Framework | React (SPA) |
| Language | TypeScript |
| Routing | react-router |
| Styling | Tailwind CSS |
| Animation | framer-motion |
| Wallet connection | `@solana/wallet-adapter-react` |
| QR | `qrcode` + `react-qr-code` |
| Share | Web Share API |
| Deployment | Static on Cloudflare Pages / Vercel |

## Mobile app (`mobile/`) — Solana Seeker

| Area | Choice |
|---|---|
| Framework | React Native (Expo dev client) |
| Wallet | `@solana-mobile/mobile-wallet-adapter-protocol` (Seed Vault) |
| Navigation | expo-router |
| Animation | react-native-reanimated |
| Camera/QR | react-native-vision-camera |
| Deep links | App Links (`packet.app/p/...`) + `packet://` scheme |
| Build target | Android (Seeker), iOS later |

## API & Blinks (`api/`)

| Area | Choice |
|---|---|
| Runtime | Hono on Cloudflare Workers (or Vercel edge) |
| Jobs | OG meta tags for `/p/:address` + Solana Actions endpoints |
| Source of truth | Reads packet accounts on-chain, stateless |

## Infra & tooling

| Area | Choice |
|---|---|
| Monorepo | Plain folders + pnpm workspaces (or Turborepo later) |
| Lint/format | eslint + prettier |
| CI | GitHub Actions (build + test on PR) |
| Indexing (later) | Helius webhooks or Geyser for claim history |
| Analytics | PostHog or Umami |
| Links | `packet.app` domain |
