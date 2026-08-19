# SIWS — usage notes + bugs found (contribution doc)

**Package:** `@onchainlab/siws` v0.1.2
**Where we use it:** PACKET web app (`web/src/lib/walletProvider.tsx`) + future Seeker mobile app.
**Purpose of this doc:** the definitive record of every bug/gotcha we hit, so we can fix them properly upstream — and so the next integration doesn't rediscover them.

---

## 1. How we use it

```text
web (browser)                  → wallet-adapter (Phantom / Solflare / Backpack / standard wallets)
                                    ↓ WebWalletLike wrapper (lib/walletProvider.tsx)
Solana Mobile (Seeker browser) → MWA + Seed Vault, automatic via isSolanaMobile()
```

- `useSeekerWallet({ wallet, rpcUrl, statement })` — one hook, both platforms.
- `isSolanaMobile()` decides which adapter siws builds — on Seeker the `wallet` prop is ignored and `MwaWalletAdapter` is used.
- We keep the connected identity in a tiny external store (`lib/wallet.ts`) so non-React code (packetClient) can read it sync.
- On connect we push `POST /users` to our API (fire-and-forget; DB is a UX layer, never security).

---

## 2. Bugs & gotchas (ordered by pain)

### 🐛 Bug 1 — `WebWalletAdapter.connect()` reads `publicKey` too early *(package bug)*

**Symptom:** `Cannot read properties of null (reading 'toBase58')` on first click. Second click works.

**Root cause:** `adapters/web.js`:

```js
async connect() {
  await this.wallet.connect();
  return this.wallet.publicKey.toBase58(); // ← publicKey can still be null
}
```

Wallet-adapter's `autoConnect` starts a background connect. When the user clicks during it, `adapter.connect()` returns immediately (`if (connected || connecting) return`) with `publicKey` still `null` → siws crashes.

**Our workaround:** wrapper's `connect()` waits for `publicKey` after `adapter.connect()` resolves (poll, 10s cap), and we disabled `autoConnect` in our app.

**Suggested upstream fix:** in `WebWalletAdapter.connect()`, after `await this.wallet.connect()`, wait for the key (poll or the adapter's `connect` event) and throw a descriptive error if it never arrives. Same applies to any connect path that returns an address.

### 🐛 Bug 2 — `WebWalletLike.publicKey` must be a live getter *(package gotcha / doc bug)*

**Symptom:** same `null.toBase58()` crash even when everything else is right.

**Root cause:** we passed a snapshot:

```ts
const wrapper = { publicKey: adapter.publicKey, ... } // null forever
```

siws reads `wallet.publicKey` *after* `connect()` resolves. A snapshot captured before connect stays null inside siws.

**Our workaround:**

```ts
get publicKey() { return adapter.publicKey; }
```

**Suggested upstream fix:** document that `publicKey` must be a getter (or accept the wallet-adapter `Adapter` directly so the package owns this detail).

### 🐛 Bug 3 — clicking wallet B connects wallet A *(package API gap)*

**Symptom:** user picks Jupiter in the dropdown, Phantom's popup opens.

**Root cause:** `useSeekerWallet` rebuilds its adapter in a `useMemo` after a re-render. If the app calls `connect()` right after switching wallets, the old adapter (previous wallet) is still bound. `adapterName` still holds the previous pick, so "wait for any adapter" logic exits immediately.

**Our workaround:** poll until `adapterName` equals the picked wallet's name, via a ref to the latest seeker instance.

**Suggested upstream fix:** let `connect()` take an optional wallet override (`connect(wallet?)`), or expose the current adapter so callers can await readiness. Otherwise every consumer re-implements the ref+poll dance.

### 🐛 Bug 4 — `WebWalletLike.signTransaction<T>` is too strict *(type friction)*

**Symptom:** TS error when passing a wallet-adapter `Adapter` directly.

**Root cause:** `WebWalletLike` requires a generic `signTransaction<T extends Transaction>(tx: T): Promise<T>`, but wallet-adapter's `Adapter` has non-generic `signTransaction(Transaction): Promise<Transaction>` — structurally incompatible.

**Our workaround:** hand-wrapped the adapter with a cast inside the generic.

**Suggested upstream fix:** loosen to `signTransaction(transaction: Transaction): Promise<Transaction>` (or accept `SignerWalletAdapter & MessageSignerWalletAdapter` directly). The generic buys nothing at runtime.

### 🐛 Bug 5 — `connect()` swallows the adapter's returned address *(API gap)*

**Symptom:** the caller wants the pubkey immediately after `await connect()` (e.g. to push `/users`), but must wait a render to read hook state.

**Root cause:** both adapters return the address from `connect()`, but the hook discards it:

```ts
const address = await adapter.connect();
setPubkey(address);      // ← only saved to state, not returned
// connect(): Promise<void>
```

**Our workaround:** read `seeker.pubkey` from hook state (a render behind) — that's why our identity lives in a `useEffect` mirror instead of in the click handler.

**Suggested upstream fix:** `connect(): Promise<string | null>` — return the address. `signIn()` already returns `{ message, signature, pubkey }`; connect should be symmetric.

### 🐛 Bug 6 — MWA adapter is statically bundled into web builds *(package bug / bloat)*

**Symptom:** a web-only app (no mobile) pulls `@solana-mobile/mobile-wallet-adapter-protocol` + `react-native` into its install and bundle (`adapters/mwa.js` is a static import).

**Our workaround:** none — we accept the ~29KB chunk + react-native in the dependency tree.

**Suggested upstream fix:** lazy-load the MWA module only when `isSolanaMobile()` is true (`await import(...)`) so web builds never touch it.

### 🐛 Bug 7 — `mwa.js` base64 helpers fall back to Node's `Buffer` *(potential crash)*

**Symptom:** `Buffer is not defined` in a browser without `btoa`/`atob` (or in exotic webviews).

**Root cause:** `adapters/mwa.js`:

```js
if (typeof btoa === "function") return btoa(binary);
return Buffer.from(bytes).toString("base64"); // ← Node global
```

**Our workaround:** none needed yet (Seeker has `btoa`/`atob`) — flagged only.

**Suggested upstream fix:** pure-JS base64 fallback (or `TextEncoder` + a small table) so the package never depends on Node globals in browser code.

### 🐛 Bug 8 — `getBalance()` silently auto-connects *(surprising side effect)*

**Symptom:** calling `getBalance()` with no session triggers a wallet connect popup.

**Root cause:** `const address = pubkey ?? (await adapter?.connect());`

**Our workaround:** we never call it without a session.

**Suggested upstream fix:** throw `"No wallet connected"` instead of auto-connecting — or name the behavior (`getBalance({ autoConnect })`).

### 📝 Note — errors surfaced to users

Wallet extensions throw bare `"Unexpected error"` when their background is broken. We map that to an actionable message ("reload the extension…") and auto-clear connect errors after 6s. siws could ship a small `friendlyWalletError(err)` helper for this.

### 📝 Note — adapter churn on re-render *(minor perf)*

`useSeekerWallet` rebuilds the adapter in a `useMemo([wallet, rpcUrl])`. In our app the `wallet` object's identity changes on every wallet-adapter state update, so the adapter is recreated often. Harmless (hook state persists) but wasteful. A `useRef`-stable adapter keyed by `wallet.name` + `rpcUrl` would fix it.

---

## 3. Checklist for the upstream PR

- [ ] Bug 1: wait-for-publicKey in `WebWalletAdapter.connect()`
- [ ] Bug 2: document/own the live `publicKey` getter
- [ ] Bug 3: per-call wallet override in `connect()` or expose adapter readiness
- [ ] Bug 4: loosen `WebWalletLike` signing types
- [ ] Bug 5: `connect()` returns the pubkey
- [ ] Bug 6: lazy-load MWA adapter (no react-native in web builds)
- [ ] Bug 7: pure-JS base64 fallback in `mwa.js` (no `Buffer`)
- [ ] Bug 8: `getBalance()` stops auto-connecting (or makes it opt-in)
- [ ] `friendlyWalletError()` helper for extension-state errors
- [ ] Adapter memo keyed on wallet name, not object identity

## 4. App-side notes (not siws bugs — for us)

- `@solana/wallet-adapter-backpack` is deprecated on npm (0.1.14) — consider dropping it or swapping to the wallet-standard path.
- `autoConnect` is off because of Bug 1's race; once the package fix lands, re-enable for session restore.
- `pnpm` peer warnings (`bs58 ^6` wanted by wallet-standard, `utf-8-validate ^5` wanted by `ws@7`) are ecosystem noise — harmless.
- StrictMode double-fires our `POST /users` effect in dev — the API upsert makes it idempotent.
