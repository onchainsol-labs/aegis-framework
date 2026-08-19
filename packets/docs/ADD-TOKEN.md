# PACKET 🧧 — How to Add a New Token

Adding a token (BONK, JUP, WIF, anything SPL) is **a client-side change only**.
The on-chain program is mint-agnostic — it never changes for new tokens.

---

## Why it's easy

The program stores nothing but a `mint: Pubkey` in each packet. Vault creation, funding, claiming, equal/random math, and the fee all work off that mint generically. So:

```text
New token = 1 registry entry + 1 logo. That's it.
```

---

## Steps (≈5 minutes for a standard SPL)

### 1. Find the mint address
From the token's official site or explorer (e.g. Solscan/Jupiter strict list).

```text
BONK → DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
JUP  → JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
```

### 2. Add one entry to the token registry

```ts
// sdk/src/token-registry.ts
export const TOKEN_REGISTRY: TokenInfo[] = [
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, verified: true },
  { symbol: "SOL",  mint: "NATIVE_SOL", decimals: 9, verified: true },
  { symbol: "SKR",  mint: "<skr-mint-address>", decimals: 6, verified: true },

  // 👇 adding BONK = adding this one line
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, verified: true },
];
```

### 3. Drop a logo in
`web/public/tokens/bonk.png` + `mobile/assets/tokens/bonk.png` (48×48 or 64×64).

### 4. Done — UI picks it up automatically
The token picker renders from the registry, so BONK now appears in:
- Create flow token picker
- Packet cards (balance display)
- History

---

## Time estimate

| Token type | Effort | What to do |
|---|---|---|
| Standard SPL (BONK, JUP, WIF…) | ~5 min | Steps 1–4 above |
| Unverified / custom mint | ~5 min | User pastes address in create flow; UI shows ⚠️ badge |
| Token-2022 with transfer fees | Medium (later) | Fee extension changes payout math — deferred to Phase 3 |
| NFT | Not supported | Different standard (Metaplex) — use NFT-gated packets instead (Phase 4) |

## Verified vs unverified

- **Verified** = team-vetted mint in the registry (no warning).
- **Unverified** = pasted custom address → shows "⚠️ Unverified token — make sure this is the real one."

## Checklist before marking verified

- [ ] Mint address from the official source
- [ ] Decimals match the mint account (or just leave `decimals` — SDK reads it live from chain anyway)
- [ ] Logo added to web + mobile
- [ ] One devnet claim test (drop $1, claim it back)
- [ ] Entry marked `verified: true`

---

## What NEVER changes

- ❌ Anchor program — mint-agnostic
- ❌ Distribution math (equal/random)
- ❌ Fee logic (fee in the packet's own token)
- ❌ Claim/refund flows

**One program. Infinite SPL tokens.** 🧧
