# PACKET 🧧 — EVM Contract (Base)

Money worth opening. EVM port of the Solana Anchor program
(`../program`) — same logic, same invariants, different chain:
**Create → Drop → Share → Claim.**

- **Zero dependencies** — no OpenZeppelin. Minimal `IERC20` interface, works with USDC.
- **Packet id = incrementing counter** (the share-link slug — `/p/42`).
- **Funds live in the contract** — no separate vault account.
- **Fee on top, never deducted** — creator pays `totalAmount + fee`; the fee goes
  straight to the fee collector.
- **Equal mode only** — last claimer sweeps the dust, so nothing is ever left
  behind (same invariant as Solana). Random mode arrives later (Chainlink VRF or
  a sealed shuffle).

## Run it — that's the whole point

```bash
forge build   # compile
forge test    # 23 tests — double-claim, dust, expiry, refund, fee math
forge fmt     # format
```

## Deploy to Base

```bash
# Deploy (constructor: admin, feeBps, feeCollector), on Base mainnet:
forge create src/Packet.sol:Packet \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_KEY \
  --constructor-args $ADMIN 500 $FEE_COLLECTOR \
  --verify

# Or Base Sepolia testnet:
forge create src/Packet.sol:Packet \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --constructor-args $ADMIN 500 $FEE_COLLECTOR \
  --verify
```

The API indexer skips the DB: it reads `PacketCreated`, `PacketClaimed`, and
`PacketRefunded` logs straight off BaseScan/any Base RPC.

## Parity notes vs the Solana program

| Solana (`../program`) | Base (`src/Packet.sol`) |
|---|---|
| PDA = packet id | counter id |
| Vault token account | contract balance (per packet `remainingAmount`) |
| `claim_packet` | `claimPacket` |
| `refund_packet` | `refundPacket` |
| `create_and_fund` | `createPacket` |
| config PDA | `admin` / `feeBps` / `feeCollector` storage |
| random: `RandomNotSupported` | random: `RandomNotSupported` (same MVP line) |
| rent / account close | nothing to close — state is freed by overwrite |

## What's next

- Random mode (VRF or commit-reveal shuffle at creation — no oracle dep).
- Gas sponsorship via a paymaster so claimers don't pay.
- `script/Deploy.s.sol` for repeatable deploys.