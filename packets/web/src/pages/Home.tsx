import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { packetClient } from "../lib/packetClient";
import type { HomeData, Packet } from "../lib/types";
import { PacketCard } from "../components/PacketCard";
import { ShareSheet } from "../components/ShareSheet";
import { formatUsd } from "../lib/format";
import { useWalletIdentity } from "../lib/wallet";

function CardSkeleton() {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-ink/5" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-28 animate-pulse rounded-lg bg-ink/5" />
          <div className="h-3.5 w-40 animate-pulse rounded-lg bg-ink/5" />
        </div>
      </div>
      <div className="mt-4 h-2.5 w-full animate-pulse rounded-full bg-ink/5" />
    </div>
  );
}

export function Home() {
  const wallet = useWalletIdentity();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharePacket, setSharePacket] = useState<Packet | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await packetClient.getHomeData());
    } catch {
      setError("Couldn't load your packets. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    void load();
  }, [load]);

  const refund = async (packet: Packet) => {
    try {
      const updated = await packetClient.refundPacket(packet.id);
      // Update the card in place — no page reload, no skeleton flash.
      setData((d) =>
        d
          ? {
              ...d,
              created: d.created.map((p) => (p.id === updated.id ? updated : p)),
            }
          : d,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed. Try again.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="pt-2 text-center lg:pt-6">
        <p className="text-5xl lg:text-6xl" aria-hidden="true">🧧</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-ink lg:text-5xl">
          Money worth opening.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base font-semibold text-ink-soft lg:text-lg">
          Drop a packet. Share the link. Watch it get opened.
        </p>
      </section>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-envelope/30 bg-white p-4 text-sm font-bold text-envelope-deep">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-envelope px-3 py-2 text-xs font-extrabold text-cream hover:bg-envelope-deep">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading your packets">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* Your packets */}
          <section aria-labelledby="your-packets">
            <h2 id="your-packets" className="mb-3 text-sm font-black uppercase tracking-wider text-ink-soft">
              Your packets
            </h2>
            {data && data.created.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.created.map((p) => (
                  <li key={p.id}>
                    <PacketCard
                      packet={p}
                      view="owner"
                      onShare={setSharePacket}
                      onRefund={(pk) => void refund(pk)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-8 text-center">
                <p className="text-4xl opacity-40" aria-hidden="true">🧧</p>
                <p className="mt-2 font-extrabold text-ink">No packets here yet</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  Drop your first one — it takes 10 seconds.
                </p>
                <Link
                  to="/create"
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-envelope px-5 py-3 text-sm font-extrabold text-cream shadow-float transition-colors hover:bg-envelope-deep active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Drop a Packet
                </Link>
              </div>
            )}
          </section>

          {/* Claimed */}
          <section aria-labelledby="claimed">
            <h2 id="claimed" className="mb-3 text-sm font-black uppercase tracking-wider text-ink-soft">
              Claimed
            </h2>
            {data && data.claimed.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.claimed.map((p) => {
                  const mine = p.claims.find((c) => c.who === wallet?.address);
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/p/${p.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition-shadow hover:shadow-lg"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-lg" aria-hidden="true">✓</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold text-ink">
                            {formatUsd(mine?.amount ?? 0)} from {p.creatorName}
                          </span>
                          <span className="block text-xs font-semibold text-ink-soft">
                            {p.mode === "equal" ? "Equal" : "Random"} · {p.claimCount}/{p.recipientLimit} claimed
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-ink-soft">
                Packets you open will show up here.
              </p>
            )}
          </section>
        </>
      )}

      {/* Big drop CTA */}
      <Link
        to="/create"
        className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-envelope px-6 py-3.5 text-base font-black text-cream shadow-float transition-all hover:bg-envelope-deep active:scale-[0.99] sm:py-4 sm:text-lg"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Drop a Packet
      </Link>

      <ShareSheet packet={sharePacket} onClose={() => setSharePacket(null)} />
    </div>
  );
}
