import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { LoaderCircle } from "lucide-react-native";
import { Envelope } from "../components/Envelope";
import { SolanaLogo } from "../components/SolanaLogo";
import { usePacketWallet } from "../lib/walletProvider";
import { useWalletIdentity } from "../lib/wallet";

/**
 * Welcome — the first screen every new user sees. One job: connect.
 * Once the wallet is connected the app opens; before that, no Home.
 */
export default function Welcome() {
  const wallet = useWalletIdentity();
  const { busy, error, connect } = usePacketWallet();

  // Already connected — straight to Home.
  if (wallet) return <Redirect href="/" />;

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-1 items-center justify-center px-6">
        {/* Hero envelope */}
        <Envelope size={220}>
          <Text className="text-4xl">🧧</Text>
        </Envelope>

        <Text className="mt-8 text-center text-4xl font-black tracking-tight text-ink">
          Money worth opening.
        </Text>
        <Text className="mx-auto mt-3 max-w-xs text-center text-base font-semibold text-ink-soft">
          Drop a packet. Share the link. Watch it get opened.
        </Text>

        {/* The one thing to do here — Solana mark + word, nothing else */}
        <Pressable
          disabled={busy}
          onPress={() => void connect()}
          className="mt-10 flex w-full max-w-sm flex-row items-center justify-center gap-2.5 rounded-2xl bg-envelope px-6 py-4 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle size={22} color="#FFF7EC" />
          ) : (
            <SolanaLogo size={22} color="#FFF7EC" />
          )}
          <Text className="text-base font-black text-cream">Mobile</Text>
        </Pressable>

        {error && (
          <Text className="mt-3 max-w-sm text-center text-sm font-bold text-envelope-deep">{error}</Text>
        )}

        <Text className="mt-6 max-w-60 text-center text-xs font-semibold text-ink-soft">
          One tap with Phantom or Solflare — no password, no sign-up.
        </Text>

        {Platform.OS === "web" && (
          <Text className="mt-3 max-w-60 text-center text-[11px] font-bold text-gold">
            Web preview — wallet connect works on your phone (Expo Go).
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
