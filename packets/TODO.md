# PACKET 🧧 — Build TODO

Master checklist. Keep this file updated as we build.
MVP = Program ✅ → SDK ✅ → Web ✅ → share/claim loop working on devnet.

---

## Phase 0 — Scaffold

- [x] Monorepo folders: `program/` (created). `sdk/`, `web/`, `api/`, `mobile/` pending
- [x] Docs organized: all spec `.md` files → `docs/`, root `README.md` created
- [x] `.gitignore` files (root + `program/`)
- [x] `program/` Anchor workspace (anchor 0.32.1, program named `packet`)
- [ ] `sdk/` TS package
- [ ] `web/` Vite + React app

## Phase 1 — Anchor program: Equal distribution end-to-end

- [x] `Config` account (fee bps, fee collector, admin) + `initialize_config`
- [x] `Packet` account (creator, mint, total, remaining, per_claim, limit, claim_count, mode, expiry, status, claims vec)
- [x] Token vault PDA
- [x] `create_and_fund` (one tx: create + fund + take 1% fee on top)
- [x] `claim_packet` (validation → transfer vault→claimer → counters, same-instruction invariant)
- [x] `refund_packet` (after expiry/completion: return unclaimed remainder, close accounts)
- [x] `update_config` (written). Fees go straight to the fee collector's ATA on drop — no fee vault, no `withdraw_fees`
- [ ] `sweep_expired` keeper instruction (Phase 2): anyone can force-refund an expired packet to its creator so funds never sit locked in a vault forever
- [x] Errors module
- [x] Core invariant enforced: distributed ≤ funded, remaining_amount reduced in the same ix as every vault transfer
- [x] MAX_RECIPIENTS = 100 (~3.4KB packet account)
- [ ] ⚠️ `anchor build` compiles clean — BLOCKED: SBF toolchain corrupted, needs `anchor build -- --force-tools-install`
- [ ] Full TS test suite (happy paths + attack paths) — written, needs an `anchor test` run on localnet
- [ ] Deploy to devnet, smoke test

## Phase 2 — SDK (`sdk/`)

- [ ] IDL types
- [ ] `createPacket()` — builds `create_and_fund` tx
- [ ] `claimPacket()` — builds claim tx
- [ ] `refundPacket()`
- [ ] `getPacket()` — fetch + parse account
- [ ] PDA derivation + share-link helpers (`packet.app/p/<address>`)
- [ ] Token registry (USDC, SKR) + live decimals from chain

## Phase 2b — Web MVP (`web/`)

- [x] Vite + React + Tailwind + framer-motion scaffold
- [x] Wallet connect (demo identity behind `lib/wallet.ts` — real wallet-adapter lands with the SDK)
- [x] Route `/` — your packets (personal view, no feed)
- [x] Route `/create` — stepper: amount → recipients → mode → expiry → review (fee shown) → drop
- [x] Route `/p/:address` — envelope claim page: closed → open → count-up + confetti
- [x] Route `/history` — created/claimed lists
- [x] Share sheet (copy link, WhatsApp/Telegram/X)
- [x] Red-envelope brand: `#E13A2F` red, `#F5B842` gold, `#FFF7EC` cream, `#1F1B16` ink (+ `brand.md`)
- [x] Mock data layer behind `lib/packetClient.ts` — one-import swap to the real SDK
- [ ] Wire real SDK + wallet-adapter (swap mock)
- [ ] Deploy static (Cloudflare Pages / Vercel)

## Phase 2c — Database (Neon Postgres) — see `docs/DATABASE.md`

- [ ] Neon project created, `DATABASE_URL` saved
- [ ] Helius account + webhook created (program address `58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD`)
- [ ] `api/` Hono server: `GET /packets?wallet=`, `GET /packets/:id`, `POST /packets` (client push), `POST /users` (wallet connect → upsert user row), `POST /webhook/helius`, `GET /health`
- [ ] Schema applied (`pnpm db:setup`)
- [ ] Client push on drop (optimistic instant history)
- [ ] Webhook upsert verified with a real claim
- [ ] Web app wallet connect → history from Neon (no localStorage)

## Phase 3 — Random via Switchboard VRF

- [ ] VRF integration: `claim` requests randomness → oracle callback settles pending claim
- [ ] `settle_random_claim` instruction
- [ ] Web: "Opening your packet…" suspense state

## Phase 4 — Seeker mobile app

- [ ] Expo dev client + Mobile Wallet Adapter (Seed Vault)
- [ ] Home / Create / Packet / Scan / History screens
- [ ] App Links `packet.app/p/...` → open in app
- [ ] QR scan → packet

## Phase 5 — Blinks & API (`api/`)

- [ ] Hono server: OG preview meta for `/p/:address`
- [ ] Action: claim packet (`GET/POST /api/actions/claim/:packet`)
- [ ] Action: packet status
- [ ] Drop + refund actions (later)

## Phase 6 — Polish

- [ ] Envelope open animation, count-up, confetti
- [ ] QR event flow
- [ ] Fee tuning / admin
- [ ] Fee sponsorship for zero-SOL claimers (relayer or first-claim dust)

## Phase 7 — Aegis rewrite (dogfooding) 🔱

- [ ] Log every painful Anchor pattern (validation, PDA plumbing, token transfer boilerplate)
- [ ] Feed into Aegis V0: `aegis::vault`, `aegis::rewards`, `aegis::tokens`
- [ ] Rebuild `program/` on Aegis behind the same SDK interface
- [ ] Benchmark Anchor vs Aegis on the Packet codebase

---

## Locked decisions

| Decision | Choice |
|---|---|
| MVP tokens | USDC (primary) + SKR (registry entry). SOL native vault = fast follow. |
| Create + fund | One `create_and_fund` tx (instant drop feel) |
| Randomness (MVP) | Equal only. Random on Switchboard VRF (Phase 3) |
| Fee | 1% on top, never deducted from packet amount. Sent directly to the fee collector's ATA at fund time (no vault, no admin withdrawal). |
| Max recipients (MVP) | 100 (inline claims vec, ~3.4KB account ≈ 0.023 SOL rent). Unlimited later via claim-ticket PDAs. |
| Storage | No DB in MVP — all critical state on-chain |
| Unclaimed funds | ALWAYS return to the creator. Protocol never sweeps them, no refund fee. Fee paid once at drop, never refunded. |
| Networks | localnet → devnet → mainnet-beta |

## Current status

**Phase 1:** program written, `cargo check` clean — pending SBF build + tests.
**Phase 2b:** web MVP built and compiling — fully clickable on mock data. Next: run `pnpm dev` to feel it, then wire the real SDK when the program is on devnet.
