import { NavLink, Outlet } from "react-router-dom";
import { Home as HomeIcon, History as HistoryIcon, Plus, ScanLine } from "lucide-react";
import { WalletButton } from "./WalletButton";

const NAV = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/create", label: "Drop", icon: Plus, end: false },
  { to: "/history", label: "History", icon: HistoryIcon, end: false },
];

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-4 lg:max-w-4xl">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-ink" aria-label="Packet home">
            <span aria-hidden="true">🧧</span> PACKET
          </NavLink>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            <NavLink to="/history" className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-bold ${isActive ? "bg-ink/5 text-ink" : "text-ink-soft hover:text-ink"}`}>
              History
            </NavLink>
            <NavLink to="/create" className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-bold ${isActive ? "bg-ink/5 text-ink" : "text-ink-soft hover:text-ink"}`}>
              Drop
            </NavLink>
          </nav>
          <WalletButton />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6 sm:pb-12 lg:max-w-4xl lg:pt-10">
        <Outlet />
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/5 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-colors ${
                  isActive ? "text-envelope" : "text-ink-soft hover:text-ink"
                }`
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Scan lives with the Seeker phase — kept out of the nav for now. */
export function ScanHint() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft">
      <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
      Scan arrives with the Seeker app
    </span>
  );
}
