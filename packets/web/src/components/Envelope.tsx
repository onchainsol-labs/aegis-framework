import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export type EnvelopePhase = "closed" | "opening" | "flap-open" | "card-out";

interface EnvelopeProps {
  phase?: EnvelopePhase;
  size?: number;
  className?: string;
  /** Rendered inside the card that slides out of the envelope. */
  children?: ReactNode;
  /** Dimmed / grayscale look for expired or completed envelopes. */
  muted?: boolean;
}

/**
 * The hero object. Classic solid-envelope construction:
 *   1. Interior pocket (dark triangle) drawn first
 *   2. Front face = rounded rect with a V cut out of the top (evenodd fill),
 *      so the pocket shows through the opening
 *   3. Flap (lighter red, rounded shoulders) covers the V when closed,
 *      tip meeting the pocket point — rotates open around its top edge
 *   4. Gold seal at the flap tip, crease running down the face
 * All key points align: pocket point (150,108), flap tip (150,114).
 */
export function Envelope({
  phase = "closed",
  size = 220,
  className = "",
  children,
  muted = false,
}: EnvelopeProps) {
  const reduced = useReducedMotion();
  const flapOpen = phase === "flap-open" || phase === "card-out";
  const cardOut = phase === "card-out";

  const w = size;
  const h = size * 0.72;

  return (
    <div
      className={`relative ${className} ${muted ? "opacity-80 saturate-50" : ""}`}
      style={{
        width: w,
        height: h,
        filter: "drop-shadow(0 18px 28px rgb(225 58 47 / 0.30))",
      }}
      aria-hidden="true"
    >
      {/* -------- Envelope body -------- */}
      <svg viewBox="0 0 300 216" className="absolute inset-0 z-10 h-full w-full" fill="none">
        <defs>
          <linearGradient id="env-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EC4E41" />
            <stop offset="1" stopColor="#D33125" />
          </linearGradient>
          <linearGradient id="env-pocket" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B82B21" />
            <stop offset="1" stopColor="#9C241B" />
          </linearGradient>
        </defs>

        {/* 1 — Interior pocket (peeks through the V when the flap opens) */}
        <path
          d="M4 4 L150 108 L296 4 Z"
          fill="url(#env-pocket)"
          stroke="#8F2018"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* 2 — Front face: rounded rect minus the V cut (evenodd) */}
        <path
          fillRule="evenodd"
          d="M4 4 H296 V212 Q296 216 292 216 H8 Q4 216 4 212 Z M4 4 L150 108 L296 4 Z"
          fill="url(#env-face)"
        />

        {/* Crease — pocket point straight down the face */}
        <path d="M150 108 L150 204" stroke="#B02A20" strokeWidth="2.5" opacity="0.65" />
      </svg>

      {/* -------- The card that slides out -------- */}
      <motion.div
        className="absolute inset-x-[9%] top-[7%] z-10 flex h-[50%] items-center justify-center rounded-xl bg-white shadow-card"
        animate={cardOut ? { y: h * 0.55, zIndex: 40 } : { y: 0, zIndex: 10 }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 150, damping: 15, delay: cardOut ? 0.45 : 0 }
        }
      >
        {children}
      </motion.div>

      {/* -------- Flap + seal (rotates open around its top edge) -------- */}
      <motion.div
        className="absolute inset-0 z-30"
        style={{
          transformOrigin: "top center",
          transformStyle: "preserve-3d",
          filter: "drop-shadow(0 3px 4px rgb(31 27 22 / 0.18))",
        }}
        animate={{ rotateX: flapOpen ? (reduced ? 0 : -180) : 0 }}
        transition={{ duration: reduced ? 0 : 0.55, ease: [0.76, 0, 0.24, 1] }}
      >
        <svg viewBox="0 0 300 216" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id="env-flap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F25C50" />
              <stop offset="1" stopColor="#DE3E31" />
            </linearGradient>
          </defs>
          <path
            d="M10 10 H290 Q296 10 296 18 V36 L150 114 L4 36 V18 Q4 10 10 10 Z"
            fill="url(#env-flap)"
            stroke="#C93225"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>

        {/* Gold seal at the flap tip */}
        <motion.div
          className="absolute left-1/2 top-[52.8%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-xl shadow-md ring-4 ring-gold/25"
          animate={{ scale: flapOpen ? 0.88 : 1 }}
          transition={{ duration: 0.3 }}
        >
          🧧
        </motion.div>
      </motion.div>
    </div>
  );
}
