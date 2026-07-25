// src/components/chain/ChainProvider.tsx
// v1.6: Active-chain context. The selected chain slug drives every
// chain-aware query (pools, positions, backtests, explorer links) and is
// persisted to localStorage so the choice survives reloads.

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CHAIN_SLUG,
  isChainSlug,
  CHAINS,
  type ChainSlug,
  type ChainInfo,
} from "../../../shared/chains";

const STORAGE_KEY = "liquidai.chain";

interface ChainContextValue {
  chain: ChainSlug;
  chainInfo: ChainInfo;
  setChain: (slug: ChainSlug) => void;
}

const ChainContext = createContext<ChainContextValue>({
  chain: DEFAULT_CHAIN_SLUG,
  chainInfo: CHAINS[DEFAULT_CHAIN_SLUG],
  setChain: () => undefined,
});

export function ChainProvider({ children }: { children: ReactNode }) {
  const [chain, setChainState] = useState<ChainSlug>(DEFAULT_CHAIN_SLUG);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isChainSlug(stored)) setChainState(stored);
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);

  const setChain = (slug: ChainSlug) => {
    setChainState(slug);
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch {
      // ignore
    }
  };

  return (
    <ChainContext.Provider
      value={{ chain, chainInfo: CHAINS[chain], setChain }}
    >
      {children}
    </ChainContext.Provider>
  );
}

export function useChain(): ChainContextValue {
  return useContext(ChainContext);
}
