# PACKET 🧧 — Build & Test Runbook

How we build the on-chain program and prove we have a working `.so`.

Program ID: `58kSrb5EhQ1aRLywXXzVwC9frqVax71xrdpJHAATBNoD`
Program keypair: `target/deploy/packet-keypair.json`

---

## 1. Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Rust (rustup) | pinned by `rust-toolchain.toml` → **1.89.0** | must be installed: `rustup toolchain install 1.89.0` |
| Anchor CLI | **0.32.1** | `cargo install anchor-cli --version 0.32.1` or avm |
| Solana CLI | **2.3.4** (validator) + **4.2.0** (build tools) | see note below |
| Node + pnpm | Node 24, pnpm 11 | `npm i -g pnpm` |

### Solana CLI note (important)

- **`cargo build-sbf` (the `.so` build)**: use the **4.2.0 stable** release — its
  platform-tools are already cached on this machine. Path:
  `~/.local/share/solana/install/releases/stable-*/solana-release/bin`
- **`solana-test-validator` (tests)**: use **2.3.4** — the 4.2.0 validator has a
  Windows bug: it can't re-open its own freshly written `genesis.tar.bz2`
  (`Error checking to unpack genesis archive: Access is denied`).

Installers:
```sh
# downloads even if the final symlink step fails (needs Dev Mode)
curl -L -o /tmp/solana-init.exe https://release.anza.xyz/stable/solana-install-init-x86_64-pc-windows-msvc.exe
/tmp/solana-init.exe stable            # → releases/stable-<hash>/solana-release/bin
/tmp/solana-init.exe 2.3.4             # → releases/2.3.4/solana-release/bin
```

> If you get `os error 1314` (symlink privilege) on Windows, enable Developer
> Mode (Settings → Privacy & Security → For developers) or run elevated.

---

## 2. Build the `.so`

```sh
cd "aegis framework/packets/program"
export PATH="$HOME/.local/share/solana/install/releases/stable-*/solana-release/bin:$PATH"
anchor build
```

Artifacts:

- `target/deploy/packet.so` — the SBF (on-chain) binary ✅
- `target/idl/packet.json` — the IDL consumed by clients/tests
- `target/types/packet.ts` — generated TS **types** (note: **no runtime `IDL`
  export** in anchor 0.32 — import the JSON instead)

### Contract-side gotchas (already fixed in the code)

- `Cargo.toml` must enable **`anchor-spl/idl-build`**:
  ```toml
  idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
  ```
- `#[instruction(...)]` on `CreateAndFund` must list **all** args. With a
  partial list, the accounts derive read `total_amount` as `recipient_limit`
  and tried to allocate a 32 MB packet account.

---

## 3. Run the tests (14 tests, ~45s)

The tests run against a local `solana-test-validator` (2.3.4):

```sh
cd "aegis framework/packets/program"
export PATH="$HOME/.local/share/solana/install/releases/2.3.4/solana-release/bin:$HOME/AppData/Roaming/npm:$PATH"
export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

# 1. Start the validator (detached), program preloaded into genesis
solana-test-validator --log --reset --bind-address 127.0.0.1 \
  --ledger ".anchor/manual-ledger" \
  --bpf-program "target/deploy/packet-keypair.json" "target/deploy/packet.so" \
  > "$TEMP/pkt-validator.log" 2>&1 &

# 2. Wait ~30s for RPC, then run the suite
sleep 30
pnpm exec ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"

# 3. Stop the validator
kill %1
```

Expected result:

```
14 passing (45s)
```

### Validator flags that matter (Windows)

- `--bind-address 127.0.0.1` — required. The test-validator's faucet connects
  to `0.0.0.0:9900` internally, which Windows rejects
  (`WSAEADDRNOTAVAIL`, os error 10049) → airdrops fail. We bypass the faucet
  entirely: the tests fall back to direct transfers from the admin wallet,
  and the program is preloaded via `--bpf-program` (no deploy step).
- `--log` (not `--quiet`) — both cannot be combined.

### Test-side notes (anchor 0.32)

- `import IDL from "../target/idl/packet.json"` — the generated
  `target/types/packet.ts` only exports **types**.
- `tsconfig.json` needs `"resolveJsonModule": true`.
- `new Program(IDL, provider)` — 0.32's constructor takes
  `(idl, provider?)`; the program address comes from `idl.address`.
- The airdrop helper falls back to `SystemProgram.transfer` from the funded
  admin wallet when the faucet is unreachable.

---

## 4. Deploying for real (localnet / devnet)

```sh
export PATH="$HOME/.local/share/solana/install/releases/2.3.4/solana-release/bin:$PATH"
solana config set --url devnet

# airdrop / transfer SOL to the deployer wallet first, then:
solana program deploy target/deploy/packet.so \
  --program-id target/deploy/packet-keypair.json
```

Upgrade later with the same command (the keypair is the upgrade authority).

---

## 5. Troubleshooting quick reference

| Symptom | Cause / fix |
|---|---|
| `ninja: manifest 'build.ninja' still dirty` | (mobile app) old CMake — see `mobile/android/gradle.properties` `android.cmakeVersion=3.31.6` |
| `Error checking to unpack genesis archive: Access is denied` | 4.2.0 validator bug on Windows — use the **2.3.4** validator |
| `airdrop ... failed: Internal error` / os error 10049 | faucet `0.0.0.0:9900` connect bug — use the tests' transfer fallback |
| `os error 1314` (symlink privilege) | enable Windows Developer Mode or run elevated |
| `no associated function 'create_type' for Mint/TokenAccount` | missing `anchor-spl/idl-build` feature in `Cargo.toml` |
| `Allocate: requested 32000152` | `#[instruction(...)]` must list ALL args (derive reads wrong offset) |
| `Module has no exported member 'IDL'` | import `target/idl/packet.json` instead of the generated types |
| `AnchorError ... expected X got {code:6007,...}` | error-shape differences in anchor 0.32 — handled by `expectAnchorErrorCode` |
