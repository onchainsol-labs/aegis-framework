import { useEffect, useState } from "react";
import { Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

interface CountUpProps {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  format: (n: number) => string;
}

/** Counts 0 → value with an ease-out curve. Jumps straight to the end for
 *  reduced-motion users. */
export function CountUp({ value, duration = 1.1, style, format }: CountUpProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return <Text style={style}>{format(display)}</Text>;
}
