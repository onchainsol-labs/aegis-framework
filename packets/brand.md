# Brand — PACKET 🧧

_Status: active — source of truth for all frontend work._

## Story

Red envelope (🧧) money gifting, reimagined as a consumer product. Playful, warm, celebratory. It must NOT look like a crypto dashboard — no hashes, no jargon, envelope first. Every screen should feel like opening something.

## Palette

| Token | Hex | Role |
|---|---|---|
| `envelope` | `#E13A2F` | Primary red — envelope body, primary buttons, active states |
| `envelope-deep` | `#B92A21` | Darker red — hover/pressed, flap shadow |
| `gold` | `#F5B842` | Accent — seal, highlights, confetti, progress |
| `gold-soft` | `#FBE3B3` | Soft gold fills, chips |
| `cream` | `#FFF7EC` | Page background |
| `ink` | `#1F1B16` | Text, borders, dark surfaces |
| `ink-soft` | `#6B6257` | Secondary text |

## Typography

- **Display / amounts:** Nunito (rounded, warm) — 800 for the big numbers
- **UI text:** Nunito — 400/600/700
- Amounts are always big, rounded, centered. Never right-aligned money.

## Voice

"Drop" / "Open" / "Claim" — never "sign transaction". Warm, short, second person. "Money worth opening."

## Motion

- Envelope flap rotates open → inner card slides up → amount counts up → confetti bursts
- VRF wait = "Opening your packet…" with animated progress (anticipation is the feature)
- Springy but disciplined: 250–500ms, `prefers-reduced-motion` respected

## Rules

1. No hashes, no PDAs, no jargon — advanced view only
2. Money amounts always big, rounded, centered
3. Every claim ends with a share prompt (the growth loop)
4. The envelope is the only "financial" object users ever see
