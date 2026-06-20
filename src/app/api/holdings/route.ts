import FortuneABI from '../../../abi/FortuneCookiesAI.json';

import { NextResponse } from 'next/server';
import {
  defaultServerChainKey as fallbackChainKey,
  getServerPublicClientByKey,
} from '../../../lib/aa/serverClients';
import type { ChainKey } from '../../../lib/aa/clients';

function keyFromChainId(id?: number): ChainKey {
  if (id === 8453) return 'base';
  if (id === 5000) return 'mantle';
  if (id === 59144) return 'linea';
  const mitosisId = Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777);
  if (id === mitosisId) return 'mitosis';
  if (id === 16661) return "og";
  if (id === 196) return "xlayer";
  if (id === 42161) return "arbitrum";

  return fallbackChainKey;
}

function cookieAddressForKey(key: ChainKey): `0x${string}` {
  if (key === 'base')    return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (key === 'mantle')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (key === 'linea')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;
  if (key === 'mitosis') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  if (key === "og") return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG as `0x${string}`;
  if (key === "xlayer") return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER as `0x${string}`;  
  if (key === "arbitrum") return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_ARBITRUM as `0x${string}`;
  
  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`;
}

export async function GET(req: Request) {
  let key: ChainKey = fallbackChainKey;
  let chainId: number | undefined;
  let COOKIE: `0x${string}` | undefined;

  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase() as `0x${string}` | null;
    if (!address) return NextResponse.json({ ok: false, error: 'address required' }, { status: 400 });

    const chainIdHdr = req.headers.get('x-chain-id');
    const parsedChainId = chainIdHdr ? Number(chainIdHdr) : undefined;
    chainId = Number.isFinite(parsedChainId) ? parsedChainId : undefined;
    key = keyFromChainId(chainId);
    COOKIE = cookieAddressForKey(key);
    if (!COOKIE) return NextResponse.json({ ok: false, error: `Missing contract for ${key}` }, { status: 500 });

    const client = getServerPublicClientByKey(key);

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
    const message = e?.shortMessage || e?.message || String(e);
    const details =
      e?.details ||
      e?.cause?.shortMessage ||
      e?.cause?.message ||
      e?.cause?.cause?.message ||
      e?.cause?.code ||
      e?.cause?.cause?.code ||
      undefined;
    const causeCode = e?.cause?.code || e?.cause?.cause?.code || undefined;
    console.error('[api/holdings] failed', {
      chain: key,
      chainId,
      contract: COOKIE,
      error: message,
      details,
      causeCode,
    });
    return NextResponse.json({ ok: false, chain: key, chainId, contract: COOKIE, error: message, details, causeCode }, { status: 500 });
  }
}
