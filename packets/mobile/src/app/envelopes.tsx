import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Envelope } from "../components/Envelope";
import type { EnvelopePhase } from "../components/Envelope";

/**
 * Envelope Lab — pick the envelope style. Temporary dev page at /envelopes.
 * Winner gets ported into components/Envelope.tsx.
 */

function LabShell({
  name,
  note,
  children,
}: {
  name: string;
  note: string;
  children: (phase: EnvelopePhase) => ReactNode;
}) {
  const [phase, setPhase] = useState<EnvelopePhase>("closed");
  const open = phase === "flap-open" || phase === "card-out";

  return (
    <View className="items-center gap-4 rounded-3xl bg-white p-8 shadow-card">
      <View className="h-56 justify-center">{children(phase)}</View>
      <View className="items-center">
        <Text className="text-lg font-black text-ink">{name}</Text>
        <Text className="mt-1 max-w-60 text-center text-sm font-semibold text-ink-soft">{note}</Text>
      </View>
      <Pressable
        onPress={() => setPhase(open ? "closed" : "flap-open")}
        className="rounded-xl bg-envelope px-5 py-2.5 active:bg-envelope-deep"
      >
        <Text className="text-sm font-extrabold text-cream">{open ? "Close" : "Open"}</Text>
      </Pressable>
    </View>
  );
}

/** V2 — flat mail icon style: solid body + V crease, no flap. */
function FlatMail({ phase }: { phase: EnvelopePhase }) {
  const reduced = useReducedMotion();
  const cardOut = phase === "card-out";

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withDelay(
          cardOut ? 450 : 0,
          withSpring(cardOut ? 70 : 0, {
            stiffness: 150,
            damping: 15,
          }),
        ),
      },
    ],
  }));

  return (
    <View className="relative" style={{ width: 200, height: 144 }}>
      <Svg viewBox="0 0 300 216" style={StyleSheet.absoluteFill} fill="none">
        <Rect x="4" y="4" width="292" height="208" rx="22" fill="#E13A2F" />
        <Path
          d="M12 12 L150 120 L288 12"
          fill="none"
          stroke="#C6281D"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: "9%",
            right: "9%",
            top: "7%",
            height: "50%",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
          },
          cardStyle,
        ]}
      >
        <Text className="text-xl font-black text-ink">$100</Text>
      </Animated.View>
    </View>
  );
}

/** V3 — flat with flap + seal: solid body, V crease, flat flap. */
function FlatFlap({ phase }: { phase: EnvelopePhase }) {
  const reduced = useReducedMotion();
  const flapOpen = phase === "flap-open" || phase === "card-out";
  const cardOut = phase === "card-out";

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withDelay(
          cardOut ? 450 : 0,
          withSpring(cardOut ? 70 : 0, {
            stiffness: 150,
            damping: 15,
          }),
        ),
      },
    ],
    zIndex: cardOut ? 40 : 10,
  }));

  const flapStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: 72 },
      { rotateX: withTiming(flapOpen ? (reduced ? "0deg" : "-180deg") : "0deg", { duration: reduced ? 0 : 550 }) },
      { translateY: -72 },
    ],
  }));

  return (
    <View className="relative" style={{ width: 200, height: 144 }}>
      <Svg viewBox="0 0 300 216" style={StyleSheet.absoluteFill} fill="none">
        <Rect x="4" y="4" width="292" height="208" rx="22" fill="#E13A2F" />
        <Path
          d="M12 12 L150 120 L288 12"
          fill="none"
          stroke="#C6281D"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: "9%",
            right: "9%",
            top: "7%",
            height: "50%",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
          },
          cardStyle,
        ]}
      >
        <Text className="text-xl font-black text-ink">$100</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.flatFlapZ, flapStyle]}>
        <Svg viewBox="0 0 300 216" style={{ width: "100%", height: "100%" }} fill="none">
          <Path
            d="M10 10 H290 Q296 10 296 18 V36 L150 112 L4 36 V18 Q4 10 10 10 Z"
            fill="#F05548"
            stroke="#C6281D"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
        <View className="absolute left-1/2 top-[51.9%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold">
          <Text className="text-lg">🧧</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flatFlapZ: {
    zIndex: 30,
  },
});

export default function EnvelopeLab() {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 }}>
      <Text className="text-2xl font-black text-ink">Envelope Lab 🧧</Text>
      <Text className="mt-1 text-sm font-semibold text-ink-soft">
        Which one? Tell me the name and I'll port it into the claim page.
      </Text>
      <View className="mt-6 gap-6">
        <LabShell name="Current" note="Notch + pocket interior + gradient flap + seal">
          {(phase) => <Envelope phase={phase} size={200} />}
        </LabShell>
        <LabShell name="Flat Mail" note="Solid body + V crease. No flap — pure icon look">
          {(phase) => <FlatMail phase={phase} />}
        </LabShell>
        <LabShell name="Flat Flap" note="Solid body + V crease + flat flap + gold seal">
          {(phase) => <FlatFlap phase={phase} />}
        </LabShell>
      </View>
    </ScrollView>
  );
}
