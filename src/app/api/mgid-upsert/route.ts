// src/app/api/mgid-upsert/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from "../../../lib/auth";
import { getPlayer, upsertPlayer, type MgidRow } from '../../../server/mgidStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sdk } from '@farcaster/miniapp-sdk'; //ttt

//import { usePathname } from 'next/navigation';

//const pathname = usePathname();
//const isMini = !!pathname && pathname.startsWith('/mini');

//import { createClient, Errors } from '@farcaster/quick-auth'; // ⬅️ add this

//const quickAuthClient = createClient(); // ⬅️ add this

type ChainKey = 'monad' | 'base' | 'mantle' | 'mitosis' | 'linea' | 'og' | 'xlayer';

const CHAIN_IDS: Record<ChainKey, number> = {
  monad: 143,
  base: 8453,
  mantle: 5000,
  linea: 59144,
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
  og: 16661,
  xlayer: 196,
};

function getUtcDayKey(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function getUtcIsoWeekKey(now: Date): string {
  // ISO week in UTC
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = tmp.getUTCDay() || 7; // Sunday -> 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day); // to Thursday of this week
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  const y = tmp.getUTCFullYear();
  return `${y}-W${String(weekNo).padStart(2, '0')}`; // e.g. 2025-W48
}

function getBaseUrl(): string {
  if (process.env.INTERNAL_APP_URL) return process.env.INTERNAL_APP_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return process.env.VERCEL_URL; // `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

type BoostFlags = {
  monad: 0 | 1;
  base: 0 | 1;
  mantle: 0 | 1;
  linea: 0 | 1;
  mitosis: 0 | 1;
  og: 0 | 1;
  xlayer: 0 | 1;  
};

async function loadBoosts(address: `0x${string}`, origin: string): Promise<BoostFlags> {
//  const baseUrl = getBaseUrl();
  const url = new URL('/api/mgid-boosts', origin);
  url.searchParams.set('address', address);

//  const params = new URLSearchParams();
//  params.set('address', address);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' }); // url.toString() params.toString()
    if (!res.ok) {
      console.error('[mgid-upsert] /api/mgid-boosts HTTP error', res.status);
      return { monad: 0, base: 0, mantle: 0, linea: 0, mitosis: 0, og: 0, xlayer: 0  };
    }
    const data: any = await res.json().catch(() => null);
    if (!data || !data.boosts) {
      return { monad: 0, base: 0, mantle: 0, linea: 0, mitosis: 0, og: 0, xlayer: 0  };
    }

    return {
      monad: (data.boosts.monad ?? 0) ? 1 : 0,
      base: (data.boosts.base ?? 0) ? 1 : 0,
      mantle: (data.boosts.mantle ?? 0) ? 1 : 0,
      linea: (data.boosts.linea ?? 0) ? 1 : 0,
      mitosis: (data.boosts.mitosis ?? 0) ? 1 : 0,
      og: 0,
      xlayer: (data.boosts.xlayer ?? 0) ? 1 : 0,     
    };
  } catch (e) {
    console.error('[mgid-upsert] /api/mgid-boosts failed', e);
    return { monad: 0, base: 0, mantle: 0, linea: 0, mitosis: 0, og: 0, xlayer: 0  };
  }
}

type HoldingsStats = {
  scoreByChain: Record<ChainKey, number>;
  imagesByChain: Record<ChainKey, number>;
};

// Call existing /api/holdings for all chains; return total unique tokenIds & imageIds per chain
async function loadHoldingsStats(address: `0x${string}`, origin: string): Promise<HoldingsStats> {
 // const baseUrl = getBaseUrl();

  const result: HoldingsStats = {
    scoreByChain: { monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0, xlayer: 0 },
    imagesByChain: { monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0, xlayer: 0 },
  };

  await Promise.all(
    (Object.keys(CHAIN_IDS) as ChainKey[]).map(async (chainKey) => {
      const chainId = CHAIN_IDS[chainKey];

  //    const params = new URLSearchParams();
   //   params.set('address', address);
     // params.set('chain', chainKey);

      const url = new URL('/api/holdings', origin);
      url.searchParams.set('address', address);

      try {
        const res = await fetch(url.toString(), { // url.toString() params.toString()
          cache: 'no-store',
          headers: { 'x-chain-id': String(chainId) },
        });

        if (!res.ok) return;
        const data: any = await res.json().catch(() => null);
        if (!data) return;

        const ids = Array.isArray(data.tokenIds) ? (data.tokenIds as number[]) : [];
        const imgs = Array.isArray(data.imageIds) ? (data.imageIds as number[]) : [];

        const uniqIds = new Set(ids);
        const uniqImgs = new Set(imgs);

        result.scoreByChain[chainKey] = uniqIds.size;
        result.imagesByChain[chainKey] = uniqImgs.size;
      } catch (e) {
        console.error('[mgid-upsert] /api/holdings failed for', chainKey, e);
      }
    }),
  );

  return result;
}

type AdapterSendsByChain = {
  base: { count: number; ok: boolean };
  mantle: { count: number; ok: boolean };
  linea: { count: number; ok: boolean };
  monad: { count: number; ok: boolean };
  xlayer: { count: number; ok: boolean };  
};

async function loadAdapterSends(address: `0x${string}`, origin: string): Promise<AdapterSendsByChain> {
//  const baseUrl = getBaseUrl();
  const url = new URL('/api/adapter-sends', origin);
  url.searchParams.set('address', address);

//  const params = new URLSearchParams();
//  params.set('address', address);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' }); // url.toString() params.toString()
    if (!res.ok) {
      console.error('[mgid-upsert] /api/adapter-sends HTTP error', res.status);
      return {
        base: { count: 0, ok: false },
        mantle: { count: 0, ok: false },
        linea: { count: 0, ok: false },
        monad: { count: 0, ok: false },
        xlayer: { count: 0, ok: false },        
      };
    }
    const data: any = await res.json().catch(() => null);

    return {
      base: {
        count: Number(data?.byChain?.base?.count ?? 0),
        ok: Boolean(data?.byChain?.base?.ok ?? false),
      },
      mantle: {
        count: Number(data?.byChain?.mantle?.count ?? 0),
        ok: Boolean(data?.byChain?.mantle?.ok ?? false),
      },
      linea: {
        count: Number(data?.byChain?.linea?.count ?? 0),
        ok: Boolean(data?.byChain?.linea?.ok ?? false),
      },
      monad: {
        count: Number(data?.byChain?.monad?.count ?? 0),
        ok: Boolean(data?.byChain?.monad?.ok ?? false),
      },     
      xlayer: {
        count: Number(data?.byChain?.xlayer?.count ?? 0),
        ok: Boolean(data?.byChain?.xlayer?.ok ?? false),
      },         
    };
  } catch (e) {
    console.error('[mgid-upsert] /api/adapter-sends failed', e);
    return {
      base: { count: 0, ok: false },
      mantle: { count: 0, ok: false },
      linea: { count: 0, ok: false },
      monad: { count: 0, ok: false },      
      xlayer: { count: 0, ok: false }, 
    };
  }
}


type UpdatePayload = {
  address?: `0x${string}`;
  EOAWallet?: `0x${string}`; // legacy
  SAWallet?: `0x${string}`;
};

function normalizeAddress(payload: UpdatePayload): `0x${string}` | null {
  const a = payload.address || payload.EOAWallet;
  if (!a) return null;
  const s = a.toLowerCase();
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? (s as `0x${string}`) : null;
}

export async function POST(req: Request) {
/*
  if (!isMini)
  {
  // 🔒 0) Require NextAuth session (Twitter) so random scripts can't hit this
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

  const sessionTwitter =
    (session as any).twitter_username ||
    (session as any).user?.name ||
    (session as any).user?.handle ||
    null;

  const sessionFarcaster =
    (session as any).farcaster_username ||
    (session as any).user?.farcasterUsername ||
    null;
  } else if (isMini) {
    // NEW: Farcaster username from SDK context
    const ctx = await (sdk as any).context;
    const fcUsername = ctx?.user?.username;
  }
  */

// Try to get NextAuth session (X / Twitter)
const headers = (req as any).headers;
const authHeaderRaw =
  headers?.get?.('authorization') ??
  headers?.get?.('Authorization') ??
  null;

const hasBearer =
  typeof authHeaderRaw === 'string' &&
  authHeaderRaw.toLowerCase().startsWith('bearer ');

// Mini app can prove “I’m running inside Farcaster” by sending x-farcaster-username
const headerFcUsernameRaw =
  headers?.get?.('x-farcaster-username') ??
  headers?.get?.('X-Farcaster-Username') ??
  null;

const hasMiniAppHeader =
  typeof headerFcUsernameRaw === 'string' &&
  headerFcUsernameRaw.trim() !== '';

const session = await getServerSession(authOptions);

// ✅ Allow ANY of:
//  - NextAuth session (desktop / X)
//  - Bearer token (Quick Auth)
//  - Mini app header (x-farcaster-username)
if (!session && !hasBearer && !hasMiniAppHeader) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const sessionTwitter =
  (session as any)?.twitter_username ||
  (session as any)?.user?.name ||
  (session as any)?.user?.handle ||
  null;

const sessionFarcaster =
  (session as any)?.farcaster_username ||
  (session as any)?.user?.farcasterUsername ||
  null;

// re-use the parsed header here:
const headerFcUsername =
  typeof headerFcUsernameRaw === 'string'
    ? headerFcUsernameRaw.trim().replace(/^@/, '')
    : null;

  // 1) Parse payload
  const payload = (await req.json().catch(() => null)) as UpdatePayload | null;
  if (!payload) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const address = normalizeAddress(payload);
  if (!address) {
    return NextResponse.json({ error: 'Missing or invalid address/EOAWallet' }, { status: 400 });
  }

  // 2) Existing row from Blob (if any)
  const existing = (await getPlayer(address)) as MgidRow | null;

  // Decide Farcaster username in a safe order:
  // 1) NextAuth session (desktop / X+Farcaster)
  // 2) Existing stored username (never overwrite)
  // 3) Mini app header on FIRST write only
  let effectiveFarcasterUsername =
    sessionFarcaster ?? existing?.usernamefarcaster ?? '';

  if (!effectiveFarcasterUsername && headerFcUsername) {
    // only allow setting from mini app header when we don't have anything yet
    effectiveFarcasterUsername = headerFcUsername;
  }

  const origin = new URL(req.url).origin;

  // 3) Recompute totals from chain: mints & holdings
  const { scoreByChain, imagesByChain } = await loadHoldingsStats(address, origin);

  // 4) Recompute totals from chain: bridges 
  const sends  = await loadAdapterSends(address, origin);
  //const baseBridge = sends.base;
  //const mantleBridge = sends.mantle;
  //const lineaBridge = sends.linea;

  // 5) Compose per-chain scores (mints + bridge events + boosts)
  const boostFlags = await loadBoosts(address, origin);

    // ── RAW components per chain ─────────────────────────────
    /*
  const mints_monad   = scoreByChain.monad;
  const mints_base    = scoreByChain.base;
  const mints_mantle  = scoreByChain.mantle;
  const mints_linea   = scoreByChain.linea;
  const mints_mitosis = scoreByChain.mitosis;

  const bridges_monad   = sends.monad.ok   ? sends.monad.count    : 0; 
  const bridges_base    = sends.base.ok    ? sends.base.count    : 0; // if ok=false, ignore this round
  const bridges_mantle  = sends.mantle.ok  ? sends.mantle.count  : 0;
  const bridges_linea   = sends.linea.ok   ? sends.linea.count   : 0;
  const bridges_mitosis = 0;
*/
  const mints_monad   = scoreByChain.monad;
  const mints_base    = scoreByChain.base;
  const mints_mantle  = scoreByChain.mantle;
  const mints_linea   = scoreByChain.linea;
  const mints_mitosis = scoreByChain.mitosis;
  const mints_og      = scoreByChain.og;
  const mints_xlayer  = scoreByChain.xlayer;

  // previous value from BLOB (so NOTOK won't zero things)
  const existingBr_monad   = existing?.totalBridges_monad   ?? 0;
  const existingBr_base    = existing?.totalBridges_base    ?? 0;
  const existingBr_mantle  = existing?.totalBridges_mantle  ?? 0;
  const existingBr_linea   = existing?.totalBridges_linea   ?? 0;
  const existingBr_mitosis = existing?.totalBridges_mitosis ?? 0;
  const existingBr_og      = (existing as any)?.totalBridges_0g ?? 0;
  const existingBr_xlayer  = (existing as any)?.totalBridges_xlayer ?? 0;

  // adapter-sends result for *this* run
  const bridges_monad_raw   = Number(sends.monad.count   ?? 0);
  const bridges_base_raw    = Number(sends.base.count    ?? 0);
  const bridges_mantle_raw  = Number(sends.mantle.count  ?? 0);
  const bridges_linea_raw   = Number(sends.linea.count   ?? 0);
  const bridges_mitosis_raw = 0;
  const bridges_og_raw      = 0;
  const bridges_xlayer_raw  = Number(sends.xlayer.count   ?? 0);

  // if ok=false → keep last good value from Blob
  const bridges_monad =
    sends.monad.ok   ? bridges_monad_raw   : existingBr_monad;
  const bridges_base =
    sends.base.ok    ? bridges_base_raw    : existingBr_base;
  const bridges_mantle =
    sends.mantle.ok  ? bridges_mantle_raw  : existingBr_mantle;
  const bridges_linea =
    sends.linea.ok   ? bridges_linea_raw   : existingBr_linea;
  const bridges_mitosis = existingBr_mitosis + bridges_mitosis_raw; // stays 0 for now
  const bridges_og      = existingBr_og + bridges_og_raw; // 0G does not use LayerZero bridge stats yet
    const bridges_xlayer =
    sends.xlayer.ok   ? bridges_xlayer_raw   : existingBr_xlayer;

  //const boost_monad   = boostFlags.monad;
  //const boost_base    = boostFlags.base;
  //const boost_mantle  = boostFlags.mantle;
  //const boost_linea   = boostFlags.linea;
  //const boost_mitosis = boostFlags.mitosis;

  const img_monad   = imagesByChain.monad;
  const img_base    = imagesByChain.base;
  const img_mantle  = imagesByChain.mantle;
  const img_linea   = imagesByChain.linea;
  const img_mitosis = imagesByChain.mitosis;
  const img_og      = imagesByChain.og;
  const img_xlayer  = imagesByChain.xlayer;  

    // ── Fresh TX (mints + bridges, NO boost) ─────────────────
  const freshTx_monad   = mints_monad   + bridges_monad;
  const freshTx_base    = mints_base    + bridges_base;
  const freshTx_mantle  = mints_mantle  + bridges_mantle;
  const freshTx_linea   = mints_linea   + bridges_linea;
  const freshTx_mitosis = mints_mitosis + bridges_mitosis;
  const freshTx_og      = mints_og + bridges_og;
  const freshTx_xlayer  = mints_xlayer + bridges_xlayer;  

  const existingTx_monad   = existing?.totalTransactions_monad   ?? 0;
  const existingTx_base    = existing?.totalTransactions_base    ?? 0;
  const existingTx_mantle  = existing?.totalTransactions_mantle  ?? 0;
  const existingTx_linea   = existing?.totalTransactions_linea   ?? 0;
  const existingTx_mitosis = existing?.totalTransactions_mitosis ?? 0;
  const existingTx_og      = (existing as any)?.totalTransactions_0g ?? 0;
  const existingTx_xlayer  = (existing as any)?.totalTransactions_xlayer ?? 0;  

  // 🔥 Apply boost **only** where there is NEW activity vs stored TX
  const boost_monad_effective =
    boostFlags.monad && freshTx_monad   > existingTx_monad   ? 1 : 0;
  const boost_base_effective =
    boostFlags.base  && freshTx_base    > existingTx_base    ? 1 : 0;
  const boost_mantle_effective =
    boostFlags.mantle && freshTx_mantle > existingTx_mantle  ? 1 : 0;
  const boost_linea_effective =
    boostFlags.linea && freshTx_linea   > existingTx_linea   ? 1 : 0;
  const boost_mitosis_effective =
    boostFlags.mitosis && freshTx_mitosis > existingTx_mitosis ? 1 : 0;
  const boost_og_effective = 0;
  const boost_xlayer_effective =
    boostFlags.xlayer && freshTx_xlayer > existingTx_xlayer ? 1 : 0;  

  // ── Fresh SCORE (mints + bridges + boost) ────────────────
  const freshScore_monad   = mints_monad   + bridges_monad   + boost_monad_effective;
  const freshScore_base    = mints_base    + bridges_base    + boost_base_effective;
  const freshScore_mantle  = mints_mantle  + bridges_mantle  + boost_mantle_effective;
  const freshScore_linea   = mints_linea   + bridges_linea   + boost_linea_effective;
  const freshScore_mitosis = mints_mitosis + bridges_mitosis + boost_mitosis_effective;
  const freshScore_og      = mints_og + bridges_og + boost_og_effective;
  const freshScore_xlayer  = mints_xlayer + bridges_xlayer + boost_xlayer_effective;  

  // Never decrease SCORE vs existing snapshot
  const score_monad =
    existing ? Math.max(existing.totalScore_monad ?? 0, freshScore_monad) : freshScore_monad;
  const score_base =
    existing ? Math.max(existing.totalScore_base ?? 0, freshScore_base) : freshScore_base;
  const score_mantle =
    existing ? Math.max(existing.totalScore_mantle ?? 0, freshScore_mantle) : freshScore_mantle;
  const score_linea =
    existing ? Math.max(existing.totalScore_linea ?? 0, freshScore_linea) : freshScore_linea;
  const score_mitosis =
    existing ? Math.max(existing.totalScore_mitosis ?? 0, freshScore_mitosis) : freshScore_mitosis;
  const score_og =
    existing ? Math.max((existing as any).totalScore_0g ?? 0, freshScore_og) : freshScore_og;
  const score_xlayer =
    existing ? Math.max((existing as any).totalScore_xlayer ?? 0, freshScore_xlayer) : freshScore_xlayer;

  // Never decrease TX vs existing snapshot
  const tx_monad =
    existing ? Math.max(existing.totalTransactions_monad ?? 0, freshTx_monad) : freshTx_monad;
  const tx_base =
    existing ? Math.max(existing.totalTransactions_base ?? 0, freshTx_base) : freshTx_base;
  const tx_mantle =
    existing ? Math.max(existing.totalTransactions_mantle ?? 0, freshTx_mantle) : freshTx_mantle;
  const tx_linea =
    existing ? Math.max(existing.totalTransactions_linea ?? 0, freshTx_linea) : freshTx_linea;
  const tx_mitosis =
    existing ? Math.max(existing.totalTransactions_mitosis ?? 0, freshTx_mitosis) : freshTx_mitosis;
  const tx_og =
    existing ? Math.max((existing as any).totalTransactions_0g ?? 0, freshTx_og) : freshTx_og;
  const tx_xlayer =
    existing ? Math.max((existing as any).totalTransactions_xlayer ?? 0, freshTx_xlayer) : freshTx_xlayer;

  // ── Totals ────────────────────────────────────────────────
  const totalScore =
    score_monad + score_base + score_mantle + score_linea + score_mitosis + score_og + score_xlayer;

  const totalTransactions =
    tx_monad + tx_base + tx_mantle + tx_linea + tx_mitosis + tx_og + tx_xlayer;

  const totalImages =
    img_monad + img_base + img_mantle + img_linea + img_mitosis + img_og + img_xlayer;

 // ── Global totals for quests ──────────────────────────────
  const totalCookiesCurrent =
    mints_monad + mints_base + mints_mantle + mints_linea + mints_mitosis + mints_og + mints_xlayer;

  const totalBridgesCurrent =
    bridges_monad + bridges_base + bridges_mantle + bridges_linea + bridges_mitosis + bridges_og + bridges_og + bridges_xlayer;

  const now = new Date();
  const dayKey = getUtcDayKey(now);
  const weekKey = getUtcIsoWeekKey(now);

  // ===== DAILY TASKS =====
  let dailyKey = existing?.dailyKey ?? null;

  // force numbers even if old rows stored strings
  let dailyBaselineCookies = Number(existing?.dailyBaselineCookies ?? 0);
  let dailyBaselineBridges = Number(existing?.dailyBaselineBridges ?? 0);

  // normalize to real booleans (handle "true"/"false", 1/0, etc.)
  const normalizeBool = (v: any): boolean => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v == null) return false;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "1" || s === "yes") return true;
      if (s === "false" || s === "0" || s === "no" || s === "") return false;
    }
    return Boolean(v);
  };

  let dailyMintDone = normalizeBool(existing?.dailyMintDone);
  let dailyBridgeDone = normalizeBool(existing?.dailyBridgeDone);

  const isSameDay = dailyKey === dayKey;

  // NEW DAY → reset baselines and flags
  if (!isSameDay || !dailyKey) {
    dailyKey = dayKey;
    dailyBaselineCookies = totalCookiesCurrent;
    dailyBaselineBridges = totalBridgesCurrent;
    dailyMintDone = false;
    dailyBridgeDone = false;
  }

  // SAFETY: if we already had the same day in storage AND mint was done,
  // never downgrade it because of any recalculation.
  if (existing && existing.dailyKey === dayKey && normalizeBool(existing.dailyMintDone)) {
    dailyMintDone = true;
    // keep the original baseline from storage if present
    if (typeof existing.dailyBaselineCookies !== "undefined") {
      dailyBaselineCookies = Number(existing.dailyBaselineCookies);
    }
  }

  // SAFETY: same for bridge
  if (existing && existing.dailyKey === dayKey && normalizeBool(existing.dailyBridgeDone)) {
    dailyBridgeDone = true;
    if (typeof existing.dailyBaselineBridges !== "undefined") {
      dailyBaselineBridges = Number(existing.dailyBaselineBridges);
    }
  }

  // Daily Mint – “Mint at least 2 COOKIEs on any chain”
  const dailyMintDiff = totalCookiesCurrent - dailyBaselineCookies;
  if (!dailyMintDone && totalCookiesCurrent > 0 && dailyMintDiff >= 2) {
    dailyMintDone = true;
  }

  // Daily Bridge – “Bridge 2 COOKIEs between any chains”
  const dailyBridgeDiff = totalBridgesCurrent - dailyBaselineBridges;
  if (!dailyBridgeDone && dailyBridgeDiff >= 2) {
    dailyBridgeDone = true;
  }

  // ===== WEEKLY TASKS =====
  // ===== WEEKLY TASKS =====
  let weeklyKey = existing?.weeklyKey ?? null;

  let weeklyBaselineCookies = Number(existing?.weeklyBaselineCookies ?? 0);
  let weeklyBaselineBridges = Number(existing?.weeklyBaselineBridges ?? 0);

  let weeklyMintDone = normalizeBool(existing?.weeklyMintDone);
  let weeklyBridgeDone = normalizeBool(existing?.weeklyBridgeDone);

  const isSameWeek = weeklyKey === weekKey;

  // NEW WEEK → reset baselines and flags
  if (!isSameWeek || !weeklyKey) {
    weeklyKey = weekKey;
    weeklyBaselineCookies = totalCookiesCurrent;
    weeklyBaselineBridges = totalBridgesCurrent;
    weeklyMintDone = false;
    weeklyBridgeDone = false;
  }

  // SAFETY: if for this week we already stored weeklyMintDone = true,
  // never downgrade it just because of re-calculation.
  if (existing && existing.weeklyKey === weekKey && normalizeBool(existing.weeklyMintDone)) {
    weeklyMintDone = true;
    if (typeof existing.weeklyBaselineCookies !== "undefined") {
      weeklyBaselineCookies = Number(existing.weeklyBaselineCookies);
    }
  }

  // Same safety for weeklyBridgeDone
  if (existing && existing.weeklyKey === weekKey && normalizeBool(existing.weeklyBridgeDone)) {
    weeklyBridgeDone = true;
    if (typeof existing.weeklyBaselineBridges !== "undefined") {
      weeklyBaselineBridges = Number(existing.weeklyBaselineBridges);
    }
  }

  const weeklyMintDiff   = totalCookiesCurrent - weeklyBaselineCookies;
  const weeklyBridgeDiff = totalBridgesCurrent - weeklyBaselineBridges;

  // “Mint 8+ cookies this week”
  if (!weeklyMintDone && weeklyMintDiff >= 8) {
    weeklyMintDone = true;
  }

  // “Bridge 8+ times this week”
  if (!weeklyBridgeDone && weeklyBridgeDiff >= 8) {
    weeklyBridgeDone = true;
  }

  /*
  // 6) Protection: if totals didn't change vs existing snapshot → no-op
  if (
    existing &&
    existing.totalScore === totalScore &&
    existing.totalTransactions === totalTransactions &&
    existing.totalImages === totalImages &&
    existing.totalScore_monad === score_monad &&
    existing.totalScore_base === score_base &&
    existing.totalScore_mantle === score_mantle &&
    existing.totalScore_linea === score_linea &&
    existing.totalScore_mitosis === score_mitosis
  ) {
    // nothing new on-chain (no new mints, no new sends)
    return NextResponse.json({ ok: true, row: existing,  changed: false }); // row: existing,  
  }
*/
  // 6) Protection: no-op only if NOTHING changed (scores, bridges, quests)
  if (existing) {
    const noScoreChange =
      existing.totalScore === totalScore &&
      existing.totalTransactions === totalTransactions &&
      existing.totalImages === totalImages &&
      (existing.totalScore_monad ?? 0) === score_monad &&
      (existing.totalScore_base ?? 0) === score_base &&
      (existing.totalScore_mantle ?? 0) === score_mantle &&
      (existing.totalScore_linea ?? 0) === score_linea &&
      (existing.totalScore_mitosis ?? 0) === score_mitosis &&
      ((existing as any).totalScore_0g ?? 0) === score_og &&
      ((existing as any).totalScore_xlayer ?? 0) === score_xlayer;

    const noBridgeChange =
      (existing.totalBridges_monad ?? 0) === bridges_monad &&
      (existing.totalBridges_base ?? 0) === bridges_base &&
      (existing.totalBridges_mantle ?? 0) === bridges_mantle &&
      (existing.totalBridges_linea ?? 0) === bridges_linea &&
      (existing.totalBridges_mitosis ?? 0) === bridges_mitosis &&
      ((existing as any).totalBridges_0g ?? 0) === bridges_og &&
      ((existing as any).totalBridges_xlayer ?? 0) === bridges_xlayer;

    const noDailyChange =
      (existing.dailyKey ?? null) === (dailyKey ?? null) &&
      (existing.dailyBaselineCookies ?? 0) === (dailyBaselineCookies ?? 0) &&
      (existing.dailyBaselineBridges ?? 0) === (dailyBaselineBridges ?? 0) &&
      normalizeBool(existing.dailyMintDone) === dailyMintDone &&
      normalizeBool(existing.dailyBridgeDone) === dailyBridgeDone;

    const noWeeklyChange =
      (existing.weeklyKey ?? null) === (weeklyKey ?? null) &&
      (existing.weeklyBaselineCookies ?? 0) === (weeklyBaselineCookies ?? 0) &&
      (existing.weeklyBaselineBridges ?? 0) === (weeklyBaselineBridges ?? 0) &&
      normalizeBool(existing.weeklyMintDone) === weeklyMintDone &&
      normalizeBool(existing.weeklyBridgeDone) === weeklyBridgeDone;

    if (noScoreChange && noBridgeChange && noDailyChange && noWeeklyChange) { //  
      // truly nothing changed → safe no-op
      return NextResponse.json({ ok: true, changed: false }); // row: existing, 
    }
  }

  // 7) Boosts – keep whatever is already stored
  //const LineaBoost = existing?.LineaBoost ?? 0;
  //const BaseBoost = existing?.BaseBoost ?? 0;
  //const MonadBoost = existing?.MonadBoost ?? 0;
  //const MantleBoost = existing?.MantleBoost ?? 0;
  //const MitosisBoost = existing?.MitosisBoost ?? 0;

  const row: MgidRow = {
    // 🔒 Usernames come from session / existing, not from client body
    usernameX: sessionTwitter ?? existing?.usernameX ?? '',
    usernamefarcaster: effectiveFarcasterUsername ?? existing?.usernamefarcaster ?? '',

    EOAWallet: address,

    // 🔒 SAWallet: cannot overwrite once stored
    SAWallet:
      existing?.SAWallet ??
      (payload.SAWallet && /^0x[0-9a-fA-F]{40}$/.test(payload.SAWallet)
        ? payload.SAWallet
        : ('' as `0x${string}`)),

    // 🔥 Boosts now come strictly from on-chain holdings
    MonadBoost: boostFlags.monad,
    BaseBoost: boostFlags.base,
    MantleBoost: boostFlags.mantle,
    LineaBoost: boostFlags.linea,
    MitosisBoost: boostFlags.mitosis,

    totalScore_monad: score_monad,
    totalTransactions_monad: tx_monad,
    totalImages_monad: img_monad,

    totalScore_base: score_base,
    totalTransactions_base: tx_base,
    totalImages_base: img_base,

    totalScore_mantle: score_mantle,
    totalTransactions_mantle: tx_mantle,
    totalImages_mantle: img_mantle,

    totalScore_linea: score_linea,
    totalTransactions_linea: tx_linea,
    totalImages_linea: img_linea,

    totalScore_mitosis: score_mitosis,
    totalTransactions_mitosis: tx_mitosis,
    totalImages_mitosis: img_mitosis,

    totalScore_0g: score_og,
    totalTransactions_0g: tx_og,
    totalImages_0g: img_og,

    totalScore_xlayer: score_xlayer,
    totalTransactions_xlayer: tx_xlayer,
    totalImages_xlayer: img_xlayer,

    totalScore,
    totalTransactions,
    totalImages,

   // createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),

    // 🔹 NEW: persist bridge counts
    totalBridges_monad: bridges_monad,
    totalBridges_base: bridges_base,
    totalBridges_mantle: bridges_mantle,
    totalBridges_linea: bridges_linea,
    totalBridges_mitosis: bridges_mitosis,
    totalBridges_0g: bridges_og,
    totalBridges_xlayer: bridges_xlayer,

    // 🔹 Persist tasks state exactly as computed above
    dailyKey,
    dailyBaselineCookies,
    dailyBaselineBridges,
    dailyMintDone,
    dailyBridgeDone,

    weeklyKey,
    weeklyBaselineCookies,
    weeklyBaselineBridges,
    weeklyMintDone,
    weeklyBridgeDone,

  };

  await upsertPlayer(row);
  return NextResponse.json({ ok: true, changed: true }); // row, 
}