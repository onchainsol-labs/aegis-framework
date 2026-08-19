import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, QrCode, Share2, X } from "lucide-react-native";
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

  if (!packet) return null;
  const shareUrl = url ?? packetUrl(packet.id);
  const text = SHARE_TEXT(packet);

  const copy = async () => {
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = () => {
    void Share.share({ message: `${text}\n${shareUrl}`, url: shareUrl });
  };

  const shareLinks = [
    { label: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, color: "#25D366" },
    { label: "Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, color: "#229ED9" },
    { label: "X", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, color: "#1F1B16" },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-end bg-ink/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close share sheet"
      >
        <Pressable className="w-full max-w-md rounded-t-3xl bg-cream p-6 pb-8" onPress={() => undefined}>
          <View className="flex-row items-start justify-between">
            <Text className="text-xl font-black text-ink">Share your Packet 🧧</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close share sheet" className="h-10 w-10 items-center justify-center rounded-xl active:bg-ink/5">
              <X size={20} color="#6B6257" />
            </Pressable>
          </View>

          {/* Link */}
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl border-2 border-ink/10 bg-white p-2 pl-4">
            <Text className="min-w-0 flex-1 font-mono text-sm font-bold text-ink" numberOfLines={1}>
              {shareUrl.replace("https://", "")}
            </Text>
            <Pressable
              onPress={() => void copy()}
              className="h-10 shrink-0 flex-row items-center gap-1.5 rounded-xl bg-ink px-4 active:bg-ink/85"
            >
              {copied ? <Check size={16} color="#FFF7EC" /> : <Copy size={16} color="#FFF7EC" />}
              <Text className="text-sm font-extrabold text-cream">{copied ? "Copied" : "Copy"}</Text>
            </Pressable>
          </View>

          {/* Native share + quick shares (flex row — no CSS grid on native) */}
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={nativeShare}
              className="min-h-12 flex-1 flex-col items-center justify-center rounded-2xl bg-envelope px-2 active:scale-[0.98]"
            >
              <Share2 size={16} color="#FFF7EC" />
              <Text className="text-xs font-extrabold text-cream">Share</Text>
            </Pressable>
            {shareLinks.map((s) => (
              <Pressable
                key={s.label}
                onPress={() => void Linking.openURL(s.url)}
                className="min-h-12 flex-1 flex-col items-center justify-center rounded-2xl px-2 active:scale-[0.98]"
                style={{ backgroundColor: s.color }}
              >
                <Text className="text-sm font-extrabold text-cream">{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* QR note — real QR lands with the SDK/mobile phase */}
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-gold-soft/60 p-3">
            <QrCode size={16} color="#1F1B16" />
            <Text className="flex-1 text-sm font-semibold text-ink">
              QR codes land with the Seeker phase — links work everywhere already.
            </Text>
          </View>

          <Text className="mt-4 text-center text-sm font-semibold text-ink-soft">"{text}"</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
