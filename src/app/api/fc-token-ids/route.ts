// src/app/api/fc-token-ids/route.ts
import { NextResponse } from 'next/server';

type ChainParam = 'base' | 'mantle' | 'linea' | 'monad';

// CANONICAL_* should point to COOKIE NFT contracts on each chain.
// You can wire them from your existing NEXT_PUBLIC_* envs.
const CANONICAL_ADDRESSES: Record<ChainParam, string> = {
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

// Etherscan V2 chain IDs
const ETHERSCAN_CHAINIDS: Record<ChainParam, string> = {
  base: '8453',   // Base mainnet
  mantle: '5000', // Mantle mainnet
  linea: '59144', // Linea mainnet
  monad: '143',
};

// One key for everything – from your Etherscan account
//const ETHERSCAN_API_KEY_ENV = 'ETHERSCAN_API_KEY';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') as ChainParam | null;
  const owner = searchParams.get('owner');

  if (!chain || !owner) {
    return NextResponse.json(
      { error: 'Missing chain or owner' },
      { status: 400 },
    );
  }

  const contract = CANONICAL_ADDRESSES[chain];
  const chainid = ETHERSCAN_CHAINIDS[chain];

  if (!contract || !chainid) {
    return NextResponse.json(
      { error: 'Unsupported chain or missing contract address' },
      { status: 400 },
    );
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: `Missing ${process.env.ETHERSCAN_API_KEY} env` },
      { status: 500 },
    );
  }

  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=${chainid}` +
    `&module=account` +
    `&action=tokennfttx` +
    `&contractaddress=${contract}` +
    `&address=${owner}` +
    `&page=1&offset=10000&sort=asc` +
    `&apikey=${apiKey}`;

  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  if (!json || json.status !== '1' || !Array.isArray(json.result)) {
    // No transfers or error – just return empty, and let UI fall back to manual input
    return NextResponse.json({ tokenIds: [] });
  }

  const lowerOwner = owner.toLowerCase();
  const balances = new Map<string, number>();

  for (const tx of json.result as any[]) {
    const tokenId = tx.tokenID ?? tx.tokenId;
    if (!tokenId) continue;

    const from = (tx.from || '').toLowerCase();
    const to = (tx.to || '').toLowerCase();

    if (to === lowerOwner) {
      balances.set(tokenId, (balances.get(tokenId) ?? 0) + 1);
    }
    if (from === lowerOwner) {
      balances.set(tokenId, (balances.get(tokenId) ?? 0) - 1);
    }
  }

  const tokenIds = [...balances.entries()]
    .filter(([, bal]) => bal > 0)
    .map(([id]) => Number(id))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  return NextResponse.json({ tokenIds });
}
