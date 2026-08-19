import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";

const COLORS = ["#E13A2F", "#F5B842", "#FFF7EC", "#FBE3B3"];

/** Fires a two-burst confetti celebration in brand colors. No-op for
 *  reduced-motion users. */
export function ConfettiBurst({ fire }: { fire: boolean }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!fire || reduced) return;
    const opts = {
      colors: COLORS,
      ticks: 240,
      gravity: 0.95,
      decay: 0.93,
      startVelocity: 34,
      spread: 120,
      zIndex: 60,
    };
    confetti({ ...opts, particleCount: 80, origin: { x: 0.5, y: 0.4 }, scalar: 1.1 });
    const t = setTimeout(
      () => confetti({ ...opts, particleCount: 45, origin: { x: 0.5, y: 0.5 }, scalar: 0.8 }),
      200,
    );
    return () => clearTimeout(t);
  }, [fire, reduced]);

  return null;
}
