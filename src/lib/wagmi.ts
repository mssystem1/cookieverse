// src/lib/wagmi.ts
'use client';

import { http } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  CHAINS_WITH_DEFAULT_FIRST,
  defaultAppChain,
  monadTestnet,
  baseMainnet,
  mantleMainnet,
  lineaMainnet,
  mitosisMainnet,
  ogMainnet,
  xLayerMainnet,
} from '../lib/chain';

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export const wagmiConfig = getDefaultConfig({
  appName: 'Cookieverse',
  projectId: WC_PROJECT_ID,
  chains: CHAINS_WITH_DEFAULT_FIRST,
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

export const initialChain = defaultAppChain;
