import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { packetClient } from "../../lib/packetClient";
import type { HomeData, Packet } from "../../lib/types";
import { PacketCard } from "../../components/PacketCard";
import { formatUsd, timeAgo } from "../../lib/format";
import { useWalletIdentity } from "../../lib/wallet";

type Tab = "created" | "claimed";

export default function History() {
  const wallet = useWalletIdentity();
  const [tab, setTab] = useState<Tab>("created");
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await packetClient.getHomeData());
    } catch {
      setError("Couldn't load history. Try again.");
    }
  }, [wallet?.address]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#E13A2F" />}
    >
      {/* Tabs */}
      <View className="flex-row gap-1 rounded-2xl bg-ink/5 p-1">
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            aria-selected={tab === t.id}
            className={`flex-1 rounded-xl px-4 py-2.5 ${tab === t.id ? "bg-white shadow-card" : ""}`}
          >
            <Text className={`text-center text-sm font-extrabold ${tab === t.id ? "text-ink" : "text-ink-soft"}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View className="mt-4 flex-row items-center justify-between gap-3 rounded-2xl border-2 border-envelope/30 bg-white p-4">
          <Text className="flex-1 text-sm font-bold text-envelope-deep">{error}</Text>
          <Pressable onPress={() => void load()} className="shrink-0 rounded-xl bg-envelope px-3 py-2 active:bg-envelope-deep">
            <Text className="text-xs font-extrabold text-cream">Retry</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View className="mt-4 gap-3">
          {[0, 1, 2].map((i) => (
            <View key={i} className="h-28 rounded-3xl bg-ink/5" />
          ))}
        </View>
      ) : (
        <>
          {tab === "created" &&
            (data && data.created.length > 0 ? (
              <View className="mt-4 gap-4">
                {data.created.map((p) => (
                  <PacketCard key={p.id} packet={p} view="owner" onRefund={(pk) => void refund(pk)} />
                ))}
              </View>
            ) : (
              <View className="mt-4 items-center rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-8">
                <Text className="text-4xl opacity-40">🧧</Text>
                <Text className="mt-2 font-extrabold text-ink">Nothing dropped yet</Text>
                <Link href="/create" asChild>
                  <Pressable className="mt-4 flex-row items-center gap-2 rounded-2xl bg-envelope px-5 py-3 active:scale-[0.98]">
                    <Plus size={16} color="#FFF7EC" />
                    <Text className="text-sm font-extrabold text-cream">Drop a Packet</Text>
                  </Pressable>
                </Link>
              </View>
            ))}

          {tab === "claimed" &&
            (data && data.claimed.length > 0 ? (
              <View className="mt-4 gap-3">
                {data.claimed.map((p) => {
                  const mine = p.claims.find((c) => c.who === wallet?.address);
                  return (
                    <Link key={p.id} href={`/p/${p.id}`} asChild>
                      <Pressable className="flex-row items-center gap-3 rounded-2xl bg-white p-4 shadow-card active:opacity-80">
                        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20">
                          <Text className="text-lg">✓</Text>
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-sm font-extrabold text-ink">
                            {formatUsd(mine?.amount ?? 0)} from {p.creatorName}
                          </Text>
                          <Text className="text-xs font-semibold text-ink-soft">
                            {timeAgo(p.createdAt)} · {p.mode === "equal" ? "Equal" : "Random"}
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-ink-soft">›</Text>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            ) : (
              <Text className="mt-4 rounded-2xl bg-white/60 p-5 text-sm font-semibold text-ink-soft">
                Packets you open will show up here.
              </Text>
            ))}
        </>
      )}
    </ScrollView>
  );
}
