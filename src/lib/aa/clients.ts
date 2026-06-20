
import { createPublicClient, http, type PublicClient } from 'viem';
import {
  CHAINS,
  defaultAppChain,
  defaultChainKey as appDefaultChainKey,
} from '../chain';
import { createBundlerClient } from 'viem/account-abstraction';

// Export default AA chain + key so other modules (SA provider, status card)
// can know which RPC / symbol to use at runtime.
export type ChainKey = 'monad' | 'base' | 'mantle' | 'mitosis' | 'linea' | "og" | "xlayer" | "arbitrum";

const DEFAULT_CHAIN_KEY = appDefaultChainKey as ChainKey;
const chain = defaultAppChain;

export const defaultChainKey = DEFAULT_CHAIN_KEY as ChainKey;
export const defaultChain = chain;

// Pick public RPC from the chain definition (which already uses per-chain envs)
const RPC_FALLBACK = chain.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_FALLBACK),
  batch: { multicall: true },
}) as unknown as PublicClient;


// --- 🔽 Bundler RPC logic per chain ---
let bundlerRpc: string | undefined;

switch (DEFAULT_CHAIN_KEY) {
  case 'base':
    bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL_BASE;
    break;
  case 'mantle':
    bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL_MANTLE;
    break;
  case 'linea':
    bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL_LINEA;
    break;    
  case 'arbitrum':
    bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL_ARBITRUM;
    break;
  //case 'mitosis':
  //  bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL_MITOSIS;
  //  break;
  default: // monad or fallback
    bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC_URL;
    break;
}

// Exported bundler client (if available)
export const bundlerClient = bundlerRpc
  ? createBundlerClient({
      chain,
      transport: http(bundlerRpc),
    })
  : undefined as any;

  const COOKIE_ADDRS = {
  monad:   (process.env.NEXT_PUBLIC_COOKIE_ADDRESS || '').toLowerCase(),
  base:    (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE || '').toLowerCase(),
  mantle:  (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE || '').toLowerCase(),
  linea:  (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA || '').toLowerCase(),  
  mitosis: (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS || '').toLowerCase(),
  og: (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG || "").toLowerCase(),
  xlayer: (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER || "").toLowerCase(),
  arbitrum: (process.env.NEXT_PUBLIC_COOKIE_ADDRESS_ARBITRUM || "").toLowerCase(),
};


export function resolveChainKeyByContract(contract?: string): ChainKey | null {
  const c = (contract || '').toLowerCase();
  if (!c) return null;
  if (c === COOKIE_ADDRS.base) return 'base';
  if (c === COOKIE_ADDRS.mantle) return 'mantle';
  if (c === COOKIE_ADDRS.linea) return 'linea';  
  if (c === COOKIE_ADDRS.mitosis) return 'mitosis';
  if (c === COOKIE_ADDRS.monad) return 'monad';
  if (c === COOKIE_ADDRS.og) return "og";
  if (c === COOKIE_ADDRS.xlayer) return "xlayer";
  if (c === COOKIE_ADDRS.arbitrum) return "arbitrum";
  return null;
}

// 2) Build exactly one PublicClient per supported chain (single place)
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

const CLIENTS: Record<ChainKey, PublicClient> = {
  monad:   undefined as any,
  base:    undefined as any,
  mantle:  undefined as any,
  linea:  undefined as any,  
  mitosis: undefined as any,
  og: undefined as any,
  xlayer: undefined as any,
  arbitrum: undefined as any,
};

for (const key of Object.keys(CLIENTS) as ChainKey[]) {
  const chain = CHAINS.find(c => c.id === ID_MAP[key])!;
  const rpc = chain.rpcUrls.default.http[0];
  CLIENTS[key] = createPublicClient({
    chain,
    transport: http(rpc),
    batch: { multicall: true },
  }) as unknown as PublicClient;
}

// 3) Export accessor (no new creation outside this file)
export function getPublicClientByKey(key: ChainKey): PublicClient {
  return CLIENTS[key];
}
