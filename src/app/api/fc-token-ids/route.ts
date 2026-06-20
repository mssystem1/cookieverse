// src/app/api/fc-token-ids/route.ts
import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChainParam = 'base' | 'mantle' | 'linea' | 'monad' | 'og' | 'xlayer' | 'arbitrum';

/**
 * IMPORTANT
 *
 * This restores the original working behavior for:
 * - base
 * - mantle
 * - linea
 * - monad
 *
 * Those chains use only Etherscan V2 `account/tokennfttx` and return the old simple shape:
 *   { tokenIds: number[] }
 *
 * Do not run ERC721Enumerable reads for those chains.
 * Do not use the `contract` query override for those chains.
 *
 * 0G is the only special chain here because it is not covered by Etherscan V2.
 * For 0G, configure a real JSON endpoint from https://chainscan.0g.ai/open/doc:
 *
 *   OG_OWNER_NFTS_API_TEMPLATE=...
 *   or
 *   OG_NFT_TRANSFERS_API_TEMPLATE=...
 *
 * Supported placeholders:
 *   {owner}
 *   {address}
 *   {wallet}
 *   {contract}
 *   {contractAddress}
 *   {contractaddress}
 *   {token}
 */

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
  og:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_OG ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG ??
    '',
  xlayer:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_XLAYER ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER ??
    '',
  arbitrum:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_ARBITRUM ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_ARBITRUM ??
    '',
};

const ETHERSCAN_CHAINIDS: Record<Exclude<ChainParam, 'og' | 'xlayer'>, string> = {
  base: '8453',
  mantle: '5000',
  linea: '59144',
  monad: '143',
  arbitrum: '42161',
};

function isSupportedChain(value: string | null): value is ChainParam {
  return (
    value === 'base' ||
    value === 'mantle' ||
    value === 'linea' ||
    value === 'monad' ||
    value === 'og' ||
    value === 'xlayer' ||
    value === 'arbitrum'
  );
}

function isHexAddress(value: string | null): value is `0x${string}` {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function normalizeAddressLike(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.toLowerCase();
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, any>;

    const maybe =
      obj.hash ??
      obj.address ??
      obj.address_hash ??
      obj.addressHash ??
      obj.value ??
      obj.id;

    if (typeof maybe === 'string') {
      return maybe.toLowerCase();
    }
  }

  return '';
}

function normalizeFrom(item: any): string {
  return normalizeAddressLike(
    item?.from ??
      item?.from_address ??
      item?.from_address_hash ??
      item?.fromAddress,
  );
}

function normalizeTo(item: any): string {
  return normalizeAddressLike(
    item?.to ??
      item?.to_address ??
      item?.to_address_hash ??
      item?.toAddress,
  );
}

function normalizeTokenAddress(item: any): string {
  return normalizeAddressLike(
    item?.token?.address ??
      item?.token?.hash ??
      item?.token?.address_hash ??
      item?.token?.addressHash ??
      item?.token_address ??
      item?.token_address_hash ??
      item?.contractAddress ??
      item?.contract_address ??
      item?.contract?.address ??
      item?.contract?.hash,
  );
}

function normalizeTokenId(item: any): string {
  const raw =
    item?.tokenID ??
    item?.tokenId ??
    item?.token_id ??
    item?.erc721TokenId ??
    item?.token_instance?.id ??
    item?.token_instance?.token_id ??
    item?.nft?.tokenId ??
    item?.id;

  if (typeof raw === 'bigint') return raw.toString();
  if (typeof raw === 'number') return String(raw);

  if (typeof raw === 'string') {
    if (raw.startsWith('0x')) return BigInt(raw).toString();
    return raw;
  }

  return '';
}

function firstArrayFromJson(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;

  const candidates = [
    json.items,
    json.result,
    json.data,
    json.data?.items,
    json.data?.result,
    json.data?.tokens,
    json.data?.nfts,
    json.tokens,
    json.nfts,
    json.ownedNfts,
    json.assets,
    json.transfers,
    json.result?.transfers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function tokenIdsFromOwnedNftItems(items: any[], contract: string): number[] {
  const lowerContract = contract.toLowerCase();
  const ids = new Set<number>();

  for (const item of items) {
    const tokenAddress = normalizeTokenAddress(item);

    if (tokenAddress && tokenAddress !== lowerContract) {
      continue;
    }

    const nested =
      item?.token_instances ??
      item?.instances ??
      item?.items ??
      item?.nfts ??
      item?.tokens;

    if (Array.isArray(nested)) {
      for (const inner of nested) {
        const id = Number(normalizeTokenId(inner));
        if (Number.isFinite(id)) ids.add(id);
      }
    }

    const id = Number(normalizeTokenId(item));
    if (Number.isFinite(id)) ids.add(id);
  }

  return [...ids].sort((a, b) => a - b);
}

function tokenIdsFromTransfers(items: any[], owner: string, contract: string): number[] {
  const lowerOwner = owner.toLowerCase();
  const lowerContract = contract.toLowerCase();

  const balances = new Map<string, number>();

  for (const tx of items) {
    const tokenAddress = normalizeTokenAddress(tx);

    if (tokenAddress && tokenAddress !== lowerContract) {
      continue;
    }

    const tokenId = normalizeTokenId(tx);
    if (!tokenId) continue;

    const from = normalizeFrom(tx);
    const to = normalizeTo(tx);

    if (to === lowerOwner) {
      balances.set(tokenId, (balances.get(tokenId) ?? 0) + 1);
    }

    if (from === lowerOwner) {
      balances.set(tokenId, (balances.get(tokenId) ?? 0) - 1);
    }
  }

  return [...balances.entries()]
    .filter(([, bal]) => bal > 0)
    .map(([id]) => Number(id))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function applyTemplate(
  template: string,
  params: {
    owner: string;
    contract: string;
  },
): string {
  return template
    .replaceAll('{owner}', params.owner)
    .replaceAll('{address}', params.owner)
    .replaceAll('{wallet}', params.owner)
    .replaceAll('{contract}', params.contract)
    .replaceAll('{contractAddress}', params.contract)
    .replaceAll('{contractaddress}', params.contract)
    .replaceAll('{token}', params.contract);
}

async function fetchJson(url: string): Promise<any> {
  const timeoutMs = Number(process.env.EXPLORER_FETCH_TIMEOUT_MS || '10000');
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Cookieverse/1.0',
      },
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
    }

    const trimmed = text.trim();

    if (!trimmed) return null;

    if (trimmed.startsWith('<')) {
      throw new Error(
        `Expected JSON but got HTML from ${url}. Use the real JSON endpoint from https://chainscan.0g.ai/open/doc`,
      );
    }

    return JSON.parse(trimmed);
  } finally {
    clearTimeout(id);
  }
}

const OKX_XLAYER_API_BASE_URL = (
  process.env.OKX_XLAYER_API_BASE_URL || 'https://www.okx.com'
).replace(/\/+$/, '');

const OKX_XLAYER_API_KEY = process.env.OKX_XLAYER_API_KEY || '';
const OKX_XLAYER_API_SECRET = process.env.OKX_XLAYER_API_SECRET || '';
const OKX_XLAYER_API_PASSPHRASE = process.env.OKX_XLAYER_API_PASSPHRASE || '';

function assertOkxXLayerAuthEnv() {
  const missing: string[] = [];

  if (!OKX_XLAYER_API_KEY) missing.push('OKX_XLAYER_API_KEY');
  if (!OKX_XLAYER_API_SECRET) missing.push('OKX_XLAYER_API_SECRET');
  if (!OKX_XLAYER_API_PASSPHRASE) missing.push('OKX_XLAYER_API_PASSPHRASE');

  if (missing.length) {
    throw new Error(`Missing OKX X Layer API auth envs: ${missing.join(', ')}`);
  }
}

function buildOkxSignedHeaders(params: {
  method: 'GET' | 'POST';
  requestPathWithQuery: string;
  body?: string;
}): HeadersInit {
  assertOkxXLayerAuthEnv();

  const timestamp = new Date().toISOString();
  const body = params.body ?? '';
  const prehash = `${timestamp}${params.method}${params.requestPathWithQuery}${body}`;

const sign = createHmac('sha256', OKX_XLAYER_API_SECRET)
  .update(prehash)
  .digest('base64');

  return {
    accept: 'application/json, text/plain, */*',
    'user-agent': 'Cookieverse/1.0',
    'OK-ACCESS-KEY': OKX_XLAYER_API_KEY,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': OKX_XLAYER_API_PASSPHRASE,
    'OK-ACCESS-SIGN': sign,
  };
}

async function fetchOkxXLayerGet(
  pathname: string,
  params: Record<string, string>,
): Promise<any> {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'undefined' && value !== '') {
      searchParams.set(key, value);
    }
  }

  const requestPathWithQuery = `${pathname}?${searchParams.toString()}`;
  const url = `${OKX_XLAYER_API_BASE_URL}${requestPathWithQuery}`;

  const timeoutMs = Number(process.env.EXPLORER_FETCH_TIMEOUT_MS || '10000');
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      method: 'GET',
      headers: buildOkxSignedHeaders({
        method: 'GET',
        requestPathWithQuery,
      }),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`OKX X Layer API HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = text ? JSON.parse(text) : null;

    if (json?.code && json.code !== '0') {
      throw new Error(`OKX X Layer API error ${json.code}: ${json.msg || text.slice(0, 300)}`);
    }

    return json;
  } finally {
    clearTimeout(id);
  }
}

function okxDataPage(json: any): any {
  return Array.isArray(json?.data) ? json.data[0] : null;
}

function okxTotalPage(json: any): number {
  const page = okxDataPage(json);
  const raw = page?.totalPage ?? '1';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function okxTokenList(json: any): any[] {
  const page = okxDataPage(json);
  return Array.isArray(page?.tokenList) ? page.tokenList : [];
}

async function getXLayerTokenIdsViaOkxBalanceApi(
  owner: string,
  contract: string,
): Promise<number[]> {
  const tokenIds = new Set<number>();

  let page = 1;
  let totalPage = 1;

  do {
    const json = await fetchOkxXLayerGet('/api/v5/xlayer/address/token-balance', {
      chainShortName: 'xlayer',
      address: owner,
      protocolType: 'token_721',
      tokenContractAddress: contract,
      page: String(page),
      limit: '50',
    });

    totalPage = okxTotalPage(json);

    for (const item of okxTokenList(json)) {
      const tokenAddress = normalizeTokenAddress(item);
      if (tokenAddress && tokenAddress !== contract.toLowerCase()) continue;

      const id = Number(normalizeTokenId(item));
      if (Number.isFinite(id)) tokenIds.add(id);
    }

    page += 1;
  } while (page <= totalPage);

  return [...tokenIds].sort((a, b) => a - b);
}

async function getTokenIdsViaEtherscan(
  chain: Exclude<ChainParam, 'og' | 'xlayer'>,
  owner: string,
  contract: string,
): Promise<number[]> {
  const chainid = ETHERSCAN_CHAINIDS[chain];

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ETHERSCAN_API_KEY env');
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

  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => null);

  if (!json || json.status !== '1' || !Array.isArray(json.result)) {
    return [];
  }

  // Original working balance reconstruction logic.
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

  return [...balances.entries()]
    .filter(([, bal]) => bal > 0)
    .map(([id]) => Number(id))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

async function getOgTokenIds(owner: string, contract: string): Promise<{
  tokenIds: number[];
  source: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const ownerTemplate =
    process.env.OG_OWNER_NFTS_API_TEMPLATE ||
    process.env.NEXT_PUBLIC_OG_OWNER_NFTS_API_TEMPLATE ||
    '';

  const transfersTemplate =
    process.env.OG_NFT_TRANSFERS_API_TEMPLATE ||
    process.env.NEXT_PUBLIC_OG_NFT_TRANSFERS_API_TEMPLATE ||
    '';

  if (ownerTemplate) {
    try {
      const url = applyTemplate(ownerTemplate, { owner, contract });
      const json = await fetchJson(url);
      const tokenIds = tokenIdsFromOwnedNftItems(firstArrayFromJson(json), contract);

      return {
        tokenIds,
        source: '0g-owner-nfts-api',
        warnings,
      };
    } catch (error: any) {
      warnings.push(`0G owner NFT API failed: ${error?.message || String(error)}`);
    }
  }

  if (transfersTemplate) {
    try {
      const url = applyTemplate(transfersTemplate, { owner, contract });
      const json = await fetchJson(url);
      const tokenIds = tokenIdsFromTransfers(firstArrayFromJson(json), owner, contract);

      return {
        tokenIds,
        source: '0g-nft-transfers-api',
        warnings,
      };
    } catch (error: any) {
      warnings.push(`0G NFT transfers API failed: ${error?.message || String(error)}`);
    }
  }

  warnings.push(
    '0G NFT API template is not configured. Set OG_OWNER_NFTS_API_TEMPLATE or OG_NFT_TRANSFERS_API_TEMPLATE using the real JSON endpoint from https://chainscan.0g.ai/open/doc',
  );

  return {
    tokenIds: [],
    source: '0g-not-configured',
    warnings,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const chain = searchParams.get('chain');
  const owner = searchParams.get('owner');

  if (!isSupportedChain(chain) || !owner) {
    return NextResponse.json(
      { error: 'Missing or unsupported chain/owner' },
      { status: 400 },
    );
  }

  if (!isHexAddress(owner)) {
    return NextResponse.json(
      { error: 'Invalid owner address' },
      { status: 400 },
    );
  }

  /**
   * This is the key fix:
   *
   * For base/mantle/linea/monad, ignore ?contract=...
   * because the old working route always used CANONICAL_ADDRESSES[chain].
   *
   * Only 0G can use ?contract=... because 0G has adapter/source-route specifics.
   */
  const contract =
    chain === 'og'
      ? searchParams.get('contract') || CANONICAL_ADDRESSES.og
      : CANONICAL_ADDRESSES[chain];

  if (!contract || !isHexAddress(contract)) {
    return NextResponse.json(
      { error: `Unsupported chain or missing contract address for ${chain}` },
      { status: 400 },
    );
  }

  try {
    if (chain === 'og') {
      const result = await getOgTokenIds(owner, contract);

      return NextResponse.json({
        ok: true,
        chain,
        source: result.source,
        contract,
        tokenIds: result.tokenIds,
        warnings: result.warnings,
      });
    }

    if (chain === 'xlayer') {
      const tokenIds = await getXLayerTokenIdsViaOkxBalanceApi(owner, contract);

      return NextResponse.json({
        tokenIds,
        ok: true,
        chain,
        source: 'okx-xlayer-address-token-balance',
        contract,
      });
    }

    const tokenIds = await getTokenIdsViaEtherscan(chain, owner, contract);

    // Preserve old response shape for existing chains.
    return NextResponse.json({ tokenIds });
  } catch (error: any) {
    return NextResponse.json(
      {
        tokenIds: [],
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
