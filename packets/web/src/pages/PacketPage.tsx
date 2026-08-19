import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Share2, Sparkles } from "lucide-react";
import { packetClient } from "../lib/packetClient";
import type { Packet } from "../lib/types";
import { Envelope } from "../components/Envelope";
import type { EnvelopePhase } from "../components/Envelope";
import { CountUp } from "../components/CountUp";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { ShareSheet } from "../components/ShareSheet";
import { formatUsd, formatToken, timeLeft } from "../lib/format";
import { usePacketWallet } from "../lib/walletProvider";
import { useWalletIdentity } from "../lib/wallet";

const OPENING_MS = 1800; // envelope suspense — anticipation is the feature

function PageSkeleton() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center pt-6">
      <div className="h-44 w-64 animate-pulse rounded-3xl bg-ink/5" />
      <div className="mt-8 h-5 w-40 animate-pulse rounded-lg bg-ink/5" />
      <div className="mt-3 h-14 w-64 animate-pulse rounded-2xl bg-ink/5" />
    </div>
  );
}

export function PacketPage() {
  const { address } = useParams<{ address: string }>();
  const [searchParams] = useSearchParams();
  const justDropped = searchParams.get("justDropped") === "1";
  const reduced = useReducedMotion();

  const [packet, setPacket] = useState<Packet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [phase, setPhase] = useState<EnvelopePhase>("closed");
  const [wonAmount, setWonAmount] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const wallet = useWalletIdentity();
  const { connect } = usePacketWallet();
  const timers = useRef<number[]>([]);

  // Smaller envelope on phones — it shouldn't dominate the screen.
  const [envSize, setEnvSize] = useState(() =>
    window.matchMedia("(max-width: 640px)").matches ? 176 : 240,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => setEnvSize(e.matches ? 176 : 240);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const p = await packetClient.getPacket(address);
      if (p) setPacket(p);
    } catch {
      // keep whatever we have — no skeleton flash mid-reveal
    }
  }, [address]);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const p = await packetClient.getPacket(address);
      setPacket(p);
      if (p) {
        const mine = p.claims.find((c) => c.who === wallet?.address);
        if (mine) {
          setWonAmount(mine.amount);
          setPhase("card-out"); // already opened — show the result
        }
      }
    } catch {
      setError("Couldn't load this packet. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [address, wallet?.address]);

  useEffect(() => {
    void load();
  }, [load]);

  // After dropping, the share sheet is the very next moment.
  useEffect(() => {
    if (justDropped && packet && !loading) {
      setShareOpen(true);
    }
  }, [justDropped, packet, loading]);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const open = async () => {
    if (!packet || busy) return;
    setClaimError(null);
    if (!wallet) {
      setClaimError("Connect a wallet to claim — takes one tap.");
      return;
    }
    setBusy(true);
    setPhase("opening");
    const minSuspense = reduced ? 200 : OPENING_MS;
    const started = Date.now();
    try {
      // Start the claim immediately; the "Opening…" wait is the minimum
      // suspense, not an extra serial delay.
      const { amount } = await packetClient.claimPacket(packet.id);
      const elapsed = Date.now() - started;
      if (elapsed < minSuspense) await delay(minSuspense - elapsed);
      setWonAmount(amount);
      setPhase("flap-open");
      later(() => setPhase("card-out"), reduced ? 0 : 650);
      later(() => setBusy(false), reduced ? 0 : 800);
      void refresh();
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Couldn't claim. Try again.");
      setPhase("closed");
      setBusy(false);
      void refresh();
    }
  };

  // ---------------------------------------------------------------- render

  if (loading) return <PageSkeleton />;

  if (error || !packet) {
    return (
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center pt-10 text-center lg:min-h-[72vh] lg:pt-0">
        <p className="text-5xl opacity-30" aria-hidden="true">🧧</p>
        <h1 className="mt-4 text-2xl font-black text-ink">This packet doesn't exist</h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          {error ?? "Check the link and try again."}
        </p>
        <Link to="/" className="mt-6 rounded-2xl bg-envelope px-6 py-3 text-sm font-extrabold text-cream shadow-float hover:bg-envelope-deep">
          Back home
        </Link>
      </div>
    );
  }

  const mine = packet.claims.find((c) => c.who === wallet?.address);
  const tl = timeLeft(packet.expiresAt);
  const left = packet.recipientLimit - packet.claimCount;
  const isCreator = packet.creator === wallet?.address;
  const winners = [...packet.claims].sort((a, b) => b.amount - a.amount);

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center pt-4 lg:min-h-[72vh] lg:pt-0">
      {/* Envelope */}
      {packet.status === "expired" || packet.status === "refunded" ? (
        <div className="relative">
          <Envelope phase="closed" muted size={envSize} />
          <span className="absolute -right-4 top-6 rotate-12 rounded-lg bg-ink px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cream">
            Expired
          </span>
        </div>
      ) : (
        <Envelope phase={phase} size={envSize}>
          {wonAmount != null ? (
            <span className="px-2 text-center">
              <CountUp
                value={wonAmount}
                format={(n) => formatUsd(n)}
                className="block text-2xl font-black text-ink"
              />
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                {packet.symbol}
              </span>
            </span>
          ) : (
            <span className="px-2 text-center">
              <span className="block text-2xl font-black text-ink">{formatUsd(packet.totalAmount)}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                {packet.symbol}
              </span>
            </span>
          )}
        </Envelope>
      )}

      <ConfettiBurst fire={phase === "card-out" && wonAmount != null} />

      {/* Header info */}
      <h1 className="mt-8 text-center text-2xl font-black text-ink">
        {formatUsd(packet.totalAmount)} packet
      </h1>
      <p className="mt-1 text-sm font-bold text-ink-soft">
        {left > 0 ? `${left} of ${packet.recipientLimit} left` : `${packet.recipientLimit} claimed`} ·{" "}
        {packet.mode === "equal" ? "Equal" : "Random"}
        {tl ? ` · ${tl}` : ""}
      </p>
      <p className="text-sm font-semibold text-ink-soft">by {packet.creatorName}</p>

      {/* Claim error / connect prompt */}
      {claimError && (
        <div role="alert" className="mt-5 w-full rounded-2xl border-2 border-envelope/30 bg-white p-4 text-center">
          <p className="text-sm font-bold text-envelope-deep">{claimError}</p>
          {!wallet && (
            <button
              type="button"
              onClick={() => {
                setClaimError(null);
                void connect();
              }}
              className="mt-3 rounded-xl bg-envelope px-5 py-2.5 text-sm font-extrabold text-cream hover:bg-envelope-deep"
            >
              Connect wallet
            </button>
          )}
        </div>
      )}

      {/* The money shot */}
      {packet.status === "active" && (
        <>
          {phase === "opening" && (
            <div className="mt-6 w-full max-w-xs text-center" aria-live="polite">
              <p className="text-sm font-black text-ink">Opening your packet…</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                <motion.div
                  className="h-full rounded-full bg-gold"
                  initial={{ width: "6%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: reduced ? 0.2 : OPENING_MS / 1000, ease: "easeInOut" }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-ink-soft">
                {packet.mode === "random" ? "Luck is being decided…" : "Claiming your share…"}
              </p>
            </div>
          )}

          {phase !== "opening" && wonAmount == null && (
            <button
              type="button"
              onClick={() => void open()}
              className="mt-7 w-full max-w-72 rounded-2xl bg-envelope px-6 py-3.5 text-lg font-black text-cream shadow-float transition-all hover:bg-envelope-deep active:scale-[0.98]"
            >
              🧧 OPEN PACKET
            </button>
          )}

          {wonAmount != null && phase === "card-out" && (
            <motion.div
              className="mt-6 w-full max-w-xs text-center"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <p className="text-3xl font-black text-envelope">You got {formatUsd(wonAmount)}! 🧧</p>
              <div className="mx-auto mt-10 flex w-full max-w-64 justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-envelope px-3.5 py-2 text-xs font-extrabold text-cream transition-colors hover:bg-envelope-deep active:scale-[0.98]"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
                </button>
                <Link
                  to="/create"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-envelope/25 bg-white px-3.5 py-2 text-xs font-extrabold text-envelope transition-colors hover:bg-envelope/5 active:scale-[0.98]"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Drop your own
                </Link>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Completed: winners list */}
      {packet.status === "completed" && (
        <div className="mt-7 w-full max-w-md">
          <p className="text-center text-sm font-black uppercase tracking-wider text-ink-soft">
            ✅ All claimed
          </p>
          <ul className="mt-4 max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-white p-3 shadow-card">
            {winners.map((w, i) => (
              <li key={`${w.who}-${i}`} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm odd:bg-cream">
                <span className="font-bold text-ink">{w.name}</span>
                <span className="font-black text-ink">{formatToken(w.amount, packet.symbol)}</span>
              </li>
            ))}
          </ul>
          {isCreator && packet.remainingAmount > 0 && (
            <p className="mt-3 text-center text-xs font-semibold text-ink-soft">
              {formatUsd(packet.remainingAmount)} left to refund from the History page.
            </p>
          )}
          {mine && (
            <p className="mt-3 text-center text-lg font-black text-envelope">
              You got {formatUsd(mine.amount)} 🎉
            </p>
          )}
        </div>
      )}

      {/* Expired / refunded */}
      {(packet.status === "expired" || packet.status === "refunded") && (
        <div className="mt-7 text-center">
          <p className="text-sm font-bold text-ink-soft">
            {packet.status === "expired" ? "This packet expired." : "Funds returned."}{" "}
            Unclaimed money goes back to the creator. 🪙
          </p>
        </div>
      )}

      <ShareSheet packet={shareOpen ? packet : null} onClose={() => setShareOpen(false)} />
    </div>
  );
}
