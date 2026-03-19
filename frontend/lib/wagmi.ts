import { http, createConfig } from "wagmi";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import type { Chain } from "viem";

// ---------------------------------------------------------------------------
// Custom chain definitions for Polkadot Hub
// ---------------------------------------------------------------------------

export const polkadotHubTestnet: Chain = {
  id: 420420421,
  name: "Polkadot Hub Testnet",
  nativeCurrency: { name: "DOT", symbol: "DOT", decimals: 10 },
  rpcUrls: {
    default: { http: ["https://rpc.pah.zeitgeist.pm"] },
    public: { http: ["https://rpc.pah.zeitgeist.pm"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout.pah.zeitgeist.pm",
    },
  },
};

export const polkadotHub: Chain = {
  id: 420420420,
  name: "Polkadot Hub",
  nativeCurrency: { name: "DOT", symbol: "DOT", decimals: 10 },
  rpcUrls: {
    default: { http: ["https://rpc.polkadot.io"] },
    public: { http: ["https://rpc.polkadot.io"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout.polkadot.network",
    },
  },
};

// ---------------------------------------------------------------------------
// Wagmi config
// ---------------------------------------------------------------------------

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will not work."
  );
}

export const wagmiConfig = createConfig({
  chains: [polkadotHubTestnet, polkadotHub],
  connectors: [
    injected(),
    walletConnect({ projectId: projectId ?? "" }),
    coinbaseWallet({ appName: "LiquidDOT" }),
  ],
  transports: {
    [polkadotHubTestnet.id]: http(),
    [polkadotHub.id]: http(),
  },
});
