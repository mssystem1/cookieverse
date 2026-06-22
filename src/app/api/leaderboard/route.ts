import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "../../../lib/chain";

//import type { Abi } from 'viem';
import {
  defaultServerChainKey as fallbackChainKey,
  getServerPublicClientByKey,
} from '../../../lib/aa/serverClients';
import type { ChainKey } from '../../../lib/aa/clients';
import FortuneABI from '../../../abi/FortuneCookiesAI.json';


/**
 * Leaderboard strategy:
 * 1) Base Top-20 = BlockVision collection holders snapshot (stable).
 * 2) ALWAYS patch the connected wallet (if ?you=<wallet>) using the same
 *    "account nft holdings" logic that works in holdings/route.ts (authoritative).
 * 3) Short server caches + real bypass on fresh=1.
 */

function cookieAddressForKey(key: ChainKey): `0x${string}` {
  if (key === 'base')    return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (key === 'mantle')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (key === 'linea')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;
  if (key === 'mitosis') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  if (key === 'og') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG as `0x${string}`;
  if (key === 'xlayer') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER as `0x${string}`;
  if (key === 'arbitrum') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_ARBITRUM as `0x${string}`;

  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`; // monad (default)
}

function keyFromChainId(id?: number): ChainKey {
  if (id === 8453) return 'base';
  if (id === 5000) return 'mantle';
  if (id === 59144) return 'linea';
  if (id === 16661) return 'og';
  if (id === 196) return 'xlayer';
  if (id === 42161) return 'arbitrum';

  const mitosisId = Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777);
  if (id === mitosisId) return 'mitosis';

  return fallbackChainKey;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;


// Count repeated addresses (case-insensitive)
const tallyLower = (arr?: readonly (string | `0x${string}`)[]) => {
  const m = new Map<string, number>();
  if (!arr) return m;
  for (const a of arr) {
    const k = String(a).toLowerCase();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};


// ---- Types (loose) ----
type Holder = { ownerAddress?: string; amount?: string };
type Holding = { nft?: { contractAddress?: string; tokenId?: string }, amount?: string | number };
type Row = { address: string; mints: number };
type MintRecord = {
  id: bigint;
  wallet: `0x${string}`;
  isImage: boolean;
};

const LEADERBOARD_CHAIN_KEYS: ChainKey[] = [
  "monad",
  "base",
  "mantle",
  "linea",
  "mitosis",
  "og",
  "xlayer",
  "arbitrum",
];

// ---- Small in-memory caches ----
// holders snapshot (collection-wide)
const HOLDERS_TTL_MS = 60_000;
let holdersCacheRows: Row[] | null = null;
let holdersCachedAt = 0;
let holdersInflight: Promise<Row[]> | null = null;
let allChainMintsCache:
  | { at: number; rows: Map<ChainKey, MintRecord[]> }
  | null = null;
let allChainMintsInflight: Promise<Map<ChainKey, MintRecord[]>> | null = null;

// per-wallet holdings cache (authoritative for connected wallet)
const YOU_TTL_MS = 5_000;
const youCache = new Map<string, { at: number; count: number }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Lowercase → Set helper (so we can do O(1) membership checks)
const toLowerSet = (arr?: readonly (string | `0x${string}`)[]) =>
  new Set((arr ?? []).map(a => String(a).toLowerCase()));

/** Normalize tokenId ("1" vs "0x1" etc.) so we can dedupe per token reliably. */
function normTokenId(id?: string): string {
  if (!id) return "";
  try {
    return "0x" + BigInt(id).toString(16);
  } catch {
    return id.toLowerCase();
  }
}

/** Fetch collection holders (stable base). */
// Fetch per-wallet mint counts for a single chain using getAllMints()
// Return type is Map<walletLowercase, count>
/*
async function fetchHolders(
  contract: string,
  apiKey: string,
  forceFresh = false
): Promise<Row[]> {
const now = Date.now();
  if (!forceFresh && holdersCacheRows && now - holdersCachedAt < HOLDERS_TTL_MS) {
    return holdersCacheRows;
  }
  if (!forceFresh && holdersInflight) return holdersInflight;

  holdersInflight = (async () => {
    // use shared client + selected chain’s cookie address
    const client  = getServerPublicClientByKey(SELECTED_KEY);
    const COOKIE  = cookieAddressForKey(SELECTED_KEY);

    // read all mints once
    const all = await client.readContract({
      address: COOKIE,
      abi: FortuneABI,
      functionName: "getAllMints",
      // some viem setups require this; harmless if ignored at runtime
      authorizationList: undefined as any,
    }) as Array<{ id: bigint; wallet: `0x${string}`; isImage: boolean }>;

    // count mints per wallet (ERC721 → 1 per token)
    const byAddr: Record<string, number> = {};
    for (const r of all) {
      const k = (r.wallet || "0x").toLowerCase();
      byAddr[k] = (byAddr[k] ?? 0) + 1;
    }

    const rows = Object.entries(byAddr)
      .map(([address, mints]) => ({ address, mints }))
      .filter((r) => r.mints > 0)
      .sort((a, b) => b.mints - a.mints);

    holdersCacheRows = rows;
    holdersCachedAt = Date.now();
    return rows;
  })();

  try {
    return await holdersInflight;
  } finally {
    holdersInflight = null;
  }
}
*/
async function fetchHolders(
  _contract: string,
  _apiKey: string,
  forceFresh = false
): Promise<Row[]> {
  const now = Date.now();
  if (!forceFresh && holdersCacheRows && now - holdersCachedAt < HOLDERS_TTL_MS) {
    return holdersCacheRows;
  }
  if (!forceFresh && holdersInflight) return holdersInflight;

  holdersInflight = (async () => {
    const allChainMints = await fetchAllChainMints(forceFresh);
    const byAddr: Record<string, number> = {};

    for (const all of allChainMints.values()) {
      for (const r of all) {
        const wallet = (r.wallet || "0x").toLowerCase();
        byAddr[wallet] = (byAddr[wallet] ?? 0) + 1;
      }
    }

    const rows = Object.entries(byAddr)
      .map(([address, mints]) => ({ address, mints }))
      .filter((r) => r.mints > 0)
      .sort((a, b) => b.mints - a.mints);

    holdersCacheRows = rows;
    holdersCachedAt = Date.now();
    return rows;
  })();

  try {
    return await holdersInflight;
  } finally {
    holdersInflight = null;
  }
}

async function fetchAllChainMints(
  forceFresh = false,
): Promise<Map<ChainKey, MintRecord[]>> {
  const now = Date.now();

  if (
    !forceFresh &&
    allChainMintsCache &&
    now - allChainMintsCache.at < HOLDERS_TTL_MS
  ) {
    return allChainMintsCache.rows;
  }

  // Never discard live work. Concurrent fresh requests must share one scan.
  if (allChainMintsInflight) return allChainMintsInflight;

  allChainMintsInflight = (async () => {
    const results = await Promise.all(
      LEADERBOARD_CHAIN_KEYS.map(async (key) => {
        try {
          const client = getServerPublicClientByKey(key);
          const cookie = cookieAddressForKey(key);
          const rows = (await client.readContract({
            address: cookie,
            abi: FortuneABI,
            functionName: "getAllMints",
            authorizationList: undefined as any,
          })) as MintRecord[];

          return [key, rows] as const;
        } catch (error) {
          console.warn("[leaderboard] chain mint snapshot failed", {
            chain: key,
            error: error instanceof Error ? error.message : String(error),
          });
          return [key, [] as MintRecord[]] as const;
        }
      }),
    );

    const rows = new Map<ChainKey, MintRecord[]>(results);
    allChainMintsCache = { at: Date.now(), rows };
    return rows;
  })();

  try {
    return await allChainMintsInflight;
  } finally {
    allChainMintsInflight = null;
  }
}


/** Authoritative per-wallet count for THIS collection (same idea as holdings/route.ts). */
async function fetchYouHoldingsCount(
  you: string,
  contract: string,
  apiKey: string,
  selectedKey: ChainKey,
  forceFresh = false
): Promise<number | null> {
  const now = Date.now();
  const ck = `${selectedKey}:${you.toLowerCase()}`;

  if (!forceFresh) {
    const cached = youCache.get(ck);
    if (cached && now - cached.at < YOU_TTL_MS) return cached.count;
  }

  const client  = getServerPublicClientByKey(selectedKey);
  const COOKIE  = cookieAddressForKey(selectedKey);

  const all = await client.readContract({
    address: COOKIE,
    abi: FortuneABI,
    functionName: "getAllMints",
    authorizationList: undefined as any,
  }) as Array<{ id: bigint; wallet: `0x${string}`; isImage: boolean }>;

  // count only this wallet’s mints
  const walletLower = you.toLowerCase();
  const total = all.reduce(
    (acc, r) => acc + (r.wallet?.toLowerCase() === walletLower ? 1 : 0),
    0,
  );

  youCache.set(ck, { at: Date.now(), count: total });
  return total;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { searchParams } = new URL(req.url);

    // resolve selected chain (header > query > default)
    const chainIdHdr = req.headers.get("x-chain-id");
    const chainIdQ   = url.searchParams.get("chainId");
    const chainQ     = url.searchParams.get("chain"); // 'monad'|'base'|'mantle'|'mitosis'
    const selectedKey: ChainKey = chainQ
      ? (["monad","base","mantle","linea","mitosis", "og", "xlayer", "arbitrum"].includes(chainQ) ? (chainQ as ChainKey) : fallbackChainKey)
      : keyFromChainId(chainIdHdr ? Number(chainIdHdr) : chainIdQ ? Number(chainIdQ) : undefined);

    // optional: "you" can be "0xEOA,0xSA"
    const youCsv = searchParams.get('you');

    //const YOU = (url.searchParams.get("you") || "").toLowerCase();
    const forceFresh = url.searchParams.get("fresh") === "1";

    const YOU_RAW = (url.searchParams.get('you') || '').toLowerCase();
    const YOU_LIST = YOU_RAW ? YOU_RAW.split(',').map(s => s.trim()).filter(Boolean) : [];
    const YOU = YOU_LIST[0] || ''; // keep the first for backward-compatibility

    const contract = cookieAddressForKey(selectedKey).toLowerCase();
    if (!contract) {
      return NextResponse.json(
        { error: `Missing COOKIE address for ${selectedKey}` },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // If truly fresh, drop holders cache/inflight so we refetch now
    if (forceFresh) {
      holdersCacheRows = null;
      holdersCachedAt = 0;
      allChainMintsCache = null;
    }

    // 1) Global all-chain holder roster. Selected chain only affects score columns.
    const allChainMints = await fetchAllChainMints(forceFresh);
    const globalCounts = new Map<string, number>();

    for (const chainRows of allChainMints.values()) {
      for (const row of chainRows) {
        const wallet = (row.wallet || "0x").toLowerCase();
        globalCounts.set(wallet, (globalCounts.get(wallet) ?? 0) + 1);
      }
    }

    const globalRows = Array.from(globalCounts, ([address, mints]) => ({
      address,
      mints,
    })).sort((a, b) => b.mints - a.mints);
    const byAddr = new Map<string, number>(
      globalRows.map((r) => [r.address, r.mints]),
    );

    // 2.5) Use getAllMints once to build both columns
    const textCounts  = new Map<string, number>();   // cookies
    const imageCounts = new Map<string, number>();   // images
    const selectedChainRows = allChainMints.get(selectedKey) ?? [];
    for (const r of selectedChainRows) {
      const k = (r.wallet || "0x").toLowerCase();
      if (r.isImage) {
        imageCounts.set(k, (imageCounts.get(k) ?? 0) + 1);
      } else {
        textCounts.set(k, (textCounts.get(k) ?? 0) + 1);
      }
    }
    const youMintsAllChains = YOU_LIST.reduce(
      (total, address) => total + (byAddr.get(address) ?? 0),
      0,
    );


    // 3) Build rows + Top-50
    const rows = Array.from(byAddr.entries())
      .map(([address, mints]) => ({ address, mints }))
      .filter((r) => r.mints > 0)
      .sort((a, b) => b.mints - a.mints);

    const actual = rows.slice(0, 50).map((r, i) => {
      const a = (r.address || "").toLowerCase();
      return {
        rank: i + 1,
        address: r.address,
        mints: r.mints,
        // ↓ counts, not booleans
        mintedCookies: textCounts.get(a)  ?? 0,
        mintedImages:  imageCounts.get(a) ?? 0,
        youMintsAllChains,
      };
    });
    const need = Math.max(0, 50 - actual.length);
    const top50 = [
      ...actual,
      ...Array.from({ length: need }, (_, i) => ({
        rank: actual.length + i + 1,
        address: null as string | null,
        mints: 0,
        mintedCookies: 0,
        mintedImages: 0,
        youMintsAllChains: 0,
      })),
    ];

    // 4) you row
    /*
    let you: { rank: number; address: string; mints: number } | null = null;
    if (YOU) {
      const idx = rows.findIndex((r) => r.address === YOU);
      if (idx >= 0) you = { rank: idx + 1, address: YOU, mints: rows[idx].mints };
    }
    */
    let you: { rank: number; address: string | string[]; mints: number; mintedCookies: number; mintedImages: number, youMintsAllChains } | null = null;

    if (YOU_LIST.length) {
      const sum = (map: Map<string, number>) =>
        YOU_LIST.reduce((acc, a) => acc + (map.get(a) ?? 0), 0);
      const mintedCookies = sum(textCounts);
      const mintedImages  = sum(imageCounts);
      const mints = mintedCookies + mintedImages;

      // rank is ambiguous for multi; set to NaN or min rank if you prefer
      you = { rank: Number.NaN, address: YOU_LIST, mints, mintedCookies, mintedImages,   youMintsAllChains };
    } else if (YOU) {
      const idx = rows.findIndex(r => r.address.toLowerCase() === YOU);
      you = {
        rank: idx >= 0 ? idx + 1 : Number.NaN,
        address: YOU,
        mints: rows[idx]?.mints ?? 0,
        mintedCookies: textCounts.get(YOU) ?? 0,
        mintedImages: imageCounts.get(YOU) ?? 0,
        youMintsAllChains,
      };
    }

    return NextResponse.json(
      { updatedAt: new Date().toISOString(), totalMinters: rows.length, top50, you },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
