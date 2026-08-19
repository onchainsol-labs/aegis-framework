import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  children: (phase: EnvelopePhase) => React.ReactNode;
}) {
  const [phase, setPhase] = useState<EnvelopePhase>("closed");
  const open = phase === "flap-open" || phase === "card-out";

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-card">
      <div className="relative flex h-56 items-center justify-center">{children(phase)}</div>
      <div className="text-center">
        <p className="text-lg font-black text-ink">{name}</p>
        <p className="mt-1 max-w-60 text-sm font-semibold text-ink-soft">{note}</p>
      </div>
      <button
        type="button"
        onClick={() => setPhase(open ? "closed" : "flap-open")}
        className="rounded-xl bg-envelope px-5 py-2.5 text-sm font-extrabold text-cream transition-colors hover:bg-envelope-deep"
      >
        {open ? "Close" : "Open"}
      </button>
    </div>
  );
}

/** V2 — flat mail icon style: solid body + V crease, no flap. */
function FlatMail({ phase }: { phase: EnvelopePhase }) {
  const reduced = useReducedMotion();
  const cardOut = phase === "card-out";
  return (
    <div
      className="relative"
      style={{ width: 200, height: 144, filter: "drop-shadow(0 14px 22px rgb(225 58 47 / 0.25))" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 216" className="absolute inset-0 h-full w-full">
        <rect x="4" y="4" width="292" height="208" rx="22" fill="#E13A2F" />
        <path
          d="M12 12 L150 120 L288 12"
          fill="none"
          stroke="#C6281D"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <motion.div
        className="absolute inset-x-[9%] top-[7%] flex h-[50%] items-center justify-center rounded-xl bg-white shadow-card"
        animate={cardOut ? { y: 70 } : { y: 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 150, damping: 15 }}
      >
        <span className="text-xl font-black text-ink">$100</span>
      </motion.div>
    </div>
  );
}

/** V3 — flat with flap + seal: solid body, V crease, flat flap. */
function FlatFlap({ phase }: { phase: EnvelopePhase }) {
  const reduced = useReducedMotion();
  const flapOpen = phase === "flap-open" || phase === "card-out";
  const cardOut = phase === "card-out";
  return (
    <div
      className="relative"
      style={{ width: 200, height: 144, filter: "drop-shadow(0 14px 22px rgb(225 58 47 / 0.25))" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 216" className="absolute inset-0 h-full w-full">
        <rect x="4" y="4" width="292" height="208" rx="22" fill="#E13A2F" />
        <path
          d="M12 12 L150 120 L288 12"
          fill="none"
          stroke="#C6281D"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <motion.div
        className="absolute inset-x-[9%] top-[7%] z-10 flex h-[50%] items-center justify-center rounded-xl bg-white shadow-card"
        animate={cardOut ? { y: 70, zIndex: 40 } : { y: 0, zIndex: 10 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 150, damping: 15, delay: cardOut ? 0.45 : 0 }}
      >
        <span className="text-xl font-black text-ink">$100</span>
      </motion.div>
      <motion.div
        className="absolute inset-0 z-30"
        style={{ transformOrigin: "top center" }}
        animate={{ rotateX: flapOpen ? (reduced ? 0 : -180) : 0 }}
        transition={{ duration: reduced ? 0 : 0.55, ease: [0.76, 0, 0.24, 1] }}
      >
        <svg viewBox="0 0 300 216" className="h-full w-full">
          <path
            d="M10 10 H290 Q296 10 296 18 V36 L150 112 L4 36 V18 Q4 10 10 10 Z"
            fill="#F05548"
            stroke="#C6281D"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute left-1/2 top-[51.9%] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-lg">
          🧧
        </div>
      </motion.div>
    </div>
  );
}

export function EnvelopeLab() {
  return (
    <div>
      <h1 className="text-2xl font-black text-ink">Envelope Lab 🧧</h1>
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        Which one? Tell me the name and I'll port it into the claim page.
      </p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <LabShell name="Current" note="Notch + pocket interior + gradient flap + seal">
          {(phase) => <Envelope phase={phase} size={200} />}
        </LabShell>
        <LabShell name="Flat Mail" note="Solid body + V crease. No flap — pure icon look">
          {(phase) => <FlatMail phase={phase} />}
        </LabShell>
        <LabShell name="Flat Flap" note="Solid body + V crease + flat flap + gold seal">
          {(phase) => <FlatFlap phase={phase} />}
        </LabShell>
      </div>
    </div>
  );
}
