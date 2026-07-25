// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* to the Fastify backend so the browser only ever talks to
    // the web origin (no CORS, single tunnel when deployed behind one).
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
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
