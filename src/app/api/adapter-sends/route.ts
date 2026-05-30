// src/app/api/adapter-sends/route.ts
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getAddress,
  isAddress,
  type Address,
} from 'viem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChainKey = 'base' | 'mantle' | 'linea' | 'monad' | 'og' | 'xlayer';

type ChainAdapterResult = {
  count: number;
  ok: boolean;
source:
  | 'etherscan'
  | 'alchemy'
  | 'chainscan-v2'
  | 'chainscan-old'
  | 'okx-xlayer-token-transaction-list'
  | 'disabled'
  | 'none';
};

const ZERO_RESULT: ChainAdapterResult = {
  count: 0,
  ok: false,
  source: 'none',
};

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
  og:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_OG ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG ??
    '',
  xlayer:
    process.env.NEXT_PUBLIC_CANONICAL_ERC721_XLAYER ??
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER ??
    '',
};

const ADAPTERS: Record<ChainKey, string | undefined> = {
  base: process.env.NEXT_PUBLIC_ADAPTER_BASE,
  mantle: process.env.NEXT_PUBLIC_ADAPTER_MANTLE,
  linea: process.env.NEXT_PUBLIC_ADAPTER_LINEA,
  monad: process.env.NEXT_PUBLIC_ADAPTER_MONAD,
  og: process.env.NEXT_PUBLIC_ADAPTER_OG,
  xlayer: process.env.NEXT_PUBLIC_ADAPTER_XLAYER,
};

const ETHERSCAN_CHAINIDS: Partial<Record<ChainKey, string>> = {
  base: '8453',
  mantle: '5000',
  linea: '59144',
  monad: '143',
};

const RPCS: Partial<Record<ChainKey, string>> = {
  base: process.env.NEXT_PUBLIC_RPC_HTTP_BASE,
  mantle: process.env.NEXT_PUBLIC_RPC_HTTP_MANTLE,
  linea: process.env.NEXT_PUBLIC_RPC_HTTP_LINEA,
  monad: process.env.NEXT_PUBLIC_RPC_HTTP_MONAD,
  og: process.env.NEXT_PUBLIC_RPC_HTTP_OG ?? process.env.OG_EVM_RPC_URL,
  xlayer: process.env.NEXT_PUBLIC_RPC_HTTP_XLAYER,
};

const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY_ENV ||
  process.env.ETHERSCAN_API_KEY ||
  process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
  '';

const OG_CHAINSCAN_BASES = (
  process.env.OG_CHAINSCAN_BASES ||
  process.env.NEXT_PUBLIC_OG_CHAINSCAN_BASES ||
  process.env.OG_CHAINSCAN_BASE ||
  process.env.NEXT_PUBLIC_OG_CHAINSCAN_BASE ||
  'https://chainscan.0g.ai'
)
  .split(',')
  .map((x) => x.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const FETCH_TIMEOUT_MS = Number(process.env.CHAINSCAN_FETCH_TIMEOUT_MS || '4500');
const CHAINSCAN_MAX_PAGES = Number(process.env.CHAINSCAN_MAX_PAGES || '15');

function isHexAddress(value: string | null): value is `0x${string}` {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      obj.value;

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
      item?.contract_address,
  );
}

function normalizeTxHash(item: any): string {
  const raw =
    item?.transaction_hash ??
    item?.tx_hash ??
    item?.hash ??
    item?.transactionHash;

  return typeof raw === 'string' ? raw.toLowerCase() : '';
}

function normalizeTokenId(item: any): string {
  const raw =
    item?.token_id ??
    item?.tokenID ??
    item?.tokenId ??
    item?.erc721TokenId ??
    item?.token_instance?.id ??
    item?.token_instance?.token_id ??
    item?.total?.token_id;

  if (typeof raw === 'bigint') return raw.toString();
  if (typeof raw === 'number') return String(raw);
  if (typeof raw === 'string') return raw;

  return '';
}

function toHexBlock(value: bigint | number | string): `0x${string}` {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value as `0x${string}`;
    return `0x${BigInt(value).toString(16)}`;
  }

  return `0x${BigInt(value).toString(16)}`;
}

async function fetchJsonWithTimeout(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });

    const text = await res.text().catch(() => '');

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    return text ? JSON.parse(text) : null;
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

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

function okxTransactionList(json: any): any[] {
  const page = okxDataPage(json);

  if (Array.isArray(page?.transactionList)) return page.transactionList;

  // Another X Layer endpoint uses transactionLists; this keeps parser resilient.
  if (Array.isArray(page?.transactionLists)) return page.transactionLists;

  return [];
}

async function postJsonWithTimeout(url: string, body: any, timeoutMs = FETCH_TIMEOUT_MS) {
  return fetchJsonWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

function chainScanNextPageParams(json: any): Record<string, string> | null {
  const params = json?.next_page_params;
  if (!params || typeof params !== 'object') return null;

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === null || typeof value === 'undefined') continue;
    out[key] = String(value);
  }

  return Object.keys(out).length > 0 ? out : null;
}

function parseOldExplorerTransfers(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json.result)) return json.result;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

function countUserToAdapterFromTransferItems(params: {
  chain: ChainKey;
  items: any[];
  user: Address;
  adapter: Address;
  contract: Address;
  source: ChainAdapterResult['source'];
}): ChainAdapterResult {
  const { chain, items, user, adapter, contract, source } = params;

  const lowerUser = user.toLowerCase();
  const lowerAdapter = adapter.toLowerCase();
  const lowerContract = contract.toLowerCase();

  const hashes = new Set<string>();

  for (const item of items) {
    const tokenAddress = normalizeTokenAddress(item);

    if (tokenAddress && tokenAddress !== lowerContract) {
      continue;
    }

    const from = normalizeFrom(item);
    const to = normalizeTo(item);

    if (from === lowerUser && to === lowerAdapter) {
      const hash = normalizeTxHash(item);
      const tokenId = normalizeTokenId(item);
      hashes.add(hash || `${item?.block_number ?? item?.blockNumber ?? ''}:${tokenId}`);
    }
  }

  console.log(
    '[adapter-sends]',
    chain,
    source,
    'items:',
    items.length,
    'user->adapter txs:',
    hashes.size,
  );

  return {
    count: hashes.size,
    ok: true,
    source,
  };
}

async function fetchOgAddressTokenTransfersV2(params: {
  user: Address;
  contract: Address;
}): Promise<any[]> {
  const { user, contract } = params;

  let lastError: any = null;

  for (const base of OG_CHAINSCAN_BASES) {
    let nextPageParams: Record<string, string> | null = null;
    const items: any[] = [];

    try {
      for (let page = 0; page < CHAINSCAN_MAX_PAGES; page += 1) {
        const url = new URL(`${base}/api/v2/addresses/${user}/token-transfers`);
        url.searchParams.set('type', 'ERC-721');
        url.searchParams.set('token', contract);

        if (nextPageParams) {
          for (const [key, value] of Object.entries(nextPageParams)) {
            url.searchParams.set(key, value);
          }
        }

        const json = await fetchJsonWithTimeout(url.toString());
        const pageItems = Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.result)
            ? json.result
            : Array.isArray(json)
              ? json
              : [];

        items.push(...pageItems);

        nextPageParams = chainScanNextPageParams(json);
        if (!nextPageParams) break;
      }

      return items;
    } catch (error) {
      lastError = error;
      console.warn('[adapter-sends] 0G ChainScan v2 failed for base', base, error);
    }
  }

  throw lastError ?? new Error('0G ChainScan v2 failed');
}

async function fetchOgAddressTokenTransfersOldApi(params: {
  user: Address;
  contract: Address;
}): Promise<any[]> {
  const { user, contract } = params;
  let lastError: any = null;

  for (const base of OG_CHAINSCAN_BASES) {
    try {
      const url = new URL(`${base}/api`);
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'tokennfttx');
      url.searchParams.set('contractaddress', contract);
      url.searchParams.set('address', user);
      url.searchParams.set('page', '1');
      url.searchParams.set('offset', '10000');
      url.searchParams.set('sort', 'asc');

      const json = await fetchJsonWithTimeout(url.toString());
      const items = parseOldExplorerTransfers(json);

      return items;
    } catch (error) {
      lastError = error;
      console.warn('[adapter-sends] 0G ChainScan old API failed for base', base, error);
    }
  }

  throw lastError ?? new Error('0G ChainScan old API failed');
}

async function fetchOgAdapterSends(user: Address): Promise<ChainAdapterResult> {
  const contractRaw = CANONICAL_ADDRESSES.og;
  const adapterRaw = ADAPTERS.og;

  if (!contractRaw || !adapterRaw || !isAddress(contractRaw) || !isAddress(adapterRaw)) {
    console.warn('[adapter-sends] og missing/invalid config', {
      contract: contractRaw,
      adapter: adapterRaw,
    });

    return ZERO_RESULT;
  }

  const contract = getAddress(contractRaw);
  const adapter = getAddress(adapterRaw);

  try {
    const items = await fetchOgAddressTokenTransfersV2({ user, contract });

    return countUserToAdapterFromTransferItems({
      chain: 'og',
      items,
      user,
      adapter,
      contract,
      source: 'chainscan-v2',
    });
  } catch {
    // Continue to old API fallback.
  }

  try {
    const items = await fetchOgAddressTokenTransfersOldApi({ user, contract });

    return countUserToAdapterFromTransferItems({
      chain: 'og',
      items,
      user,
      adapter,
      contract,
      source: 'chainscan-old',
    });
  } catch (error) {
    console.error('[adapter-sends] og all ChainScan strategies failed', error);
    return ZERO_RESULT;
  }
}

async function fetchEtherscanNFTTx(url: string): Promise<{ ok: boolean; json: any | null }> {
  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      console.warn('[adapter-sends] HTTP error', res.status, res.statusText);
      return { ok: false, json: null };
    }

    const json: any = await res.json().catch(() => null);
    if (!json) return { ok: false, json: null };

    return { ok: true, json };
  } catch (error) {
    console.error('[adapter-sends] fetch error', error);
    return { ok: false, json: null };
  }
}

function extractUserToAdapterCountFromEtherscanJson(
  chain: ChainKey,
  json: any,
  user: Address,
  adapter: Address,
): ChainAdapterResult {
  const transfers = Array.isArray(json.result) ? (json.result as any[]) : [];
  const lowerUser = user.toLowerCase();
  const lowerAdapter = adapter.toLowerCase();

  const hashes = new Set<string>();

  for (const tx of transfers) {
    const from = (tx.from || '').toString().toLowerCase();
    const to = (tx.to || '').toString().toLowerCase();
    const isError = (tx.isError ?? tx.txreceipt_status ?? '0').toString();

    if (from === lowerUser && to === lowerAdapter && isError !== '1') {
      const hash = tx.hash || tx.transactionHash;
      const tokenId = tx.tokenID ?? tx.tokenId ?? '';
      hashes.add(typeof hash === 'string' && hash ? hash.toLowerCase() : `${tx.blockNumber ?? ''}:${tokenId}`);
    }
  }

  console.log(
    '[adapter-sends]',
    chain,
    'etherscan transfers:',
    transfers.length,
    'user->adapter txs:',
    hashes.size,
  );

  return { count: hashes.size, ok: true, source: 'etherscan' };
}

async function fetchAdapterSendsViaEtherscan(
  chain: Exclude<ChainKey, 'og' | 'xlayer'>,
  user: Address,
): Promise<ChainAdapterResult> {
  const apiKey = ETHERSCAN_API_KEY;
  const contractRaw = CANONICAL_ADDRESSES[chain];
  const adapterRaw = ADAPTERS[chain];
  const chainid = ETHERSCAN_CHAINIDS[chain];

  if (!apiKey || !contractRaw || !adapterRaw || !chainid) {
    console.warn('[adapter-sends]', chain, 'missing etherscan config', {
      hasApiKey: !!apiKey,
      contract: contractRaw,
      adapter: adapterRaw,
      chainid,
    });

    return ZERO_RESULT;
  }

  if (!isAddress(contractRaw) || !isAddress(adapterRaw)) {
    console.warn('[adapter-sends]', chain, 'invalid contract/adapter address', {
      contract: contractRaw,
      adapter: adapterRaw,
    });

    return ZERO_RESULT;
  }

  const contract = getAddress(contractRaw);
  const adapter = getAddress(adapterRaw);

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

  if (!ok || !json) return ZERO_RESULT;

  if (json.status !== '1' || !Array.isArray(json.result)) {
    const resultStr = typeof json.result === 'string' ? json.result : '';

    console.warn(
      '[adapter-sends]',
      chain,
      'non-success etherscan status:',
      json.status,
      json.message,
      resultStr,
    );

    if (resultStr.includes('No transactions found')) {
      return { count: 0, ok: true, source: 'etherscan' };
    }

    return ZERO_RESULT;
  }

  return extractUserToAdapterCountFromEtherscanJson(chain, json, user, adapter);
}

async function fetchBaseAdapterSendsWithRetry(user: Address): Promise<ChainAdapterResult> {
  const start = Date.now();
  const maxDurationMs = 5_000;
  const intervalMs = 500;

  while (Date.now() - start < maxDurationMs) {
    const result = await fetchAdapterSendsViaEtherscan('base', user);
    if (result.ok) return result;
    await sleep(intervalMs);
  }

  console.warn('[adapter-sends] base etherscan timeout after retries');
  return ZERO_RESULT;
}

function getAlchemyFromBlock(chain: ChainKey): `0x${string}` {
  const key = chain.toUpperCase();

  const raw =
    process.env[`ADAPTER_SENDS_FROM_BLOCK_${key}`] ??
    process.env[`NFT_SCAN_FROM_BLOCK_${key}`] ??
    process.env[`NEXT_PUBLIC_COOKIE_START_BLOCK_${key}`] ??
    process.env.NEXT_PUBLIC_COOKIE_START_BLOCK ??
    '0';

  return toHexBlock(raw);
}

async function fetchAdapterSendsViaAlchemy(
  chain: Exclude<ChainKey, 'og' | 'xlayer'>,
  user: Address,
): Promise<ChainAdapterResult> {
  const rpc = RPCS[chain];
  const contractRaw = CANONICAL_ADDRESSES[chain];
  const adapterRaw = ADAPTERS[chain];

  if (!rpc || !contractRaw || !adapterRaw || !isAddress(contractRaw) || !isAddress(adapterRaw)) {
    return ZERO_RESULT;
  }

  const contract = getAddress(contractRaw);
  const adapter = getAddress(adapterRaw);

  const hashes = new Set<string>();
  let pageKey: string | undefined;

  try {
    for (let page = 0; page < 20; page += 1) {
      const transferParams: any = {
        fromBlock: getAlchemyFromBlock(chain),
        toBlock: 'latest',
        fromAddress: user,
        toAddress: adapter,
        contractAddresses: [contract],
        category: ['erc721'],
        withMetadata: false,
        excludeZeroValue: false,
        maxCount: '0x3e8',
      };

      if (pageKey) transferParams.pageKey = pageKey;

      const json = await postJsonWithTimeout(rpc, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'alchemy_getAssetTransfers',
        params: [transferParams],
      }, 10_000);

      if (json?.error) {
        throw new Error(JSON.stringify(json.error));
      }

      const transfers = Array.isArray(json?.result?.transfers)
        ? json.result.transfers
        : [];

      for (const tx of transfers) {
        const hash = tx.hash || tx.transactionHash;
        if (typeof hash === 'string' && hash) {
          hashes.add(hash.toLowerCase());
        }
      }

      pageKey = json?.result?.pageKey;
      if (!pageKey) break;
    }

    console.log('[adapter-sends]', chain, 'alchemy user->adapter txs:', hashes.size);

    return {
      count: hashes.size,
      ok: true,
      source: 'alchemy',
    };
  } catch (error) {
    console.warn('[adapter-sends]', chain, 'alchemy_getAssetTransfers failed', error);
    return ZERO_RESULT;
  }
}

async function fetchXLayerAdapterSendsViaOkxApi(
  user: Address,
): Promise<ChainAdapterResult> {
  const contractRaw = CANONICAL_ADDRESSES.xlayer;
  const adapterRaw = ADAPTERS.xlayer;

  if (!contractRaw || !adapterRaw || !isAddress(contractRaw) || !isAddress(adapterRaw)) {
    console.warn('[adapter-sends] xlayer missing/invalid config', {
      contract: contractRaw,
      adapter: adapterRaw,
    });

    return ZERO_RESULT;
  }

  const contract = getAddress(contractRaw);
  const adapter = getAddress(adapterRaw);

  const hashes = new Set<string>();

  try {
    let page = 1;
    let totalPage = 1;

    do {
      const json = await fetchOkxXLayerGet('/api/v5/xlayer/address/token-transaction-list', {
        chainShortName: 'xlayer',
        address: user,
        protocolType: 'token_721',
        tokenContractAddress: contract,
        isFromOrTo: 'from',
        page: String(page),
        limit: '50',
      });

      totalPage = okxTotalPage(json);

      const result = countUserToAdapterFromTransferItems({
        chain: 'xlayer',
        items: okxTransactionList(json),
        user,
        adapter,
        contract,
        source: 'okx-xlayer-token-transaction-list',
      });

      // countUserToAdapterFromTransferItems returns only count, so re-count hashes here
      // to dedupe across pages.
      for (const item of okxTransactionList(json)) {
        const tokenAddress = normalizeTokenAddress(item);
        if (tokenAddress && tokenAddress !== contract.toLowerCase()) continue;

        const from = normalizeFrom(item);
        const to = normalizeTo(item);

        if (from === user.toLowerCase() && to === adapter.toLowerCase()) {
          const hash = normalizeTxHash(item);
          const tokenId = normalizeTokenId(item);
          hashes.add(hash || `${item?.height ?? item?.blockNumber ?? ''}:${tokenId}`);
        }
      }

      page += 1;
    } while (page <= totalPage);

    console.log(
      '[adapter-sends] xlayer okx token-transaction-list user->adapter txs:',
      hashes.size,
    );

    return {
      count: hashes.size,
      ok: true,
      source: 'okx-xlayer-token-transaction-list',
    };
  } catch (error) {
    console.error('[adapter-sends] xlayer OKX token-transaction-list failed', error);
    return ZERO_RESULT;
  }
}

async function fetchChainAdapterSends(
  chain: ChainKey,
  user: Address,
): Promise<ChainAdapterResult> {
  if (chain === 'og') {
    return fetchOgAdapterSends(user);
  }
  
  if (chain === 'xlayer') {
    return fetchXLayerAdapterSendsViaOkxApi(user);
  }

  // Monad: never use eth_getLogs on free Alchemy plan.
  // Use Alchemy enhanced method first, then Etherscan as fallback.
  if (chain === 'monad') {
    const alchemy = await fetchAdapterSendsViaAlchemy(chain, user);
    if (alchemy.ok) return alchemy;

    return fetchAdapterSendsViaEtherscan(chain, user);
  }

  if (chain === 'base') {
    const base = await fetchBaseAdapterSendsWithRetry(user);
    if (base.ok) return base;

    const alchemy = await fetchAdapterSendsViaAlchemy(chain, user);
    if (alchemy.ok) return alchemy;

    return ZERO_RESULT;
  }

  const etherscan = await fetchAdapterSendsViaEtherscan(chain, user);
  if (etherscan.ok) return etherscan;

  const alchemy = await fetchAdapterSendsViaAlchemy(chain, user);
  if (alchemy.ok) return alchemy;

  return ZERO_RESULT;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!isHexAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid or missing address' },
      { status: 400 },
    );
  }

  const user = getAddress(address);

const [base, mantle, linea, monad, og, xlayer] = await Promise.all([
  fetchChainAdapterSends('base', user),
  fetchChainAdapterSends('mantle', user),
  fetchChainAdapterSends('linea', user),
  fetchChainAdapterSends('monad', user),
  fetchChainAdapterSends('og', user),
  fetchChainAdapterSends('xlayer', user),
]);

  return NextResponse.json({
    address: user.toLowerCase(),
    byChain: {
      base,
      mantle,
      linea,
      monad,
      og,
      xlayer,
    },
  });
}
