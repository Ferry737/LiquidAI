// src/lib/constants.ts
// Uniswap v3 canonical deployment addresses on Ethereum Sepolia (chainId 11155111).

export const SEPOLIA_CHAIN_ID = 11155111;

export const UNISWAP_V3 = {
  factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
  nonfungiblePositionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
  swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FBB",
} as const;

// Common Sepolia test tokens.
export const TOKENS = [
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    decimals: 6,
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6",
    decimals: 18,
  },
] as const;

export type Token = (typeof TOKENS)[number];

export const FEE_TIERS = [
  { fee: 100, label: "0.01%", tickSpacing: 1 },
  { fee: 500, label: "0.05%", tickSpacing: 10 },
  { fee: 3000, label: "0.30%", tickSpacing: 60 },
  { fee: 10000, label: "1.00%", tickSpacing: 200 },
] as const;

export function tokenBySymbol(sym: string): Token | undefined {
  return TOKENS.find((t) => t.symbol === sym);
}
