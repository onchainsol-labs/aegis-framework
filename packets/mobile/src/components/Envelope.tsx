import { useId } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Filter, FeDropShadow, G, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type EnvelopePhase = "closed" | "opening" | "flap-open" | "card-out";

interface EnvelopeProps {
  phase?: EnvelopePhase;
  size?: number;
  className?: string;
  /** Rendered inside the card that slides out of the envelope. */
  children?: ReactNode;
  /** Dimmed look for expired or completed envelopes. */
  muted?: boolean;
}

/**
 * The hero object. Classic solid-envelope construction (same geometry as the
 * web app):
 *   1. Interior pocket (dark triangle) drawn first
 *   2. Front face = rounded rect with a V cut out of the top (evenodd fill),
 *      so the pocket shows through the opening
 *   3. Flap (lighter red) covers the V when closed — rotates open around its
 *      top edge
 *   4. Gold seal at the flap tip, crease running down the face
 */
export function Envelope({ phase = "closed", size = 220, children, muted = false }: EnvelopeProps) {
  const reduced = useReducedMotion();
  const flapOpen = phase === "flap-open" || phase === "card-out";
  const cardOut = phase === "card-out";
  // Gradient ids must be unique per instance (SVG ids are global per screen).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const w = size;
  const h = size * 0.72;

  // Card slides out of the envelope and rises above the flap.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withDelay(
          cardOut ? 450 : 0,
          withSpring(cardOut ? h * 0.55 : 0, {
            stiffness: 150,
            damping: 15,
          }),
        ),
      },
    ],
    zIndex: cardOut ? 40 : 10,
  }));

  // Flap rotates around its top edge (translate-trick for the transform origin).
  const flapStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: h / 2 },
      { rotateX: withTiming(flapOpen ? (reduced ? "0deg" : "-180deg") : "0deg", { duration: reduced ? 0 : 550 }) },
      { translateY: -h / 2 },
    ],
  }));

  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(flapOpen ? 0.88 : 1, { duration: 300 }) }],
  }));

  return (
    <View style={[styles.wrap, { width: w, height: h }, muted && styles.muted]}>
      {/* -------- Envelope body -------- */}
      <Svg width="100%" height="100%" viewBox="0 0 300 216" style={styles.svg} fill="none">
        <Defs>
          <LinearGradient id={`face-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#EC4E41" />
            <Stop offset="1" stopColor="#D33125" />
          </LinearGradient>
          <LinearGradient id={`pocket-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B82B21" />
            <Stop offset="1" stopColor="#9C241B" />
          </LinearGradient>
          {/* Silhouette glow — same drop-shadow as the web envelope */}
          <Filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <FeDropShadow dx="0" dy="18" stdDeviation="28" floodColor="#E13A2F" floodOpacity="0.3" />
          </Filter>
        </Defs>

        <G filter={`url(#glow-${uid})`}>
          {/* 1 — Interior pocket (peeks through the V when the flap opens) */}
          <Path
            d="M4 4 L150 108 L296 4 Z"
            fill={`url(#pocket-${uid})`}
            stroke="#8F2018"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* 2 — Front face: rounded rect minus the V cut (evenodd) */}
          <Path
            fillRule="evenodd"
            d="M4 4 H296 V212 Q296 216 292 216 H8 Q4 216 4 212 Z M4 4 L150 108 L296 4 Z"
            fill={`url(#face-${uid})`}
          />

          {/* Crease — pocket point straight down the face */}
          <Path d="M150 108 L150 204" stroke="#B02A20" strokeWidth={2.5} opacity={0.65} />
        </G>
      </Svg>

      {/* -------- The card that slides out -------- */}
      <Animated.View style={[styles.card, { left: "9%", right: "9%", top: "7%", height: h * 0.5 }, cardStyle]}>
        {children}
      </Animated.View>

      {/* -------- Flap + seal (rotates open around its top edge) -------- */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.flap, flapStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 300 216" fill="none">
          <Defs>
            <LinearGradient id={`flap-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F25C50" />
              <Stop offset="1" stopColor="#DE3E31" />
            </LinearGradient>
          </Defs>
          <Path
            d="M10 10 H290 Q296 10 296 18 V36 L150 114 L4 36 V18 Q4 10 10 10 Z"
            fill={`url(#flap-${uid})`}
            stroke="#C93225"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </Svg>

        {/* Gold seal at the flap tip */}
        <Animated.View style={[styles.seal, sealStyle]}>
          <Text style={styles.sealEmoji}>🧧</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  muted: {
    opacity: 0.8,
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#1F1B16",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  flap: {
    zIndex: 30,
  },
  seal: {
    position: "absolute",
    left: "50%",
    top: "52.8%",
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5B842",
    shadowColor: "#1F1B16",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sealEmoji: {
    fontSize: 20,
  },
});
