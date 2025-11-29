// src/server/mgidStore.ts
import { put, list } from '@vercel/blob';
import os from 'node:os';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export type MgidRow = {
  usernameX: string;   // X username
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
  totalScore: number;
  totalTransactions: number;
  totalImages: number;
  updatedAt: number;                       // epoch ms UTC

  // 🔹 NEW: per-chain bridge counts (from adapter-sends)
  totalBridges_monad: number;
  totalBridges_base: number;
  totalBridges_mantle: number;
  totalBridges_linea: number;
  totalBridges_mitosis: number; // keep for symmetry (always 0 for now)

    // 🔹 Daily tasks (UTC-based)
  dailyKey?: string;                // 'YYYY-MM-DD' (UTC)
  dailyBaselineCookies?: number;    // total cookies at start of that day
  dailyBaselineBridges?: number;    // total bridges at start of that day
  dailyMintDone?: boolean;          // "Mint at least 2 COOKIEs" – logic in mgid-upsert
  dailyBridgeDone?: boolean;        // "Bridge 2 COOKIEs"

  // 🔹 Weekly tasks (UTC-based ISO week)
  weeklyKey?: string;               // 'YYYY-Www' (UTC ISO week)
  weeklyBaselineCookies?: number;   // total cookies at start of week
  weeklyBaselineBridges?: number;   // total bridges at start of week
  weeklyMintDone?: boolean;         // "Mint 8+ cookies this week"
  weeklyBridgeDone?: boolean;       // "Bridge 8+ times this week"
};

type Snapshot = { players: Record<string, MgidRow> };

// Single fixed key for MGID data inside this store
const BLOB_PATH = 'fortune-cookie/snapshot.json';

// Vercel sets BLOB_READ_WRITE_TOKEN automatically in production.
// For local dev you can also keep using your MGID_BLOB_TOKEN if you want.
const TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ||
  '';

// Local fallback file (dev only when no token)
const FALLBACK_FILE = path.join(os.tmpdir(), 'mgid-leaderboard.json');

/** Make sure the blob exists; return its URL. */
async function ensureBlobUrl(): Promise<string | null> {
  if (!TOKEN) return null;

  // 1) See if we already have the blob at BLOB_PATH
  const { blobs } = await list({ prefix: BLOB_PATH, token: TOKEN });
  if (blobs.length > 0) return blobs[0].url;

  // 2) Create an empty snapshot at a stable path (no random suffix)
  const init: Snapshot = { players: {} as Snapshot['players'] };
  try {
    const res = await put(BLOB_PATH, JSON.stringify(init), {
      token: TOKEN,
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false, // creation only
    });
    return res.url;
  } catch {
    // 3) If another request created it in the meantime, re-list
    const again = await list({ prefix: BLOB_PATH, token: TOKEN });
    return again.blobs.length > 0 ? again.blobs[0].url : null;
  }
}

function empty(): Snapshot { return { players: {} }; }

async function readSnapshot(): Promise<Snapshot> {
  // Dev/local fallback if there is no Blob token
  if (!TOKEN) {
    try {
      const raw = await readFile(FALLBACK_FILE, 'utf8');
      return JSON.parse(raw) as Snapshot;
    } catch {
      const init: Snapshot = { players: {} as Snapshot['players'] };
      await writeFile(FALLBACK_FILE, JSON.stringify(init), 'utf8');
      return init;
    }
  }

  // Production / blob path
  const url = await ensureBlobUrl();
  if (!url) {
    return { players: {} as Snapshot['players'] };
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    return { players: {} as Snapshot['players'] };
  }

  return (await res.json()) as Snapshot;
}

async function writeSnapshot(next: Snapshot): Promise<void> {
  if (!TOKEN) {
    // dev/local: write to temp file
    await writeFile(FALLBACK_FILE, JSON.stringify(next), 'utf8');
    return;
  }

  await put(BLOB_PATH, JSON.stringify(next), {
    token: TOKEN,
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true, // ✅ overwrite same key each time
  });
}



export async function upsertPlayer(row: MgidRow) {
  const snap = await readSnapshot();
  snap.players[row.EOAWallet.toLowerCase() as `0x${string}`] = row;
  await writeSnapshot(snap);
}

export async function getPlayer(EOAWallet: `0x${string}`) {
  const snap = await readSnapshot();
  return snap.players[EOAWallet.toLowerCase() as `0x${string}`] || null;
}

export async function topPlayers(limit = 50): Promise<MgidRow[]> {
  const snap = await readSnapshot();
  const all = Object.values(snap.players);
  all.sort((a, b) => b.totalScore - a.totalScore || b.updatedAt - a.updatedAt);
  return all.slice(0, limit);
}

export async function getPlayersMany(addresses: string[]): Promise<MgidRow[]> {
  const snap = await readSnapshot();

  const uniq = Array.from(
    new Set(
      addresses
        .map((a) => a?.toLowerCase())
        .filter(Boolean) as string[]
    )
  );

  const rows: MgidRow[] = [];
  for (const addr of uniq) {
    const row = snap.players[addr];
    if (row) rows.push(row);
  }

  return rows;
}