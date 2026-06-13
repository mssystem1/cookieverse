// src/server/mgidStore.ts
import { put, list } from '@vercel/blob';
import os from 'node:os';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export type MgidRow = {
  usernameX: string;
  usernamefarcaster: string;

  EOAWallet: `0x${string}`;
  SAWallet: `0x${string}`;

  LineaBoost: number;
  BaseBoost: number;
  MonadBoost: number;
  MantleBoost: number;
  MitosisBoost: number;

  totalScore_monad: number;
  totalTransactions_monad: number;
  totalImages_monad: number;

  totalScore_base: number;
  totalTransactions_base: number;
  totalImages_base: number;

  totalScore_mantle: number;
  totalTransactions_mantle: number;
  totalImages_mantle: number;

  totalScore_linea: number;
  totalTransactions_linea: number;
  totalImages_linea: number;

  totalScore_mitosis: number;
  totalTransactions_mitosis: number;
  totalImages_mitosis: number;

  totalScore_0g: number;
  totalTransactions_0g: number;
  totalImages_0g: number;

  totalScore_xlayer: number;
  totalTransactions_xlayer: number;
  totalImages_xlayer: number;  

  totalX402_base: number;
  totalX402_mantle: number;
  totalX402_xlayer: number;

  totalX402Score_base: number;
  totalX402Score_mantle: number;
  totalX402Score_xlayer: number;

  totalX402: number;
  totalX402Score: number;

  totalScore: number;
  totalTransactions: number;
  totalImages: number;

  updatedAt: number;

  totalBridges_monad: number;
  totalBridges_base: number;
  totalBridges_mantle: number;
  totalBridges_linea: number;
  totalBridges_mitosis: number;
  totalBridges_0g: number;
  totalBridges_xlayer: number;  

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

// ---------- Legacy snapshot (read/migrate only) ----------
type LegacySnapshot = { players: Record<string, MgidRow> };
const LEGACY_SNAPSHOT_PATH = 'fortune-cookie/snapshot.json';

// ---------- V2 per-player storage ----------
/**
 * Bullet-proof strategy:
 * - Append-only history: players/<addr>/v/<updatedAt>.json  (never overwritten)
 * - Optional "latest":   players/<addr>/latest.json        (best-effort cache)
 *
 * Even if "latest" becomes stale due to concurrent writes, history is authoritative.
 */
const V2_PREFIX = 'fortune-cookie/players/';
const MIGRATION_MARKER = 'fortune-cookie/migrations/mgid-v2-migrated.txt';

// Vercel sets BLOB_READ_WRITE_TOKEN in production.
// Keep exactly your existing behavior (no new token env logic).
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

// Dev fallback (only used when no token)
const FALLBACK_DIR = path.join(os.tmpdir(), 'mgid-v2');

function normAddr(a: string) {
  return a.toLowerCase();
}

function v2HistoryPath(addr: string, updatedAt: number) {
  return `${V2_PREFIX}${normAddr(addr)}/v/${updatedAt}.json`;
}

function v2LatestPath(addr: string) {
  return `${V2_PREFIX}${normAddr(addr)}/latest.json`;
}

// ---------- Helpers ----------
async function listAll(opts: { prefix: string; limit?: number }) {
  if (!TOKEN) return { blobs: [] as any[] };

  const blobs: any[] = [];
  let cursor: string | undefined = undefined;

  // list() supports limit + cursor pagination :contentReference[oaicite:3]{index=3}
  while (true) {
    const res: any = await list({
      token: TOKEN,
      prefix: opts.prefix,
      limit: opts.limit ?? 1000,
      cursor,
    } as any);

    blobs.push(...(res.blobs ?? []));

    if (!res.cursor) break;
    cursor = res.cursor;
  }

  return { blobs };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function blobUrlByExactPathname(pathname: string): Promise<string | null> {
  if (!TOKEN) return null;
  const { blobs } = await list({ token: TOKEN, prefix: pathname });
  const exact = (blobs ?? []).find((b: any) => b.pathname === pathname);
  return exact?.url ?? null;
}

// ---------- Legacy snapshot read ----------
async function readLegacySnapshot(): Promise<LegacySnapshot> {
  if (!TOKEN) {
    // dev/local legacy fallback (rarely needed, but keep safe)
    const f = path.join(FALLBACK_DIR, 'legacy-snapshot.json');
    try {
      const raw = await readFile(f, 'utf8');
      return JSON.parse(raw) as LegacySnapshot;
    } catch {
      return { players: {} };
    }
  }

  const url = await blobUrlByExactPathname(LEGACY_SNAPSHOT_PATH);
  if (!url) return { players: {} };

  return (await fetchJson<LegacySnapshot>(url)) ?? { players: {} };
}

// ---------- V2 read: get latest row for one address ----------
async function readV2HistoryBest(addr: string): Promise<MgidRow | null> {
  const a = normAddr(addr);
  const prefix = `${V2_PREFIX}${a}/v/`;

  if (!TOKEN) return null;

  const { blobs } = await listAll({ prefix });
  let best: { updatedAt: number; url: string } | null = null;

  for (const b of blobs) {
    const m = String(b.pathname).match(/\/v\/(\d+)\.json$/);
    if (!m) continue;
    const ts = Number(m[1]);
    if (!Number.isFinite(ts)) continue;
    if (!best || ts > best.updatedAt) best = { updatedAt: ts, url: b.url };
  }

  if (!best) return null;
  return (await fetchJson<MgidRow>(best.url)) ?? null;
}

async function readV2Best(
  addr: string,
  opts: { preferHistory?: boolean } = {}
): Promise<MgidRow | null> {
  const a = normAddr(addr);

  if (opts.preferHistory) {
    try {
      const history = await readV2HistoryBest(a);
      if (history) return history;
    } catch (error) {
      console.error('[mgidStore] history read failed, falling back to latest', {
        address: a,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 1) try latest.json (fast path)
  if (!TOKEN) {
    try {
      const f = path.join(FALLBACK_DIR, `${a}.latest.json`);
      const raw = await readFile(f, 'utf8');
      return JSON.parse(raw) as MgidRow;
    } catch {
      // fallback to scanning history on disk
    }
  } else {
    const latestUrl = await blobUrlByExactPathname(v2LatestPath(a));
    if (latestUrl) {
      const latest = await fetchJson<MgidRow>(latestUrl);
      if (latest) return latest;
    }
  }

  // 2) scan history and pick max updatedAt (authoritative)

  if (!TOKEN) {
    // local: scan files (best effort)
    return null;
  }

  return readV2HistoryBest(a);
}

// ---------- V2 write: bullet-proof upsert ----------
/**
 * Bullet-proof guarantees:
 * - We NEVER overwrite shared global data.
 * - We write append-only history first (cannot delete other players).
 * - latest.json is a cache; if it fails or becomes stale, history remains correct.
 */
export async function upsertPlayer(row: MgidRow) {
  const addr = normAddr(row.EOAWallet);
  const ts = row.updatedAt || Date.now();

  // Local fallback (no blob token) – keep behavior safe in dev
  if (!TOKEN) {
    await writeFile(path.join(FALLBACK_DIR, `${addr}.latest.json`), JSON.stringify({ ...row, updatedAt: ts }), 'utf8');
    return;
  }

  // 1) Append-only history (authoritative). Never overwrite.
  // If the exact ts already exists (rare), we add a random suffix by retrying with +1ms.
  let historyPath = v2HistoryPath(addr, ts);
  for (let i = 0; i < 3; i++) {
    try {
      await put(historyPath, JSON.stringify({ ...row, updatedAt: ts }), {
        token: TOKEN,
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      break;
    } catch (e: any) {
      // If conflict, bump timestamp slightly and retry; otherwise rethrow.
      const msg = String(e?.message ?? '');
      const isConflict =
        msg.includes('already exists') ||
        msg.includes('Conflict') ||
        msg.includes('409');

      if (!isConflict || i === 2) throw e;
      historyPath = v2HistoryPath(addr, ts + (i + 1));
    }
  }

  // 2) Best-effort latest cache. Never throw from this.
  try {
    // Guard: only overwrite latest if newer than what we see.
    const cur = await readV2Best(addr);
    if (!cur || (cur.updatedAt ?? 0) <= ts) {
      await put(v2LatestPath(addr), JSON.stringify({ ...row, updatedAt: ts }), {
        token: TOKEN,
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    }
  } catch {
    // swallow: history already persisted
  }
}

// ---------- Public reads ----------
export async function getPlayer(
  EOAWallet: `0x${string}`,
  opts: { preferHistory?: boolean } = {}
) {
  // Prefer V2; if not found, fall back to legacy snapshot
  const v2 = await readV2Best(EOAWallet, opts);
  if (v2) return v2;

 // const legacy = await readLegacySnapshot();
 // return legacy.players[normAddr(EOAWallet)] || null;
}

/**
 * topPlayers:
 * - Uses latest.json when available (fast).
 * - If you want absolute correctness even when latest is stale, you can flip
 *   `STRICT = true` to compute from history (heavier).
 */
export async function topPlayers(limit = 50): Promise<MgidRow[]> {
  if (!TOKEN) return [];

  const STRICT = false;

  if (!STRICT) {
    // list all latest.json files
    const { blobs } = await listAll({ prefix: V2_PREFIX });

    const latestBlobs = blobs.filter((b: any) => String(b.pathname).endsWith('/latest.json'));
    const rows = await Promise.all(latestBlobs.map((b: any) => fetchJson<MgidRow>(b.url)));

    const all = rows.filter(Boolean) as MgidRow[];
    all.sort((a, b) => b.totalScore - a.totalScore || b.updatedAt - a.updatedAt);
    return all.slice(0, limit);
  }

  // STRICT mode: scan history for every address (slow but fully authoritative)
  const { blobs } = await listAll({ prefix: `${V2_PREFIX}` });

  // Group max updatedAt per address from history files
  const bestByAddr = new Map<string, { ts: number; url: string }>();

  for (const b of blobs) {
    const p = String(b.pathname);
    const m = p.match(/^fortune-cookie\/players\/([^/]+)\/v\/(\d+)\.json$/);
    if (!m) continue;

    const addr = m[1];
    const ts = Number(m[2]);
    const prev = bestByAddr.get(addr);
    if (!prev || ts > prev.ts) bestByAddr.set(addr, { ts, url: b.url });
  }

  const best = Array.from(bestByAddr.values());
  const rows = await Promise.all(best.map((x) => fetchJson<MgidRow>(x.url)));
  const all = rows.filter(Boolean) as MgidRow[];

  all.sort((a, b) => b.totalScore - a.totalScore || b.updatedAt - a.updatedAt);
  return all.slice(0, limit);
}

export async function getPlayersMany(
  addresses: string[],
  opts: { preferHistory?: boolean } = {}
): Promise<MgidRow[]> {
  const uniq = Array.from(new Set(addresses.map((a) => a?.toLowerCase()).filter(Boolean) as string[]));
  const settled = await Promise.allSettled(
    uniq.map(async (a) => ({ address: a, row: await getPlayer(a as any, opts) }))
  );

  const rows: MgidRow[] = [];

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      if (result.value.row) rows.push(result.value.row);
      continue;
    }

    console.error('[mgidStore] getPlayersMany row read failed', {
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  }

  return rows;
}

// ---------- Migration: snapshot.json -> V2 per-player ----------
/**
 * Idempotent migration:
 * - Reads legacy snapshot.json
 * - Writes each player into V2 history (+ best-effort latest)
 * - Drops a marker blob so it runs only once
 */
export async function migrateLegacySnapshotToV2Once() {
  if (!TOKEN) return;

  const markerUrl = await blobUrlByExactPathname(MIGRATION_MARKER);
  if (markerUrl) return; // already migrated

  const legacy = await readLegacySnapshot();
  const players = Object.values(legacy.players ?? {});

  for (const row of players) {
    if (!row?.EOAWallet) continue;
    // This is safe + idempotent: history is append-only, latest guarded by updatedAt.
    await upsertPlayer(row);
  }

  // Write marker (creation only)
  await put(MIGRATION_MARKER, 'ok', {
    token: TOKEN,
    access: 'public',
    contentType: 'text/plain',
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}
