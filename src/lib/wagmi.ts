// src/lib/wagmi.ts
import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

const rpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://rpc.sepolia.org";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [metaMask(), injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: http(rpc),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
