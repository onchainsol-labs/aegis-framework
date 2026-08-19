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

-- Short share codes → packet ids (packet.app/s/<code>)
create table if not exists short_links (
  code       text primary key,
  packet_id  text not null references packets(id),
  created_at timestamptz not null default now()
);
