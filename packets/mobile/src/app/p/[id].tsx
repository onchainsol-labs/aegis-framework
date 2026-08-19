import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Share2, Sparkles } from "lucide-react-native";
import { packetClient } from "../../lib/packetClient";
import type { Packet } from "../../lib/types";
import { Envelope } from "../../components/Envelope";
import type { EnvelopePhase } from "../../components/Envelope";
import { CountUp } from "../../components/CountUp";
import { ConfettiBurst } from "../../components/ConfettiBurst";
import { ShareSheet } from "../../components/ShareSheet";
import { formatUsd, formatToken, timeLeft } from "../../lib/format";
import { usePacketWallet } from "../../lib/walletProvider";
import { useWalletIdentity } from "../../lib/wallet";

const OPENING_MS = 1800; // envelope suspense — anticipation is the feature

function PageSkeleton() {
  return (
    <View className="mx-auto w-full max-w-md items-center pt-6">
      <View className="h-44 w-64 rounded-3xl bg-ink/5" />
      <View className="mt-8 h-5 w-40 rounded-lg bg-ink/5" />
      <View className="mt-3 h-14 w-64 rounded-2xl bg-ink/5" />
    </View>
  );
}

export default function PacketPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { justDropped } = useLocalSearchParams<{ justDropped?: string }>();
  const isJustDropped = justDropped === "1";
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  const [packet, setPacket] = useState<Packet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [phase, setPhase] = useState<EnvelopePhase>("closed");
  const [wonAmount, setWonAmount] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const wallet = useWalletIdentity();
  const { connect } = usePacketWallet();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Smaller envelope on phones — it shouldn't dominate the screen.
  const envSize = width < 400 ? 176 : 240;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const p = await packetClient.getPacket(id);
      if (p) setPacket(p);
    } catch {
      // keep whatever we have — no skeleton flash mid-reveal
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const p = await packetClient.getPacket(id);
      setPacket(p);
      if (p) {
        const mine = p.claims.find((c) => c.who === wallet?.address);
        if (mine) {
          setWonAmount(mine.amount);
          setPhase("card-out"); // already opened — show the result
        }
      }
    } catch {
      setError("Couldn't load this packet. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [id, wallet?.address]);

  useEffect(() => {
    void load();
  }, [load]);

  // After dropping, the share sheet is the very next moment.
  useEffect(() => {
    if (isJustDropped && packet && !loading) {
      setShareOpen(true);
    }
  }, [isJustDropped, packet, loading]);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const open = async () => {
    if (!packet || busy) return;
    setClaimError(null);
    if (!wallet) {
      setClaimError("Connect a wallet to claim — takes one tap.");
      return;
    }
    setBusy(true);
    setPhase("opening");
    const minSuspense = reduced ? 200 : OPENING_MS;
    const started = Date.now();
    try {
      // Start the claim immediately; the "Opening…" wait is the minimum
      // suspense, not an extra serial delay.
      const { amount } = await packetClient.claimPacket(packet.id);
      const elapsed = Date.now() - started;
      if (elapsed < minSuspense) await delay(minSuspense - elapsed);
      setWonAmount(amount);
      setPhase("flap-open");
      later(() => setPhase("card-out"), reduced ? 0 : 650);
      later(() => setBusy(false), reduced ? 0 : 800);
      void refresh();
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Couldn't claim. Try again.");
      setPhase("closed");
      setBusy(false);
      void refresh();
    }
  };

  // "Opening…" progress bar — 6% → 100% over the suspense window.
  const progress = useSharedValue(6);
  useEffect(() => {
    if (phase === "opening") {
      progress.value = 6;
      progress.value = withTiming(100, { duration: reduced ? 200 : OPENING_MS });
    }
  }, [phase, reduced, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  // ------------------------------------------------------------------ render

  if (loading) return <PageSkeleton />;

  if (error || !packet) {
    return (
      <View className="mx-auto w-full max-w-md flex-1 items-center justify-center px-4">
        <Text className="text-5xl opacity-30">🧧</Text>
        <Text className="mt-4 text-2xl font-black text-ink">This packet doesn't exist</Text>
        <Text className="mt-2 text-center text-sm font-semibold text-ink-soft">
          {error ?? "Check the link and try again."}
        </Text>
        <Link href="/" asChild>
          <Pressable className="mt-6 rounded-2xl bg-envelope px-6 py-3 active:bg-envelope-deep">
            <Text className="text-sm font-extrabold text-cream">Back home</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const mine = packet.claims.find((c) => c.who === wallet?.address);
  const tl = timeLeft(packet.expiresAt);
  const left = packet.recipientLimit - packet.claimCount;
  const isCreator = packet.creator === wallet?.address;
  const winners = [...packet.claims].sort((a, b) => b.amount - a.amount);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 48,
        paddingTop: 16,
        width: "100%",
        maxWidth: 448,
        alignSelf: "center",
        alignItems: "center",
      }}
    >
      {/* Envelope */}
      {packet.status === "expired" || packet.status === "refunded" ? (
        <View className="relative">
          <Envelope phase="closed" muted size={envSize} />
          <View className="absolute -right-4 top-6 rotate-12 rounded-lg bg-ink px-3 py-1.5">
            <Text className="text-xs font-black uppercase tracking-wider text-cream">Expired</Text>
          </View>
        </View>
      ) : (
        <Envelope phase={phase} size={envSize}>
          {wonAmount != null ? (
            <View className="items-center px-2">
              <CountUp
                value={wonAmount}
                format={(n) => formatUsd(n)}
                style={{ fontSize: 24, fontFamily: "Nunito_900Black", color: "#1F1B16" }}
              />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                {packet.symbol}
              </Text>
            </View>
          ) : (
            <View className="items-center px-2">
              <Text className="text-2xl font-black text-ink">{formatUsd(packet.totalAmount)}</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                {packet.symbol}
              </Text>
            </View>
          )}
        </Envelope>
      )}

      <ConfettiBurst fire={phase === "card-out" && wonAmount != null} />

      {/* Header info */}
      <Text className="mt-8 text-center text-2xl font-black text-ink">
        {formatUsd(packet.totalAmount)} packet
      </Text>
      <Text className="mt-1 text-center text-sm font-bold text-ink-soft">
        {left > 0 ? `${left} of ${packet.recipientLimit} left` : `${packet.recipientLimit} claimed`} ·{" "}
        {packet.mode === "equal" ? "Equal" : "Random"}
        {tl ? ` · ${tl}` : ""}
      </Text>
      <Text className="text-sm font-semibold text-ink-soft">by {packet.creatorName}</Text>

      {/* Claim error / connect prompt */}
      {claimError && (
        <View className="mt-5 w-full items-center rounded-2xl border-2 border-envelope/30 bg-white p-4">
          <Text className="text-center text-sm font-bold text-envelope-deep">{claimError}</Text>
          {!wallet && (
            <Pressable
              onPress={() => {
                setClaimError(null);
                void connect();
              }}
              className="mt-3 rounded-xl bg-envelope px-5 py-2.5 active:bg-envelope-deep"
            >
              <Text className="text-sm font-extrabold text-cream">Connect wallet</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* The money shot */}
      {packet.status === "active" && (
        <>
          {phase === "opening" && (
            <View className="mt-6 w-full max-w-xs items-center">
              <Text className="text-sm font-black text-ink">Opening your packet…</Text>
              <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                <Animated.View className="h-full rounded-full bg-gold" style={progressStyle} />
              </View>
              <Text className="mt-2 text-xs font-semibold text-ink-soft">
                {packet.mode === "random" ? "Luck is being decided…" : "Claiming your share…"}
              </Text>
            </View>
          )}

          {phase !== "opening" && wonAmount == null && (
            <Pressable
              onPress={() => void open()}
              className="mt-7 w-full max-w-72 rounded-2xl bg-envelope px-6 py-3.5 active:scale-[0.98]"
            >
              <Text className="text-center text-lg font-black text-cream">🧧 OPEN PACKET</Text>
            </Pressable>
          )}

          {wonAmount != null && phase === "card-out" && (
            <View className="mt-6 w-full max-w-xs items-center">
              <Text className="text-center text-3xl font-black text-envelope">
                You got {formatUsd(wonAmount)}! 🧧
              </Text>
              <View className="mt-10 w-full max-w-64 flex-row justify-center gap-2">
                <Pressable
                  onPress={() => setShareOpen(true)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-envelope px-3.5 py-2 active:scale-[0.98]"
                >
                  <Share2 size={14} color="#FFF7EC" />
                  <Text className="text-xs font-extrabold text-cream">Share</Text>
                </Pressable>
                <Link href="/create" asChild>
                  <Pressable className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border-2 border-envelope/25 bg-white px-3.5 py-2 active:scale-[0.98]">
                    <Sparkles size={14} color="#E13A2F" />
                    <Text className="text-xs font-extrabold text-envelope">Drop your own</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          )}
        </>
      )}

      {/* Completed: winners list */}
      {packet.status === "completed" && (
        <View className="mt-7 w-full max-w-md">
          <Text className="text-center text-sm font-black uppercase tracking-wider text-ink-soft">
            ✅ All claimed
          </Text>
          <View className="mt-4 gap-1.5 rounded-2xl bg-white p-3 shadow-card">
            {winners.map((w, i) => (
              <View
                key={`${w.who}-${i}`}
                className={`flex-row items-center justify-between rounded-xl px-3 py-2 ${i % 2 === 0 ? "bg-cream" : ""}`}
              >
                <Text className="text-sm font-bold text-ink">{w.name}</Text>
                <Text className="text-sm font-black text-ink">{formatToken(w.amount, packet.symbol)}</Text>
              </View>
            ))}
          </View>
          {isCreator && packet.remainingAmount > 0 && (
            <Text className="mt-3 text-center text-xs font-semibold text-ink-soft">
              {formatUsd(packet.remainingAmount)} left to refund from the History page.
            </Text>
          )}
          {mine && (
            <Text className="mt-3 text-center text-lg font-black text-envelope">
              You got {formatUsd(mine.amount)} 🎉
            </Text>
          )}
        </View>
      )}

      {/* Expired / refunded */}
      {(packet.status === "expired" || packet.status === "refunded") && (
        <View className="mt-7">
          <Text className="text-center text-sm font-bold text-ink-soft">
            {packet.status === "expired" ? "This packet expired." : "Funds returned."}{" "}
            Unclaimed money goes back to the creator. 🪙
          </Text>
        </View>
      )}

      <ShareSheet packet={shareOpen ? packet : null} onClose={() => setShareOpen(false)} />
    </ScrollView>
  );
}
