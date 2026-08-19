# PACKET 🧧 — UI Mockups & Direction (ASCII Wireframes)

Mobile-first sketches. Every screen: playful, warm, zero crypto jargon.
The envelope is the hero object on every screen.

---

## Design Direction (quick)

| Element | Direction |
|---|---|
| Feel | Playful, warm, celebratory — NOT a crypto dashboard |
| Colors | Envelope red `#E13A2F`, gold `#F5B842`, cream bg `#FFF7EC`, ink `#1F1B16` |
| Type | Rounded display font for amounts, clean sans for labels |
| Motion | Flap opens → card slides up → count-up number → confetti |
| Language | "Drop" / "Open" / "Claim" — never "sign transaction" |

---

## 1. Home (mobile) — personal view, no feed for MVP

MVP rule: you only see packets YOU created or claimed. Other people's
packets reach you exclusively via the shared link.

```text
┌────────────────────────────────┐
│  🧧 PACKET          [wallet ⓟ]│
│  Money worth opening           │
│                                │
│  Your packets                  │
│  ┌──────────────────────────┐  │
│  │      🧧                   │  │
│  │   $100 · Random          │  │
│  │   ▓▓▓▓▓▓▓░░░ 7/10 left   │  │
│  │   59m left · [Share]     │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │      🧧                   │  │
│  │   $50 · Equal            │  │
│  │   ▓▓▓▓░░░░░░ 3/20 left   │  │
│  │   2h left · [Share]      │  │
│  └──────────────────────────┘  │
│                                │
│  Claimed                       │
│  ✓ $12.40 from @whoelse        │
│  ✓ $5.00 from @dora            │
│                                │
│  ┌──────────────────────────┐  │
│  │     [+ Drop a Packet]    │  │
│  └──────────────────────────┘  │
│  [Home]  [Scan]  [History]     │
└────────────────────────────────┘
```

Phase 2 adds: live/public packets, profiles, activity feed.

---

## 2. Create Flow (stepper)

### Step 1 — Amount + token
```text
┌────────────────────────────────┐
│  ← Drop a Packet        1/5    │
│                                │
│  How much?                     │
│  ┌──────────────────────────┐  │
│  │           $100           │  │
│  └──────────────────────────┘  │
│                                │
│  [USDC ●]  [SOL]  [SKR]        │
│                                │
│  Balance: $240.00 USDC         │
│                                │
│              [Continue →]      │
└────────────────────────────────┘
```

### Step 2 — Recipients
```text
┌────────────────────────────────┐
│  ← Drop a Packet        2/5    │
│                                │
│  How many people?              │
│  ┌──────────────────────────┐  │
│  │          10  people      │  │
│  └──────────────────────────┘  │
│  [-][+]                         │
│                                │
│  Each gets $10 if Equal        │
│  (Random = luck, 0–2x)        │
│              [Continue →]      │
└────────────────────────────────┘
```

### Step 3 — Distribution mode
```text
┌────────────────────────────────┐
│  ← Drop a Packet        3/5    │
│                                │
│  How is it split?              │
│  ┌──────────────────────────┐  │
│  │  ⚖️ EQUAL                │  │
│  │  Everyone gets $10       │  │
│  │                    (●)   │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  🎲 RANDOM               │  │
│  │  Luck! Shares vary       │  │
│  │                    ( )   │  │
│  └──────────────────────────┘  │
│              [Continue →]      │
└────────────────────────────────┘
```

### Step 4 — Expiry
```text
┌────────────────────────────────┐
│  ← Drop a Packet        4/5    │
│                                │
│  Expires in?                   │
│  [1 hour] [6 hours] [24h]      │
│  [Never]                       │
│                                │
│  Unclaimed money returns       │
│  to you. 🪙                     │
│              [Continue →]      │
└────────────────────────────────┘
```

### Step 5 — Review & Drop
```text
┌────────────────────────────────┐
│  ← Drop a Packet        5/5    │
│                                │
│  ┌──────────────────────────┐  │
│  │      🧧                   │  │
│  │   $100 · 10 people       │  │
│  │   Random · 1 hour        │  │
│  │   USDC                   │  │
│  └──────────────────────────┘  │
│                                │
│  Packet amount      $100.00    │
│  Fee (1%)          + $1.00     │
│  ─────────────────────────     │
│  You pay            $101.00    │
│                                │
│       [ ✨ Drop Packet ]       │
└────────────────────────────────┘
```

---

## 3. Claim Experience (the money shot)

### Closed
```text
┌────────────────────────────────┐
│                                │
│          ┌──────────┐          │
│          │    🧧    │          │
│          │ $100     │          │
│          │ 7/10 left│          │
│          │ Random   │          │
│          └──────────┘          │
│      by @whoelse · 59m left    │
│                                │
│      [ 🔓 OPEN PACKET ]        │
│                                │
│  Shares are random. Good luck! │
└────────────────────────────────┘
```

### Opening (VRF suspense)
```text
┌────────────────────────────────┐
│                                │
│          ┌──────────┐          │
│          │  flap    │          │
│          │  /rotates\          │
│          │   🧧  ↑  │          │
│          └──────────┘          │
│                                │
│      Opening your packet…      │
│      ▓▓▓▓▓▓▓░░░░░░░░          │
└────────────────────────────────┘
```

### Revealed
```text
┌────────────────────────────────┐
│          ✨ 🎉 ✨              │
│          ┌──────────┐          │
│          │  $12.40  │          │
│          │  USDC    │          │
│          │  (counts up)        │
│          └──────────┘          │
│                                │
│     You got $12.40! 🧧         │
│                                │
│  [Share]   [Drop your own]     │
└────────────────────────────────┘
```

---

## 4. Share Sheet

```text
┌────────────────────────────────┐
│  Share your Packet 🧧          │
│  ┌──────────────────────────┐  │
│  │ packet.app/p/7x92... ⧉   │  │
│  └──────────────────────────┘  │
│                                │
│  [WhatsApp] [Telegram] [X]     │
│  [Copy link]  [QR code]        │
│  ──────────────────────────    │
│  "I dropped $100 — first 10    │
│   to open get a share! 🧧"     │
└────────────────────────────────┘
```

---

## 5. History

```text
┌────────────────────────────────┐
│  History          [Created|Claimed]│
│                                │
│  🧧 $100 · 7/10 claimed        │
│     Random · Active · 59m left │
│  🧧 $50 · 20/20 claimed        │
│     Equal · Completed ✅        │
│  🧧 $25 · 2/5 claimed          │
│     Equal · Expired · $15 back │
└────────────────────────────────┘
```

---

## 6. Scan (Seeker / events)

```text
┌────────────────────────────────┐
│  ┌──────────────────────────┐  │
│  │    [camera viewfinder]    │  │
│  │        ╔══════╗          │  │
│  │        ║ QR 🧧║          │  │
│  │        ╚══════╝          │  │
│  └──────────────────────────┘  │
│  Scan a Packet to open it      │
│                                │
│  [ 🔦 ]  [ 📷 ]                │
└────────────────────────────────┘
```

---

## 7. Blink card (in-feed claim)

```text
┌────────────────────────────────┐
│  🧧 PACKET                     │
│  $100 · Random · USDC          │
│  ▓▓▓▓▓▓▓░░░ 7/10 left         │
│  by @whoelse                   │
│                                │
│  [ Claim ]                     │
│  ⓘ 59m left · claim in-feed   │
└────────────────────────────────┘
```

---

## 8. Desktop Web (home)

```text
┌──────────────────────────────────────────────────────┐
│  🧧 PACKET  Your Packets  Create  History  [Connect] │
│──────────────────────────────────────────────────────│
│                                                      │
│  Money worth opening.                                │
│  Drop a packet. Share the link. Watch it get opened. │
│  (MVP: your packets only — no public feed yet)       │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │    🧧       │  │    🧧       │  │    🧧       │   │
│  │  $100       │  │  $50        │  │  $25        │   │
│  │  7/10 left  │  │  3/20 left  │  │  2/5 left   │   │
│  │  Random     │  │  Equal      │  │  Equal      │   │
│  │  [Open]     │  │  [Open]     │  │  [Open]     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │            [+ Drop a Packet]                   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Motion & micro-interactions

| Moment | Animation |
|---|---|
| Packet card hover | Slight lift + envelope tilts toward you |
| Open | Flap rotates open, card slides up, amount counts up, confetti burst |
| VRF wait | "Opening…" with animated progress — anticipation is the feature |
| Claim success | Number ticks up 0 → $12.40, gold shimmer |
| Packet completed | Card deflates, "ALL CLAIMED ✅" stamp |
| Expired | Card grays out, "returned to creator" |
| Drop success | Envelope flies out of the button, link copies itself |

## Empty states

```text
┌────────────────────────────────┐
│                                │
│         🧧  (big, faded)       │
│  No packets here yet           │
│  Drop your first one —         │
│  it takes 10 seconds.          │
│                                │
│      [ + Drop a Packet ]       │
└────────────────────────────────┘
```

---

## Rules that protect the feel

1. No hashes, no "program-derived account", no jargon — advanced view only
2. Money amounts always big, rounded, centered
3. Every claim ends with a share prompt (the growth loop)
4. The envelope is the only "financial" object users ever see
