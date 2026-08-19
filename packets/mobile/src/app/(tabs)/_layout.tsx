import { Redirect, Tabs } from "expo-router";
import { History as HistoryIcon, Home as HomeIcon, Plus } from "lucide-react-native";
import { WalletButton } from "../../components/WalletButton";
import { COLORS } from "../../lib/theme";
import { useWalletIdentity } from "../../lib/wallet";

export default function TabsLayout() {
  const wallet = useWalletIdentity();

  // Onboarding gate — no wallet, no Home. Connect on /welcome first.
  if (!wallet) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.cream },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "Nunito_800ExtraBold", color: COLORS.ink },
        tabBarStyle: {
          backgroundColor: COLORS.cream,
          borderTopColor: "rgba(31,27,22,0.08)",
          // Match the web bottom nav: tall, comfy tap targets
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: COLORS.envelope,
        tabBarInactiveTintColor: COLORS.inkSoft,
        tabBarLabelStyle: { fontFamily: "Nunito_800ExtraBold", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerTitle: "🧧 PACKET",
          headerRight: () => <WalletButton />,
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Drop",
          headerShown: false,
          tabBarIcon: ({ color }) => <Plus color={color} size={26} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerRight: () => <WalletButton />,
          tabBarIcon: ({ color, size }) => <HistoryIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
