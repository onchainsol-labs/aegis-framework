# PACKET 🧧 — Revenue & Fees

How Packet makes money, baked into the product from day one.

---

## MVP: Platform fee (1%)

Every packet pays a small fee at **fund time**, added **on top** of the packet amount — never deducted from it.

```text
Creator wants to drop $100
        ↓
Creator funds $100 + $1 fee = $101 total
        ↓
$1 → fee collector's ATA (direct, no vault)
$100 → packet vault → recipients get the FULL $100
```

| Property | Rule |
|---|---|
| Rate | 1% (configurable in the on-chain Config account) |
| Token | Same token as the packet (USDC fee for USDC packets, etc.) |
| Timing | Taken once, when the packet is funded |
| Transparency | Shown in the create flow: "$100 packet + $1 fee = $101 total" |
| Refunds | Fee is NOT refunded when unclaimed funds are returned. No fee is taken on the refund either — the creator gets 100% of what's unclaimed. |
| Unclaimed funds | ALWAYS belong to the creator. The protocol never sweeps leftover funds — `sweep_expired` (Phase 2) force-refunds them to the creator so they never sit locked. |
| Withdrawal | None needed — fees land directly in the fee collector's ATA (multisig wallet later). Config admin can change the collector address. |

Rule: **what you drop is what they get.** The fee is always extra, on top.

Goal: small enough that users don't think about it.

---

## Later revenue streams

| Stream | What it is | When |
|---|---|---|
| **Premium Packets** | Advanced rules: eligibility, branding, bigger limits | Phase 2–3 |
| **Sponsored Packets** | Brands fund distributions, pay placement | Phase 3 |
| **API / SDK** | Businesses create packets programmatically (metered) | Phase 4 |
| **Embedded Packet** | Other apps integrate Packet; rev share or fee | Phase 4 |
| **Business Accounts** | Recurring campaign tools, analytics | Phase 4 |
| **Creator Tools** | Dashboards, analytics, scheduled drops | Phase 3 |

## Who pays what

| | Creator | Claimer |
|---|---|---|
| Platform fee (1%) | ✅ Added on top at fund time | ❌ Never |
| Solana network fee | ~dust per tx | ~dust per tx (~0.000005 SOL) |
| Amount | Funds packet | Receives full share |

Claiming is **free** — claimers only pay Solana's own network fee (a fraction of a cent), and receive their full share. No platform fee touches claims.

**Edge case:** a claimer needs a tiny bit of SOL to sign the claim tx. For zero-balance wallets (a stranger's first packet), plan for fee sponsorship via a relayer or a first-claim SOL dust flow — Phase 2 polish, not MVP blocker.

## How the fee is enforced on-chain

1. `Config` PDA stores: fee bps, fee collector, admin.
2. `create_and_fund` splits the deposit: packet amount → packet vault, fee (extra, on top) → fee collector's ATA, all in one tx.
3. No fee vault PDA exists, so there's nothing for an attacker to pre-create and brick. Admin becomes a multisig before mainnet.

No token needed. No speculation. Revenue = usage × fee.
