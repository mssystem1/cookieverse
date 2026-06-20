import { createPublicClient, http, type PublicClient } from 'viem';
import { fetch as undiciFetch } from 'undici';
import { CHAINS, defaultChainKey as appDefaultChainKey } from '../chain';
import type { ChainKey } from './clients';

export const defaultServerChainKey = appDefaultChainKey as ChainKey;

const ID_MAP: Record<ChainKey, number> = {
  monad: 143,
  base: 8453,
  mantle: 5000,
  linea: 59144,
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
  og: 16661,
  xlayer: 196,
  arbitrum: 42161,
};

const rpcFetch: typeof fetch = (input, init) => {
  const { cache, next, url, ...safeInit } = (init || {}) as RequestInit & {
    next?: unknown;
    url?: unknown;
  };

  if (safeInit.signal == null) delete safeInit.signal;

  return undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    safeInit as Parameters<typeof undiciFetch>[1],
  ) as unknown as ReturnType<typeof fetch>;
};

const CLIENTS = Object.fromEntries(
  (Object.keys(ID_MAP) as ChainKey[]).map((key) => {
    const chain = CHAINS.find((candidate) => candidate.id === ID_MAP[key]);
    if (!chain) throw new Error(`Missing chain config for ${key}`);

    const rpc = chain.rpcUrls.default.http[0];
    const client = createPublicClient({
      chain,
      transport: http(rpc, {
        fetchFn: rpcFetch,
        timeout: 20_000,
      }),
      batch: { multicall: true },
    }) as unknown as PublicClient;

    return [key, client];
  }),
) as Record<ChainKey, PublicClient>;

export function getServerPublicClientByKey(key: ChainKey): PublicClient {
  return CLIENTS[key];
}
