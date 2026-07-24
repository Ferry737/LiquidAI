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
    };
    return config;
  },
};

export default nextConfig;
