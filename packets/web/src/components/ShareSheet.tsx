import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Copy, Check, X, QrCode } from "lucide-react";
import type { Packet } from "../lib/types";
import { API_URL } from "../lib/packetClient";
import { formatUsd, packetUrl } from "../lib/format";

interface ShareSheetProps {
  packet: Packet | null;
  onClose: () => void;
}

const SHARE_TEXT = (packet: Packet) =>
  `I dropped ${formatUsd(packet.totalAmount)} — first ${packet.recipientLimit} to open get a share! 🧧`;

export function ShareSheet({ packet, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();

  // Full link shows instantly; short link (packet.app/s/xxxx) replaces it
  // once the api creates the code.
  useEffect(() => {
    if (!packet) return;
    let alive = true;
    setUrl(packetUrl(packet.id));
    fetch(`${API_URL}/s`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packet_id: packet.id }),
    })
      .then((r) => r.json())
      .then((d: { url?: string }) => {
        if (alive && d?.url) setUrl(d.url);
      })
      .catch(() => {
        // keep the full link — shortener is a nicety, never a failure
      });
    return () => {
      alive = false;
    };
  }, [packet]);

  // Focus the primary action + close on Escape
  useEffect(() => {
    if (!packet) return;
    const t = setTimeout(() => copyRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [packet, onClose]);

  if (!packet) return null;
  const shareUrl = url ?? packetUrl(packet.id);
  const text = SHARE_TEXT(packet);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked (http, permissions) — do nothing, the link is visible
    }
  };

  const shareLinks = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, color: "bg-[#25D366]" },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, color: "bg-[#229ED9]" },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, color: "bg-ink" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Share your packet"
      >
        <motion.div
          className="w-full max-w-md rounded-t-3xl bg-cream p-6 pb-8 shadow-2xl sm:rounded-3xl sm:pb-6"
          initial={{ y: reduced ? 0 : 60, opacity: reduced ? 1 : 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduced ? 0 : 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-black text-ink">Share your Packet 🧧</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close share sheet"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-ink/5"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Link */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-ink/10 bg-white p-2 pl-4">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-ink">
              {shareUrl.replace("https://", "")}
            </span>
            <button
              ref={copyRef}
              type="button"
              onClick={copy}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-extrabold text-cream transition-colors hover:bg-ink/85"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Quick shares */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {shareLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl ${s.color} px-2 text-cream transition-transform hover:scale-[1.03] active:scale-[0.98]`}
              >
                <span className="text-sm font-extrabold">{s.label}</span>
              </a>
            ))}
          </div>

          {/* QR note — real QR lands with the SDK/mobile phase */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-gold-soft/60 p-3 text-sm font-semibold text-ink">
            <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
            QR codes land with the Seeker phase — links work everywhere already.
          </div>

          <p className="mt-4 text-center text-sm font-semibold text-ink-soft">"{text}"</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
