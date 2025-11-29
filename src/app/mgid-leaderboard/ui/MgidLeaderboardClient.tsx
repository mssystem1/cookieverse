'use client';

import * as React from 'react';

type Row = {
  username: string;
  embeddedWallet: `0x${string}`;
  totalScore: number;
  totalTransactions: number;
  updatedAt: number;
};

type ApiResponse = Row[] | { rows: Row[] }; // UPDATE: accept both shapes

export default function MgidLeaderboardClient() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // UPDATE: extract parse helper so we can reuse on refresh
  const parseRows = React.useCallback((data: ApiResponse): Row[] => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).rows)) return (data as any).rows as Row[];
    return [];
  }, []);

  const fetchRows = React.useCallback(async () => {
    setError(null);
    const r = await fetch('/api/mgid-leaderboard', {
      cache: 'no-store', // always fresh from Blob-backed API
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as ApiResponse;
    return parseRows(data);
  }, [parseRows]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await fetchRows();
        if (!alive) return;
        setRows(next);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load leaderboard');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchRows]);

  // (Optional) Light auto-refresh every 30s so players see updates without reload
  React.useEffect(() => {
    const id = setInterval(async () => {
      try {
        const next = await fetchRows();
        setRows(next);
      } catch {
        // ignore intermittent errors on background refresh
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchRows]);

  if (loading) return <div style={{ opacity: 0.8, color: '#cbd5e1' }}>Loading leaderboard…</div>;
  if (error) return <div style={{ color: '#cbd5e1' }}>{error}</div>;
  if (!rows.length) {
    return (
      <div style={{ color: '#cbd5e1' }}>
        No entries yet. Register a score to appear here.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          tableLayout: 'fixed',
          color: '#e5e7eb',
          background: '#0f0f12',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #1f1f26',
        }}
      >
        <colgroup>
          <col style={{ width: '18%' }} />
          <col style={{ width: '36%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>

        <thead>
          <tr>
            <Th style={{ textAlign: 'left', paddingLeft: 8, background: '#14141a', borderBottom: '1px solid #1f1f26' }}>
              RANK
            </Th>
            <Th style={{ textAlign: 'left', paddingLeft: 28, background: '#14141a', borderBottom: '1px solid #1f1f26' }}>
              PLAYER
            </Th>
            <Th style={{ textAlign: 'left', paddingLeft: 28, background: '#14141a', borderBottom: '1px solid #1f1f26' }}>
              SMART WALLET
            </Th>
            <Th style={{ textAlign: 'right', paddingRight: 18, background: '#14141a', borderBottom: '1px solid #1f1f26' }}>
              TOTALSCORE
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => {
            const rank = i + 1;
            const key = `${r.embeddedWallet}-${rank}`;
            return (
              <Tr key={key} i={i} active={false}>
                {/* rank with same emojis/styling */}
                <Td style={{ textAlign: 'left', paddingLeft: 12 }}>
                  {rankCell(rank)}
                </Td>

                {/* player name */}
                <Td style={{ textAlign: 'left', paddingLeft: 28 }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 800 }}>{r.username || '—'}</span>
                </Td>

                {/* embedded wallet (short) with explorer link */}
                <Td style={{ textAlign: 'left', paddingLeft: 28 }}>
                  <a
                    href={`https://monadvision.com/address/${r.embeddedWallet}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#cbd5e1', textDecoration: 'none', fontFamily: 'ui-monospace, Menlo, monospace' }}
                  >
                    {short(r.embeddedWallet)}
                  </a>
                </Td>

                {/* totalScore with same pill style/colors as MINTS column */}
                <Td style={{ textAlign: 'right', paddingRight: 18 }}>
                  <span style={pillStyle(rank)}>{r.totalScore}</span>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ==== shared styles cloned from your Leaderboard (rank & pill) ==== */

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: '12px 12px', color: '#e5e7eb', letterSpacing: '0.04em', ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px', borderBottom: '1px solid #16161d', ...style }}>{children}</td>;
}
function Tr({ children, i, active }: { children: React.ReactNode; i: number; active: boolean }) {
  const base: React.CSSProperties = {
    background:
      i < 3 ? 'linear-gradient(90deg, rgba(124,58,237,0.18), rgba(15,15,18,0))'
            : i % 2 ? '#0d0d12' : '#0b0b10',
    transition: 'box-shadow 140ms ease, background 140ms ease',
  };
  const glow: React.CSSProperties = active
    ? { boxShadow: '0 0 0 2px rgba(124,58,237,0.70) inset, 0 0 24px rgba(124,58,237,0.35)',
        background: 'linear-gradient(90deg, rgba(124,58,237,0.28), rgba(15,15,18,0.10))' }
    : {};
  return <tr style={{ ...base, ...glow }}>{children}</tr>;
}

// same emoji scheme
function rankCell(rank: number) {
  if (rank === 1) return '🥇  1';
  if (rank === 2) return '🥈  2';
  if (rank === 3) return '🥉  3';
  return `🟣 ${rank.toString().padStart(2, ' ')}`;
}

// same pill look used for the MINTS column, now for totalScore
function pillStyle(rank: number): React.CSSProperties {
  const palette =
    rank === 1 ? { bg: '#fef3c7', fg: '#92400e', b: '#f59e0b' } :
    rank === 2 ? { bg: '#e5e7eb', fg: '#374151', b: '#9ca3af' } :
    rank === 3 ? { bg: '#f3e8ff', fg: '#6b21a8', b: '#a855f7' } :
                  { bg: '#eff6ff', fg: '#1e3a8a', b: '#60a5fa' };
  return {
    display: 'inline-block',
    minWidth: 56,
    textAlign: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontWeight: 800,
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.b}`,
  };
}

function short(a?: string) {
  if (!a) return '';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
