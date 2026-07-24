// next.config.mjs
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
    };
    return config;
  },
};

export default nextConfig;
