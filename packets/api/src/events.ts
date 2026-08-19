import { createHash } from "node:crypto";
import bs58 from "bs58";

// Anchor event discriminators: first 8 bytes of sha256("event:<Name>")
const DISC = (name: string) =>
  createHash("sha256").update(`event:${name}`).digest().subarray(0, 8);

const DISCRIMINATORS = new Map<string, ParsedEvent["name"]>([
  [DISC("PacketCreated").toString("hex"), "PacketCreated"],
  [DISC("PacketClaimed").toString("hex"), "PacketClaimed"],
  [DISC("PacketRefunded").toString("hex"), "PacketRefunded"],
]);

export type ParsedEvent =
  | { name: "PacketCreated"; packet: string; creator: string; mint: string; totalAmount: bigint; recipientLimit: number; mode: "equal" | "random"; expiresAt: bigint }
  | { name: "PacketClaimed"; packet: string; claimer: string; amount: bigint; claimCount: number }
  | { name: "PacketRefunded"; packet: string; creator: string; amount: bigint };

export function parseEventsFromLogs(logs: string[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith("Program data: ")) continue;
    let buf: Buffer;
    try {
      buf = Buffer.from(line.slice("Program data: ".length), "base64");
    } catch {
      continue;
    }
    if (buf.length < 8) continue;
    const disc = buf.subarray(0, 8).toString("hex");
    const name = DISCRIMINATORS.get(disc);
    if (!name) continue;

    let o = 8;
    const pubkey = () => bs58.encode(buf.subarray(o, (o += 32)));
    const u64 = () => buf.readBigUInt64LE((o += 8) - 8);
    const u32 = () => buf.readUInt32LE((o += 4) - 4);
    const i64 = () => buf.readBigInt64LE((o += 8) - 8);

    try {
      if (name === "PacketCreated") {
        const packet = pubkey();
        const creator = pubkey();
        const mint = pubkey();
        const totalAmount = u64();
        const recipientLimit = u32();
        const mode = buf[o] === 1 ? "random" : "equal";
        o += 1;
        const expiresAt = i64();
        events.push({ name, packet, creator, mint, totalAmount, recipientLimit, mode, expiresAt });
      } else if (name === "PacketClaimed") {
        const packet = pubkey();
        const claimer = pubkey();
        const amount = u64();
        const claimCount = u32();
        events.push({ name, packet, claimer, amount, claimCount });
      } else {
        const packet = pubkey();
        const creator = pubkey();
        const amount = u64();
        events.push({ name, packet, creator, amount });
      }
    } catch {
      continue; // truncated event data — skip
    }
  }
  return events;
}
