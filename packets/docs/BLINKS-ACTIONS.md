# PACKET 🧧 × Solana Actions & Blinks

Packet is shareable money. Blinks are shareable transactions. They're made for each other.

---

## What they are

- **Action** — an API endpoint that returns metadata + a Solana transaction ("claim this packet").
- **BLink** — a URL that unfurls into an interactive card (works on X, Discord, Telegram, websites).

## Why this fits Packet

Packet's core loop is **Drop → Share → Claim**. Today the share link sends people to `packet.app`. With Blinks, the claim experience happens **inside the feed** — no app switch, no friction.

```text
Creator drops a Packet
        ↓
Posts the blink in a group / on X
        ↓
Followers see "🧧 $100 Packet — 7/10 left [Claim]"
        ↓
They click Claim, sign in their wallet
        ↓
Done. Confetti. They share it too.
```

Claiming without leaving the chat = more claims, more shares, faster growth loop.

---

## Actions we'll ship

| Action | Endpoint | What it does |
|---|---|---|
| **Claim packet** | `GET/POST packet.app/api/actions/claim/:packet` | Interactive card: packet state + Claim button |
| **Drop packet** | `GET/POST packet.app/api/actions/drop` | Creator funds a preset packet straight from a post |
| **Packet status** | `GET packet.app/api/actions/status/:packet` | Live "claimed 7/10" card for embeds |
| **Refund packet** | `GET/POST packet.app/api/actions/refund/:packet` | Creator reclaims unclaimed funds after expiry |

## Blink states (what the card shows)

```text
🧧 $100 Packet — 7/10 claimed · Random · 59m left
   [ Claim ]                    ← active

🧧 $100 Packet — COMPLETE
   Winners: 10 · You missed it   ← done

🧧 $100 Packet — EXPIRED
   Creator refunded $30          ← expired
```

## Rules & security

- Blink endpoints are stateless: they read the packet account on-chain (same source of truth as the app).
- Every blink tx is built by the shared `sdk/` — identical validation to the app.
- VRF claims still work via blink (the card shows "Opening…" then settles).
- Rate-limit claim actions to stop bots (simple per-IP throttle + on-chain claim rules still apply).

## Mobile / Seeker

Blinks render in X's in-app browser and the dApp Store browser on Seeker. The deep link fallback (`packet.app/p/...`) opens the native app when the user prefers it.

---

## Roadmap

| Phase | Ship |
|---|---|
| 1 | Claim action + status action (MVP) |
| 2 | Drop action (create from a post) |
| 3 | Sponsor/creator blinks, QR→blink at events |
| 4 | Blink SDK in `sdk/` for third parties |
