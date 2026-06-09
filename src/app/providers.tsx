// src/app/providers.tsx
'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { useAccount, useSwitchChain, WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { initialChain } from '../lib/wagmi';
import { wagmiConfig  } from '../lib/wagmi';

function DefaultChainSwitcher() {
  const attemptedRef = useRef(false);
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (attemptedRef.current || !isConnected || !chainId) return;

    attemptedRef.current = true;

    if (chainId === initialChain.id) return;

    switchChain(
      { chainId: initialChain.id },
      {
        onError(error) {
          console.warn(
            '[cookieverse:default-chain-switch-failed]',
            error instanceof Error ? error.message : error,
          );
        },
      },
    );
  }, [chainId, isConnected, switchChain]);

  return null;
}

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
      <DefaultChainSwitcher />
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} initialChain={initialChain}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
