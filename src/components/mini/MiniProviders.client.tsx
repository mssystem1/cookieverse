'use client';

import * as React from 'react';
import { useEffect, useMemo, PropsWithChildren } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sdk } from '@farcaster/miniapp-sdk';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

import { baseMainnet, monadTestnet } from '../../lib/chain';

//import { SmartAccountProviderMini } from '../../app/SmartAccountProvider';

// wagmi config that will use Farcaster’s EIP-1193 provider via injected()
const wagmiConfig = createConfig({
  chains: [baseMainnet],
  transports: { [baseMainnet.id]: http() }, // your RPC setup (can keep http() if set globally)
  connectors: [
    miniAppConnector() as any
  ]
});

export default function MiniProviders({ children }: PropsWithChildren) {
  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => {
    // Hide splash when your app is ready to display
    sdk.actions.ready().catch(() => {}); // must be called in mini to remove splash. :contentReference[oaicite:0]{index=0}

    // Expose Farcaster’s EIP-1193 provider so `injected()` picks it up
    sdk.wallet.getEthereumProvider()
      .then((provider) => { (window as any).ethereum = provider; })
      .catch(() => {});
  }, []);
/*
        <SmartAccountProviderMini>
          {children}
        </SmartAccountProviderMini>
*/
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>

          {children}

      </QueryClientProvider>
    </WagmiProvider>
  );
}
