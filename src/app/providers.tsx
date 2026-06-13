// src/app/providers.tsx
'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { useAccount, useSwitchChain, WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { initialChain } from '../lib/wagmi';
import { wagmiConfig  } from '../lib/wagmi';
import { CHAINS } from '../lib/chain';

const LAST_CHAIN_ID_KEY = 'cookieverse:last-chain-id';
const DEFAULT_CHAIN_APPLIED_KEY = 'cookieverse:default-chain-applied';

const supportedChainIds = new Set(CHAINS.map((chain) => chain.id));

function readSavedChainId(options: { includeWagmiStore?: boolean } = {}) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LAST_CHAIN_ID_KEY);
    const id = raw ? Number(raw) : NaN;
    if (Number.isFinite(id) && supportedChainIds.has(id)) return id;

    if (!options.includeWagmiStore) return null;

    const wagmiRaw = window.localStorage.getItem('wagmi.store');
    if (!wagmiRaw) return null;

    const wagmiStore = JSON.parse(wagmiRaw);
    const wagmiChainId = Number(
      wagmiStore?.state?.chainId ?? wagmiStore?.chainId ?? NaN
    );

    return Number.isFinite(wagmiChainId) && supportedChainIds.has(wagmiChainId)
      ? wagmiChainId
      : null;
  } catch {
    return null;
  }
}

function writeSavedChainId(chainId: number) {
  if (typeof window === 'undefined' || !supportedChainIds.has(chainId)) return;

  try {
    window.localStorage.setItem(LAST_CHAIN_ID_KEY, String(chainId));
    window.localStorage.setItem(DEFAULT_CHAIN_APPLIED_KEY, '1');
  } catch {}
}

function readDefaultChainApplied() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(DEFAULT_CHAIN_APPLIED_KEY) === '1';
  } catch {
    return false;
  }
}

function resolveRainbowInitialChain() {
  const defaultApplied = readDefaultChainApplied();
  const savedChainId = defaultApplied
    ? readSavedChainId({ includeWagmiStore: true })
    : null;

  return CHAINS.find((chain) => chain.id === savedChainId) ?? initialChain;
}

function ChainPreferenceRestorer() {
  const restoreAttemptedRef = useRef(false);
  const pendingTargetRef = useRef<number | null>(null);
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (!isConnected || !chainId) return;
    const defaultApplied = readDefaultChainApplied();

    if (!defaultApplied) {
      const targetChainId = initialChain.id;

      if (chainId === targetChainId) {
        writeSavedChainId(chainId);
        pendingTargetRef.current = null;
        return;
      }

      if (pendingTargetRef.current === targetChainId) return;

      pendingTargetRef.current = targetChainId;
      switchChain(
        { chainId: targetChainId },
        {
          onSuccess() {
            writeSavedChainId(targetChainId);
            pendingTargetRef.current = null;
          },
          onError(error) {
            pendingTargetRef.current = null;
            console.warn(
              '[cookieverse:default-chain-switch-failed]',
              error instanceof Error ? error.message : error,
            );
          },
        },
      );
      return;
    }

    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;

    const savedChainId = defaultApplied
      ? readSavedChainId({ includeWagmiStore: true })
      : null;
    const targetChainId = savedChainId;

    if (!targetChainId || targetChainId === chainId) {
      writeSavedChainId(chainId);
      return;
    }

    pendingTargetRef.current = targetChainId;
    switchChain(
      { chainId: targetChainId },
      {
        onSuccess() {
          writeSavedChainId(targetChainId);
          pendingTargetRef.current = null;
        },
        onError(error) {
          pendingTargetRef.current = null;
          console.warn(
            '[cookieverse:chain-restore-failed]',
            error instanceof Error ? error.message : error,
          );
        },
      },
    );
  }, [chainId, isConnected, switchChain]);

  useEffect(() => {
    if (!isConnected || !chainId || !readDefaultChainApplied()) return;
    if (pendingTargetRef.current && pendingTargetRef.current !== chainId) return;

    writeSavedChainId(chainId);
  }, [chainId, isConnected]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const rainbowInitialChain = useMemo(resolveRainbowInitialChain, []);

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
        <ChainPreferenceRestorer />
        <RainbowKitProvider theme={darkTheme()} initialChain={rainbowInitialChain}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
