# PACKET 🧧 — Tokens We Support

## Launch tokens (MVP)

| Token | Type | Notes |
|---|---|---|
| **USDC** | SPL stablecoin | Primary token. The default choice for packets — predictable value. |
| **SKR** | SPL token | Community token. Same packet mechanics, same vault logic. |
| **SOL** | Native | Handled as native lamports in the vault (wrapped SOL where needed). Enables zero-token-setup drops. |

### SOL handling note
SOL is not an SPL token, so the program supports two vault types:
1. **Native vault** (system-owned PDA holding lamports) — simplest for SOL packets.
2. **Token vault** (SPL token account PDA) — used for USDC, SKR, and any other SPL.

The SDK hides this difference — users just pick a token.

## Fees are taken in the packet's own token
If someone drops a USDC packet → fee in USDC. SOL packet → fee in SOL. No forced conversion.

---

## Future token plan

### Phase 2 — more stables & majors
- **USDT** — second stablecoin option
- **PYUSD** — if demand shows up
- **EURC / cNGN** — stablecoin rails for African markets (community rewards, remittances)

### Phase 3 — community & creator tokens
- Any SPL token via a permissionless allowlist (creator can drop any token they hold, with a warning UI for unknown mints)
- Token-holder packets: only holders of token X can claim (eligibility rules)

### Phase 4 — NFT & gated
- NFT-holder packets (own a collection → claim)
- Soulbound/identity-gated packets

## Adding a new token

See [ADD-TOKEN.md](./ADD-TOKEN.md) — one registry entry + one logo, ~5 minutes, zero program changes.

## Token risk rules
- Unknown mints get a "⚠️ unverified token" badge in the UI
- Verified token list maintained by the team (on-chain registry later)
- Random distribution works identically for any SPL mint
