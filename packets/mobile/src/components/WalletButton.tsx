import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, LoaderCircle, LogOut } from "lucide-react-native";
import { usePacketWallet } from "../lib/walletProvider";
import { shortAddress } from "../lib/format";

/**
 * Wallet pill — MWA connection (Phantom / Solflare / Seed Vault on a Seeker).
 * Same layout and copy as the web pill.
 */
export function WalletButton() {
  const { identity, busy, error, connect, disconnect } = usePacketWallet();
  const [open, setOpen] = useState(false);

  if (!identity) {
    return (
      <View className="relative">
        <Pressable
          disabled={busy}
          onPress={() => void connect()}
          className="h-11 flex-row items-center gap-2 rounded-xl bg-envelope px-5 active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <LoaderCircle size={16} color="#FFF7EC" />}
          <Text className="text-sm font-extrabold text-cream">{busy ? "Connecting…" : "Connect wallet"}</Text>
        </Pressable>

        {error && (
          <View className="absolute right-0 z-50 mt-2 w-64 rounded-xl border-2 border-envelope/30 bg-white p-3 shadow-card">
            <Text className="text-xs font-bold text-envelope-deep">{error}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="relative">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="h-11 flex-row items-center gap-2 rounded-full border-2 border-ink/10 bg-white pl-1.5 pr-3 active:scale-[0.98]"
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-gold">
          <Text className="text-sm font-black text-ink">{identity.name.charAt(0)}</Text>
        </View>
        <Text className="text-sm font-extrabold text-ink">{shortAddress(identity.address)}</Text>
        <ChevronDown size={16} color="#6B6257" />
      </Pressable>

      {open && (
        <View className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-ink/10 bg-white p-2 shadow-card">
          <View className="px-3 py-2">
            <Text className="text-sm font-extrabold text-ink">{shortAddress(identity.address)}</Text>
            <Text className="font-mono text-xs font-semibold text-ink-soft" numberOfLines={1}>
              {identity.address}
            </Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => {
              setOpen(false);
              void disconnect();
            }}
            className="mt-1 flex-row items-center gap-2 rounded-xl px-3 py-2.5 active:bg-envelope/5 disabled:opacity-60"
          >
            <LogOut size={16} color="#E13A2F" />
            <Text className="text-sm font-bold text-envelope">{busy ? "Disconnecting…" : "Disconnect"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
