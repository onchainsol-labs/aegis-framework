import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, LogOut, Wallet } from "lucide-react";
import { usePacketWallet } from "../lib/walletProvider";
import { shortAddress } from "../lib/format";

/**
 * Wallet pill — real SIWS connection.
 * Web: pick Phantom / Solflare / Backpack. Seeker: MWA (Seed Vault) directly.
 */
export function WalletButton() {
  const { identity, installedWallets, isMobile, busy, error, connect, disconnect } = usePacketWallet();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const handlePick = (name: string) => {
    setOpen(false);
    void connect(name);
  };

  if (!identity) {
    return (
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (isMobile || installedWallets.length <= 1) {
              void connect();
            } else {
              setOpen((o) => !o);
            }
          }}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-envelope px-5 text-sm font-extrabold text-cream shadow-float transition-colors hover:bg-envelope-deep active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Connecting…" : "Connect wallet"}
        </button>

        {open && !isMobile && (
          <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-ink/10 bg-white p-2 shadow-card">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
              Pick a wallet
            </p>
            {installedWallets.length === 0 && (
              <p className="px-3 pb-2 text-sm font-semibold text-ink-soft">
                No wallet extension found — install Phantom or Solflare.
              </p>
            )}
            {installedWallets.map((name) => (
              <button
                key={name}
                type="button"
                role="menuitem"
                onClick={() => handlePick(name)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-ink/5"
              >
                <Wallet className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="absolute right-0 z-50 mt-2 w-64 rounded-xl border-2 border-envelope/30 bg-white p-3 text-xs font-bold text-envelope-deep">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink/10 bg-white pl-1.5 pr-3 text-sm font-extrabold text-ink transition-colors hover:border-ink/20"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-sm font-black text-ink">
          {identity.name.charAt(0)}
        </span>
        <span>{shortAddress(identity.address)}</span>
        <ChevronDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-ink/10 bg-white p-2 shadow-card">
          <div className="px-3 py-2">
            <p className="text-sm font-extrabold text-ink">{shortAddress(identity.address)}</p>
            <p className="truncate font-mono text-xs font-semibold text-ink-soft">{identity.address}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-envelope transition-colors hover:bg-envelope/5 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}
