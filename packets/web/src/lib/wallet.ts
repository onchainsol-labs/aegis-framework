// Wallet identity — real SIWS-backed store.
//
// The actual connection logic lives in `walletProvider.tsx`
// (useSeekerWallet from @onchainlab/siws); this module is a tiny external
// store so non-React code (packetClient) and pages can read the same
// identity that the WalletButton writes.

import { useSyncExternalStore } from "react";

export interface WalletIdentity {
  address: string;
  name: string;
}

let identity: WalletIdentity | null = null;
const listeners = new Set<() => void>();

export function setWalletIdentity(next: WalletIdentity | null): void {
  identity = next;
  for (const l of listeners) l();
}

export function getWallet(): WalletIdentity | null {
  return identity;
}

export function subscribeWalletIdentity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useWalletIdentity(): WalletIdentity | null {
  return useSyncExternalStore(subscribeWalletIdentity, getWallet, getWallet);
}
