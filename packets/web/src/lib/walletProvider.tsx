// Wallet wiring — one place for web + Solana Mobile.
//
// Uses @onchainlab/siws: on a Seeker/Solana Mobile browser it auto-routes to
// MWA (Seed Vault); in a desktop browser it uses the wallet-adapter wallet
// the user picks (Phantom, Solflare, Backpack, ...).
//
// siws 0.2.0 handles the hard parts:
//   - connect(wallet?) takes a per-call wallet so the freshly picked wallet
//     is connected (no adapter-swap race)
//   - WebWalletAdapter waits for publicKey after connect() (no null crash)
//   - MWA is lazy-loaded (web bundles never include it)

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { MessageSignerWalletAdapter, SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { isSolanaMobile, useSeekerWallet } from "@onchainlab/siws";
import type { Balances, WebWalletLike } from "@onchainlab/siws";
import { setWalletIdentity, useWalletIdentity } from "./wallet";

const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const API_URL = import.meta.env.VITE_API_URL ?? "https://api.joyblox.fun";

export interface PacketWallet {
  /** The connected identity (address + wallet name), or null */
  identity: ReturnType<typeof useWalletIdentity>;
  /** Adapter names ready to connect on web (e.g. ["Phantom"]) */
  installedWallets: string[];
  /** True on a Solana Mobile (Seeker) browser — MWA is used */
  isMobile: boolean;
  busy: boolean;
  error: string | null;
  /** Connect. On web pass a wallet name (defaults to the first installed). */
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Live SOL/USDC/SKR balances for the connected wallet (needs the RPC). */
  getBalance: () => Promise<Balances>;
}

const Ctx = createContext<PacketWallet | null>(null);

/** Adapter → siws WebWalletLike. `publicKey` must be a live getter. */
function toWebWalletLike(adapter: SignerWalletAdapter & MessageSignerWalletAdapter): WebWalletLike {
  return {
    name: adapter.name,
    get publicKey() {
      return adapter.publicKey;
    },
    connect: () => adapter.connect(),
    disconnect: () => adapter.disconnect(),
    signMessage: (msg: Uint8Array) => adapter.signMessage(msg),
    signTransaction: (tx) => adapter.signTransaction(tx),
    sendTransaction: (tx, connection) => adapter.sendTransaction(tx, connection),
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { wallets } = useWallet();
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickedRef = useRef("Wallet");

  // The wallet the hook holds for disconnect/sign calls (keyed on name).
  const chosen = useMemo<WebWalletLike | null>(() => {
    const adapter = wallets.find((w) => w.adapter.name === chosenName)?.adapter as
      | (SignerWalletAdapter & MessageSignerWalletAdapter)
      | undefined;
    if (!adapter) return null;
    return toWebWalletLike(adapter);
  }, [wallets, chosenName]);

  const seeker = useSeekerWallet({
    wallet: chosen,
    rpcUrl: RPC_URL,
    statement: "Sign in to PACKET",
  });

  // siws callbacks close over their render's adapter — keep a ref so a click
  // handler always calls the latest instance.
  const seekerRef = useRef(seeker);
  seekerRef.current = seeker;

  const installedWallets = useMemo(
    () => wallets.filter((w) => w.readyState === "Installed").map((w) => w.adapter.name),
    [wallets],
  );

  // Errors auto-clear — a failed connect shouldn't leave the pill shouting forever.
  const errorTimer = useRef<number | null>(null);
  const fail = (msg: string) => {
    setError(msg);
    if (errorTimer.current != null) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 6000);
  };

  // Mirror siws state into the shared identity store, and let the api know
  // the wallet connected (user row upsert).
  useEffect(() => {
    const addr = seeker.pubkey;
    if (addr) {
      setError(null); // connected — any stale connect error goes away
      setWalletIdentity({
        address: addr,
        name: isSolanaMobile() ? "Solana Mobile" : pickedRef.current,
      });
      void fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: addr }),
      }).catch(() => {
        // api down — identity still works, history will just be empty
      });
    } else {
      setWalletIdentity(null);
    }
  }, [seeker.pubkey]);

  const connect = useCallback(
    async (walletName?: string) => {
      setBusy(true);
      setError(null);
      try {
        if (isSolanaMobile()) {
          await seekerRef.current.connect();
          return;
        }
        const name = walletName ?? installedWallets[0];
        if (!name) throw new Error("No wallet extension found. Install Phantom or Solflare.");
        const adapter = wallets.find((w) => w.adapter.name === name)?.adapter as
          | (SignerWalletAdapter & MessageSignerWalletAdapter)
          | undefined;
        if (!adapter) throw new Error(`Wallet "${name}" is not available.`);
        pickedRef.current = name;
        setChosenName(name); // the hook adopts it for later calls
        // The override connects the wallet the user JUST picked — no race
        // with the re-render that rebuilds the hook's adapter.
        await seekerRef.current.connect(toWebWalletLike(adapter));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const generic =
          !msg || msg === "Unexpected error" || msg.includes("Receiving end");
        fail(
          generic
            ? `${pickedRef.current} didn't respond — reload the extension (chrome://extensions → reload ${pickedRef.current}) and refresh this page.`
            : msg,
        );
      } finally {
        setBusy(false);
      }
    },
    [wallets, installedWallets],
  );

  const disconnect = useCallback(async () => {
    setError(null);
    await seekerRef.current.disconnect();
  }, []);

  const getBalance = useCallback(() => seekerRef.current.getBalance(), []);

  const identity = useWalletIdentity();

  return (
    <Ctx.Provider
      value={{ identity, installedWallets, isMobile: isSolanaMobile(), busy, error, connect, disconnect, getBalance }}
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
