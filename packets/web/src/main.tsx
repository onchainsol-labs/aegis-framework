import { StrictMode, useMemo } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConnectionProvider, WalletProvider as AdapterWalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import "./index.css";
import App from "./App.tsx";
import { WalletProvider } from "./lib/walletProvider.tsx";

const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://api.mainnet-beta.solana.com";

function Providers({ children }: { children: ReactNode }) {
  const adapters = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
    [],
  );
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <AdapterWalletProvider wallets={adapters} autoConnect={false}>
        <WalletProvider>{children}</WalletProvider>
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
