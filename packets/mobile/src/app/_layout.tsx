import "../lib/polyfills";
import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { WalletProvider } from "../lib/walletProvider";
import { WalletButton } from "../components/WalletButton";
import { COLORS } from "../lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <WalletProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.cream },
          headerTintColor: COLORS.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: "Nunito_800ExtraBold", color: COLORS.ink },
          contentStyle: { backgroundColor: COLORS.cream },
        }}
      >
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="p/[id]"
          options={{ title: "Packet", headerBackButtonDisplayMode: "minimal", headerRight: () => <WalletButton /> }}
        />
        <Stack.Screen name="envelopes" options={{ title: "Envelope Lab 🧧" }} />
      </Stack>
    </WalletProvider>
  );
}
