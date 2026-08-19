import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Plus, RefreshCw } from "lucide-react-native";
import { packetClient } from "../../lib/packetClient";
import type { HomeData, Packet } from "../../lib/types";
import { PacketCard } from "../../components/PacketCard";
import { ShareSheet } from "../../components/ShareSheet";
import { formatUsd } from "../../lib/format";
import { useWalletIdentity } from "../../lib/wallet";

function CardSkeleton() {
  return (
    <View className="rounded-3xl bg-white p-5 shadow-card">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 rounded-2xl bg-ink/5" />
        <View className="flex-1 gap-2">
          <View className="h-5 w-28 rounded-lg bg-ink/5" />
          <View className="h-3.5 w-40 rounded-lg bg-ink/5" />
        </View>
      </View>
      <View className="mt-4 h-2.5 w-full rounded-full bg-ink/5" />
    </View>
  );
}

export default function Home() {
  const wallet = useWalletIdentity();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharePacket, setSharePacket] = useState<Packet | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await packetClient.getHomeData());
    } catch {
      setError("Couldn't load your packets. Check your connection and try again.");
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

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#E13A2F" />}
    >
      {/* Hero */}
      <View className="items-center pt-2">
        <Text className="text-5xl">🧧</Text>
        <Text className="mt-3 text-center text-4xl font-black tracking-tight text-ink">
          Money worth opening.
        </Text>
        <Text className="mx-auto mt-3 max-w-md text-center text-base font-semibold text-ink-soft">
          Drop a packet. Share the link. Watch it get opened.
        </Text>
      </View>

      {error && (
        <View className="mt-6 flex-row items-center justify-between gap-3 rounded-2xl border-2 border-envelope/30 bg-white p-4">
          <Text className="flex-1 text-sm font-bold text-envelope-deep">{error}</Text>
          <Pressable
            onPress={() => void load()}
            className="shrink-0 flex-row items-center gap-1.5 rounded-xl bg-envelope px-3 py-2 active:bg-envelope-deep"
          >
            <RefreshCw size={14} color="#FFF7EC" />
            <Text className="text-xs font-extrabold text-cream">Retry</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View className="mt-6 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <>
          {/* Your packets */}
          <View className="mt-8">
            <Text className="mb-3 text-sm font-black uppercase tracking-wider text-ink-soft">
              Your packets
            </Text>
            {data && data.created.length > 0 ? (
              <View className="gap-4">
                {data.created.map((p) => (
                  <PacketCard
                    key={p.id}
                    packet={p}
                    view="owner"
                    onShare={setSharePacket}
                    onRefund={(pk) => void refund(pk)}
                  />
                ))}
              </View>
            ) : (
              <View className="rounded-3xl border-2 border-dashed border-ink/15 bg-white/60 p-8 items-center">
                <Text className="text-4xl opacity-40">🧧</Text>
                <Text className="mt-2 font-extrabold text-ink">No packets here yet</Text>
                <Text className="mt-1 text-center text-sm font-semibold text-ink-soft">
                  Drop your first one — it takes 10 seconds.
                </Text>
                <Link href="/create" asChild>
                  <Pressable className="mt-4 flex-row items-center gap-2 rounded-2xl bg-envelope px-5 py-3 active:scale-[0.98]">
                    <Plus size={16} color="#FFF7EC" />
                    <Text className="text-sm font-extrabold text-cream">Drop a Packet</Text>
                  </Pressable>
                </Link>
              </View>
            )}
          </View>

          {/* Claimed */}
          <View className="mt-8">
            <Text className="mb-3 text-sm font-black uppercase tracking-wider text-ink-soft">
              Claimed
            </Text>
            {data && data.claimed.length > 0 ? (
              <View className="gap-3">
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
                            {p.mode === "equal" ? "Equal" : "Random"} · {p.claimCount}/{p.recipientLimit} claimed
                          </Text>
                        </View>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            ) : (
              <Text className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-ink-soft">
                Packets you open will show up here.
              </Text>
            )}
          </View>
        </>
      )}

      {/* Big drop CTA */}
      <Link href="/create" asChild>
        <Pressable className="mx-auto mt-8 flex w-full max-w-md flex-row items-center justify-center gap-2 rounded-2xl bg-envelope px-6 py-4 active:scale-[0.99]">
          <Plus size={20} color="#FFF7EC" />
          <Text className="text-lg font-black text-cream">Drop a Packet</Text>
        </Pressable>
      </Link>

      <ShareSheet packet={sharePacket} onClose={() => setSharePacket(null)} />
    </ScrollView>
  );
}
