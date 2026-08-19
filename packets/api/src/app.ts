import { Hono } from "hono";
import { cors } from "hono/cors";
import { pool } from "./db.js";
import { parseEventsFromLogs, type ParsedEvent } from "./events.js";

export const app = new Hono();

// Web app (vite dev server / static deploy) calls the API cross-origin.
app.use("*", cors());

// ---------------------------------------------------------------- health
app.get("/health", (c) => c.json({ ok: true }));

// ------------------------------------------------- wallet history
app.get("/packets", async (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet query param required" }, 400);
  const [created, claimed] = await Promise.all([
    pool.query("select * from packets where creator = $1 order by created_at desc", [wallet]),
    pool.query(
      "select p.*, cl.amount as my_amount, cl.claimed_at from claims cl join packets p on p.id = cl.packet_id where cl.claimer = $1 order by cl.claimed_at desc",
      [wallet],
    ),
  ]);
  return c.json({ created: created.rows, claimed: claimed.rows });
});

// ------------------------------------------- single packet (on-chain fallback)
app.get("/packets/:id", async (c) => {
  const id = c.req.param("id");
  const res = await pool.query("select * from packets where id = $1", [id]);
  if (res.rows[0]) {
    const claims = await pool.query(
      "select claimer, amount, claimed_at from claims where packet_id = $1 order by claimed_at asc",
      [id],
    );
    return c.json({ ...res.rows[0], claims: claims.rows });
  }

  // Fallback: read the account straight from the chain
  const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const rpcRes = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [id, { encoding: "base64" }] }),
  });
  const json = await rpcRes.json() as { result?: { value: { data: [string, string]; owner: string; lamports: number } | null } };
  if (!json.result?.value) return c.json({ error: "packet not found" }, 404);
  const { data, owner, lamports } = json.result.value;
  return c.json({ id, owner, lamports, data: data[0] });
});

// ------------------------------------------------------ client push: packet
app.post("/packets", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b?.id || !b?.creator || !b?.mint) return c.json({ error: "id, creator and mint required" }, 400);

  const total = String(b.total_amount ?? 0);
  const remaining = String(b.remaining_amount ?? b.total_amount ?? 0);
  const limit = Number(b.recipient_limit ?? 0);
  const mode = b.mode === "random" ? "random" : "equal";
  const expiresAt = Number(b.expires_at ?? 0);
  const status = String(b.status ?? "active");

  const res = await pool.query(
    `insert into packets (id, creator, mint, total_amount, remaining_amount, recipient_limit, claim_count, mode, expires_at, status, updated_at)
     values ($1,$2,$3,$4,$5,$6,0,$7,$8,$9, now())
     on conflict (id) do update set
       remaining_amount = excluded.remaining_amount,
       claim_count = excluded.claim_count,
       mode = excluded.mode,
       expires_at = excluded.expires_at,
       status = excluded.status,
       updated_at = now()
     returning *`,
    [b.id, b.creator, b.mint, total, remaining, limit, mode, expiresAt, status],
  );

  // New packet → bump creator totals
  if (res.rowCount === 1) {
    await pool.query(
      `update users set total_dropped = total_dropped + $1, packets_dropped = packets_dropped + 1, last_seen = now() where wallet = $2`,
      [total, b.creator],
    );
  }
  return c.json(res.rows[0], 201);
});

// ------------------------------------------------- client push: wallet connect
app.post("/users", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b?.wallet) return c.json({ error: "wallet required" }, 400);
  await pool.query(
    `insert into users (wallet, last_seen) values ($1, now())
     on conflict (wallet) do update set last_seen = now()`,
    [b.wallet],
  );
  return c.json({ ok: true }, 201);
});

// ------------------------------------------------------------ apply an event
async function applyEvent(e: ParsedEvent) {
  if (e.name === "PacketCreated") {
    await pool.query(
      `insert into packets (id, creator, mint, total_amount, remaining_amount, recipient_limit, claim_count, mode, expires_at, status)
       values ($1,$2,$3,$4,$4,$5,0,$6,$7,'active')
       on conflict (id) do update set
         total_amount = excluded.total_amount,
         remaining_amount = excluded.remaining_amount,
         recipient_limit = excluded.recipient_limit,
         mode = excluded.mode,
         expires_at = excluded.expires_at,
         status = 'active',
         updated_at = now()`,
      [e.packet, e.creator, e.mint, e.totalAmount.toString(), e.recipientLimit, e.mode, e.expiresAt.toString()],
    );
    await pool.query(
      `update users set total_dropped = total_dropped + $1, packets_dropped = packets_dropped + 1, last_seen = now() where wallet = $2`,
      [e.totalAmount.toString(), e.creator],
    );
  } else if (e.name === "PacketClaimed") {
    await pool.query(
      `insert into claims (packet_id, claimer, amount) values ($1,$2,$3)
       on conflict (packet_id, claimer) do nothing`,
      [e.packet, e.claimer, e.amount.toString()],
    );
    await pool.query(
      `update packets set
         remaining_amount = greatest(remaining_amount - $2, 0),
         claim_count = $3,
         status = case when $3 >= recipient_limit then 'completed' else status end,
         updated_at = now()
       where id = $1`,
      [e.packet, e.amount.toString(), e.claimCount],
    );
    await pool.query(
      `update users set total_claimed = total_claimed + $1, packets_claimed = packets_claimed + 1, last_seen = now() where wallet = $2`,
      [e.amount.toString(), e.claimer],
    );
  } else {
    // PacketRefunded → remaining goes to zero, packet closes
    await pool.query(
      `update packets set remaining_amount = 0, status = 'closed', updated_at = now() where id = $1`,
      [e.packet],
    );
  }
}

// ------------------------------------------------------------ short links
app.post("/s", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b?.packet_id) return c.json({ error: "packet_id required" }, 400);
  // Default code: first 8 chars of the packet PDA — unique per packet.
  const code = typeof b.code === "string" && b.code ? b.code : String(b.packet_id).slice(0, 8);
  await pool.query(
    "insert into short_links (code, packet_id) values ($1, $2) on conflict (code) do nothing",
    [code, b.packet_id],
  );
  const webUrl = process.env.WEB_URL ?? "https://packet.app";
  return c.json({ code, url: `${webUrl}/s/${code}` }, 201);
});

app.get("/s/:code", async (c) => {
  const res = await pool.query("select packet_id from short_links where code = $1", [c.req.param("code")]);
  if (!res.rows[0]) return c.json({ error: "link not found" }, 404);
  const webUrl = process.env.WEB_URL ?? "https://packet.app";
  return c.redirect(`${webUrl}/p/${res.rows[0].packet_id}`, 302);
});

// -------------------------------------------------------------- Helius webhook
app.post("/webhook/helius", async (c) => {
  const secret = process.env.HELIUS_WEBHOOK_SECRET ?? "";
  if (secret) {
    const auth = c.req.header("Helius-Webhook-Secret") ?? c.req.header("Authorization");
    if (auth !== secret) return c.json({ error: "unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const txs = Array.isArray(body) ? body : body?.transactions ?? [];
  let applied = 0;
  for (const tx of txs) {
    const logs: string[] = tx?.meta?.logMessages ?? tx?.transaction?.meta?.logMessages ?? [];
    if (!logs.length) continue;
    for (const e of parseEventsFromLogs(logs)) {
      await applyEvent(e);
      applied++;
    }
  }
  return c.json({ ok: true, applied });
});
