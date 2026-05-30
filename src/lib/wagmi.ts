// src/lib/wagmi.ts
'use client';

import { http } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  CHAINS,
  monadTestnet,
  baseMainnet,
  mantleMainnet,
  lineaMainnet,
  mitosisMainnet,
  ogMainnet,
  xLayerMainnet,
} from '../lib/chain';

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const DEFAULT_CHAIN_KEY =
  (process.env.NEXT_PUBLIC_DEFAULT_CHAIN || 'monad').toLowerCase();

const CHAIN_MAP: Record<string, number> = {
  monad: monadTestnet.id,
  base: baseMainnet.id,
  mantle: mantleMainnet.id,
  linea: lineaMainnet.id,
  mitosis: mitosisMainnet.id,
  og: ogMainnet.id,
  '0g': ogMainnet.id,
  xlayer: xLayerMainnet.id,
  'x-layer': xLayerMainnet.id,
};

const initialChainId = CHAIN_MAP[DEFAULT_CHAIN_KEY] ?? monadTestnet.id;

export const wagmiConfig = getDefaultConfig({
  appName: 'Cookieverse',
  projectId: WC_PROJECT_ID,
  chains: [
    monadTestnet,
    baseMainnet,
    mantleMainnet,
    lineaMainnet,
    mitosisMainnet,
    ogMainnet,
    xLayerMainnet,
  ],
  transports: {
    [monadTestnet.id]: http(),
    [baseMainnet.id]: http(),
    [mantleMainnet.id]: http(),
    [lineaMainnet.id]: http(),
    [mitosisMainnet.id]: http(),
    [ogMainnet.id]: http(),
    [xLayerMainnet.id]: http(),
  },
  ssr: true,
  pollingInterval: 60_000,
});

export const initialChain =
  CHAINS.find((c) => c.id === initialChainId) ?? monadTestnet;