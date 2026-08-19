import { Link } from "react-router-dom";
import { Share2, RotateCcw } from "lucide-react";
import type { Packet } from "../lib/types";
import { formatUsd, timeLeft } from "../lib/format";

interface PacketCardProps {
  packet: Packet;
  /** "owner" = you dropped it (share/refund), "claim" = you can open it */
  view: "owner" | "claim";
  onShare?: (packet: Packet) => void;
  onRefund?: (packet: Packet) => void;
}

export function PacketCard({ packet, view, onShare, onRefund }: PacketCardProps) {
  const progress = packet.recipientLimit > 0 ? packet.claimCount / packet.recipientLimit : 0;
  const left = packet.recipientLimit - packet.claimCount;
  const tl = timeLeft(packet.expiresAt);
  const modeLabel = packet.mode === "equal" ? "Equal" : "Random";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-card transition-shadow hover:shadow-lg">
      {/* Status stamp */}
      {packet.status !== "active" && (
        <div
          className={`absolute right-3 top-3 rotate-6 rounded-lg px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide ${
            packet.status === "completed"
              ? "bg-gold/20 text-envelope-deep"
              : "bg-ink/10 text-ink-soft"
          }`}
        >
          {packet.status === "completed" ? "All claimed" : packet.status === "expired" ? "Expired" : "Refunded"}
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-envelope/10 text-2xl" aria-hidden="true">
          🧧
        </span>
        <div className="min-w-0">
          <p className="text-xl font-black leading-tight text-ink">
            {formatUsd(packet.totalAmount)}
            <span className="ml-1 text-sm font-bold text-ink-soft">{packet.symbol}</span>
          </p>
          <p className="text-sm font-semibold text-ink-soft">
            {left > 0 ? `${left} left` : "No claims left"} · {modeLabel}
            {tl ? ` · ${tl}` : ""}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-envelope/10" role="progressbar" aria-valuemin={0} aria-valuemax={packet.recipientLimit} aria-valuenow={packet.claimCount} aria-label={`${packet.claimCount} of ${packet.recipientLimit} claimed`}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-envelope transition-[width] duration-500"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs font-bold text-ink-soft">
          {packet.claimCount}/{packet.recipientLimit} claimed
        </p>
      </div>

      {/* Action */}
      {view === "owner" ? (
        <div className="mt-auto flex gap-2 pt-4">
          {packet.status === "active" && (
            <button
              type="button"
              onClick={() => onShare?.(packet)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-envelope px-4 py-3 text-sm font-extrabold text-cream transition-colors hover:bg-envelope-deep active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </button>
          )}
          {(packet.status === "expired" || packet.status === "completed") && packet.remainingAmount > 0 && (
            <button
              type="button"
              onClick={() => onRefund?.(packet)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-envelope/20 bg-white px-4 py-3 text-sm font-extrabold text-envelope transition-colors hover:bg-envelope/5 active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Get {formatUsd(packet.remainingAmount)} back
            </button>
          )}
        </div>
      ) : (
        <Link
          to={`/p/${packet.id}`}
          className="mt-auto inline-flex w-full items-center justify-center rounded-2xl bg-envelope px-4 py-3 text-sm font-extrabold text-cream transition-colors hover:bg-envelope-deep active:scale-[0.98]"
        >
          Open packet
        </Link>
      )}
    </article>
  );
}
