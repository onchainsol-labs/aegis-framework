import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { packetClient } from "../lib/packetClient";
import type { HomeData, Packet } from "../lib/types";
import { PacketCard } from "../components/PacketCard";
import { formatUsd, timeAgo } from "../lib/format";
import { useWalletIdentity } from "../lib/wallet";

type Tab = "created" | "claimed";

export function History() {
  const wallet = useWalletIdentity();
  const [tab, setTab] = useState<Tab>("created");
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await packetClient.getHomeData());
    } catch {
      setError("Couldn't load history. Try again.");
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "created", label: "Created" },
    { id: "claimed", label: "Claimed" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-ink">History</h1>

      {/* Tabs */}
      <div role="tablist" aria-label="History" className="mt-4 flex gap-1 rounded-2xl bg-ink/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
              tab === t.id ? "bg-white text-ink shadow-card" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-envelope/30 bg-white p-4 text-sm font-bold text-envelope-deep">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 rounded-xl bg-envelope px-3 py-2 text-xs font-extrabold text-cream hover:bg-envelope-deep">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-ink/5" />
          ))}
        </div>
      ) : (
        <>
          {tab === "created" &&
            (data && data.created.length > 0 ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.created.map((p) => (
                  <li key={p.id}>
                    <PacketCard packet={p} view="owner" onRefund={(pk) => void refund(pk)} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-8 text-center">
                <p className="text-4xl opacity-40" aria-hidden="true">🧧</p>
                <p className="mt-2 font-extrabold text-ink">Nothing dropped yet</p>
                <Link to="/create" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-envelope px-5 py-3 text-sm font-extrabold text-cream shadow-float hover:bg-envelope-deep">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Drop a Packet
                </Link>
              </div>
            ))}

          {tab === "claimed" &&
            (data && data.claimed.length > 0 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.claimed.map((p) => {
                  const mine = p.claims.find((c) => c.who === wallet?.address);
                  return (
                    <li key={p.id}>
                      <Link to={`/p/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition-shadow hover:shadow-lg">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-lg" aria-hidden="true">✓</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold text-ink">
                            {formatUsd(mine?.amount ?? 0)} from {p.creatorName}
                          </span>
                          <span className="block text-xs font-semibold text-ink-soft">
                            {timeAgo(p.createdAt)} · {p.mode === "equal" ? "Equal" : "Random"}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-ink-soft" aria-hidden="true">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl bg-white/60 p-5 text-sm font-semibold text-ink-soft">
                Packets you open will show up here.
              </p>
            ))}
        </>
      )}
    </div>
  );
}
