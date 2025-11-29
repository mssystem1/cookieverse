'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sdk } from '@farcaster/miniapp-sdk';
import { baseMainnet, monadTestnet } from '../../lib/chain';

/* -------------------- layout: two stacked rows (no grid) -------------------- */
const CONTAINER: React.CSSProperties = { width: '100%', marginBottom: 12 };

const TOP_BAR: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  width: '100%',
};

const LEFT_CLUSTER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const RIGHT_CLUSTER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const TABS_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  marginTop: 12,
  width: '100%',
};

/* -------------------- tokens to mirror main tab look -------------------- */
const TAB_BASE: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(63,63,70,0.70)',
  background: 'rgba(24,24,28,0.82)',
  color: '#e5e7eb',
  fontWeight: 700,
  fontSize: 13,
  textDecoration: 'none',
  lineHeight: 1.0,
  whiteSpace: 'nowrap',
};
const TAB_ACTIVE: React.CSSProperties = {
  background: '#4f46e5',
  borderColor: '#4f46e5',
  color: '#fff',
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(63,63,70,0.70)',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  minWidth: 170,
  textAlign: 'center',
};

const BTN_ACCENT: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(63,63,70,0.70)',
  background: 'rgba(24,24,28,0.82)',
  color: '#e5e7eb',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  minWidth: 100,
  textAlign: 'center',
};

const PILL: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid rgba(63,63,70,0.70)',
  background: 'rgba(24,24,28,0.82)',
  color: '#e5e7eb',
  fontSize: 12,
  fontWeight: 700,
};

/* -------------------- helpers -------------------- */
function makeSiweNonce(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

export default function MiniNav() {
  const pathname = usePathname();
  const tabs = useMemo(
    () => [
      { href: '/mini', label: 'Main' },
      { href: '/mini/bridge', label: 'ZK Bridge' },      
      { href: '/mini/leaderboard', label: 'Leaderboard' },
      { href: '/mini/dashboard', label: 'Dashboard' },      
    ],
    []
  );

  const { address, isConnected } = useAccount();
  const { connect, connectors, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();

  const [addr, setAddr] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);

  // MON balance (live via periodic refetch)
  const { data: bal } = useBalance({
    address: (addr as Address) || undefined,
    chainId: monadTestnet.id,
    query: { enabled: !!addr, refetchInterval: 30_000 }, // <-- removed `watch`
  });

  // On mount, hydrate from Farcaster provider if available
  useEffect(() => {
    (async () => {
      try {
        const provider: any = await sdk.wallet.getEthereumProvider();
        (window as any).ethereum = provider;
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
        setAddr((accounts?.[0] ?? null) as Address | null);

        if (provider?.on) {
          provider.on('accountsChanged', (a: string[]) => {
            setAddr((a?.[0] ?? null) as Address | null);
          });
          provider.on('disconnect', () => setAddr(null));
        }
      } catch {
        // ignore if not inside Warpcast yet
      }
    })();
  }, []);

  // Sign-in OR Disconnect toggle
  const onPrimaryClick = useCallback(async () => {
    if (addr) {
      // Disconnect
      try {
        disconnect();
      } catch {}
      setAddr(null);
      return;
    }

    // Sign-in
    if (busy) return;
    setBusy(true);
    const guard = setTimeout(() => setBusy(false), 15000);

    try {
      const nonce = makeSiweNonce(16); // >= 8, alphanumeric
      await sdk.actions.signIn({ nonce, acceptAuthAddress: true });

      const provider: any = await sdk.wallet.getEthereumProvider();
      (window as any).ethereum = provider;

      const inj = connectors.find((c) => c.id === 'injected') ?? injected();
      if (!isConnected || connectStatus === 'idle') {
        await connect({ connector: inj });
      }

      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      setAddr((accounts?.[0] ?? null) as Address | null);
    } catch (e) {
      console.error('Farcaster sign-in failed:', e);
      alert('Sign in failed. Please try again inside Farcaster.');
    } finally {
      clearTimeout(guard);
      setBusy(false);
      sdk.actions.ready().catch(() => {});
    }
  }, [addr, busy, connect, connectors, connectStatus, disconnect, isConnected]);

  const share = useCallback(async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/mini`
        : 'https://monad-fortune-cookies.vercel.app/mini';

    await sdk.actions.composeCast({
      text: 'Mint a Fortune 🍪 in the Mini!',
      embeds: [url],
    });
  }, []);

  return (
    <div style={CONTAINER}>
      {/* Row 1: left cluster = Sign-in/Disconnect + Balance; right = Share */}
      <div style={TOP_BAR}>
        <div style={LEFT_CLUSTER}>
          <button style={BTN_PRIMARY} onClick={onPrimaryClick} disabled={busy}>
            {addr
              ? `Disconnect ${addr.slice(0, 6)}…${addr.slice(-4)}`
              : busy
              ? 'Signing…'
              : 'Sign in with Farcaster'}
          </button>

          {/* ETH balance pill (only when signed) */}
          {addr ? (
            <span style={PILL} title="Wallet balance">
              {bal?.formatted ? `${Number(bal.formatted).toFixed(4)} ${bal.symbol || 'ETH'}` : '— ETH'}
            </span>
          ) : null}
        </div>

        <div style={RIGHT_CLUSTER}>
          <button style={BTN_ACCENT} onClick={share}>Share</button>
        </div>
      </div>

      {/* Row 2: tabs (always below) */}
      <nav style={TABS_ROW} aria-label="Mini navigation">
        {tabs.map((t) => {
          const active =
            pathname === t.href || (t.href !== '/mini' && pathname?.startsWith(t.href));
          return (
            <Link key={t.href} href={t.href} style={{ ...TAB_BASE, ...(active ? TAB_ACTIVE : null) }}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
