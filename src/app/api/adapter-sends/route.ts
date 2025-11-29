// src/app/api/adapter-sends/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChainKey = 'base' | 'mantle' | 'linea' | 'monad';

type ChainAdapterResult = {
  count: number;
  ok: boolean;      // true = data is reliable, false = we had to fallback
};

// COOKIE / CANONICAL ONFT contracts
const CANONICAL_ADDRESSES: Record<ChainKey, string> = {
  base:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721 ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE ??
    '',
  mantle:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_MANTLE ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE ??
    '',
  linea:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_LINEA ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA ??
    '',
  monad:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_MONAD ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS ??
    '',    
};

// LayerZero adapters
const ADAPTERS: Record<ChainKey, string | undefined> = {
  base: process.env.NEXT_PUBLIC_ADAPTER_BASE,
  mantle: process.env.NEXT_PUBLIC_ADAPTER_MANTLE,
  linea: process.env.NEXT_PUBLIC_ADAPTER_LINEA,
  monad: process.env.NEXT_PUBLIC_ADAPTER_MONAD,  
};

// Etherscan V2 chain IDs
const ETHERSCAN_CHAINIDS: Record<ChainKey, string> = {
  base: '8453',
  mantle: '5000',
  linea: '59144',
  monad: '143',
};

// Your key name (you used ETHERSCAN_API_KEY_ENV earlier)
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY_ENV ||
  process.env.ETHERSCAN_API_KEY ||
  process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
  '';

function isHexAddress(v: string | null): v is `0x${string}` {
  return !!v && /^0x[0-9a-fA-F]{40}$/.test(v);
}

// Small sleep helper for retry loop
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEtherscanNFTTx(
  url: string,
): Promise<{ ok: boolean; json: any | null }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[adapter-sends] HTTP error', res.status, res.statusText);
      return { ok: false, json: null };
    }
    const json: any = await res.json().catch(() => null);
    if (!json) return { ok: false, json: null };
    return { ok: true, json };
  } catch (e) {
    console.error('[adapter-sends] fetch error', e);
    return { ok: false, json: null };
  }
}

/**
 * Base: special retry logic (up to 10 seconds, every 500 ms).
 * If we never get a valid "status:1" response, return ok:false so mgid-upsert
 * can keep previous score via Math.max().
 */
async function fetchBaseAdapterSends(
  user: `0x${string}`,
): Promise<ChainAdapterResult> {
  const apiKey = ETHERSCAN_API_KEY;
  const contract = CANONICAL_ADDRESSES.base;
  const adapter = ADAPTERS.base;
  const chainid = ETHERSCAN_CHAINIDS.base;

  if (!apiKey || !contract || !adapter || !chainid) {
    console.warn('[adapter-sends] base missing config', {
      hasApiKey: !!apiKey,
      contract,
      adapter,
      chainid,
    });
    return { count: 0, ok: false };
  }

  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=${chainid}` +
    `&module=account` +
    `&action=tokennfttx` +
    `&contractaddress=${contract}` +
    `&address=${user}` +
    `&page=1&offset=10000&sort=asc` +
    `&apikey=${apiKey}`;

  const start = Date.now();
  const maxDurationMs = 5_000;
  const intervalMs = 500;

  let lastJson: any | null = null;

  while (Date.now() - start < maxDurationMs) {
    const { ok, json } = await fetchEtherscanNFTTx(url);
    lastJson = json;

    if (!ok || !json) {
      await sleep(intervalMs);
      continue;
    }

    // Check Etherscan status
    if (json.status === '1' && Array.isArray(json.result)) {
      // success
      return extractUserToAdapterCount('base', json, user, adapter);
    }

    // Base-specific free-tier message: no point retrying forever
    const resultStr = typeof json.result === 'string' ? json.result : '';
    if (
      resultStr.includes('Free API access is not supported for this chain') ||
      resultStr.includes('No transactions found')
    ) {
      console.warn(
        '[adapter-sends] base non-success status',
        json.status,
        json.message,
        json.result,
      );
      // we consider this definitive: ok=false so mgid-upsert keeps old score
      return { count: 0, ok: false };
    }

    // other NOTOK → try again after delay
    await sleep(intervalMs);
  }

  console.warn(
    '[adapter-sends] base timeout after retries, lastJson=',
    lastJson,
  );
  // Did not get valid data in time → mark as unreliable
  return { count: 0, ok: false };
}

/**
 * Mantle / Linea: single call (they are stable on free tier).
 */
async function fetchOtherChainAdapterSends(
  chain: 'mantle' | 'linea' | 'monad',
  user: `0x${string}`,
): Promise<ChainAdapterResult> {
  const apiKey = ETHERSCAN_API_KEY;
  const contract = CANONICAL_ADDRESSES[chain];
  const adapter = ADAPTERS[chain];
  const chainid = ETHERSCAN_CHAINIDS[chain];

  if (!apiKey || !contract || !adapter || !chainid) {
    console.warn('[adapter-sends]', chain, 'missing config', {
      hasApiKey: !!apiKey,
      contract,
      adapter,
      chainid,
    });
    return { count: 0, ok: false };
  }

  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=${chainid}` +
    `&module=account` +
    `&action=tokennfttx` +
    `&contractaddress=${contract}` +
    `&address=${user}` +
    `&page=1&offset=10000&sort=asc` +
    `&apikey=${apiKey}`;

  const { ok, json } = await fetchEtherscanNFTTx(url);
  if (!ok || !json) {
    return { count: 0, ok: false };
  }

  if (json.status !== '1' || !Array.isArray(json.result)) {
    const resultStr = typeof json.result === 'string' ? json.result : '';
    console.warn(
      '[adapter-sends]',
      chain,
      'non-success status from etherscan:',
      json.status,
      json.message,
      resultStr,
    );

    if (resultStr.includes('No transactions found')) {
      // legit zero, ok=true
      return { count: 0, ok: true };
    }

    return { count: 0, ok: false };
  }

  return extractUserToAdapterCount(chain, json, user, adapter);
}

function extractUserToAdapterCount(
  chain: ChainKey,
  json: any,
  user: `0x${string}`,
  adapter: string,
): ChainAdapterResult {
  const transfers = json.result as any[];
  const lowerUser = user.toLowerCase();
  const lowerAdapter = adapter.toLowerCase();

  const filtered = transfers.filter((tx) => {
    const from = (tx.from || '').toString().toLowerCase();
    const to = (tx.to || '').toString().toLowerCase();
    const isError = (tx.isError || tx.txreceipt_status || '0').toString();
    return from === lowerUser && to === lowerAdapter && isError === '0';
  });

  const hashes = filtered
    .map((tx) => tx.hash || tx.transactionHash)
    .filter((h: any) => typeof h === 'string') as string[];

  console.log(
    '[adapter-sends]',
    chain,
    'ERC721 transfers:',
    transfers.length,
    'user->adapter bridges:',
    filtered.length,
  );

  return { count: filtered.length, ok: true };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!isHexAddress(address)) {
    return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 });
  }

  const user = address.toLowerCase() as `0x${string}`;

  const [base, mantle, linea, monad] = await Promise.all([
    fetchBaseAdapterSends(user),
    fetchOtherChainAdapterSends('mantle', user),
    fetchOtherChainAdapterSends('linea', user),
    fetchOtherChainAdapterSends('monad', user),    
  ]);

  return NextResponse.json({
    address: user,
    byChain: { base, mantle, linea, monad },
  });
}
