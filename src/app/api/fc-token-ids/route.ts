// src/app/api/fc-token-ids/route.ts
import { NextResponse } from 'next/server';
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
} from 'viem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChainParam = 'base' | 'mantle' | 'linea' | 'monad' | 'og';

const ERC721_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

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
};

const ETHERSCAN_CHAINIDS: Partial<Record<ChainParam, string>> = {
  base: '8453',
  mantle: '5000',
  linea: '59144',
  monad: '143',
};

const RPCS: Partial<Record<ChainParam, string>> = {
  base: process.env.NEXT_PUBLIC_RPC_HTTP_BASE,
  mantle: process.env.NEXT_PUBLIC_RPC_HTTP_MANTLE,
  linea: process.env.NEXT_PUBLIC_RPC_HTTP_LINEA,
  monad: process.env.NEXT_PUBLIC_RPC_HTTP_MONAD,
  og: process.env.NEXT_PUBLIC_RPC_HTTP_OG ?? process.env.OG_EVM_RPC_URL,
};

const CHAIN_IDS: Record<ChainParam, number> = {
  base: 8453,
  mantle: 5000,
  linea: 59144,
  monad: 143,
  og: Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16661),
};

type TokenIdsResponse = {
  ok: boolean;
  source: string;
  chain: ChainParam;
  contract: Address;
  tokenIds: number[];
  warnings: string[];
  error?: string;
};

function chainEnvKey(chain: ChainParam): string {
  return chain.toUpperCase();
}

function addWarning(warnings: string[], msg: string, error?: unknown) {
  const suffix =
    error instanceof Error
      ? `: ${error.message}`
      : error
        ? `: ${String(error)}`
        : '';
  const text = `${msg}${suffix}`;
  warnings.push(text);
  console.warn('[fc-token-ids]', text);
}

function makeChain(chain: ChainParam) {
  const rpc = RPCS[chain] || '';

  return defineChain({
    id: CHAIN_IDS[chain],
    name: chain === 'og' ? '0G' : chain.toUpperCase(),
    nativeCurrency: {
      name:
        chain === 'mantle'
          ? 'Mantle'
          : chain === 'monad'
            ? 'Monad'
            : chain === 'og'
              ? '0G'
              : 'Ether',
      symbol:
        chain === 'mantle'
          ? 'MNT'
          : chain === 'monad'
            ? 'MON'
            : chain === 'og'
              ? 'OG'
              : 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [rpc] },
      public: { http: [rpc] },
    },
  });
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

    if (typeof maybe === 'string') return maybe.toLowerCase();
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
    item?.token_id ??
    item?.tokenID ??
    item?.tokenId ??
    item?.erc721TokenId ??
    item?.token_id_hex ??
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

function tokenIdsFromOwnerItems(items: any[], contract: Address): number[] {
  const lowerContract = contract.toLowerCase();
  const ids = new Set<number>();

  for (const item of items) {
    const tokenAddr = normalizeTokenAddress(item);

    if (tokenAddr && tokenAddr !== lowerContract) continue;

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

function tokenIdsFromTransferItems(items: any[], owner: Address, contract: Address): number[] {
  const lowerOwner = owner.toLowerCase();
  const lowerContract = contract.toLowerCase();

  const balances = new Map<string, number>();

  for (const item of items) {
    const tokenAddr = normalizeTokenAddress(item);

    if (tokenAddr && tokenAddr !== lowerContract) continue;

    const tokenId = normalizeTokenId(item);
    if (!tokenId) continue;

    const from = normalizeFrom(item);
    const to = normalizeTo(item);

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

function getOwnerNftsApiTemplate(chain: ChainParam): string | undefined {
  const key = chainEnvKey(chain);

  return (
    process.env[`${key}_OWNER_NFTS_API_TEMPLATE`] ||
    process.env[`NEXT_PUBLIC_${key}_OWNER_NFTS_API_TEMPLATE`] ||
    undefined
  );
}

function getTransfersApiTemplate(chain: ChainParam): string | undefined {
  const key = chainEnvKey(chain);

  return (
    process.env[`${key}_NFT_TRANSFERS_API_TEMPLATE`] ||
    process.env[`NEXT_PUBLIC_${key}_NFT_TRANSFERS_API_TEMPLATE`] ||
    undefined
  );
}

function applyTemplate(
  template: string,
  params: {
    owner: Address;
    address: Address;
    wallet: Address;
    contract: Address;
    token: Address;
  },
): string {
  return template
    .replaceAll('{owner}', params.owner)
    .replaceAll('{address}', params.address)
    .replaceAll('{wallet}', params.wallet)
    .replaceAll('{contract}', params.contract)
    .replaceAll('{contractAddress}', params.contract)
    .replaceAll('{contractaddress}', params.contract)
    .replaceAll('{token}', params.token);
}

async function fetchJson(url: string): Promise<any> {
  const timeoutMs = Number(process.env.EXPLORER_FETCH_TIMEOUT_MS || '8000');
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
        `Explorer returned HTML, not JSON. Wrong API endpoint: ${url}`,
      );
    }

    return JSON.parse(trimmed);
  } finally {
    clearTimeout(id);
  }
}

async function getTokenIdsViaEnumerable(params: {
  chain: ChainParam;
  owner: Address;
  contract: Address;
}): Promise<number[]> {
  const { chain, owner, contract } = params;

  const rpc = RPCS[chain];
  if (!rpc) return [];

  const client = createPublicClient({
    chain: makeChain(chain),
    transport: http(rpc),
  });

  const balance = (await (client as any).readContract({
    address: contract,
    abi: ERC721_ABI as any,
    functionName: 'balanceOf',
    args: [owner],
    authorizationList: undefined as any,
  })) as bigint;

  if (balance <= 0n) return [];

  const maxReads = BigInt(process.env.MAX_ENUMERABLE_NFT_READS || '200');
  const limit = balance > maxReads ? maxReads : balance;
  const ids: number[] = [];

  for (let i = 0n; i < limit; i += 1n) {
    const tokenId = (await (client as any).readContract({
      address: contract,
      abi: ERC721_ABI as any,
      functionName: 'tokenOfOwnerByIndex',
      args: [owner, i],
      authorizationList: undefined as any,
    })) as bigint;

    const n = Number(tokenId);
    if (Number.isFinite(n)) ids.push(n);
  }

  return ids.sort((a, b) => a - b);
}

async function getTokenIdsViaExplorerTemplate(params: {
  chain: ChainParam;
  owner: Address;
  contract: Address;
  warnings: string[];
}): Promise<{ source: string; ids: number[] } | null> {
  const { chain, owner, contract, warnings } = params;

  const ownerTemplate = getOwnerNftsApiTemplate(chain);

  if (ownerTemplate) {
    try {
      const url = applyTemplate(ownerTemplate, {
        owner,
        address: owner,
        wallet: owner,
        contract,
        token: contract,
      });

      const json = await fetchJson(url);
      const ids = tokenIdsFromOwnerItems(firstArrayFromJson(json), contract);

      return { source: `${chain}-owner-nfts-template`, ids };
    } catch (error) {
      addWarning(warnings, `${chain} owner NFT template failed`, error);
    }
  }

  const transfersTemplate = getTransfersApiTemplate(chain);

  if (transfersTemplate) {
    try {
      const url = applyTemplate(transfersTemplate, {
        owner,
        address: owner,
        wallet: owner,
        contract,
        token: contract,
      });

      const json = await fetchJson(url);
      const ids = tokenIdsFromTransferItems(firstArrayFromJson(json), owner, contract);

      return { source: `${chain}-transfers-template`, ids };
    } catch (error) {
      addWarning(warnings, `${chain} NFT transfers template failed`, error);
    }
  }

  return null;
}

async function getTokenIdsViaEtherscan(params: {
  chain: Exclude<ChainParam, 'og'>;
  owner: Address;
  contract: Address;
}): Promise<number[]> {
  const { chain, owner, contract } = params;

  const chainid = ETHERSCAN_CHAINIDS[chain];
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!chainid || !apiKey) return [];

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

  if (!json || json.status !== '1' || !Array.isArray(json.result)) return [];

  return tokenIdsFromTransferItems(json.result, owner, contract);
}

function rpcLogsEnabled(chain: ChainParam): boolean {
  const key = chainEnvKey(chain);
  return process.env[`NFT_IDS_ENABLE_RPC_LOGS_${key}`] === 'true';
}

function getScanFromBlock(chain: ChainParam): bigint {
  const key = chainEnvKey(chain);

  const raw =
    process.env[`NFT_SCAN_FROM_BLOCK_${key}`] ??
    process.env[`NEXT_PUBLIC_COOKIE_START_BLOCK_${key}`] ??
    process.env.NEXT_PUBLIC_COOKIE_START_BLOCK ??
    '0';

  return BigInt(raw);
}

function getBlockStep(chain: ChainParam): bigint {
  const key = chainEnvKey(chain);

  const raw =
    process.env[`NFT_SCAN_BLOCK_STEP_${key}`] ??
    process.env.NFT_SCAN_BLOCK_STEP ??
    (chain === 'monad' ? '10' : '50000');

  const step = BigInt(raw);
  return step > 0n ? step : 10n;
}

async function getTokenIdsViaRpcLogs(params: {
  chain: ChainParam;
  owner: Address;
  contract: Address;
  warnings: string[];
}): Promise<number[]> {
  const { chain, owner, contract, warnings } = params;

  if (!rpcLogsEnabled(chain)) return [];

  const rpc = RPCS[chain];
  if (!rpc) return [];

  const client = createPublicClient({
    chain: makeChain(chain),
    transport: http(rpc),
  });

  const fromBlock = getScanFromBlock(chain);
  const latestBlock = await client.getBlockNumber();
  const step = getBlockStep(chain);
  const maxRequests = Number(
    process.env[`NFT_IDS_MAX_RPC_LOG_REQUESTS_${chainEnvKey(chain)}`] ||
      '300',
  );

  const candidates = new Set<bigint>();
  let requests = 0;

  for (let start = fromBlock; start <= latestBlock; start += step + 1n) {
    if (requests >= maxRequests) {
      addWarning(warnings, `${chain} RPC log scan stopped at maxRequests=${maxRequests}`);
      break;
    }

    requests += 1;

    const end = start + step > latestBlock ? latestBlock : start + step;

    const [incoming, outgoing] = await Promise.all([
      client.getContractEvents({
        address: contract,
        abi: ERC721_ABI,
        eventName: 'Transfer',
        args: { to: owner },
        fromBlock: start,
        toBlock: end,
      }),
      client.getContractEvents({
        address: contract,
        abi: ERC721_ABI,
        eventName: 'Transfer',
        args: { from: owner },
        fromBlock: start,
        toBlock: end,
      }),
    ]);

    for (const log of incoming) {
      if (log.args.tokenId !== undefined) candidates.add(log.args.tokenId);
    }

    for (const log of outgoing) {
      if (log.args.tokenId !== undefined) candidates.add(log.args.tokenId);
    }
  }

  const owned: number[] = [];

  for (const tokenId of candidates) {
    try {
      const currentOwner = (await (client as any).readContract({
        address: contract,
        abi: ERC721_ABI as any,
        functionName: 'ownerOf',
        args: [tokenId],
        authorizationList: undefined as any,
      })) as Address;

      if (currentOwner.toLowerCase() === owner.toLowerCase()) {
        const n = Number(tokenId);
        if (Number.isFinite(n)) owned.push(n);
      }
    } catch {
      // skip
    }
  }

  return owned.sort((a, b) => a - b);
}

function makeResponse(params: Omit<TokenIdsResponse, 'ok'> & { ok?: boolean }) {
  return NextResponse.json({
    ok: params.ok ?? true,
    source: params.source,
    chain: params.chain,
    contract: params.contract,
    tokenIds: params.tokenIds,
    warnings: params.warnings,
    ...(params.error ? { error: params.error } : {}),
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const chain = searchParams.get('chain') as ChainParam | null;
  const ownerRaw = searchParams.get('owner');
  const contractOverride = searchParams.get('contract');

  if (!chain || !ownerRaw) {
    return NextResponse.json({ error: 'Missing chain or owner' }, { status: 400 });
  }

  if (!['base', 'mantle', 'linea', 'monad', 'og'].includes(chain)) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
  }

  if (!isAddress(ownerRaw)) {
    return NextResponse.json({ error: 'Invalid owner address' }, { status: 400 });
  }

  const contractRaw = contractOverride || CANONICAL_ADDRESSES[chain];

  if (!contractRaw || !isAddress(contractRaw)) {
    return NextResponse.json(
      { error: `Missing or invalid ERC721 contract address for ${chain}` },
      { status: 400 },
    );
  }

  const owner = getAddress(ownerRaw);
  const contract = getAddress(contractRaw);
  const warnings: string[] = [];

  // 0. Contract override safety.
  // If bridge/page sends adapter address as contract, this API cannot work.
  // It must receive the NFT/ERC721 source token address.
  // Logs showed one bad call with 0x3DD... returning no balanceOf data.
  const sourceHint =
    chain === 'og'
      ? 'For 0G, contract must be NEXT_PUBLIC_CANONICAL_ERC721_OG, not NEXT_PUBLIC_ADAPTER_OG.'
      : '';

  // 1. ERC721Enumerable. Fast when supported. Logs show your 0G NFT has balanceOf
  // but tokenOfOwnerByIndex reverts, so this will fall through.
  try {
    const enumerableIds = await getTokenIdsViaEnumerable({ chain, owner, contract });

    if (enumerableIds.length > 0) {
      return makeResponse({
        source: 'erc721-enumerable',
        chain,
        contract,
        tokenIds: enumerableIds,
        warnings,
      });
    }
  } catch (error) {
    addWarning(warnings, `${chain} ERC721Enumerable lookup failed`, error);
  }

  // 2. Explorer/Open API template. This is mandatory for 0G if NFT is not ERC721Enumerable
  // and RPC logs are not enabled.
  const templated = await getTokenIdsViaExplorerTemplate({
    chain,
    owner,
    contract,
    warnings,
  });

  if (templated) {
    return makeResponse({
      source: templated.source,
      chain,
      contract,
      tokenIds: templated.ids,
      warnings,
    });
  }

  // 3. Etherscan-compatible chains.
  if (chain !== 'og') {
    const ids = await getTokenIdsViaEtherscan({ chain, owner, contract });

    if (ids.length > 0) {
      return makeResponse({
        source: 'etherscan',
        chain,
        contract,
        tokenIds: ids,
        warnings,
      });
    }
  }

  // 4. Optional RPC logs. Disabled by default for Monad/0G unless explicitly enabled.
  const rpcIds = await getTokenIdsViaRpcLogs({
    chain,
    owner,
    contract,
    warnings,
  });

  if (rpcIds.length > 0) {
    return makeResponse({
      source: 'rpc-logs',
      chain,
      contract,
      tokenIds: rpcIds,
      warnings,
    });
  }

  const missingTemplate =
    chain === 'og'
      ? `0G NFT is not ERC721Enumerable and no OG_OWNER_NFTS_API_TEMPLATE / OG_NFT_TRANSFERS_API_TEMPLATE is configured. ${sourceHint}`
      : `No token IDs found for ${chain}.`;

  addWarning(warnings, missingTemplate);

  return makeResponse({
    ok: true,
    source: 'empty',
    chain,
    contract,
    tokenIds: [],
    warnings,
  });
}
