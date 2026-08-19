import { useReducedMotion } from "react-native-reanimated";
import ConfettiCannon from "react-native-confetti-cannon";
import { CONFETTI_COLORS } from "../lib/theme";

/** Fires a two-burst confetti celebration in brand colors. No-op for
 *  reduced-motion users. */
export function ConfettiBurst({ fire }: { fire: boolean }) {
  const reduced = useReducedMotion();

  if (!fire || reduced) return null;

  return (
    <ConfettiCannon
      count={120}
      origin={{ x: -30, y: 0 }}
      explosionSpeed={350}
      fallSpeed={2800}
      colors={CONFETTI_COLORS}
    />
  );
}
