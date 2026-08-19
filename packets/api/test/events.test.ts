import { createHash } from "node:crypto";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { parseEventsFromLogs } from "../src/events.js";

const PROGRAM = "58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD";
const key = (s: string) => bs58.decode(s);

const disc = (name: string) =>
  createHash("sha256").update(`event:${name}`).digest().subarray(0, 8);

const log = (name: string, payload: Buffer) =>
  `Program data: ${Buffer.concat([disc(name), payload]).toString("base64")}`;

function packetCreatedLog() {
  const payload = Buffer.concat([
    key(PROGRAM),            // packet
    key(PROGRAM),            // creator
    key(PROGRAM),            // mint
    Buffer.alloc(8),         // total_amount
    Buffer.alloc(4),         // recipient_limit
    Buffer.from([0]),        // mode: Equal
    Buffer.alloc(8),         // expires_at
  ]);
  payload.writeBigUInt64LE(100n, 96);        // total_amount = 100
  payload.writeUInt32LE(10, 104);            // recipient_limit = 10
  payload.writeBigInt64LE(0n, 109);          // expires_at = 0 (never, after mode byte)
  return log("PacketCreated", payload);
}

function packetClaimedLog() {
  const payload = Buffer.concat([
    key(PROGRAM),            // packet
    key(PROGRAM),            // claimer
    Buffer.alloc(8),         // amount
    Buffer.alloc(4),         // claim_count
  ]);
  payload.writeBigUInt64LE(50n, 64);         // amount = 50
  payload.writeUInt32LE(2, 72);              // claim_count = 2
  return log("PacketClaimed", payload);
}

function packetRefundedLog() {
  const payload = Buffer.concat([
    key(PROGRAM),            // packet
    key(PROGRAM),            // creator
    Buffer.alloc(8),         // amount
  ]);
  payload.writeBigUInt64LE(30n, 64);         // amount = 30
  return log("PacketRefunded", payload);
}

describe("parseEventsFromLogs", () => {
  it("parses PacketCreated", () => {
    const events = parseEventsFromLogs(["Program log: something else", packetCreatedLog()]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "PacketCreated",
      packet: PROGRAM,
      creator: PROGRAM,
      mint: PROGRAM,
      totalAmount: 100n,
      recipientLimit: 10,
      mode: "equal",
      expiresAt: 0n,
    });
  });

  it("parses PacketClaimed", () => {
    const events = parseEventsFromLogs([packetClaimedLog()]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "PacketClaimed",
      packet: PROGRAM,
      claimer: PROGRAM,
      amount: 50n,
      claimCount: 2,
    });
  });

  it("parses PacketRefunded", () => {
    const events = parseEventsFromLogs([packetRefundedLog()]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "PacketRefunded",
      packet: PROGRAM,
      creator: PROGRAM,
      amount: 30n,
    });
  });

  it("parses multiple events from one log list", () => {
    const events = parseEventsFromLogs([packetCreatedLog(), packetClaimedLog()]);
    expect(events.map((e) => e.name)).toEqual(["PacketCreated", "PacketClaimed"]);
  });

  it("reads random mode as 'random'", () => {
    const payload = Buffer.concat([
      key(PROGRAM), key(PROGRAM), key(PROGRAM),
      Buffer.alloc(8), Buffer.alloc(4), Buffer.from([1]), Buffer.alloc(8),
    ]);
    const events = parseEventsFromLogs([log("PacketCreated", payload)]);
    expect(events[0]).toMatchObject({ mode: "random" });
  });

  it("skips unknown discriminators", () => {
    const payload = Buffer.alloc(125);
    const events = parseEventsFromLogs([log("PacketNope", payload)]);
    expect(events).toHaveLength(0);
  });

  it("skips truncated data", () => {
    const events = parseEventsFromLogs([
      `Program data: ${disc("PacketCreated").toString("base64")}`, // disc only, no payload
      "Program data: not-base64!!",
      "random log line",
    ]);
    expect(events).toHaveLength(0);
  });
});
