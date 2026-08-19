# PACKET 🧧 — Database (Neon Postgres)

**Purpose:** persistent wallet history — created, claimed, and expired packets
survive browser storage clears. Wallet connects → everything's there.

**Rule (from PLAN.md):** the DB is a **UX speed layer only — never security.**
The program on-chain is always the source of truth. If the DB is wrong, the
product survives; if the program is wrong, nothing survives.

---

## 1. What you need to create (right now)

### A. Neon project (~2 min)
1. Go to https://neon.tech → sign in → **Create project** → pick a region
2. Grab the **connection string** (it looks like `postgresql://...`)
3. Save it as `DATABASE_URL` — you'll need it in the `api/` `.env`

### B. Helius webhook (~3 min)
1. Go to https://dev.helius.xyz → create an account → grab your **API key**
2. Create a **Webhook**:
   - **Webhook URL:** `https://<your-api-domain>/webhook/helius`
   - **Transaction type:** `any` (or: `createAccount` + `transfer` for a leaner feed)
   - **Accounts:** your `packet` program address `58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD`
   - Enable the **auth header** option → generate a secret
3. Save the secret as `HELIUS_WEBHOOK_SECRET` and your key as `HELIUS_API_KEY`

### C. Run the schema
```bash
cd api
cp .env.example .env      # fill in DATABASE_URL, HELIUS_WEBHOOK_SECRET
pnpm db:setup             # applies schema.sql to Neon
```

---

## 2. Schema

```sql
-- One row per connected wallet (upserted on wallet connect)
create table if not exists users (
  wallet          text primary key,        -- the wallet address
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  -- derived totals — kept fresh by events (webhook) + client pushes
  total_dropped   numeric not null default 0,
  total_claimed   numeric not null default 0,
  packets_dropped int     not null default 0,
  packets_claimed int     not null default 0
);

-- One row per packet (PDA address = primary key)
create table if not exists packets (
  id               text primary key,          -- packet PDA address
  creator          text not null,
  mint             text not null,
  total_amount     numeric not null,
  remaining_amount numeric not null,
  recipient_limit  int    not null,
  claim_count      int    not null,
  mode             text   not null,           -- 'equal' | 'random'
  expires_at       bigint not null,           -- unix seconds, 0 = never
  status           text   not null,           -- 'active' | 'completed' | 'closed'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One row per claim (unique per packet + claimer)
create table if not exists claims (
  packet_id  text        not null references packets(id),
  claimer    text        not null,
  amount     numeric     not null,
  claimed_at timestamptz not null default now(),
  primary key (packet_id, claimer)
);

create index if not exists idx_packets_creator on packets(creator);
create index if not exists idx_claims_claimer on claims(claimer);
```

---

## 3. Two write paths (both keep the DB in sync)

```text
USER connects their wallet
   │
   └─ ① CLIENT PUSH
         web app → POST /users { wallet } → Neon
         (upsert: first_seen set on first connect, last_seen bumped)
         → connecting = creating their account. Done.

CREATOR drops a packet
   │
   ├─ ① CLIENT PUSH (fast path)
   │     web app → POST /packets  → Neon  (instant "Your packets")
   │
   └─ ② WEBHOOK (authoritative)
         on-chain event → Helius → POST /webhook/helius → Neon
         (upserts the same packet; chain data wins)

CLAIMER opens a packet
   │
   └─ ② WEBHOOK only (the claimer's browser pushed nothing)
         PacketClaimed event → Helius → POST /webhook/helius → Neon
         (claim row inserted, packet counters updated)

REFUND / expiry
   └─ ② WEBHOOK only → status flips to 'closed' / 'expired'
```

**Why both?** Client push makes "just dropped" appear instantly. The webhook
is the safety net for everything else — especially claims, which always
happen on someone else's device. Writes are **idempotent upserts** keyed by
`packet id` (+ `claimer`), so ① and ② can arrive in any order safely.

---

## 4. API endpoints (`api/` — Hono)

| Method | Path | What |
|---|---|---|
| `GET` | `/packets?wallet=<addr>` | `{ created: [...], claimed: [...] }` — powers wallet history |
| `GET` | `/packets/:id` | Single packet (fast lookup; falls back to on-chain read) |
| `POST` | `/packets` | Client push after a drop (body = packet fields) |
| `POST` | `/users` | Client push on wallet connect → upsert user row (first/last seen) |
| `POST` | `/webhook/helius` | Helius events → upsert packets + claims + user totals |
| `GET` | `/health` | Liveness |

**Webhook security:** verify the `Helius-Webhook-Secret` header on every
request. Reject mismatches. The DB accepts upserts freely (idempotent) —
malformed rows can never move funds, only pollute a display list.

---

## 5. Env vars (`api/.env`)

```env
DATABASE_URL=postgresql://...            # from Neon
HELIUS_WEBHOOK_SECRET=...                # from the Helius webhook config
HELIUS_API_KEY=...                       # from Helius dashboard
RPC_URL=https://api.devnet.solana.com    # fallback reads from chain
```

---

## 6. What the web app does with it

1. Wallet connects → `GET /packets?wallet=...` → render created + claimed
   (expired included — status comes from the DB)
2. Drop succeeds → `POST /packets` (optimistic) → card appears instantly
3. Claim succeeds → nothing pushed (webhook handles it; UI refreshes on next load)
4. Link validity NEVER depends on the DB — it's always verified on-chain

---

## 7. Metrics, social & rankings

**The wallet address is the identity key — no registration step.** Everything
a user does is recorded with amounts and timestamps:

| Action | Table | Fields |
|---|---|---|
| Connect wallet | `users` (upsert) | `wallet`, `first_seen`, `last_seen` — the account is born here |
| Create | `packets` | `creator`, `total_amount`, `mint`, `mode`, `expires_at`, `status`, `created_at` |
| Claim | `claims` | `claimer`, `amount`, `claimed_at` |
| Refund / expiry | `packets` | `status` → `closed` / `expired` |

**Example queries (metrics we can ship today):**

```sql
-- Volume dropped per wallet (leaderboard-ready)
select creator, count(*) as packets, sum(total_amount) as volume_dropped
from packets group by creator order by volume_dropped desc;

-- Volume claimed per wallet
select claimer, count(*) as claims, sum(amount) as volume_claimed
from claims group by claimer order by volume_claimed desc;

-- Activity over time (for charts)
select date_trunc('day', created_at) as day, count(*), sum(total_amount)
from packets group by day order by day;
```

**Phase 2+ additions (when social ships):**
- `profiles` table — wallet → `@handle`, avatar, bio (wallet stays the anchor)

**⚠️ Sybil warning:** wallet addresses are public keys, not people. Anyone
can create unlimited wallets, so raw rankings are gameable. When
leaderboards arrive, rank on hard-to-fake signals (verified activity,
claim history depth), not raw counts.

## Checklist

- [ ] Neon project created, `DATABASE_URL` saved
- [ ] Helius account + webhook created, secret + key saved
- [ ] `api/.env` filled
- [ ] `pnpm db:setup` ran, tables exist
- [ ] `pnpm dev` → `/health` returns ok
- [ ] Dropped a packet → `POST /packets` wrote a row
- [ ] Claimed a packet → webhook wrote the claim row
