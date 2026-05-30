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
  if (id === 196) return "xlayer";

  return 'monad'; // default
}

function cookieAddressForKey(key: ChainKey): `0x${string}` {
  if (key === 'base')    return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (key === 'mantle')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (key === 'linea')  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;
  if (key === 'mitosis') return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  if (key === "og") return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG as `0x${string}`;
  if (key === "xlayer") return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER as `0x${string}`;  
  
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