'use client';

import { useMemo, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { CHAINS } from '../lib/chain';

export default function TopUpMenu() {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => [
    { label: 'Monad Testnet', id: 10143 },
    { label: 'Base',          id: 8453 },
    { label: 'Mantle',        id: 5000 },
    { label: 'Linea',         id: 59144 },    
    { label: 'Mitosis',       id: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777) },
    { label: 'Arbitrum',      id: 42161 },
  ], []);

  const current = items.find(i => i.id === chainId);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid #444',
          background: '#111',
        }}
        aria-label="Switch chain"
      >
        {current ? current.label : 'Switch Chain'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 6,
            zIndex: 50,
            background: '#0b0b10',
            border: '1px solid #333',
            borderRadius: 12,
            padding: 10,
            minWidth: 220,
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <ul style={{ display: 'grid', gap: 6 }}>
            {items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => { switchChain({ chainId: c.id }); setOpen(false); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #333',
                    background: chainId === c.id ? '#1f2937' : '#0b0b10',
                  }}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
