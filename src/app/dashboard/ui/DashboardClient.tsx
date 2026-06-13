"use client";

import * as React from "react";
import { useAccount } from "wagmi";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ChainKey = "monad" | "base" | "mantle" | "linea" | "mitosis" | "og" | "xlayer";

type HoldingsResponse = {
  ok: boolean;
  chain: ChainKey;
  tokenIds: number[];
  imageIds: number[];
};

type MgidRowClient = {
  EOAWallet?: string;

  usernameX?: string;
  usernamefarcaster?: string;

  totalScore?: number;
  totalScore_monad?: number;
  totalScore_base?: number;
  totalScore_mantle?: number;
  totalScore_linea?: number;
  totalScore_mitosis?: number;

  totalScore_0g?: number;
  totalTransactions_0g?: number;
  totalImages_0g?: number;

  totalScore_xlayer?: number;
  totalTransactions_xlayer?: number;
  totalImages_xlayer?: number;  

  totalX402_base?: number;
  totalX402_mantle?: number;
  totalX402_xlayer?: number;

  totalX402Score_base?: number;
  totalX402Score_mantle?: number;
  totalX402Score_xlayer?: number;

  totalX402?: number;
  totalX402Score?: number;

  totalBridges_monad?: number;
  totalBridges_base?: number;
  totalBridges_mantle?: number;
  totalBridges_linea?: number;
  totalBridges_mitosis?: number;
  totalBridges_0g?: number;
  totalBridges_xlayer?: number;  

  // quests
  dailyKey?: string;
  dailyBaselineCookies?: number;
  dailyBaselineBridges?: number;
  dailyBaselineX402?: number;
  dailyMintDone?: boolean;
  dailyBridgeDone?: boolean;
  dailyX402Done?: boolean;

  weeklyKey?: string;
  weeklyBaselineCookies?: number;
  weeklyBaselineBridges?: number;
  weeklyBaselineX402?: number;
  weeklyMintDone?: boolean;
  weeklyBridgeDone?: boolean;
  weeklyX402Done?: boolean;
};

type ChainStats = {
  key: ChainKey;
  label: string;
  accent: string;
  cookies: number;
  images: number;
  bridges: number;
  bridgeSupported: boolean;
  x402: number;
  x402Supported: boolean;
  score: number;
};

type TasksDerived = {
  todayKey: string;
  weekKey: string;
  dailyMintDone: boolean;
  dailyBridgeDone: boolean;
  weeklyMintDone: boolean;
  weeklyBridgeDone: boolean;
  dailyX402Done: boolean;
  weeklyX402Done: boolean;
  dailyMintProgress: number;
  dailyBridgeProgress: number;
  dailyX402Progress: number;
  weeklyMintProgress: number;
  weeklyBridgeProgress: number;
  weeklyX402Progress: number;
};

const CHAINS_META: { key: ChainKey; label: string; accent: string }[] = [
  { key: "monad", label: "Monad", accent: "#22c55e" },
  { key: "base", label: "Base", accent: "#60a5fa" },
  { key: "mantle", label: "Mantle", accent: "#facc15" },
  { key: "linea", label: "Linea", accent: "#38bdf8" },
  { key: "mitosis", label: "Mitosis", accent: "#a855f7" },
  { key: "og", label: "0G", accent: "#c084fc" },
  { key: "xlayer", label: "X Layer", accent: "#262525" },  
];

const CHAIN_IDS: Record<ChainKey, number> = {
  monad: 143,
  base: 8453,
  mantle: 5000,
  linea: 59144,
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
  og: 16661,
  xlayer: 196,  
};

const BRIDGE_ENABLED_CHAINS = new Set<ChainKey>(["base", "mantle", "linea", "monad", "xlayer"]);
const X402_ENABLED_CHAINS = new Set<ChainKey>(["base", "mantle", "xlayer"]);

function isBridgeSupported(key: ChainKey): boolean {
  return BRIDGE_ENABLED_CHAINS.has(key);
}

function isX402Supported(key: ChainKey): boolean {
  return X402_ENABLED_CHAINS.has(key);
}

function getX402ScoreForChain(mgid: MgidRowClient | null, key: ChainKey): number {
  if (!mgid || !isX402Supported(key)) return 0;
  if (key === "base") return Number(mgid.totalX402Score_base ?? mgid.totalX402_base ?? 0);
  if (key === "mantle") return Number(mgid.totalX402Score_mantle ?? mgid.totalX402_mantle ?? 0);
  if (key === "xlayer") return Number(mgid.totalX402Score_xlayer ?? mgid.totalX402_xlayer ?? 0);
  return 0;
}

function getBridgeCountForChain(
  mgid: MgidRowClient | null,
  key: ChainKey
): number {
  if (!mgid || !isBridgeSupported(key)) return 0;

  if (key === "base") return Number(mgid.totalBridges_base ?? 0);
  if (key === "mantle") return Number(mgid.totalBridges_mantle ?? 0);
  if (key === "linea") return Number(mgid.totalBridges_linea ?? 0);
  if (key === "xlayer") return Number(mgid.totalBridges_xlayer ?? 0);  
  if (key === "monad") return Number(mgid.totalBridges_monad ?? 0);    

  return 0;
}

// same helpers as in mgid-upsert
function getUtcDayKey(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getUtcIsoWeekKey(now: Date): string {
  const tmp = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  const y = tmp.getUTCFullYear();
  return `${y}-W${String(weekNo).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const { address, isConnected } = useAccount();

  const [mgid, setMgid] = React.useState<MgidRowClient | null>(null);
  const [holdings, setHoldings] = React.useState<
    Partial<Record<ChainKey, HoldingsResponse>>
  >({});
  const [chainsStats, setChainsStats] = React.useState<ChainStats[]>([]);
  const [totalCookies, setTotalCookies] = React.useState(0);
  const [totalBridges, setTotalBridges] = React.useState(0);
  const [totalX402, setTotalX402] = React.useState(0);
  const [totalScore, setTotalScore] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // periodic mgid-upsert every 60s (like bridge page, simpler headers)
  React.useEffect(() => {
    if (!address) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fetch("/api/mgid-upsert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address }),
        });
      } catch (e) {
        console.error("periodic mgid-upsert (dashboard) failed", e);
      }
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  React.useEffect(() => {
    if (!isConnected || !address) {
      setMgid(null);
      setHoldings({});
      setChainsStats([]);
      setTotalCookies(0);
      setTotalBridges(0);
      setTotalX402(0);
      setTotalScore(0);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      const addr = address.toLowerCase();

      try {
        // 1) MGID from Blob via mgid-downsert (same pattern as LeaderboardClient)
        const mgidRes = await fetch("/api/mgid-downsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ op: "readMany", addresses: [addr] }),
        });

        let mgidRow: MgidRowClient | null = null;
        if (mgidRes.ok) {
          const j = await mgidRes.json().catch(() => null);
          const rows = Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];
          mgidRow = rows[0] || null;
        }

        if (!cancelled) setMgid(mgidRow);

        // 2) Holdings per chain (cookies + images)
        const holdingsMap: Partial<Record<ChainKey, HoldingsResponse>> = {};

        await Promise.all(
          CHAINS_META.map(async ({ key }) => {
            try {
              const chainId = CHAIN_IDS[key];
              const res = await fetch(`/api/holdings?address=${addr}`, {
                cache: "no-store",
                headers: { "x-chain-id": String(chainId) },
              });
              if (!res.ok) return;
              const j = (await res.json()) as HoldingsResponse;
              holdingsMap[key] = j;
            } catch {
              // ignore chain failure
            }
          })
        );

        if (!cancelled) setHoldings(holdingsMap);

        if (!cancelled) {
          const stats = computeChainStats(mgidRow, holdingsMap);
          setChainsStats(stats);

          const cookiesSum = stats.reduce((acc, s) => acc + s.cookies, 0);
          // Only Base, Mantle and Linea bridges are active in the dashboard.
          // Monad, Mitosis and 0G bridge counts are intentionally excluded.
          const bridgesSum = stats.reduce(
            (acc, s) => acc + (s.bridgeSupported ? s.bridges : 0),
            0
          );

          // Use the visible per-chain score total so disabled bridge routes cannot
          // keep inflating the dashboard through old stored totals.
          const scoreTotal = stats.reduce((acc, s) => acc + s.score, 0);
          const x402Total = stats.reduce(
            (acc, s) => acc + (s.x402Supported ? s.x402 : 0),
            0
          );

          setTotalCookies(cookiesSum);
          setTotalBridges(bridgesSum);
          setTotalX402(x402Total);
          setTotalScore(scoreTotal);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();

    // 🔁 refresh every 60s so weekly/daily completions update without full reload
    const id = window.setInterval(() => {
      fetchAll();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, isConnected]);

  if (!isConnected || !address) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 18,
          background:
            "radial-gradient(circle at top, rgba(31,41,55,0.9), #020617 60%)",
          border: "1px solid #1f2937",
          color: "#9ca3af",
        }}
      >
        Connect your wallet to enter the Cookieverse Dashboard 🍪✨
      </div>
    );
  }

  const tasks = deriveTasksFromMgid(mgid, totalCookies, totalBridges, totalX402);
  const chainsEngaged = chainsStats.filter(
    (s) => s.cookies > 0 || s.images > 0 || (s.bridgeSupported && s.bridges > 0)
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SummaryCard
        address={address}
        totalCookies={totalCookies}
        totalBridges={totalBridges}
        totalX402={totalX402}
        totalScore={totalScore}
        mgid={mgid}
      />

      <ChainGrid chains={chainsStats} loading={loading} error={error} />

      <TasksSection
        tasks={tasks}
        totalCookies={totalCookies}
        totalBridges={totalBridges}
        totalX402={totalX402}
        chainsEngaged={chainsEngaged}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function computeChainStats(
  mgid: MgidRowClient | null,
  holdings: Partial<Record<ChainKey, HoldingsResponse>>
): ChainStats[] {
  return CHAINS_META.map(({ key, label, accent }) => {
    const h = holdings[key];

    const cookies = Number(h?.tokenIds?.length ?? 0);
    const images = Number(h?.imageIds?.length ?? 0);

    const bridgeSupported = isBridgeSupported(key);
    const bridges = getBridgeCountForChain(mgid, key);
    const x402Supported = isX402Supported(key);
    const x402 = getX402ScoreForChain(mgid, key);

    let storedScore = 0;
    if (mgid) {
      if (key === "monad") storedScore = Number(mgid.totalScore_monad ?? 0);
      if (key === "base") storedScore = Number(mgid.totalScore_base ?? 0);
      if (key === "mantle") storedScore = Number(mgid.totalScore_mantle ?? 0);
      if (key === "linea") storedScore = Number(mgid.totalScore_linea ?? 0);
      if (key === "mitosis") storedScore = Number(mgid.totalScore_mitosis ?? 0);
      if (key === "og") storedScore = Number(mgid.totalScore_0g ?? 0);
      if (key === "xlayer") storedScore = Number(mgid.totalScore_xlayer ?? 0);      
    }

    /**
     * Score logic:
     * - Cookies and images count on every chain.
     * - Bridge points count only on Base, Mantle and Linea.
     * - Monad, Mitosis and 0G bridges are intentionally excluded.
     */
    const liveScore =
      cookies +
      images +
      (bridgeSupported ? bridges : 0) +
      (x402Supported ? x402 : 0);
    const score = bridgeSupported ? Math.max(storedScore, liveScore) : liveScore;

    return {
      key,
      label,
      accent,
      cookies,
      images,
      bridges,
      bridgeSupported,
      x402,
      x402Supported,
      score,
    };
  });
}

function deriveTasksFromMgid(
  mgid: MgidRowClient | null,
  totalCookiesCurrent: number,
  totalBridgesCurrent: number,
  totalX402Current: number
): TasksDerived {
  const now = new Date();
  const todayKey = getUtcDayKey(now);
  const weekKey = getUtcIsoWeekKey(now);

  const dailyActive = mgid?.dailyKey === todayKey;
  const weeklyActive = mgid?.weeklyKey === weekKey;

  const dailyBaselineCookies =
    dailyActive && typeof mgid?.dailyBaselineCookies === "number"
      ? mgid!.dailyBaselineCookies!
      : totalCookiesCurrent;
  const dailyBaselineBridges =
    dailyActive && typeof mgid?.dailyBaselineBridges === "number"
      ? mgid!.dailyBaselineBridges!
      : totalBridgesCurrent;
  const dailyBaselineX402 =
    dailyActive && typeof mgid?.dailyBaselineX402 === "number"
      ? mgid!.dailyBaselineX402!
      : totalX402Current;

  const weeklyBaselineCookies =
    weeklyActive && typeof mgid?.weeklyBaselineCookies === "number"
      ? mgid!.weeklyBaselineCookies!
      : totalCookiesCurrent;
  const weeklyBaselineBridges =
    weeklyActive && typeof mgid?.weeklyBaselineBridges === "number"
      ? mgid!.weeklyBaselineBridges!
      : totalBridgesCurrent;
  const weeklyBaselineX402 =
    weeklyActive && typeof mgid?.weeklyBaselineX402 === "number"
      ? mgid!.weeklyBaselineX402!
      : totalX402Current;

  const dailyMintProgress = Math.max(
    0,
    totalCookiesCurrent - dailyBaselineCookies
  );
  const dailyBridgeProgress = Math.max(
    0,
    totalBridgesCurrent - dailyBaselineBridges
  );
  const dailyX402Progress = Math.max(
    0,
    totalX402Current - dailyBaselineX402
  );
  const weeklyMintProgress = Math.max(
    0,
    totalCookiesCurrent - weeklyBaselineCookies
  );
  const weeklyBridgeProgress = Math.max(
    0,
    totalBridgesCurrent - weeklyBaselineBridges
  );
  const weeklyX402Progress = Math.max(
    0,
    totalX402Current - weeklyBaselineX402
  );

  return {
    todayKey,
    weekKey,
    dailyMintDone: dailyActive ? Boolean(mgid?.dailyMintDone) : false,
    dailyBridgeDone: dailyActive ? Boolean(mgid?.dailyBridgeDone) : false,
    dailyX402Done: dailyActive ? Boolean(mgid?.dailyX402Done) : false,
    weeklyMintDone: weeklyActive ? Boolean(mgid?.weeklyMintDone) : false,
    weeklyBridgeDone: weeklyActive ? Boolean(mgid?.weeklyBridgeDone) : false,
    weeklyX402Done: weeklyActive ? Boolean(mgid?.weeklyX402Done) : false,
    dailyMintProgress,
    dailyBridgeProgress,
    dailyX402Progress,
    weeklyMintProgress,
    weeklyBridgeProgress,
    weeklyX402Progress,
  };
}

// ─────────────────────────────────────────────────────────────
// UI pieces
// ─────────────────────────────────────────────────────────────

function SummaryCard(props: {
  address: string;
  totalCookies: number;
  totalBridges: number;
  totalX402: number;
  totalScore: number;
  mgid: MgidRowClient | null;
}) {
  const { address, totalCookies, totalBridges, totalX402, totalScore, mgid } = props;

  const rankLabel = getRankLabel(totalScore);
  const rankColors = getRankColors(totalScore);
  const username =
    mgid?.usernameX ||
    mgid?.usernamefarcaster ||
    short(address);

  return (
    <div
      style={{
        borderRadius: 24,
        padding: 22,
        background:
          "radial-gradient(circle at top, #111827, #020617 65%)",
        border: "1px solid rgba(148,163,184,0.4)",
        display: "grid",
        gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)",
        gap: 18,
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
            marginBottom: 4,
          }}
        >
          Welcome to your multi-chain realm,
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: "#e5e7eb",
            marginBottom: 12,
          }}
        >
          {username}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <Pill label="TOTAL SCORE" value={totalScore.toString()} />
          <Pill label="COOKIES" value={totalCookies.toString()} />
          <Pill label="BRIDGES" value={totalBridges.toString()} />
          <Pill label="X402" value={totalX402.toString()} />
        </div>

        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          Wallet:{" "}
          <span style={{ color: "#e5e7eb" }}>{short(address)}</span>
        </div>
      </div>

      <div
        className="dashboard-rank-zone"
        style={{
          justifySelf: "flex-end",
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
        }}
      >
        {/* Rank pill */}
        <div
          className="dashboard-rank-pill"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            background: rankColors.bg,
            border: `1px solid ${rankColors.border}`,
            boxShadow: rankColors.glow,
          }}
        >
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              color: "#0f172a",
              opacity: 0.85,
            }}
          >
            Rank
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0b1120",
            }}
          >
            {rankLabel}
          </span>
        </div>

        {/* Level circle */}
        <div
          className="dashboard-level-ring"
          style={{
            width: 72,
            height: 72,
            borderRadius: "999px",
            background:
              "conic-gradient(from 220deg,#7c3aed,#22c55e,#38bdf8,#a855f7,#7c3aed)",
            padding: 2,
            boxShadow: "0 0 40px rgba(129,140,248,0.55)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "inherit",
              background: "#020617",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#e5e7eb",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.7 }}>Level</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {Math.max(1, getRankTier(totalScore))}
            </div>
          </div>
        </div>

        <div
          className="dashboard-tier-caption"
          style={{
            fontSize: 11,
            color: "#a5b4fc",
          }}
        >
          Tier level · higher = rarer cookie
        </div>
      </div>
    </div>
  );
}

function ChainGrid(props: {
  chains: ChainStats[];
  loading: boolean;
  error: string | null;
}) {
  const { chains, loading, error } = props;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: 14,
      }}
    >
      {chains.map((c) => (
        <div
          key={c.key}
          style={{
            borderRadius: 18,
            padding: 14,
            background:
              "radial-gradient(circle at top, rgba(15,23,42,0.96), #020617)",
            border: "1px solid #111827",
            boxShadow: "0 12px 40px rgba(15,23,42,0.85)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#e5e7eb",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>{c.label}</span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 999,
                border: `1px solid ${c.accent}`,
                color: c.accent,
                background: "rgba(15,23,42,0.9)",
              }}
            >
              Score {c.score}
            </span>
          </div>

          {(() => {
            const showBridges =
              c.key === "base" || c.key === "mantle" || c.key === "linea" || c.key === "xlayer" || c.key === "monad";
            const showX402 = c.x402Supported;
            const statColumns = showBridges && showX402
              ? "repeat(4,1fr)"
              : showBridges || showX402
                ? "repeat(3,1fr)"
                : "repeat(2,1fr)";

            return (
              <>
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginBottom: 10,
                  }}
                >
                  {c.cookies > 0 || c.images > 0 || (showBridges && c.bridges > 0) || (showX402 && c.x402 > 0)
                    ? "You’ve unlocked this chain. Keep farming!"
                    : showBridges
                      ? "No cookies here yet. Mint or bridge to awaken it ⚡️"
                      : "No cookies here yet. Mint to awaken it ⚡️"}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: statColumns,
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <StatMini label="Cookies" value={c.cookies} />
                  {showBridges && <StatMini label="Bridges" value={c.bridges} />}
                  {showX402 && <StatMini label="x402" value={c.x402} />}
                  <StatMini label="Images" value={c.images} />
                </div>
              </>
            );
          })()}

          <div style={{ marginTop: 10 }}>
            <ProgressBar
              value={Math.min(c.score, 100)}
              accent={c.accent}
            />
          </div>
        </div>
      ))}

      {loading && (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          Loading on-chain activity…
        </div>
      )}

      {error && (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: 13,
            color: "#f97373",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function TasksSection(props: {
  tasks: TasksDerived;
  totalCookies: number;
  totalBridges: number;
  totalX402: number;
  chainsEngaged: number;
}) {
  const { tasks, totalCookies, totalBridges, totalX402, chainsEngaged } = props;

  const dailyTasks = [
    {
      key: "dailyMint" as const,
      title: "Daily Mint",
      desc: "Mint at least 2 COOKIEs on any chain.",
      done: tasks.dailyMintDone,
      progress: Math.min(tasks.dailyMintProgress, 2),
      target: 2,
    },
    {
      key: "dailyBridge" as const,
      title: "Daily Bridge",
      desc: "Bridge 2 COOKIEs on Base, Mantle, Linea, Monad or X Layer.",
      done: tasks.dailyBridgeDone,
      progress: Math.min(tasks.dailyBridgeProgress, 2),
      target: 2,
    },
    {
      key: "dailyX402" as const,
      title: "Daily x402",
      desc: "Use x402 once on Base, Mantle or X Layer.",
      done: tasks.dailyX402Done,
      progress: Math.min(tasks.dailyX402Progress, 1),
      target: 1,
    },
  ];

  const weeklyTasks = [
    {
      key: "weeklyMint" as const,
      title: "Weekly Mint",
      desc: "Mint 8+ COOKIEs this week.",
      done: tasks.weeklyMintDone,
      progress: Math.min(tasks.weeklyMintProgress, 8),
      target: 8,
    },
    {
      key: "weeklyBridge" as const,
      title: "Weekly Bridge",
      desc: "Bridge 8+ COOKIEs this week on Base, Mantle, Linea, Monad or X Layer.",
      done: tasks.weeklyBridgeDone,
      progress: Math.min(tasks.weeklyBridgeProgress, 8),
      target: 8,
    },
    {
      key: "weeklyX402" as const,
      title: "Weekly x402",
      desc: "Use x402 5 times this week on Base, Mantle or X Layer.",
      done: tasks.weeklyX402Done,
      progress: Math.min(tasks.weeklyX402Progress, 5),
      target: 5,
    },
  ];

 return (
  <div style={{ display: "grid", gap: 14 }}>
    {/* Daily card */}
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        background:
          "radial-gradient(circle at top left, rgba(55,65,81,0.6), #020617 70%)",
        border: "1px solid #1f2937",
      }}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#e5e7eb",
              letterSpacing: "-0.02em",
            }}
          >
            Daily Quests
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            Today (UTC): {tasks.todayKey}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right" }}>
          Chains touched:{" "}
          <span style={{ color: "#e5e7eb" }}>{chainsEngaged}</span> · Cookies:{" "}
          <span style={{ color: "#e5e7eb" }}>{totalCookies}</span> · Bridges:{" "}
          <span style={{ color: "#e5e7eb" }}>{totalBridges}</span> В· x402:{" "}
          <span style={{ color: "#e5e7eb" }}>{totalX402}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 10,
        }}
      >
        {dailyTasks.map((t) => (
          <QuestCard key={t.key} task={t} />
        ))}
      </div>
    </div>

    {/* Weekly card */}
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        background:
          "radial-gradient(circle at top right, rgba(30,64,175,0.6), #020617 70%)",
        border: "1px solid #1f2937",
      }}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#e5e7eb",
              letterSpacing: "-0.02em",
            }}
          >
            Weekly Quests
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            Week (UTC): {tasks.weekKey}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right" }}>
          Progress resets each Monday (UTC)
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 10,
        }}
      >
        {weeklyTasks.map((t) => (
          <QuestCard key={t.key} task={t} weekly />
        ))}
      </div>
    </div>
  </div>
);
}

function QuestCard(props: {
  task: {
    title: string;
    desc: string;
    done: boolean;
    progress: number;
    target: number;
  };
  weekly?: boolean;
}) {
  const { task, weekly } = props;
  const pct =
    task.target > 0 ? Math.min(100, (task.progress / task.target) * 100) : 0;

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 10,
        background: "rgba(15,23,42,0.94)",
        border: task.done
          ? "1px solid rgba(34,197,94,0.8)"
          : "1px solid #111827",
        boxShadow: task.done
          ? "0 0 18px rgba(34,197,94,0.6)"
          : "0 0 0 rgba(0,0,0,0)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "999px",
            border: "1px solid #64748b",
            background: task.done ? "#22c55e" : "transparent",
          }}
        />
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e5e7eb",
          }}
        >
          {task.title} {weekly ? "🗓" : "☀️"}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 6,
        }}
      >
        {task.desc}
      </div>
      <div
        style={{
          fontSize: 11,
          color: task.done ? "#22c55e" : "#a855f7",
          marginBottom: 4,
        }}
      >
        {task.done
          ? "Completed"
          : `${task.progress}/${task.target} progress`}
      </div>
      <ProgressBar
        value={pct}
        accent={task.done ? "#22c55e" : "#a855f7"}
      />
    </div>
  );
}

function Pill(props: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.5)",
        background: "rgba(15,23,42,0.96)",
        minWidth: 90,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#9ca3af",
        }}
      >
        {props.label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#e5e7eb",
        }}
      >
        {props.value}
      </span>
    </div>
  );
}

function StatMini(props: { label: string; value: number | string }) {
  return (
    <div
      style={{
        padding: 6,
        borderRadius: 10,
        background: "#020617",
        border: "1px solid #111827",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          marginBottom: 2,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#e5e7eb",
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

function ProgressBar(props: { value: number; accent: string }) {
  const v = Math.max(0, Math.min(100, props.value));
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: "#020617",
        border: "1px solid #0f172a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${v}%`,
          borderRadius: 999,
          background: `linear-gradient(90deg,${props.accent},#7c3aed)`,
          transition: "width 0.25s ease-out",
        }}
      />
    </div>
  );
}

function getRankLabel(totalScore: number): string {
  if (totalScore >= 600) return "Emerald Cookie";
  if (totalScore >= 260) return "Diamond Cookie";
  if (totalScore >= 120) return "Gold Cookie";
  if (totalScore >= 60) return "Silver Cookie";
  if (totalScore >= 10) return "Bronze Cookie";
  return "Cookie";
}

function getRankTier(totalScore: number): number {
  if (totalScore >= 600) return 5;
  if (totalScore >= 260) return 4;
  if (totalScore >= 120) return 3;
  if (totalScore >= 60) return 2;
  if (totalScore >= 10) return 1;
  return 0;
}

function getRankColors(totalScore: number): { bg: string; border: string; glow: string } {
  // Emerald Cookie
  if (totalScore >= 600) {
    return {
      bg: "linear-gradient(90deg,#22c55e,#16a34a)",
      border: "#22c55e",
      glow: "0 0 18px rgba(34,197,94,0.7)",
    };
  }
  // Diamond Cookie
  if (totalScore >= 260) {
    return {
      bg: "linear-gradient(90deg,#38bdf8,#a855f7)",
      border: "#38bdf8",
      glow: "0 0 18px rgba(56,189,248,0.7)",
    };
  }
  // Gold Cookie
  if (totalScore >= 120) {
    return {
      bg: "linear-gradient(90deg,#facc15,#f97316)",
      border: "#facc15",
      glow: "0 0 18px rgba(250,204,21,0.75)",
    };
  }
  // Silver Cookie
  if (totalScore >= 60) {
    return {
      bg: "linear-gradient(90deg,#e5e7eb,#9ca3af)",
      border: "#e5e7eb",
      glow: "0 0 18px rgba(148,163,184,0.7)",
    };
  }
  // Bronze Cookie
  if (totalScore >= 10) {
    return {
      bg: "linear-gradient(90deg,#b45309,#92400e)",
      border: "#b45309",
      glow: "0 0 18px rgba(180,83,9,0.7)",
    };
  }
  // base Cookie
  return {
    bg: "linear-gradient(90deg,#64748b,#475569)",
    border: "#64748b",
    glow: "0 0 18px rgba(100,116,139,0.6)",
  };
}

function short(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
