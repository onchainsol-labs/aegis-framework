// Packet client — the single seam between the UI and the chain.
//
// REAL implementation: talks to the PACKET api (Hono + Neon Postgres).
// The DB is a UX speed layer — the program on-chain stays the source of truth.
//
// What's live now:
//   - wallet history from Neon (created + claimed)
//   - packet pages from Neon (claims included), with on-chain fallback in the api
//   - create → derives the real Packet PDA and pushes the row (fast path)
// What lands with the program on devnet (contract work):
//   - claimPacket / refundPacket — on-chain txs only

import { PublicKey } from "@solana/web3.js";
import type { CreatePacketInput, HomeData, Packet, PacketStatus } from "./types";
import { getWallet } from "./wallet";

const API_URL = import.meta.env.VITE_API_URL ?? "https://api.joyblox.fun";

export { API_URL };

// The packet program (matches the deployed program id).
const PROGRAM_ID = new PublicKey("58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD");

// Mint → symbol (mainnet). TODO: move to the shared sdk token registry.
const MINTS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3: "SKR",
};

const USDC_DECIMALS = 6; // TODO: live decimals from the registry

export interface PacketClient {
  getHomeData(): Promise<HomeData>;
  getPacket(id: string): Promise<Packet | null>;
  createPacket(input: CreatePacketInput): Promise<Packet>;
  claimPacket(id: string): Promise<{ packet: Packet; amount: number }>;
  refundPacket(id: string): Promise<Packet>;
}

// Raw shapes as returned by the api.
interface DbPacketRow {
  id: string;
  creator: string;
  mint: string;
  total_amount: string;
  remaining_amount: string;
  recipient_limit: number;
  claim_count: number;
  mode: string;
  expires_at: string | number;
  status: string;
  created_at: string;
  my_amount?: string;
}

interface DbClaimRow {
  claimer: string;
  amount: string;
  claimed_at: string;
}

const shortAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `API ${res.status}`);
  }
  return (await res.json()) as T;
}

/** DB row → UI Packet. Amounts in the DB are raw minor units (USDC = 6dp). */
function toPacket(row: DbPacketRow, myAddress?: string): Packet {
  const expiresSec = Number(row.expires_at);
  const expiresAt = expiresSec === 0 ? null : expiresSec * 1000;
  let status: PacketStatus =
    row.status === "completed" ? "completed" : row.status === "closed" ? "refunded" : "active";
  if (status === "active" && expiresAt != null && expiresAt <= Date.now()) status = "expired";
  const total = Number(row.total_amount) / 10 ** USDC_DECIMALS;
  const limit = row.recipient_limit;
  return {
    id: row.id,
    creator: row.creator,
    creatorName: shortAddress(row.creator),
    symbol: MINTS[row.mint] ?? "USDC",
    totalAmount: total,
    remainingAmount: Number(row.remaining_amount) / 10 ** USDC_DECIMALS,
    perClaim: limit > 0 ? Math.floor((total / limit) * 100) / 100 : 0,
    recipientLimit: limit,
    claimCount: row.claim_count,
    mode: row.mode === "random" ? "random" : "equal",
    expiresAt,
    status,
    createdAt: Date.parse(row.created_at),
    claims:
      myAddress && row.my_amount != null
        ? [{ who: myAddress, name: shortAddress(myAddress), amount: Number(row.my_amount) / 10 ** USDC_DECIMALS }]
        : [],
  };
}

/** Derives the packet PDA — same seeds as the program: ["packet", creator, nonce]. */
function derivePacketPda(creator: string): { id: string; nonce: string } {
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("packet"), new PublicKey(creator).toBuffer(), nonce],
    PROGRAM_ID,
  );
  const nonceHex = [...nonce].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { id: pda.toBase58(), nonce: nonceHex };
}

export const apiClient: PacketClient = {
  async getHomeData(): Promise<HomeData> {
    const me = getWallet();
    if (!me) return { created: [], claimed: [] };
    const data = await api<{ created: DbPacketRow[]; claimed: DbPacketRow[] }>(
      `/packets?wallet=${encodeURIComponent(me.address)}`,
    );
    return {
      created: data.created.map((r) => toPacket(r)),
      claimed: data.claimed.map((r) => toPacket(r, me.address)),
    };
  },

  async getPacket(id: string): Promise<Packet | null> {
    const res = await api<DbPacketRow & { claims?: DbClaimRow[] }>(`/packets/${encodeURIComponent(id)}`);
    if (!res.creator) return null; // on-chain fallback row — not a packet yet
    const packet = toPacket(res);
    packet.claims = (res.claims ?? []).map((c) => ({
      who: c.claimer,
      name: shortAddress(c.claimer),
      amount: Number(c.amount) / 10 ** USDC_DECIMALS,
    }));
    return packet;
  },

  async createPacket(input: CreatePacketInput): Promise<Packet> {
    const me = getWallet();
    if (!me) throw new Error("Connect a wallet first");
    const { id } = derivePacketPda(me.address);
    const total = Math.round(input.totalAmount * 10 ** USDC_DECIMALS);
    const body = {
      id,
      creator: me.address,
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      total_amount: total,
      remaining_amount: total,
      recipient_limit: input.recipientLimit,
      mode: input.mode,
      expires_at: input.expiresAt != null ? Math.floor(input.expiresAt / 1000) : 0,
    };
    const row = await api<DbPacketRow>("/packets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return toPacket(row);
  },

  async claimPacket(): Promise<{ packet: Packet; amount: number }> {
    throw new Error("Claiming goes live when the program ships on devnet.");
  },

  async refundPacket(): Promise<Packet> {
    throw new Error("Refunds go live when the program ships on devnet.");
  },
};

export const packetClient: PacketClient = apiClient;

/** Fee preview: 1% added on top, never deducted from the packet. */
export function feeFor(amount: number): number {
  return (amount * 100) / 10_000;
}
