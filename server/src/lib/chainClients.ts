// server/src/lib/chainClients.ts
// v1.6: ChainClientFactory — one UniswapClient + one viem public client per
// enabled chain. Instances are cached; chains are fully isolated. This is the
// ONLY place chain-specific clients are constructed.

import { createPublicClient, http, type PublicClient } from "viem";
import { config } from "./config";
import { UniswapClient } from "../clients/uniswap";
import { BadRequestError } from "./errors";
import {
  CHAINS,
  type ChainInfo,
  type ChainSlug,
} from "../../../shared/chains";

export class ChainClientFactory {
  private uniswapClients = new Map<ChainSlug, UniswapClient>();
  private publicClients = new Map<ChainSlug, PublicClient>();

  constructor(
    private readonly enabledChains: ChainSlug[] = config.enabledChains,
    private readonly chainEnv: Record<
      ChainSlug,
      { rpcUrl: string; subgraphUrl: string }
    > = config.chainEnv
  ) {}

  get enabled(): ChainSlug[] {
    return [...this.enabledChains];
  }

  isEnabled(slug: ChainSlug): boolean {
    return this.enabledChains.includes(slug);
  }

  chainInfo(slug: ChainSlug): ChainInfo {
    return CHAINS[slug];
  }

  /** Throw a 400 when the slug is not enabled on this deployment. */
  assertEnabled(slug: ChainSlug): void {
    if (!this.isEnabled(slug)) {
      throw new BadRequestError(`chain "${slug}" is not enabled`);
    }
  }

  uniswap(slug: ChainSlug): UniswapClient {
    this.assertEnabled(slug);
    let client = this.uniswapClients.get(slug);
    if (!client) {
      client = new UniswapClient(CHAINS[slug], this.chainEnv[slug].subgraphUrl);
      this.uniswapClients.set(slug, client);
    }
    return client;
  }

  publicClient(slug: ChainSlug): PublicClient {
    this.assertEnabled(slug);
    let client = this.publicClients.get(slug);
    if (!client) {
      const chain = CHAINS[slug];
      client = createPublicClient({
        chain: {
          id: chain.chainId,
          name: chain.name,
          nativeCurrency: {
            name: chain.nativeSymbol,
            symbol: chain.nativeSymbol,
            decimals: 18,
          },
          rpcUrls: { default: { http: [this.chainEnv[slug].rpcUrl] } },
        },
        transport: http(this.chainEnv[slug].rpcUrl),
      }) as PublicClient;
      this.publicClients.set(slug, client);
    }
    return client;
  }

  subgraphUrl(slug: ChainSlug): string {
    this.assertEnabled(slug);
    return this.chainEnv[slug].subgraphUrl;
  }

  rpcUrl(slug: ChainSlug): string {
    this.assertEnabled(slug);
    return this.chainEnv[slug].rpcUrl;
  }

  /** Drop cached instances (tests). */
  clear(): void {
    this.uniswapClients.clear();
    this.publicClients.clear();
  }
}

/** Global singleton factory bound to the validated config. */
export const chainClients = new ChainClientFactory();
