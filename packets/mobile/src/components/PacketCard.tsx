import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { RotateCcw, Share2 } from "lucide-react-native";
import type { Packet } from "../lib/types";
import { formatUsd, timeLeft } from "../lib/format";

interface PacketCardProps {
  packet: Packet;
  /** "owner" = you dropped it (share/refund), "claim" = you can open it */
  view: "owner" | "claim";
  onShare?: (packet: Packet) => void;
  onRefund?: (packet: Packet) => void;
}

export function PacketCard({ packet, view, onShare, onRefund }: PacketCardProps) {
  const progress = packet.recipientLimit > 0 ? packet.claimCount / packet.recipientLimit : 0;
  const left = packet.recipientLimit - packet.claimCount;
  const tl = timeLeft(packet.expiresAt);
  const modeLabel = packet.mode === "equal" ? "Equal" : "Random";

  return (
    <View className="relative flex flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-card">
      {/* Status stamp */}
      {packet.status !== "active" && (
        <View
          className={`absolute right-3 top-3 rotate-6 rounded-lg px-2.5 py-1 ${
            packet.status === "completed" ? "bg-gold/20" : "bg-ink/10"
          }`}
        >
          <Text
            className={`text-xs font-extrabold uppercase tracking-wide ${
              packet.status === "completed" ? "text-envelope-deep" : "text-ink-soft"
            }`}
          >
            {packet.status === "completed"
              ? "All claimed"
              : packet.status === "expired"
                ? "Expired"
                : "Refunded"}
          </Text>
        </View>
      )}

      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-envelope/10">
          <Text className="text-2xl">🧧</Text>
        </View>
        <View className="min-w-0">
          <Text className="text-xl font-black leading-tight text-ink">
            {formatUsd(packet.totalAmount)}
            <Text className="text-sm font-bold text-ink-soft"> {packet.symbol}</Text>
          </Text>
          <Text className="text-sm font-semibold text-ink-soft">
            {left > 0 ? `${left} left` : "No claims left"} · {modeLabel}
            {tl ? ` · ${tl}` : ""}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View className="mt-4">
        <View className="h-2.5 w-full overflow-hidden rounded-full bg-envelope/10">
          {/* Native has no CSS gradients — solid gold matches the web's
              gold→red sweep closely enough. */}
          <View
            className="h-full rounded-full bg-gold"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </View>
        <Text className="mt-1.5 text-xs font-bold text-ink-soft">
          {packet.claimCount}/{packet.recipientLimit} claimed
        </Text>
      </View>

      {/* Action */}
      {view === "owner" ? (
        <View className="mt-auto flex-row gap-2 pt-4">
          {packet.status === "active" && (
            <Pressable
              onPress={() => onShare?.(packet)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-envelope px-4 py-3 active:scale-[0.98]"
            >
              <Share2 size={16} color="#FFF7EC" />
              <Text className="text-sm font-extrabold text-cream">Share</Text>
            </Pressable>
          )}
          {(packet.status === "expired" || packet.status === "completed") &&
            packet.remainingAmount > 0 && (
              <Pressable
                onPress={() => onRefund?.(packet)}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-envelope/20 bg-white px-4 py-3 active:scale-[0.98]"
              >
                <RotateCcw size={16} color="#E13A2F" />
                <Text className="text-sm font-extrabold text-envelope">
                  Get {formatUsd(packet.remainingAmount)} back
                </Text>
              </Pressable>
            )}
        </View>
      ) : (
        <Link href={`/p/${packet.id}`} asChild>
          <Pressable className="mt-auto w-full items-center justify-center rounded-2xl bg-envelope px-4 py-3 active:scale-[0.98]">
            <Text className="text-sm font-extrabold text-cream">Open packet</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}
