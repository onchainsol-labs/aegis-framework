import { createHash } from "node:crypto";
import bs58 from "bs58";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../src/db.js";
import { app } from "../src/app.js";

vi.mock("../src/db.js", () => ({
  pool: { query: vi.fn() },
}));

const PROGRAM = "58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD";

// The real pool.query returns pg's QueryResult; our mock is plain vi.fn(),
// so give it the same shape explicitly for TS.
type Row = Record<string, unknown>;
type QueryResultLike = { rows: Row[]; rowCount: number };
const query = pool.query as unknown as {
  (...args: unknown[]): Promise<QueryResultLike>;
  mockReset: () => void;
  mockResolvedValue: (v: QueryResultLike) => void;
  mockResolvedValueOnce: (v: QueryResultLike) => {
    (...args: unknown[]): Promise<QueryResultLike>;
    mockReset: () => void;
    mockResolvedValue: (v: QueryResultLike) => void;
    mockResolvedValueOnce: (v: QueryResultLike) => unknown;
    mock: { calls: unknown[][] };
  };
  mock: { calls: unknown[][] };
};

const disc = (name: string) =>
  createHash("sha256").update(`event:${name}`).digest().subarray(0, 8);

const key = (s: string) => bs58.decode(s);

function packetCreatedLog(total = 100n) {
  const payload = Buffer.concat([
    key(PROGRAM), key(PROGRAM), key(PROGRAM),
    Buffer.alloc(8), Buffer.alloc(4), Buffer.from([0]), Buffer.alloc(8),
  ]);
  payload.writeBigUInt64LE(total, 96);
  payload.writeUInt32LE(10, 104);
  return `Program data: ${Buffer.concat([disc("PacketCreated"), payload]).toString("base64")}`;
}

beforeEach(() => {
  query.mockReset();
});

afterEach(() => {
  delete process.env.HELIUS_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /packets", () => {
  it("400s without a wallet", async () => {
    const res = await app.request("/packets");
    expect(res.status).toBe(400);
  });

  it("returns created + claimed for a wallet", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: "p1" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: "p2", my_amount: "5" }], rowCount: 1 });

    const res = await app.request("/packets?wallet=abc");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: Row[]; claimed: Row[] };
    expect(body.created).toEqual([{ id: "p1" }]);
    expect(body.claimed).toEqual([{ id: "p2", my_amount: "5" }]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("GET /packets/:id", () => {
  it("returns the db row with claims when present", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: "p1", status: "active" }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ claimer: "c1", amount: "5", claimed_at: "2026-08-14T10:00:00Z" }],
        rowCount: 1,
      });
    const res = await app.request("/packets/p1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "p1",
      status: "active",
      claims: [{ claimer: "c1", amount: "5", claimed_at: "2026-08-14T10:00:00Z" }],
    });
  });

  it("falls back to the chain when missing from the db", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ result: { value: { data: ["aGk=", "base58"], owner: "own", lamports: 42 } } }),
          { status: 200 },
        ),
      ),
    );

    const res = await app.request("/packets/unknown");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "unknown", owner: "own", lamports: 42, data: "aGk=" });
  });

  it("404s when neither db nor chain has it", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { value: null } }), { status: 200 })),
    );
    const res = await app.request("/packets/unknown");
    expect(res.status).toBe(404);
  });
});

describe("POST /packets", () => {
  const body = {
    id: "p1",
    creator: "c1",
    mint: "m1",
    total_amount: 100,
    recipient_limit: 10,
    mode: "equal",
    expires_at: 0,
  };

  it("400s without id/creator/mint", async () => {
    const res = await app.request("/packets", { method: "POST", body: JSON.stringify({ id: "p1" }) });
    expect(res.status).toBe(400);
  });

  it("upserts and bumps creator totals on insert", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "p1" }], rowCount: 1 });
    const res = await app.request("/packets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("total_dropped");
    expect(query.mock.calls[1][1]).toEqual(["100", "c1"]);
  });

  it("does not bump totals when the packet already existed", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "p1" }], rowCount: 0 });
    const res = await app.request("/packets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("POST /users", () => {
  it("400s without a wallet", async () => {
    const res = await app.request("/users", { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it("upserts the user row", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await app.request("/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: "w1" }),
    });
    expect(res.status).toBe(201);
    expect(query.mock.calls[0][1]).toEqual(["w1"]);
  });
});

describe("short links", () => {
  it("creates a code from the packet id", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await app.request("/s", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packet_id: "3A9j7V78mwZR1h21czXyjPvhgqdeP1RaSzupCGfxQgSs" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string; url: string };
    expect(body.code).toBe("3A9j7V78");
    expect(body.url).toBe("https://packet.app/s/3A9j7V78");
    expect(query.mock.calls[0][1]).toEqual(["3A9j7V78", "3A9j7V78mwZR1h21czXyjPvhgqdeP1RaSzupCGfxQgSs"]);
  });

  it("400s without a packet_id", async () => {
    const res = await app.request("/s", { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(400);
  });

  it("redirects to the packet page", async () => {
    query.mockResolvedValueOnce({
      rows: [{ packet_id: "3A9j7V78mwZR1h21czXyjPvhgqdeP1RaSzupCGfxQgSs" }],
      rowCount: 1,
    });
    const res = await app.request("/s/3A9j7V78", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://packet.app/p/3A9j7V78mwZR1h21czXyjPvhgqdeP1RaSzupCGfxQgSs",
    );
  });

  it("404s for unknown codes", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await app.request("/s/nope");
    expect(res.status).toBe(404);
  });
});

describe("POST /webhook/helius", () => {
  it("401s when the secret is set and the header is wrong", async () => {
    process.env.HELIUS_WEBHOOK_SECRET = "shh";
    const res = await app.request("/webhook/helius", {
      method: "POST",
      headers: { "Helius-Webhook-Secret": "wrong" },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("accepts when the secret matches", async () => {
    process.env.HELIUS_WEBHOOK_SECRET = "shh";
    const res = await app.request("/webhook/helius", {
      method: "POST",
      headers: { "Helius-Webhook-Secret": "shh" },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: 0 });
  });

  it("applies a PacketCreated event from logs", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 1 });
    const res = await app.request("/webhook/helius", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ meta: { logMessages: [packetCreatedLog()] } }]),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: 1 });
    expect(query.mock.calls[0][0]).toContain("insert into packets");
    expect((query.mock.calls[0][1] as unknown[])[0]).toBe(PROGRAM); // packet id
    expect(query.mock.calls[1][0]).toContain("total_dropped");
  });

  it("handles logs nested under transaction.meta", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 1 });
    const res = await app.request("/webhook/helius", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ transaction: { meta: { logMessages: [packetCreatedLog()] } } }]),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: 1 });
  });

  it("ignores txs without logs", async () => {
    const res = await app.request("/webhook/helius", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ signature: "s" }]),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: 0 });
    expect(query).not.toHaveBeenCalled();
  });
});
