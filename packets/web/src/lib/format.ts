// Number + time formatting. Money is always big, rounded, and human.

export function formatUsd(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatToken(n: number, symbol: string): string {
  const max = n >= 1000 ? 2 : n >= 1 ? 2 : 4;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: max })} ${symbol}`;
}

export function shortAddress(a: string): string {
  return a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

/** `packet.app/p/<id>` — the shareable slug. */
export function packetUrl(id: string): string {
  return `https://packet.app/p/${id}`;
}

/** Short link label for the share sheet. */
export function shortPacketLink(id: string): string {
  return `packet.app/p/${id.slice(0, 6)}…`;
}

export function timeLeft(expiresAt: number | null): string | null {
  if (expiresAt == null) return null;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m left`;
  return `${Math.floor(hours / 24)}d left`;
}

export function timeAgo(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Live thousands separators for the amount input: "1000000" → "1,000,000".
 *  Keeps the decimal part (and a trailing dot) untouched. */
export function formatInputAmount(raw: string): string {
  if (!raw) return "";
  const [int, ...rest] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length > 0 ? `${grouped}.${rest.join("")}` : grouped;
}
