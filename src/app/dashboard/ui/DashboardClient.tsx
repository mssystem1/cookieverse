"use client";

import * as React from "react";
import { useAccount } from "wagmi";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ChainKey = "monad" | "base" | "mantle" | "linea" | "mitosis";

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

  totalBridges_monad?: number;
  totalBridges_base?: number;
  totalBridges_mantle?: number;
  totalBridges_linea?: number;
  totalBridges_mitosis?: number;

  // quests
  dailyKey?: string;
  dailyBaselineCookies?: number;
  dailyBaselineBridges?: number;
  dailyMintDone?: boolean;
  dailyBridgeDone?: boolean;

  weeklyKey?: string;
  weeklyBaselineCookies?: number;
  weeklyBaselineBridges?: number;
  weeklyMintDone?: boolean;
  weeklyBridgeDone?: boolean;
};

type ChainStats = {
  key: ChainKey;
  label: string;
  accent: string;
  cookies: number;
  images: number;
  bridges: number;
  score: number;
};

type TasksDerived = {
  todayKey: string;
  weekKey: string;
  dailyMintDone: boolean;
  dailyBridgeDone: boolean;
  weeklyMintDone: boolean;
  weeklyBridgeDone: boolean;
  dailyMintProgress: number;
  dailyBridgeProgress: number;
  weeklyMintProgress: number;
  weeklyBridgeProgress: number;
};

const CHAINS_META: { key: ChainKey; label: string; accent: string }[] = [
  { key: "monad", label: "Monad", accent: "#22c55e" },
  { key: "base", label: "Base", accent: "#60a5fa" },
  { key: "mantle", label: "Mantle", accent: "#facc15" },
  { key: "linea", label: "Linea", accent: "#38bdf8" },
  { key: "mitosis", label: "Mitosis", accent: "#a855f7" },
];

const CHAIN_IDS: Record<ChainKey, number> = {
  monad: 143,
  base: 8453,
  mantle: 5000,
  linea: 59144,
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
};

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
          const bridgesSum =
            (mgidRow?.totalBridges_monad ?? 0) +
            (mgidRow?.totalBridges_base ?? 0) +
            (mgidRow?.totalBridges_mantle ?? 0) +
            (mgidRow?.totalBridges_linea ?? 0) +
            (mgidRow?.totalBridges_mitosis ?? 0);

          const scoreTotal =
            mgidRow?.totalScore ??
            stats.reduce((acc, s) => acc + s.score, 0);

          setTotalCookies(cookiesSum);
          setTotalBridges(bridgesSum);
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

  const tasks = deriveTasksFromMgid(mgid, totalCookies, totalBridges);
  const chainsEngaged = chainsStats.filter(
    (s) => s.cookies > 0 || s.bridges > 0
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SummaryCard
        address={address}
        totalCookies={totalCookies}
        totalBridges={totalBridges}
        totalScore={totalScore}
        mgid={mgid}
      />

      <ChainGrid chains={chainsStats} loading={loading} error={error} />

      <TasksSection
        tasks={tasks}
        totalCookies={totalCookies}
        totalBridges={totalBridges}
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
    const cookies = h?.tokenIds?.length ?? 0;
    const images = h?.imageIds?.length ?? 0;

    let bridges = 0;
    if (mgid) {
      if (key === "monad") bridges = mgid.totalBridges_monad ?? 0;
      if (key === "base") bridges = mgid.totalBridges_base ?? 0;
      if (key === "mantle") bridges = mgid.totalBridges_mantle ?? 0;
      if (key === "linea") bridges = mgid.totalBridges_linea ?? 0;
      if (key === "mitosis") bridges = mgid.totalBridges_mitosis ?? 0;
    }

    let score = 0;
    if (mgid) {
      if (key === "monad") score = mgid.totalScore_monad ?? 0;
      if (key === "base") score = mgid.totalScore_base ?? 0;
      if (key === "mantle") score = mgid.totalScore_mantle ?? 0;
      if (key === "linea") score = mgid.totalScore_linea ?? 0;
      if (key === "mitosis") score = mgid.totalScore_mitosis ?? 0;
    }

    return { key, label, accent, cookies, images, bridges, score };
  });
}

function deriveTasksFromMgid(
  mgid: MgidRowClient | null,
  totalCookiesCurrent: number,
  totalBridgesCurrent: number
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

  const weeklyBaselineCookies =
    weeklyActive && typeof mgid?.weeklyBaselineCookies === "number"
      ? mgid!.weeklyBaselineCookies!
      : totalCookiesCurrent;
  const weeklyBaselineBridges =
    weeklyActive && typeof mgid?.weeklyBaselineBridges === "number"
      ? mgid!.weeklyBaselineBridges!
      : totalBridgesCurrent;

  const dailyMintProgress = Math.max(
    0,
    totalCookiesCurrent - dailyBaselineCookies
  );
  const dailyBridgeProgress = Math.max(
    0,
    totalBridgesCurrent - dailyBaselineBridges
  );
  const weeklyMintProgress = Math.max(
    0,
    totalCookiesCurrent - weeklyBaselineCookies
  );
  const weeklyBridgeProgress = Math.max(
    0,
    totalBridgesCurrent - weeklyBaselineBridges
  );

  return {
    todayKey,
    weekKey,
    dailyMintDone: dailyActive ? Boolean(mgid?.dailyMintDone) : false,
    dailyBridgeDone: dailyActive ? Boolean(mgid?.dailyBridgeDone) : false,
    weeklyMintDone: weeklyActive ? Boolean(mgid?.weeklyMintDone) : false,
    weeklyBridgeDone: weeklyActive ? Boolean(mgid?.weeklyBridgeDone) : false,
    dailyMintProgress,
    dailyBridgeProgress,
    weeklyMintProgress,
    weeklyBridgeProgress,
  };
}

// ─────────────────────────────────────────────────────────────
// UI pieces
// ─────────────────────────────────────────────────────────────

function SummaryCard(props: {
  address: string;
  totalCookies: number;
  totalBridges: number;
  totalScore: number;
  mgid: MgidRowClient | null;
}) {
  const { address, totalCookies, totalBridges, totalScore, mgid } = props;

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
        </div>

        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          Wallet:{" "}
          <span style={{ color: "#e5e7eb" }}>{short(address)}</span>
        </div>
      </div>

      <div
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

          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginBottom: 10,
            }}
          >
            {c.cookies > 0 || c.bridges > 0
              ? "You’ve unlocked this chain. Keep farming!"
              : "No cookies here yet. Mint or bridge to awaken it ⚡️"}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 6,
              fontSize: 12,
            }}
          >
            <StatMini label="Cookies" value={c.cookies} />
            <StatMini label="Bridges" value={c.bridges} />
            <StatMini label="Images" value={c.images} />
          </div>

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
  chainsEngaged: number;
}) {
  const { tasks, totalCookies, totalBridges, chainsEngaged } = props;

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
      desc: "Bridge 2 COOKIEs between any chains.",
      done: tasks.dailyBridgeDone,
      progress: Math.min(tasks.dailyBridgeProgress, 2),
      target: 2,
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
      desc: "Bridge 8+ COOKIEs this week.",
      done: tasks.weeklyBridgeDone,
      progress: Math.min(tasks.weeklyBridgeProgress, 8),
      target: 8,
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
          <span style={{ color: "#e5e7eb" }}>{totalBridges}</span>
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

function StatMini(props: { label: string; value: number }) {
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
