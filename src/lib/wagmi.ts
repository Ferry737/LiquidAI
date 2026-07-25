// src/lib/wagmi.ts
// v1.6: all three testnets from the shared chain registry.
import { createConfig, http } from "wagmi";
import { sepolia, arbitrumSepolia, baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";
import { CHAINS } from "../../shared/chains";

const sepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC || CHAINS.sepolia.defaultRpcUrl;
const arbSepoliaRpc =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ||
  CHAINS["arbitrum-sepolia"].defaultRpcUrl;
const baseSepoliaRpc =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
  CHAINS["base-sepolia"].defaultRpcUrl;

export const wagmiConfig = createConfig({
  chains: [sepolia, arbitrumSepolia, baseSepolia],
  connectors: [metaMask(), injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [arbitrumSepolia.id]: http(arbSepoliaRpc),
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
