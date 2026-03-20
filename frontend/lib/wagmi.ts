import { http, createConfig } from "wagmi";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import type { Chain } from "viem";

// ---------------------------------------------------------------------------
// Custom chain definitions for Polkadot Hub
// ---------------------------------------------------------------------------

export const polkadotHubTestnet: Chain = {
  id: 420420417,
  name: "Polkadot Hub Testnet",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 10 },
  rpcUrls: {
    default: { http: ["https://services.polkadothub-rpc.com/testnet"] },
    public: { http: ["https://services.polkadothub-rpc.com/testnet"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
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
  chains: [polkadotHubTestnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "LiquidDOT" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [polkadotHubTestnet.id]: http(),
  },
});
