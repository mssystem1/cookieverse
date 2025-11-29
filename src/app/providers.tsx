// src/app/providers.tsx
'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { ReactNode, useMemo } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { initialChain } from '../lib/wagmi';
import { wagmiConfig  } from '../lib/wagmi';

export default function Providers({ children }: { children: ReactNode }) {
  // One QueryClient for the app lifetime
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchInterval: false, // no periodic background refetching
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
          },
        },
      }),
    [],
  );

  return (
    <WagmiProvider config={wagmiConfig }>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} initialChain={initialChain}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
