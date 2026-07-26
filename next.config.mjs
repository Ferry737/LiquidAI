// next.config.mjs
// v2.1: Removed backend rewrites — the app is now fully self-contained client-side.
// All data fetched directly from public APIs (Uniswap subgraph, CoinGecko, public RPCs).
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Optional Coinbase/Base connector deps we don't use (MetaMask/injected only).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": false,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
      // @metamask/sdk pulls in react-native storage that doesn't exist in web builds.
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
