// shared/chains.ts
// v1.6: Multi-chain registry — the SINGLE source of truth for every chain
// LiquidAI touches. Testnets only. No chain constants may live anywhere else.
//
// Consumed by:
//   - /server  (ChainClientFactory, route zod enums, boot-time env validation)
//   - /worker  (per-chain execution loop)
//   - /src     (wagmi config, chain switcher, explorer links)

export const CHAIN_SLUGS = [
  "sepolia",
  "arbitrum-sepolia",
  "base-sepolia",
] as const;

export type ChainSlug = (typeof CHAIN_SLUGS)[number];

export interface ChainInfo {
  chainId: number;
  name: string;
  slug: ChainSlug;
  /** Env var name holding the RPC URL for this chain. */
  rpcUrlEnvKey: string;
  /** Env var name holding the Uniswap v3 subgraph URL for this chain. */
  subgraphUrlEnvKey: string;
  /** NonfungiblePositionManager deployment. */
  nfpmAddress: `0x${string}`;
  /** UniswapV3Factory deployment. */
  factoryAddress: `0x${string}`;
  nativeSymbol: string;
  blockExplorerUrl: string;
  /** Chain name as DefiLlama knows it (yields `chain` field). */
  defillamaChainSlug: string;
  /** Fallback RPC when the env var is unset (public endpoints, testnet only). */
  defaultRpcUrl: string;
  /** Fallback subgraph when the env var is unset. */
  defaultSubgraphUrl: string;
}

export const CHAINS: Record<ChainSlug, ChainInfo> = {
  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    slug: "sepolia",
    rpcUrlEnvKey: "SEPOLIA_RPC_URL",
    subgraphUrlEnvKey: "SEPOLIA_SUBGRAPH_URL",
    nfpmAddress: "0x1238536071E1c677A632429e3655c799b22cDA52",
    factoryAddress: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    defillamaChainSlug: "Ethereum",
    defaultRpcUrl: "https://rpc.sepolia.org",
    defaultSubgraphUrl:
      "https://api.studio.thegraph.com/query/uniswap/uniswap-v3-sepolia/version/latest",
  },
  "arbitrum-sepolia": {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    slug: "arbitrum-sepolia",
    rpcUrlEnvKey: "ARBITRUM_SEPOLIA_RPC_URL",
    subgraphUrlEnvKey: "ARBITRUM_SEPOLIA_SUBGRAPH_URL",
    nfpmAddress: "0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65",
    factoryAddress: "0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e",
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://sepolia.arbiscan.io",
    defillamaChainSlug: "Arbitrum",
    defaultRpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    defaultSubgraphUrl:
      "https://api.studio.thegraph.com/query/uniswap/uniswap-v3-arbitrum-sepolia/version/latest",
  },
  "base-sepolia": {
    chainId: 84532,
    name: "Base Sepolia",
    slug: "base-sepolia",
    rpcUrlEnvKey: "BASE_SEPOLIA_RPC_URL",
    subgraphUrlEnvKey: "BASE_SEPOLIA_SUBGRAPH_URL",
    nfpmAddress: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
    factoryAddress: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://sepolia.basescan.org",
    defillamaChainSlug: "Base",
    defaultRpcUrl: "https://sepolia.base.org",
    defaultSubgraphUrl:
      "https://api.studio.thegraph.com/query/uniswap/uniswap-v3-base-sepolia/version/latest",
  },
};

export const DEFAULT_CHAIN_SLUG: ChainSlug = "sepolia";
export const DEFAULT_CHAIN_ID = CHAINS[DEFAULT_CHAIN_SLUG].chainId;

export const ALL_CHAINS: ChainInfo[] = CHAIN_SLUGS.map((s) => CHAINS[s]);

export function chainBySlug(slug: string): ChainInfo | undefined {
  return (CHAINS as Record<string, ChainInfo>)[slug];
}

export function chainById(chainId: number): ChainInfo | undefined {
  return ALL_CHAINS.find((c) => c.chainId === chainId);
}

export function chainByIdAny(chainId: number): ChainInfo | undefined {
  return ALL_CHAINS.find((c) => c.chainId === chainId);
}

export function isChainSlug(v: unknown): v is ChainSlug {
  return typeof v === "string" && (CHAIN_SLUGS as readonly string[]).includes(v);
}

// ---- Explorer link helpers (used by the frontend) ----

export function explorerTxUrl(slug: ChainSlug, txHash: string): string {
  return `${CHAINS[slug].blockExplorerUrl}/tx/${txHash}`;
}

export function explorerAddressUrl(slug: ChainSlug, address: string): string {
  return `${CHAINS[slug].blockExplorerUrl}/address/${address}`;
}

// ---- Env resolution + boot validation (server/worker side) ----

export interface ResolvedChainEnv {
  rpcUrl: string;
  subgraphUrl: string;
}

/**
 * Resolve RPC + subgraph URLs for a chain from an env map, falling back to
 * the registry defaults. Legacy fallback: SUBGRAPH_URL applies to sepolia.
 */
export function resolveChainEnv(
  chain: ChainInfo,
  env: Record<string, string | undefined>
): ResolvedChainEnv {
  const legacySubgraph =
    chain.slug === "sepolia" ? env.SUBGRAPH_URL : undefined;
  return {
    rpcUrl: env[chain.rpcUrlEnvKey] || chain.defaultRpcUrl,
    subgraphUrl:
      env[chain.subgraphUrlEnvKey] || legacySubgraph || chain.defaultSubgraphUrl,
  };
}

export interface ChainEnvValidation {
  ok: boolean;
  errors: string[];
  resolved: Record<ChainSlug, ResolvedChainEnv>;
}

/**
 * Validate chain env at boot. Fails fast (ok=false + errors) when a resolved
 * RPC or subgraph URL is missing or not a valid http(s) URL.
 * Call from server/worker startup and throw when !ok.
 */
export function validateChainEnv(
  env: Record<string, string | undefined>,
  slugs: ChainSlug[] = [...CHAIN_SLUGS]
): ChainEnvValidation {
  const errors: string[] = [];
  const resolved = {} as Record<ChainSlug, ResolvedChainEnv>;

  const isHttpUrl = (v: string): boolean => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  for (const slug of slugs) {
    const chain = CHAINS[slug];
    if (!chain) {
      errors.push(`unknown chain slug: ${slug}`);
      continue;
    }
    const r = resolveChainEnv(chain, env);
    if (!r.rpcUrl || !isHttpUrl(r.rpcUrl)) {
      errors.push(`${chain.rpcUrlEnvKey}: missing or invalid URL for ${slug}`);
    }
    if (!r.subgraphUrl || !isHttpUrl(r.subgraphUrl)) {
      errors.push(
        `${chain.subgraphUrlEnvKey}: missing or invalid URL for ${slug}`
      );
    }
    resolved[slug] = r;
  }

  return { ok: errors.length === 0, errors, resolved };
}

/**
 * Parse a CHAINS_ENABLED env value ("sepolia,base-sepolia") into slugs.
 * Empty/unset -> all chains. Unknown slugs are reported as errors.
 */
export function parseEnabledChains(
  value: string | undefined
): { slugs: ChainSlug[]; errors: string[] } {
  if (!value || !value.trim()) return { slugs: [...CHAIN_SLUGS], errors: [] };
  const errors: string[] = [];
  const slugs: ChainSlug[] = [];
  for (const raw of value.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (isChainSlug(raw)) slugs.push(raw);
    else errors.push(`CHAINS_ENABLED: unknown chain slug "${raw}"`);
  }
  return { slugs: slugs.length ? slugs : [...CHAIN_SLUGS], errors };
}


/**
 * v1.9: helper referenced by shared/policy.ts. The current shared chains
 * registry only defines testnet chains, so this returns false for every
 * known id. Extend the MAINNET chain set here when mainnet goes live.
 */
export function isMainnetChainId(chainId: number): boolean {
  return !ALL_CHAINS.some((c) => c.chainId === chainId);
}

export function isTestnetChainId(chainId: number): boolean {
  return ALL_CHAINS.some((c) => c.chainId === chainId);
}
