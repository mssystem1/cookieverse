"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
//import { useSmartAccount } from '../../../app/SmartAccountProvider'; 

import { useChainId } from 'wagmi';

import * as React from 'react';

type Row = {
  rank: number;
  address?: string | string[] | null; // ← allow array
  Xusername?: string;       
  FarcasterUsername: string;       
  mints: number;
  mintedCookies?: number;
  mintedImages?: number;
  TotalMints?: number;
  totalScore?: number;      // ← NEW: MGID total score from BLOB
  localScore?: number;   // SCORE on {localchain}, depends on connected chain
};

type Api = {
  top50: Row[];
  you: Row | null;
  totalMinters: number;
  updatedAt: string;
  stale?: boolean;
  error?: string;
};

type LeaderboardMode = 'default' | 'FarcasterMini' | 'compact';

type LeaderboardClientProps = {
  mode?: LeaderboardMode;
};

  function n(value: unknown): number {
    const x = Number(value);
    return Number.isFinite(x) ? x : 0;
  }

  function pickPositive(...values: unknown[]): number {
    for (const value of values) {
      const x = n(value);
      if (x > 0) return x;
    }
    return 0;
  }

export default function LeaderboardClient({ mode = 'default' }: LeaderboardClientProps) {
  const chainId = useChainId();

  const compact = mode === 'FarcasterMini' || mode === 'compact';
  const { address } = useAccount();
  const [data, setData] = useState<Api | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const dataRef = React.useRef<Api | null>(null);

  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

//  const { saAddress } = useSmartAccount();
  const eoaLower = address?.toLowerCase();
 // const saLower  = saAddress?.toLowerCase();
  const highlights = Array.from(new Set([eoaLower].filter(Boolean) as string[])); // saLower

  function fetchData(fresh = false) {
    const qs = new URLSearchParams();
    const youList = [address].filter(Boolean) as string[]; // , saAddress

    if (youList.length) qs.set("you", youList.join(","));
    if (fresh) qs.set("fresh", "1");
    if (chainId) qs.set("chainId", String(chainId));

    const hasExistingData = !!dataRef.current;

    if (hasExistingData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setRefreshError(null);

    fetch(`/api/leaderboard?${qs.toString()}`, {
      cache: "no-store",
      headers: { "x-chain-id": String(chainId ?? "") },
    })
      .then((r) => r.json())
      .then(async (j) => {
        // collect addresses from top50 (string or first element of array)
        const addrs = Array.isArray(j?.top50)
          ? j.top50
              .map((r: any) => (Array.isArray(r.address) ? r.address[0] : r.address))
              .filter(Boolean)
          : [];

        // fetch BLOB profiles once
        const profiles = await fetchProfilesFor(addrs);

        // enrich rows: attach Xusername / FarcasterUsername if EOAWallet matches address
        if (Array.isArray(j?.top50)) {
          j.top50 = j.top50.map((r: any) => {
            const a = Array.isArray(r.address) ? r.address[0] : r.address;
            const p = a ? profiles.get(String(a).toLowerCase()) : undefined;

            const mitosisId = Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || '0');

            let profileLocalScore = 0;

            if (p) {
              if (chainId === 8453) {
                profileLocalScore = n(p.totalScore_base);
              } else if (chainId === 5000) {
                profileLocalScore = n(p.totalScore_mantle);
              } else if (chainId === 59144) {
                profileLocalScore = n(p.totalScore_linea);
              } else if (mitosisId && chainId === mitosisId) {
                profileLocalScore = n(p.totalScore_mitosis);
              } else {
                profileLocalScore = n(p.totalScore_monad);
              }
            }

            // IMPORTANT:
            // /api/leaderboard returns `mints` for selected chain.
            // mgid profile can exist but contain 0. Do not let that erase API data.
            const localScore = pickPositive(
              profileLocalScore,
              r.localScore,
              r.mints,
            );

            const totalScore = pickPositive(
              p?.totalScore,
              r.totalScore,
              r.TotalMints,
              localScore,
              r.mints,
            );

            return {
              ...r,
              Xusername: p?.usernameX ?? r.Xusername ?? '',
              FarcasterUsername: p?.usernamefarcaster ?? r.FarcasterUsername ?? '',
              totalScore,
              localScore,
            };
          });

          // 🔥 Sort Top-50 by totalScore (desc), fallback to mints if needed
          j.top50.sort((a: any, b: any) => {
            const as = typeof a.totalScore === 'number' ? a.totalScore : 0;
            const bs = typeof b.totalScore === 'number' ? b.totalScore : 0;

            if (bs !== as) return bs - as;

            return (b.mints ?? 0) - (a.mints ?? 0);
          });

          // Recompute rank based on new order
          j.top50 = j.top50.map((r: any, idx: number) => ({
            ...r,
            rank: idx + 1,
          }));
        }

        // also enrich "you" card if present
        if (j?.you) {
          const youAddrs = Array.isArray(j.you.address)
            ? j.you.address
            : [j.you.address];

          const p = youAddrs
            .map((a: any) => (a ? profiles.get(String(a).toLowerCase()) : undefined))
            .find(Boolean);

          if (p) {
            j.you = {
              ...j.you,
              Xusername: p.usernameX ?? j.you.Xusername ?? '',
              FarcasterUsername: p.usernamefarcaster ?? j.you.FarcasterUsername ?? '',
              totalScore: p.totalScore ?? j.you.totalScore ?? 0,
            };
          }
        }

        setData(j);
        dataRef.current = j;
        setRefreshError(null);
      })
      .catch((e: any) => {
        console.error('leaderboard refresh failed', e);

        // Keep previous table visible.
        setRefreshError(e?.message || 'Leaderboard refresh failed.');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  // Fetch on mount and when wallet changes (fresh)
  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]); // saAddress

  // Refetch fresh when window gains focus or tab becomes visible (switching tabs)
  useEffect(() => {
    const onFocus = () => fetchData(true);
    const onVisible = () => { if (!document.hidden) onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId]); // saAddress,

  //const lower = address?.toLowerCase();

  if (loading && !data) {
    return (
      <div style={{ opacity: 0.8, color: '#cbd5e1' }}>
        Loading leaderboard…
      </div>
    );
  }

  if (!data || !Array.isArray(data.top50)) {
    return <div style={{ color: "#cbd5e1" }}>Leaderboard unavailable.</div>;
  }

const inTopForAll = highlights.length
  ? highlights.every((h) => data.top50.some((r) => lowers(r.address).includes(h)))
  : false;
  const showPinned = highlights.length > 0 && !inTopForAll;

  // If API couldn't compute rank (e.g., no mints yet), still show your wallet card
  /*
const youRow: Row | null =
  (data.you as any) ??
  ([address, saAddress].filter(Boolean).length
    ? {
        rank: NaN,
        address: [address, saAddress].filter(Boolean) as string[], // ← array, not "a + b"
        mints: 0,
        mintedCookies: 0,
        mintedImages: 0,
      }
    : null);
*/

// Derive "you" from Top-50 if API omitted it.
// If any of your wallets (EOA/SA) appear in Top-20, show their real rank & totals.
const youRow: Row | null = (data.you as any) ?? (() => {
  const wallets = [address].filter(Boolean) as string[]; // , saAddress
  if (!wallets.length) return null;

  const wanted = wallets.map((w) => w.toLowerCase());
  const hits = data.top50.filter((r) => lowers(r.address).some((a) => wanted.includes(a)));

  if (!hits.length) {
    // nothing on the board yet → keep the “no mints yet” fallback
    return {
      rank: Number.NaN,
      address: wallets, // keep as array
      mints: 0,
      mintedCookies: 0,
      mintedImages: 0,
      TotalMints: 0,
    };
  }

  // aggregate across any hit (EOA and/or SA if both appear)
  const rank = Math.min(...hits.map((r) => r.rank));
  const mints = hits.reduce((acc, r) => acc + (r.mints || 0), 0);
  const mintedCookies = hits.reduce((acc, r) => acc + (r.mintedCookies || 0), 0);
  const mintedImages = hits.reduce((acc, r) => acc + (r.mintedImages || 0), 0);
  const TotalMints = hits.reduce((acc, r) => acc + (r.TotalMints || 0), 0);

  return { rank, address: wallets, mints, mintedCookies, mintedImages, TotalMints };
})();

  return (
    <div>
      {data.stale ? (
        <div style={{ color: "#fbbf24", marginBottom: 8, fontWeight: 700 }}>
          Showing cached leaderboard (rate-limited). Will refresh automatically.
        </div>
      ) : null}

    {refreshing ? (
      <div
        style={{
          color: '#9ca3af',
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Refreshing leaderboard…
      </div>
    ) : null}

    {refreshError && data ? (
      <div
        style={{
          color: '#fbbf24',
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Last refresh failed. Showing previous leaderboard.
      </div>
    ) : null}

      {/*showPinned && youRow ? <PinnedYouRow you={youRow} hasRank={!!data.you} /> : null*/}
      {showPinned && youRow ? <PinnedYouRow you={youRow} hasRank={Number.isFinite(youRow.rank)} /> : null}

      <Table
        rows={data.top50}
        highlight={highlights}
        compact={compact}
        mode={mode}
      />
      <p style={{ marginTop: 12, color: "#9ca3af" }}>
        {Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt))}
        {" • "}
        {data.totalMinters} total unique minters
      </p>
    </div>
  );
}

function PinnedYouRow({ you, hasRank }: { you: Row; hasRank: boolean }) {
  const mints   = you.mints ?? 0;
  const cookies = you.mintedCookies ?? 0;
  const images  = you.mintedImages ?? 0;
  const TotalMints = you.TotalMints ?? 0;
  const hasAnyActivity = mints > 0 || cookies > 0 || images > 0 || TotalMints > 0;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "12px 16px",
        border: "2px solid #7c3aed",
        borderRadius: 12,
        background: "linear-gradient(90deg, rgba(124,58,237,0.25), rgba(124,58,237,0.10))",
        color: "#f5f3ff",
        fontWeight: 800,
      }}
    >
      {hasRank || hasAnyActivity ? (
        <>
          {hasRank ? `Your rank: #${you.rank} • ` : `Your wallet: `}
          {youLabelStr(you.address)} • {mints} mints
          {" • Cookies "}{cookies}
          {" • Images "}{images}
          {/*" • Total Mints accros chains "*/}{/*TotalMints*/}
        </>
      ) : (
        <>
          Your wallet: {youLabelStr(you.address)} • No mints yet
          {" • Cookies 0 • Images 0"}
        </>
      )}
    </div>
  );
}

function Table({
  rows,
  highlight,
  compact = false,
  mode,
}: {
  rows: Row[];
  highlight: string | string[];
  compact?: boolean;
  mode: LeaderboardMode;
}) {
  const hl = Array.isArray(highlight) ? highlight : [highlight];

   const chainId = useChainId();

  // label used in the header: "monad" | "base" | "mantle" | "mitosis"
  const chainLabel = React.useMemo(() => {
    const mitosisId = Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || '0');
    if (chainId === 8453) return 'base';
    if (chainId === 5000) return 'mantle';
    if (chainId === 59144) return 'linea';    
    if (mitosisId && chainId === mitosisId) return 'mitosis';
    return 'monad';
  }, [chainId]);

  // address explorer href for the WALLET link
  const makeExplorerAddressUrl = React.useCallback((addr: string) => {
    const mitosisBase =
      process.env.NEXT_PUBLIC_MITOSIS_EXPLORER?.replace(/\/+$/, '') || '';
    switch (chainLabel) {
      case 'base':
        return `https://basescan.org/address/${addr}`;
      case 'mantle':
        return `https://mantlescan.xyz/address/${addr}`;
      case 'linea':
        return `https://lineascan.build/address/${addr}`;        
      case 'mitosis':
        // allow env override if your explorer differs
        return mitosisBase ? `${mitosisBase}/address/${addr}` : `#`;
      default:
        // monad testnet
        return `https://monadvision.com/address/${addr}`;
    }
  }, [chainLabel]); 

  const usernameHeader =
  mode === 'compact'
    ? 'X USERNAME'
    : mode === 'FarcasterMini'
    ? 'FARCASTER USERNAME'
    : null;

function renderUsernameCell(r: Row, isPlaceholder: boolean) {
  if (isPlaceholder) {
    return <span style={{ color: '#6b7280' }}>—</span>;
  }

  if (mode === 'compact') {
    return r.Xusername && r.Xusername.trim().length > 0 ? (
      <span>@{r.Xusername}</span>
    ) : (
      <span style={{ color: '#6b7280' }}>—</span>
    );
  }

  if (mode === 'FarcasterMini') {
    return r.FarcasterUsername &&
      String(r.FarcasterUsername).trim().length > 0 ? (
      <span>@{r.FarcasterUsername}</span>
    ) : (
      <span style={{ color: '#6b7280' }}>—</span>
    );
  }

  return null;
}

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          tableLayout: "fixed",
          color: "#e5e7eb",
          background: "#0f0f12",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #1f1f26",
          fontSize: compact ? 12 : 14,
        }}
      >
        <colgroup>
          {compact ? (
            <>
              <col style={{ width: "20%" }} />
              <col style={{ width: "40%" }} />
              <col style={{ width: "56%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "26%" }} />              
            </>
          ) : (
            <>
              <col style={{ width: "18%" }} />
              <col style={{ width: "40%" }} />
              <col style={{ width: "56%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "26%" }} />
            </>
          )}
        </colgroup>

        <thead>
          <tr>
            <Th
              compact={compact}
              style={{
                textAlign: 'left',
                paddingLeft: 8,
                background: '#14141a',
                borderBottom: '1px solid #1f1f26',
              }}
            >
              RANK
            </Th>

            {mode === 'default' ? (
              <>
                <Th
                  compact={compact}
                  style={{
                    textAlign: 'left',
                    paddingLeft: 8,
                    background: '#14141a',
                    borderBottom: '1px solid #1f1f26',
                  }}
                >
                  X USERNAME
                </Th>

                <Th
                  compact={compact}
                  style={{
                    textAlign: 'left',
                    paddingLeft: 8,
                    background: '#14141a',
                    borderBottom: '1px solid #1f1f26',
                  }}
                >
                  FARCASTER USERNAME
                </Th>
              </>
            ) : (
              <Th
                compact={compact}
                style={{
                  textAlign: 'left',
                  paddingLeft: 8,
                  background: '#14141a',
                  borderBottom: '1px solid #1f1f26',
                }}
              >
                {usernameHeader}
              </Th>
            )}

            <Th
              compact={compact}
              style={{
                textAlign: 'left',
                paddingLeft: compact ? 16 : 28,
                background: '#14141a',
                borderBottom: '1px solid #1f1f26',
              }}
            >
              WALLET
            </Th>

            <Th
              compact={compact}
              style={{
                textAlign: 'right',
                paddingRight: compact ? 10 : 18,
                background: '#14141a',
                borderBottom: '1px solid #1f1f26',
              }}
            >
              SCORE on {chainLabel}
            </Th>

            <Th
              compact={compact}
              style={{
                textAlign: 'right',
                paddingRight: compact ? 10 : 18,
                background: '#14141a',
                borderBottom: '1px solid #1f1f26',
              }}
            >
              TOTAL SCORE
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => {
            const isPlaceholder = !r.address;
            const rowLowers = lowers(r.address);
            const active = rowLowers.some((a) => hl.includes(a));
            const key = (r.address || "placeholder") + "-" + r.rank;

            return (
              <Tr key={key} i={i} active={active}>
                <Td compact={compact} style={{ textAlign: "left", paddingLeft: compact ? 8 : 12 }}>
                  {rankCell(r.rank)}
                </Td>

            {mode === 'default' ? (
              <>
                {/* X USERNAME */}
                <Td
                  compact={compact}
                  style={{ textAlign: 'left', paddingLeft: compact ? 8 : 12 }}
                >
                  {isPlaceholder ? (
                    <span style={{ color: '#6b7280' }}>—</span>
                  ) : r.Xusername && r.Xusername.trim().length > 0 ? (
                    <span>@{r.Xusername}</span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>—</span>
                  )}
                </Td>

                {/* FARCASTER USERNAME */}
                <Td
                  compact={compact}
                  style={{ textAlign: 'left', paddingLeft: compact ? 8 : 12 }}
                >
                  {isPlaceholder ? (
                    <span style={{ color: '#6b7280' }}>—</span>
                  ) : r.FarcasterUsername &&
                    String(r.FarcasterUsername).trim().length > 0 ? (
                    <span>@{r.FarcasterUsername}</span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>—</span>
                  )}
                </Td>
              </>
            ) : (
              <Td
                compact={compact}
                style={{ textAlign: 'left', paddingLeft: compact ? 8 : 12 }}
              >
                {renderUsernameCell(r, isPlaceholder)}
              </Td>
            )}

              {/* WALLET */}
              <Td compact={compact} style={{ textAlign: "left", paddingLeft: compact ? 16 : 28 }}>
                {isPlaceholder ? (
                  <span style={{ color: "#6b7280" }}>—</span>
                ) : (
                  (() => {
                    const addr = Array.isArray(r.address) ? r.address[0] : r.address;
                    const label = youLabelStr(addr!);

                    // ✅ Clickable ONLY for connected (active/highlighted) wallet row
                    if (!active) {
                      return <span style={{ color: "#cbd5e1" }}>{label}</span>;
                    }

                    const href = makeExplorerAddressUrl(String(addr));
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#ffffff",          // make connected wallet stand out
                          fontWeight: 800,           // highlight connected wallet text
                          textDecoration: "none",
                          transition: "color .15s ease, text-decoration .15s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none";
                        }}
                        title={`Open connected wallet in ${chainLabel} explorer`}
                      >
                        {label}
                      </a>
                    );
                  })()
                )}
              </Td>

                <Td compact={compact} style={{ textAlign: "right", paddingRight: compact ? 10 : 18 }}>
                  {isPlaceholder ? <span style={{ color: "#6b7280" }}>—</span> : <span style={pillStyle(r.rank)}>{/*r.mints*/}{pickPositive(r.localScore)}</span>}
                </Td>

                <Td compact={compact} style={{ textAlign: "right", paddingRight: compact ? 10 : 18 }}>
                  {isPlaceholder ? <span style={{ color: "#6b7280" }}>—</span> : <span style={pillStyle(r.rank)}>{/*r.TotalMints*/}{pickPositive(r.totalScore)}</span>}
                </Td>

                {/*showExtras &&*/} 
                {/*showExtras && (
                  <Td compact={compact} style={{ textAlign: "right", paddingRight: compact ? 12 : 25 }}>
                    {isPlaceholder ? <span style={{ color: "#6b7280" }}>—</span> : <span style={pillStyle(r.rank)}>{r.mintedCookies ?? 0}</span>}
                  </Td>
                )*/}
                {/*showExtras &&*/} 
                {/*showExtras && (
                  <Td compact={compact} style={{ textAlign: "right", paddingRight: compact ? 14 : 30 }}>
                    {isPlaceholder ? <span style={{ color: "#6b7280" }}>—</span> : <span style={pillStyle(r.rank)}>{r.mintedImages ?? 0}</span>}
                  </Td>
                )*/}
              </Tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  compact = false,
  style,
}: {
  children: React.ReactNode;
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: compact ? "8px 8px" : "12px 12px",
        color: "#e5e7eb",
        letterSpacing: "0.04em",
        fontSize: compact ? 12 : 13,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  compact = false,
  style,
}: {
  children: React.ReactNode;
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: compact ? "8px" : "12px",
        borderBottom: "1px solid #16161d",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function Tr({ children, i, active }: { children: React.ReactNode; i: number; active: boolean }) {
  const base: React.CSSProperties = {
    background: i < 3 ? "linear-gradient(90deg, rgba(124,58,237,0.18), rgba(15,15,18,0))" : i % 2 ? "#0d0d12" : "#0b0b10",
    transition: "box-shadow 140ms ease, background 140ms ease",
  };
  const glow: React.CSSProperties = active
    ? { boxShadow: "0 0 0 2px rgba(124,58,237,0.70) inset, 0 0 24px rgba(124,58,237,0.35)", background: "linear-gradient(90deg, rgba(124,58,237,0.28), rgba(15,15,18,0.10))" }
    : {};
  return <tr style={{ ...base, ...glow }}>{children}</tr>;
}

function rankCell(rank: number) {
  if (rank === 1) return "🥇  1";
  if (rank === 2) return "🥈  2";
  if (rank === 3) return "🥉  3";
  return `🟣 ${rank.toString().padStart(2, " ")}`;
}

function short(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function youLabelStr(a?: string | string[] | null) {
  if (!a) return "";
  const parts = Array.isArray(a) ? a : String(a).split(" + ").map(s => s.trim()).filter(Boolean);
  return parts.map((s) => short(s)).join(" + ");
}

function pillStyle(rank: number): React.CSSProperties {
  const palette =
    rank === 1 ? { bg: "#fef3c7", fg: "#92400e", b: "#f59e0b" } :
    rank === 2 ? { bg: "#e5e7eb", fg: "#374151", b: "#9ca3af" } :
    rank === 3 ? { bg: "#f3e8ff", fg: "#6b21a8", b: "#a855f7" } :
                  { bg: "#eff6ff", fg: "#1e3a8a", b: "#60a5fa" };
  return {
    display: "inline-block",
    minWidth: 36, //
    textAlign: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 800,
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.b}`,
  };
}

// put these near your other helpers (e.g., below `short` / above `youLabelStr`)
type AddrInput = string | string[] | null | undefined;

function toArray(v: AddrInput): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}
function lowers(v: AddrInput): string[] {
  return toArray(v).map((s) => s.toLowerCase());
}

type ProfileMeta = {
  usernameX?: string;
  usernamefarcaster?: string;
  totalScore?: number;
  totalScore_monad?: number;
  totalScore_base?: number;
  totalScore_mantle?: number;
  totalScore_linea?: number;
  totalScore_mitosis?: number;
};

async function fetchProfilesFor(addresses: string[]) {
  const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean)));
  if (!uniq.length) return new Map<string, ProfileMeta>();

  // ⬇️ CHANGE THIS
  const res = await fetch('/api/mgid-downsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ op: 'readMany', addresses: uniq }),
  });

  if (!res.ok) return new Map();

  const j = await res.json().catch(() => null);
  const out = new Map<string, ProfileMeta>();

  const rows = Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];
  for (const r of rows) {
    const w = (r?.EOAWallet || '').toLowerCase();
    if (!w) continue;
    out.set(w, {
      usernameX: r?.usernameX ?? r?.username ?? '',
      usernamefarcaster: r?.usernamefarcaster ?? '',
      totalScore: Number(r?.totalScore ?? 0),
      totalScore_monad: Number(r?.totalScore_monad ?? 0),
      totalScore_base: Number(r?.totalScore_base ?? 0),
      totalScore_mantle: Number(r?.totalScore_mantle ?? 0),
      totalScore_linea: Number(r?.totalScore_linea ?? 0),
      totalScore_mitosis: Number(r?.totalScore_mitosis ?? 0),
    });
  }
  return out;
}
