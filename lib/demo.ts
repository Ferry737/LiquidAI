// All numeric values here are DEMO / TESTNET figures for visualization only.
// They are NOT real TVL, APR, or performance claims.

export const DEMO_METRICS = {
  totalValueManaged: 128420,
  unclaimedFees: 4210,
  avgFeeApr: 31.4,
  positionsInRange: 3,
  positionsTotal: 3,
};

export const DEMO_POSITIONS = [
  { pair: "ETH / USDC", fee: "0.30%", status: "IN RANGE", range: "$4,430 — $5,170", price: 4824.2, lower: 4430, upper: 5170 },
  { pair: "WBTC / ETH", fee: "0.30%", status: "IN RANGE", range: "$2,910 — $3,340", price: 3120.5, lower: 2910, upper: 3340 },
  { pair: "DAI / USDC", fee: "0.05%", status: "IN RANGE", range: "$0.998 — $1.002", price: 1.0, lower: 0.998, upper: 1.002 },
];

export const BACKTEST = {
  strategyApr: 31.4,
  benchmarkApr: 18.2,
  maxDrawdown: -6.8,
  rebalances: 27,
  feesEarned: 8421,
};

export const CHAINS = [
  { name: "Ethereum", state: "live" },
  { name: "Arbitrum", state: "live" },
  { name: "Base", state: "live" },
  { name: "Optimism", state: "testnet" },
];

export const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Strategies", href: "#strategies" },
  { label: "Backtest", href: "#backtest" },
  { label: "Resources", href: "#resources" },
];
