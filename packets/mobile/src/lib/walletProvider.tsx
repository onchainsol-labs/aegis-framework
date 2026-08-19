// Wallet wiring — one place, native.
//
// Uses the Solana Mobile Wallet Adapter protocol (the same MWA path the web
// app's siws hook takes on a Seeker): authorize → the wallet app (Phantom /
// Solflare) deeplinks back with the address. Same PacketWallet surface as
// the web provider so every page ports unchanged.

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Connection, PublicKey } from "@solana/web3.js";
import { getWallet, setWalletIdentity, useWalletIdentity } from "./wallet";

const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.joyblox.fun";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export interface Balances {
  sol: number;
  usdc: number;
  skr: number;
}

export interface PacketWallet {
  /** The connected identity (address + wallet name), or null */
  identity: ReturnType<typeof useWalletIdentity>;
  /** Adapter names ready to connect on web — always empty on mobile */
  installedWallets: string[];
  /** True on mobile — MWA is used */
  isMobile: boolean;
  busy: boolean;
  error: string | null;
  /** Connect. `walletName` is ignored on mobile (single MWA flow). */
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Live SOL/USDC/SKR balances for the connected wallet (needs the RPC). */
  getBalance: () => Promise<Balances>;
}

const APP_IDENTITY = {
  name: "PACKET",
  uri: "https://packet.app",
  icon: "https://packet.app/favicon.svg",
};

const Ctx = createContext<PacketWallet | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const identity = useWalletIdentity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Errors auto-clear — a failed connect shouldn't shout forever.
  const fail = (msg: string) => {
    setError(msg);
    if (errorTimer.current != null) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 6000);
  };

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await Promise.race([
        transact(async (wallet) => {
          const auth = await wallet.authorize({
            cluster: "mainnet-beta",
            identity: APP_IDENTITY,
          });
          const account = auth.accounts[0];
          if (!account) throw new Error("No account was authorized.");
          return { token: auth.auth_token, address: account.address, label: account.label };
        }),
        // Never spin forever — if the wallet app never answers, fail out.
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Wallet didn't respond. Is Phantom or Solflare installed?")), 60_000),
        ),
      ]);
      if (!result) return; // user backed out of the wallet picker
      authTokenRef.current = result.token;
      setWalletIdentity({
        address: result.address,
        name: result.label || "Mobile wallet",
      });
      // Let the api know the wallet connected (user row upsert).
      void fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: result.address }),
      }).catch(() => {
        // api down — identity still works, history will just be empty
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(msg || "Couldn't connect. Open Phantom or Solflare and try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    const token = authTokenRef.current;
    authTokenRef.current = null;
    setWalletIdentity(null);
    if (token) {
      try {
        await transact(async (wallet) => {
          await wallet.deauthorize({ auth_token: token });
        });
      } catch {
        // wallet app closed mid-flow — local sign-out is enough
      }
    }
  }, []);

  const getBalance = useCallback(async (): Promise<Balances> => {
    const me = getWallet();
    if (!me) return { sol: 0, usdc: 0, skr: 0 };
    try {
      const conn = new Connection(RPC_URL, "confirmed");
      const pk = new PublicKey(me.address);
      const [lamports, accounts] = await Promise.all([
        conn.getBalance(pk),
        conn.getParsedTokenAccountsByOwner(pk, { mint: USDC_MINT }),
      ]);
      let usdc = 0;
      for (const { account } of accounts.value) {
        const ui = account.data.parsed?.info?.tokenAmount?.uiAmount;
        if (typeof ui === "number") usdc += ui;
      }
      return { sol: lamports / 1e9, usdc, skr: 0 };
    } catch {
      return { sol: 0, usdc: 0, skr: 0 };
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        identity,
        installedWallets: [],
        isMobile: true,
        busy,
        error,
        connect,
        disconnect,
        getBalance,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePacketWallet(): PacketWallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePacketWallet must be used inside <WalletProvider>");
  return ctx;
}
