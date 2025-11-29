// lib/chain.ts
import { defineChain } from 'viem';

// Prefer env RPCs to avoid rate limiting. Fallbacks are safe but you should set envs.
const RPC_MONAD  = process.env.NEXT_PUBLIC_RPC_HTTP_MONAD  || 'https://testnet-rpc.monad.xyz';
const RPC_BASE   = process.env.NEXT_PUBLIC_RPC_HTTP_BASE   || 'https://mainnet.base.org';
const RPC_MANTLE = process.env.NEXT_PUBLIC_RPC_HTTP_MANTLE || 'https://rpc.mantle.xyz';
const RPC_LINEA  = process.env.NEXT_PUBLIC_RPC_HTTP_LINEA  || 'https://rpc.linea.build';
const RPC_MITOS  = process.env.NEXT_PUBLIC_RPC_HTTP_MITOS  || 'https://rpc.mitosis.org'; // set your real endpoint

export const monadTestnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_MONAD] }, public: { http: [RPC_MONAD] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: 'https://monadvision.com/' } },
  testnet: true,
});

// Well-known IDs:
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

// Set your actual Mitosis mainnet chainId & explorer if different:
export const mitosisMainnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777_777), // <-- set real id
  name: 'Mitosis',
  nativeCurrency: { name: 'Mitosis', symbol: 'MITO', decimals: 18 },
  rpcUrls: { default: { http: [RPC_MITOS] }, public: { http: [RPC_MITOS] } },
  blockExplorers: { default: { name: 'Mitosis Explorer', url: process.env.NEXT_PUBLIC_MITOSIS_EXPLORER || 'https://explorer.mitosis.org' } },
});

export const CHAINS = [monadTestnet, baseMainnet, mantleMainnet, lineaMainnet, mitosisMainnet];
