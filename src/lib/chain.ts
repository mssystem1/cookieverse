// src/lib/chain.ts
import { defineChain } from 'viem';

// Prefer env RPCs to avoid rate limiting. Fallbacks are safe but you should set envs.
const RPC_MONAD = process.env.NEXT_PUBLIC_RPC_HTTP_MONAD || 'https://testnet-rpc.monad.xyz';
const RPC_BASE = process.env.NEXT_PUBLIC_RPC_HTTP_BASE || 'https://mainnet.base.org';
const RPC_MANTLE = process.env.NEXT_PUBLIC_RPC_HTTP_MANTLE || 'https://rpc.mantle.xyz';
const RPC_LINEA = process.env.NEXT_PUBLIC_RPC_HTTP_LINEA || 'https://rpc.linea.build';
const RPC_MITOS = process.env.NEXT_PUBLIC_RPC_HTTP_MITOS || 'https://rpc.mitosis.org';
const RPC_OG = process.env.NEXT_PUBLIC_RPC_HTTP_OG || 'https://evmrpc.0g.ai';
const RPC_XLAYER = process.env.NEXT_PUBLIC_RPC_HTTP_XLAYER || 'https://rpc.xlayer.tech';

export const monadTestnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_MONAD] }, public: { http: [RPC_MONAD] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: 'https://monadvision.com' } },
  testnet: true,
});

export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_BASE] }, public: { http: [RPC_BASE] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
});

export const mantleMainnet = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_MANTLE] }, public: { http: [RPC_MANTLE] } },
  blockExplorers: { default: { name: 'MantleScan', url: 'https://mantlescan.xyz' } },
});

export const lineaMainnet = defineChain({
  id: 59144,
  name: 'Linea',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_LINEA] }, public: { http: [RPC_LINEA] } },
  blockExplorers: { default: { name: 'LineaScan', url: 'https://lineascan.build' } },
});

export const mitosisMainnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777_777),
  name: 'Mitosis',
  nativeCurrency: { name: 'Mitosis', symbol: 'MITO', decimals: 18 },
  rpcUrls: { default: { http: [RPC_MITOS] }, public: { http: [RPC_MITOS] } },
  blockExplorers: {
    default: {
      name: 'Mitosis Explorer',
      url: process.env.NEXT_PUBLIC_MITOSIS_EXPLORER || 'https://explorer.mitosis.org',
    },
  },
});

export const ogMainnet = defineChain({
  id: 16661,
  name: '0G',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [RPC_OG] }, public: { http: [RPC_OG] } },
  blockExplorers: { default: { name: '0G ChainScan', url: 'https://chainscan.0g.ai' } },
});

export const xLayerMainnet = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [RPC_XLAYER] }, public: { http: [RPC_XLAYER] } },
  blockExplorers: {
    default: {
      name: 'OKX X Layer Explorer',
      url: 'https://www.okx.com/web3/explorer/xlayer',
    },
  },
});

export const CHAINS = [
  monadTestnet,
  baseMainnet,
  mantleMainnet,
  lineaMainnet,
  mitosisMainnet,
  ogMainnet,
  xLayerMainnet,
];

export type AppChainKey =
  | 'monad'
  | 'base'
  | 'mantle'
  | 'linea'
  | 'mitosis'
  | 'og'
  | 'xlayer';

type DefaultChainInputKey =
  | AppChainKey
  | '0g'
  | 'x-layer'
  | 'x_layer';

export const CHAIN_BY_DEFAULT_KEY: Record<DefaultChainInputKey, (typeof CHAINS)[number]> = {
  monad: monadTestnet,
  base: baseMainnet,
  mantle: mantleMainnet,
  linea: lineaMainnet,
  mitosis: mitosisMainnet,
  og: ogMainnet,
  '0g': ogMainnet,
  xlayer: xLayerMainnet,
  'x-layer': xLayerMainnet,
  x_layer: xLayerMainnet,
} as const;

export function normalizeDefaultChainKey(value?: string | null) {
  const key = String(value || 'monad').trim().toLowerCase();

  if (key === '0g') return 'og';
  if (key === 'x-layer' || key === 'x_layer') return 'xlayer';
  if (key in CHAIN_BY_DEFAULT_KEY) return key as AppChainKey;

  return 'monad';
}

export const defaultChainKey = normalizeDefaultChainKey(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN
);

export const defaultAppChain =
  CHAIN_BY_DEFAULT_KEY[defaultChainKey as keyof typeof CHAIN_BY_DEFAULT_KEY] ??
  monadTestnet;

export const CHAINS_WITH_DEFAULT_FIRST = [
  defaultAppChain,
  ...CHAINS.filter((chain) => chain.id !== defaultAppChain.id),
] as const;
