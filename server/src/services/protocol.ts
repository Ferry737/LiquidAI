// server/src/services/protocol.ts
import type { ProtocolStats } from "../../../shared/types";
import { defiLlamaClient } from "../clients/defillama";
import { cache, TTL } from "../lib/cache";

export async function getProtocolStats(): Promise<ProtocolStats> {
  return cache.getOrSet("protocol:stats", TTL.PROTOCOL_MS, async () => {
    const [protocolTvlUSD, chainTvlUSD, volume24hUSD] = await Promise.all([
      defiLlamaClient.protocolTvl("uniswap-v3"),
      defiLlamaClient.chainTvl("Ethereum"),
      defiLlamaClient.dexVolume24h("uniswap").catch(() => 0),
    ]);
    return {
      protocolTvlUSD,
      chainTvlUSD,
      volume24hUSD,
      updatedAt: Date.now(),
    };
  });
}
