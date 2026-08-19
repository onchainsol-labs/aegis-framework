// Shared domain types — mirror the on-chain program's shape so swapping the
// mock client for the real SDK is a one-file change.

export type DistributionMode = "equal" | "random";

export type PacketStatus = "active" | "completed" | "expired" | "refunded";

export interface ClaimRecord {
  who: string;
  name: string;
  amount: number;
}

export interface Packet {
  /** Public packet ID — on-chain this is the Packet PDA address. */
  id: string;
  creator: string;
  creatorName: string;
  /** Token symbol (mock). On-chain: mint pubkey resolved via the registry. */
  symbol: string;
  totalAmount: number;
  remainingAmount: number;
  perClaim: number;
  recipientLimit: number;
  claimCount: number;
  mode: DistributionMode;
  /** Unix ms. null = never expires. */
  expiresAt: number | null;
  status: PacketStatus;
  createdAt: number;
  claims: ClaimRecord[];
}

export interface CreatePacketInput {
  symbol: string;
  totalAmount: number;
  recipientLimit: number;
  mode: DistributionMode;
  expiresAt: number | null;
}

export interface HomeData {
  created: Packet[];
  claimed: Packet[];
}
