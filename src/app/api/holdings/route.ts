/*
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BV_ACCOUNT_NFTS = "https://api.blockvision.org/v2/monad/account/nfts";

// ---------- DURABLE LAST-GOOD STORAGE (survives dev hot reloads) ----------
const DB_PATH = process.env.HOLDINGS_DB_PATH || path.join(process.cwd(), ".holdings_last_good.json");
type GoodRec = { at: number; tokenIds: number[]; tokenIdsFlat: number[] };

// in-memory map
const LAST_GOOD = new Map<string, GoodRec>();

function loadDbOnce() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      const obj = JSON.parse(raw) as Record<string, GoodRec>;
      for (const k of Object.keys(obj)) LAST_GOOD.set(k, obj[k]);
    }
  } catch { }
}
function saveDb() {
  try {
    const obj: Record<string, GoodRec> = {};
    for (const [k, v] of LAST_GOOD.entries()) obj[k] = v;
    fs.writeFileSync(DB_PATH, JSON.stringify(obj), "utf8");
  } catch { }
}
loadDbOnce();

// ---------- Short “ephemeral” cache just to avoid hammering BV ----------
type Ephemeral = { at: number; payload: any };
const EPHEMERAL = new Map<string, Ephemeral>();
const TTL_MS = Number(process.env.HOLDINGS_TTL_MS ?? 45_000);

// ---------- Backoff / pacing ----------
const MAX_RETRIES = Number(process.env.BV_MAX_RETRIES ?? 5);
const BASE_DELAY = Number(process.env.BV_BASE_DELAY_MS ?? 400);
const PAGE_DELAY = Number(process.env.BV_PAGE_DELAY_MS ?? 300);
const REQ_TIMEOUT_MS = Number(process.env.BV_REQ_TIMEOUT_MS ?? 12000);
const jitter = (min = 80, max = 220) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const backoff = (n: number, retryAfter?: number) =>
  retryAfter && retryAfter > 0 ? retryAfter * 1000 : Math.min(5000, Math.round(BASE_DELAY * 2 ** n) + jitter());

function ok(payload: any, cacheHdr = "no-store") {
  return NextResponse.json(payload, { headers: { "Cache-Control": cacheHdr } });
}
function staleFrom(key: string) {
  const good = LAST_GOOD.get(key);
  if (!good) return null;
  return ok({
    ok: true,
    source: "blockvision/account-nfts (stale)",
    stale: true,
    tokenIds: good.tokenIds,
    tokenIdsFlat: good.tokenIdsFlat,
    lastGoodAt: good.at
  }, "no-store");
}
function strictAddr(x: string | null) {
  return (x || "").toLowerCase();
}
function isHexAddr(x: string) {
  return /^0x[a-f0-9]{40}$/.test(x);
}

async function safeJson(res: Response): Promise<any> {
  try { return await res.json(); }
  catch { return { __raw: await res.text().catch(() => "") }; }
}
async function fetchBV(url: string, init: RequestInit): Promise<Response> {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), REQ_TIMEOUT_MS);
    try {
      const r = await fetch(url, { ...init, signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) return r;
      if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
        if (i === MAX_RETRIES) return r;
        const ra = Number(r.headers.get("retry-after") ?? "");
        await sleep(backoff(i, Number.isFinite(ra) ? ra : undefined));
        continue;
      }
      return r; // 4xx not retried
    } catch (e) {
      clearTimeout(t);
      if (i === MAX_RETRIES) throw e;
      await sleep(backoff(i));
    }
  }
  throw new Error("Exhausted retries");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = strictAddr(url.searchParams.get("address"));
  const contract = strictAddr(url.searchParams.get("contract") || process.env.NEXT_PUBLIC_COOKIE_ADDRESS || "");
  const fresh = url.searchParams.get("fresh") === "1";

  if (!isHexAddr(address)) return ok({ ok: false, error: "Bad or missing ?address" });
  if (!isHexAddr(contract)) return ok({ ok: false, error: "Bad or missing ?contract (or NEXT_PUBLIC_COOKIE_ADDRESS)" });

  const apiKey = process.env.BLOCKVISION_API_KEY;
  if (!apiKey) return ok({ ok: false, error: "BLOCKVISION_API_KEY is not set" });

  const key = `${address}:${contract}`;

  // Serve recent (non-empty) payload quickly if available
  if (!fresh) {
    const eph = EPHEMERAL.get(key);
    if (eph && Date.now() - eph.at < TTL_MS) return ok(eph.payload);
  }

  // Always try to fetch fresh, but NEVER clear last-good on failure/empty
  const headers = { "x-api-key": apiKey, "accept": "application/json" } as const;
  const init: RequestInit = { headers, cache: "no-store" };

  try {
    let pageIndex = 1;
    const collections: any[] = [];
    let pagesFetched = 0;

    while (true) {
      const res = await fetchBV(`${BV_ACCOUNT_NFTS}?address=${address}&pageIndex=${pageIndex}`, init);

      if (!res.ok) {
        // On any upstream error -> return last-good if exists (never wipe)
        const stale = staleFrom(key);
        if (stale) return stale;
        // First ever call & no last-good yet: return soft empty (no IDs)
        return ok({ ok: false, error: `BlockVision error ${res.status}` });
      }

      const j = await safeJson(res);
      const page = j?.result?.data ?? j?.data ?? j?.collections ?? [];
      if (Array.isArray(page) && page.length) {
        collections.push(...page);
        pagesFetched++;
      } else {
        break;
      }

      const next = j?.result?.nextPageIndex ?? j?.nextPageIndex ?? j?.result?.nextPage ?? j?.nextPage ?? null;
      const hasNext = j?.result?.hasNext ?? j?.hasNext ?? (typeof next === "number" && next !== pageIndex);
      if (!hasNext) break;
      pageIndex = typeof next === "number" && next !== pageIndex ? next : pageIndex + 1;
      await sleep(PAGE_DELAY + jitter(70, 180));
    }

    // Extract items for our contract
    const items = collections
      .filter((c: any) => strictAddr(String(c?.contractAddress ?? c?.contract_address ?? "")) === contract)
      .flatMap((c: any) => {
        const arr = c?.items ?? c?.assets ?? c?.list ?? c?.tokens ?? [];
        return Array.isArray(arr) ? arr : [];
      });

    const tokenIds = Array.from(
      new Set(
        items.map((it: any) => Number(it?.tokenId ?? it?.token_id ?? it?.id)).filter((n: number) => Number.isFinite(n))
      )
    ).sort((a, b) => a - b);

    const tokenIdsFlat = items.flatMap((it: any) => {
      const id = Number(it?.tokenId ?? it?.token_id ?? it?.id);
      const qty = Math.max(1, Number(it?.qty ?? it?.amount ?? it?.balance ?? 1));
      if (!Number.isFinite(id)) return [];
      return new Array(qty).fill(id);
    });

    // ---------- STICKY GUARANTEE ----------
    if (tokenIds.length > 0) {
      const payload = {
        ok: true,
        source: "blockvision/account-nfts",
        tokenIds,
        tokenIdsFlat,
        collectionCountScanned: collections.length,
        pagesFetched
      };
      // Save durable last-good (write-through to disk)
      LAST_GOOD.set(key, { at: Date.now(), tokenIds, tokenIdsFlat });
      try { saveDb(); } catch {}
      // Update ephemeral read-through cache
      EPHEMERAL.set(key, { at: Date.now(), payload });
      return ok(payload);
    } else {
      // Empty fetch → NEVER clear last-good; return stale if exists
      const stale = staleFrom(key);
      if (stale) return stale;
      // First-ever call: soft empty (no IDs). Client should keep previous UI.
      return ok({ ok: false, error: "No tokenIds available yet" });
    }
    // -------------------------------------

  } catch (e: any) {
    // Network/timeout → also return last-good if exists
    const stale = staleFrom(key);
    if (stale) return stale;
    return ok({ ok: false, error: e?.message || String(e) });
  }
}
*/

import FortuneABI from '../../../abi/FortuneCookiesAI.json';

import { NextResponse } from 'next/server';
import { parseAbi } from 'viem';
import { getPublicClientByKey, type ChainKey } from '../../../lib/aa/clients';

function keyFromChainId(id?: number): ChainKey {
  if (id === 8453) return 'base';
  if (id === 5000) return 'mantle';
  if (id === 59144) return 'linea';
  const mitosisId = Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777);
  if (id === mitosisId) return 'mitosis';
  if (id === 16661) return "og";
  return 'monad'; // default
}

function cookieAddressForKey(key: ChainKey): `0x${string}` {
  if (key === 'base')    return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (key === 'mantle')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (key === 'linea')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;
  if (key === 'mitosis') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  if (key === "og") return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG as `0x${string}`;
  
  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase() as `0x${string}` | null;
    if (!address) return NextResponse.json({ ok: false, error: 'address required' }, { status: 400 });

    const chainIdHdr = req.headers.get('x-chain-id');
    const chainId = chainIdHdr ? Number(chainIdHdr) : undefined;
    const key = keyFromChainId(chainId);
    const COOKIE = cookieAddressForKey(key);
    if (!COOKIE) return NextResponse.json({ ok: false, error: `Missing contract for ${key}` }, { status: 500 });

    const client = getPublicClientByKey(key);

    const all = await client.readContract({
      address: COOKIE as `0x${string}`,
      abi: FortuneABI,
      functionName: 'getAllMints',
      // NOTE: viem’s ExactRequired in your setup expects this key;
      // it's ignored at runtime, but satisfies TS:
      authorizationList: undefined as any,
    }) as Array<{ id: bigint; wallet: `0x${string}`; isImage: boolean }>;

    const tokenIds = all
      .filter(r => (r.wallet || '0x').toLowerCase() === address)
      .map(r => Number(r.id));
    const imageIds = all
      .filter(r => (r.wallet || '0x').toLowerCase() === address && r.isImage)
      .map(r => Number(r.id));

    return NextResponse.json({ ok: true, tokenIds, imageIds, chain: key });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
