'use client';

import * as React from 'react';
import { parseAbi, type Address } from 'viem';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from 'wagmi';

import { usePathname } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';

import { useAppMode } from '../../hooks/useAppMode'

// ─────────────────────────────────────────────────────────────────────────────
// Chain & LayerZero config (matches your .env and src/lib/chain.ts)
// ─────────────────────────────────────────────────────────────────────────────

const CHAIN_IDS = {
  base: 8453,
  mantle: 5000,
  linea: 59144,
  monad: 143,
  og: Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16661),
} as const;

const LZ_EIDS = {
  base: 30184,
  mantle: 30181,
  linea: 30183,
  monad: 30390,
  og: Number(process.env.NEXT_PUBLIC_LZ_EID_OG || 0),
} as const;

type ChainKey = keyof typeof CHAIN_IDS;

type AnyPublicClient = any;
type AnyWalletClient = any;

const chainIdToChainKey = (chainId?: number | null): ChainKey | null => {
  if (!chainId) return null;
  switch (chainId) {
    case CHAIN_IDS.base:
      return 'base';
    case CHAIN_IDS.mantle:
      return 'mantle';
    case CHAIN_IDS.linea:
      return 'linea';
    case CHAIN_IDS.monad:
      return 'monad';
    case CHAIN_IDS.og:
      return 'og';
    default:
      return null;
  }
};

const chainLabel = (chain: ChainKey): string => {
  switch (chain) {
    case 'base':
      return 'Base';
    case 'mantle':
      return 'Mantle';
    case 'linea':
      return 'Linea';
    case 'monad':
      return 'Monad';
    case 'og':
      return '0G';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Env-based addresses
// ─────────────────────────────────────────────────────────────────────────────

const CANONICAL_BASE =
  (process.env.NEXT_PUBLIC_CANONICAL_ERC721 ||
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE) as Address;

const CANONICAL_LINEA =
  (process.env.NEXT_PUBLIC_CANONICAL_ERC721_LINEA ||
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA) as Address;
    
const CANONICAL_MANTLE =
  (process.env.NEXT_PUBLIC_CANONICAL_ERC721_MANTLE ||
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE) as Address;    

const CANONICAL_MONAD =
  (process.env.NEXT_PUBLIC_CANONICAL_ERC721_MONAD ||
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS) as Address;

const CANONICAL_OG =
  (process.env.NEXT_PUBLIC_CANONICAL_ERC721_OG ||
    process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG) as Address;

const ADAPTER_BASE = process.env.NEXT_PUBLIC_ADAPTER_BASE as Address;
const ADAPTER_MANTLE = process.env.NEXT_PUBLIC_ADAPTER_MANTLE as Address;
const ADAPTER_LINEA = process.env.NEXT_PUBLIC_ADAPTER_LINEA as Address;
const ADAPTER_MONAD = process.env.NEXT_PUBLIC_ADAPTER_MONAD as Address;
const ADAPTER_OG = process.env.NEXT_PUBLIC_ADAPTER_OG as Address;

const ONFT_MANTLE = process.env.NEXT_PUBLIC_ONFT_MANTLE as Address;
const ONFT_LINEA = process.env.NEXT_PUBLIC_ONFT_LINEA as Address;
const ONFT_BASE = process.env.NEXT_PUBLIC_ONFT_BASE as Address;
const ONFT_OG = process.env.NEXT_PUBLIC_ONFT_OG as Address;


const FEE_RECEIVER =
  (process.env.NEXT_PUBLIC_FEE_RECEIVER as Address) || ADAPTER_BASE;
const APP_FEE_BPS = BigInt(
  process.env.NEXT_PUBLIC_APP_FEE_BPS ?? '0',
);

const FLAT_FEE_WEI_ETH = BigInt(
  process.env.NEXT_PUBLIC_FLAT_FEE_WEI_ETH ?? '0',
); // Base & Linea

const FLAT_FEE_WEI_MON = BigInt(
  process.env.NEXT_PUBLIC_FLAT_FEE_WEI_MON ?? '0',
); // Monad

const FLAT_FEE_WEI_OG = BigInt(
  process.env.NEXT_PUBLIC_FLAT_FEE_WEI_OG ?? '0',
); // 0G

const FLAT_FEE_WEI_MNT = BigInt(
  process.env.NEXT_PUBLIC_FLAT_FEE_WEI_MNT ?? '0',
); // Mantle

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (mirrors your approveAdapter.ts & sendWithFee.ts logic)
// ─────────────────────────────────────────────────────────────────────────────

const ERC721_ABI = parseAbi([
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
]);

const ONFT_ABI = parseAbi([
  'function quoteSend((uint32 dstEid, bytes32 to, uint256 tokenId, bytes extraOptions, bytes composeMsg, bytes onftCmd) _sendParam, bool _payInLzToken) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function send((uint32 dstEid, bytes32 to, uint256 tokenId, bytes extraOptions, bytes composeMsg, bytes onftCmd) _sendParam, (uint256 nativeFee, uint256 lzTokenFee) _fee, address _refundAddress) payable',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const IPFS_GATEWAY =
  (process.env.PINATA_GATEWAY || 'https://ipfs.io/ipfs/')
    .replace(/\/+$/, '') + '/';

type NftPreviewMeta = {
  name?: string;
  image?: string;
  rawImage?: string;
};

function normalizeNftAssetUri(uri?: string | null): string | undefined {
  const value = uri?.trim();
  if (!value) return undefined;

  if (/^ipfs:\/\//i.test(value)) {
    const path = value.replace(/^ipfs:\/\/(ipfs\/)?/i, '');
    return `${IPFS_GATEWAY}${path}`;
  }

  if (/^ar:\/\//i.test(value)) {
    return `https://arweave.net/${value.replace(/^ar:\/\//i, '')}`;
  }

  if (/^data:/i.test(value)) {
    return value;
  }

  // Avoid mixed-content blocking on HTTPS pages.
  if (/^http:\/\//i.test(value)) {
    return value.replace(/^http:/i, 'https:');
  }

  return value;
}

function decodeBase64Utf8(b64: string): string {
  const binary = window.atob(b64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseJsonDataUri(uri: string): any | null {
  const commaIndex = uri.indexOf(',');
  if (commaIndex === -1) return null;

  const header = uri.slice(0, commaIndex).toLowerCase();
  const payload = uri.slice(commaIndex + 1);

  if (!header.startsWith('data:application/json')) return null;

  const jsonText = header.includes(';base64')
    ? decodeBase64Utf8(payload)
    : decodeURIComponent(payload);

  return JSON.parse(jsonText);
}

function isLikelyDirectImageUrl(url: string): boolean {
  return (
    /^data:image\//i.test(url) ||
    /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)
  );
}

async function resolveNftPreviewFromTokenUri(
  tokenUri: string,
): Promise<NftPreviewMeta> {
  // Case 1: onchain base64/json metadata
  if (/^data:application\/json/i.test(tokenUri)) {
    const meta = parseJsonDataUri(tokenUri);

    return {
      name: meta?.name,
      image: normalizeNftAssetUri(meta?.image || meta?.image_url),
      rawImage: meta?.image || meta?.image_url,
    };
  }

  const normalizedTokenUri = normalizeNftAssetUri(tokenUri);
  if (!normalizedTokenUri) return {};

  // Case 2: tokenURI is already a direct image
  if (isLikelyDirectImageUrl(normalizedTokenUri)) {
    return {
      image: normalizedTokenUri,
      rawImage: tokenUri,
    };
  }

  // Case 3: tokenURI points to metadata JSON on IPFS/HTTP
  if (/^https?:\/\//i.test(normalizedTokenUri)) {
    try {
      const res = await fetch(normalizedTokenUri, { cache: 'no-store' });
      const text = await res.text();

      try {
        const meta = JSON.parse(text);

        return {
          name: meta?.name,
          image: normalizeNftAssetUri(meta?.image || meta?.image_url),
          rawImage: meta?.image || meta?.image_url,
        };
      } catch {
        // If it was not JSON, maybe it was a direct image without extension.
        return {
          image: normalizedTokenUri,
          rawImage: tokenUri,
        };
      }
    } catch {
      // If browser fetch is blocked, still try to render it as an image.
      return {
        image: normalizedTokenUri,
        rawImage: tokenUri,
      };
    }
  }

  return {
    image: normalizedTokenUri,
    rawImage: tokenUri,
  };
}

function addrToBytes32(addr: string): `0x${string}` {
  const hex = addr.toLowerCase().replace(/^0x/, '');
  return ('0x' + hex.padStart(64, '0')) as `0x${string}`;
}

function makeExplorerTxUrl(chainId: number | undefined, hash: string): string {
  if (!hash) return '#';
  if (chainId === CHAIN_IDS.base) return `https://basescan.org/tx/${hash}`;
  if (chainId === CHAIN_IDS.mantle) return `https://mantlescan.xyz/tx/${hash}`;
  if (chainId === CHAIN_IDS.linea) return `https://lineascan.build/tx/${hash}`;
  if (chainId === CHAIN_IDS.monad) return `https://monadscan.com/tx/${hash}`;
  if (chainId === CHAIN_IDS.og) {
    const explorer = process.env.NEXT_PUBLIC_OG_EXPLORER || 'https://chainscan-galileo.0g.ai';
    return `${explorer.replace(/\/+$/, '')}/tx/${hash}`;
  }
  return '#';
}

function makeExplorerTxUrlLZ(chainId: number | undefined, hash: string): string {
  if (!hash) return '#';
  return `https://layerzeroscan.com/tx/${hash}`;
}

type SourceContractKind = 'adapter' | 'onft';

type BridgeRoute = {
  token: Address;
  oapp: Address;
  sourceKind: SourceContractKind;
  dstEid: number;
  flatFeeWei: bigint;
};

const BRIDGE_ROUTES: Partial<
  Record<ChainKey, Partial<Record<ChainKey, BridgeRoute>>>
> = {
  og: {
    base: {
      token: CANONICAL_OG,
      oapp: ADAPTER_OG,
      sourceKind: 'adapter',
      dstEid: LZ_EIDS.base,
      flatFeeWei: FLAT_FEE_WEI_OG,
    },
  },

  base: {
    // Base Adapter -> Mantle
    mantle: {
      token: CANONICAL_BASE,
      oapp: ADAPTER_BASE,
      sourceKind: 'adapter',
      dstEid: LZ_EIDS.mantle,
      flatFeeWei: FLAT_FEE_WEI_ETH,
    },

    // Base Adapter -> Linea
    linea: {
      token: CANONICAL_BASE,
      oapp: ADAPTER_BASE,
      sourceKind: 'adapter',
      dstEid: LZ_EIDS.linea,
      flatFeeWei: FLAT_FEE_WEI_ETH,
    },
  },

  mantle: {
    // Mantle Adapter -> Base
    base: {
      token: CANONICAL_MANTLE,
      oapp: ADAPTER_MANTLE,
      sourceKind: 'adapter',
      dstEid: LZ_EIDS.base,
      flatFeeWei: FLAT_FEE_WEI_MNT,
    },
  },

  linea: {
    // Linea Adapter -> Base
    base: {
      token: CANONICAL_LINEA,
      oapp: ADAPTER_LINEA,
      sourceKind: 'adapter',
      dstEid: LZ_EIDS.base,
      flatFeeWei: FLAT_FEE_WEI_ETH,
    },
  },

  monad: {
    // Monad Adapter -> Base
    base: {
      token: CANONICAL_MONAD,
      oapp: ADAPTER_MONAD,
      sourceKind: 'adapter',
      dstEid: LZ_EIDS.base,
      flatFeeWei: FLAT_FEE_WEI_MON,
    },
  },
};

function getBridgeRoute(src: ChainKey, dst: ChainKey): BridgeRoute {
  const route = BRIDGE_ROUTES[src]?.[dst];

  if (!route) {
    throw new Error(`Unsupported bridge route: ${chainLabel(src)} -> ${chainLabel(dst)}`);
  }

  if (!route.token || !route.oapp) {
    throw new Error(`Missing contract env for ${chainLabel(src)} -> ${chainLabel(dst)}`);
  }

  if (!route.dstEid || !Number.isFinite(route.dstEid)) {
    throw new Error(`Missing LayerZero EID for ${chainLabel(dst)}`);
  }

  return route;
}

function allowedDestsFor(src: ChainKey): ChainKey[] {
  return Object.keys(BRIDGE_ROUTES[src] || {}) as ChainKey[];
}

type StoredBridgeJob = {
  version: 1;
  owner: string;
  src: ChainKey;
  dst: ChainKey;
  tokenId: string;
  approvalHash?: `0x${string}`;
  sendHash?: `0x${string}`;
  sourceChainId: number;
  status:
    | 'approval-submitted'
    | 'approval-confirmed'
    | 'send-submitted'
    | 'source-confirmed';
  createdAt: number;
  updatedAt: number;
};

const bridgeJobStorageKey = (owner?: string) =>
  owner ? `cookieverse:bridge:${owner.toLowerCase()}` : 'cookieverse:bridge';

function saveBridgeJob(job: StoredBridgeJob) {
  window.localStorage.setItem(bridgeJobStorageKey(job.owner), JSON.stringify(job));
}

function loadBridgeJob(owner?: string): StoredBridgeJob | null {
  if (!owner) return null;

  try {
    const raw = window.localStorage.getItem(bridgeJobStorageKey(owner));
    return raw ? (JSON.parse(raw) as StoredBridgeJob) : null;
  } catch {
    return null;
  }
}

function clearBridgeJob(owner?: string) {
  if (!owner) return;
  window.localStorage.removeItem(bridgeJobStorageKey(owner));
}

async function waitForReceiptWithTimeout(params: {
  publicClient: any;
  hash: `0x${string}`;
  timeoutMs: number;
}) {
  const { publicClient, hash, timeoutMs } = params;

  return Promise.race([
    publicClient.waitForTransactionReceipt({ hash }),
    new Promise<null>((resolve) =>
      window.setTimeout(() => resolve(null), timeoutMs),
    ),
  ]);
}


const OG_CHAINSCAN_API =
  (process.env.NEXT_PUBLIC_OG_CHAINSCAN_API || 'https://chainscan.0g.ai/api/v2')
    .replace(/\/+$/, '');

const APPROVAL_POLL_INTERVAL_MS = 1_500;
const APPROVAL_POLL_TIMEOUT_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readApprovedAddress(params: {
  publicClient: AnyPublicClient;
  token: Address;
  tokenId: bigint;
}): Promise<Address | null> {
  const { publicClient, token, tokenId } = params;

  try {
    return (await publicClient.readContract({
      address: token,
      abi: ERC721_ABI as any,
      functionName: 'getApproved',
      args: [tokenId],
      authorizationList: undefined as any,
    })) as Address;
  } catch (error) {
    console.warn('[bridge] getApproved failed', error);
    return null;
  }
}

async function isApprovedForAdapter(params: {
  publicClient: AnyPublicClient;
  token: Address;
  adapter: Address;
  tokenId: bigint;
}): Promise<boolean> {
  const approved = await readApprovedAddress({
    publicClient: params.publicClient,
    token: params.token,
    tokenId: params.tokenId,
  });

  return approved?.toLowerCase() === params.adapter.toLowerCase();
}

async function isOgTxSuccessOnChainScan(hash: `0x${string}`): Promise<boolean> {
  try {
    const res = await fetch(`${OG_CHAINSCAN_API}/transactions/${hash}`, {
      cache: 'no-store',
    });

    if (!res.ok) return false;

    const json: any = await res.json().catch(() => null);
    if (!json) return false;

    const status = String(
      json.status ??
        json.result ??
        json.transaction?.status ??
        json.tx_status ??
        '',
    ).toLowerCase();

    return (
      status === 'ok' ||
      status === 'success' ||
      status === '1' ||
      status === 'true'
    );
  } catch {
    return false;
  }
}

async function waitUntilApprovedForAdapter(params: {
  chain: ChainKey;
  publicClient: AnyPublicClient;
  token: Address;
  adapter: Address;
  tokenId: bigint;
  approvalHash?: `0x${string}`;
  timeoutMs?: number;
}): Promise<boolean> {
  const {
    chain,
    publicClient,
    token,
    adapter,
    tokenId,
    approvalHash,
    timeoutMs = APPROVAL_POLL_TIMEOUT_MS,
  } = params;

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const approved = await isApprovedForAdapter({
      publicClient,
      token,
      adapter,
      tokenId,
    });

    if (approved) return true;

    if (chain === 'og' && approvalHash) {
      const chainScanSuccess = await isOgTxSuccessOnChainScan(approvalHash);
      if (chainScanSuccess) {
        await sleep(1_500);
        return true;
      }
    }

    await sleep(APPROVAL_POLL_INTERVAL_MS);
  }

  return false;
}

/*
async function upsertMgidAfterBridge(params: {
  address: `0x${string}`;
  src: ChainKey;          // 'base' | 'mantle' | 'linea'
}) {
  const { address, src } = params;

  // 1) X username from session (same pattern as in app/page.tsx)
  const sessionResp = await fetch('/api/auth/session', { cache: 'no-store' });
  const session = sessionResp.ok ? await sessionResp.json() : null;
  const twitter_username = session?.twitter_username || '';

  // 2) read existing row from blob
  const readResp = await fetch(`/api/mgid-get?address=${address}`, {
    cache: 'no-store',
  });
  const existing = readResp.ok ? await readResp.json() : null;

  // 3) base row seeded from existing values (same field structure)
  const row = {
    usernameX: twitter_username,
    usernamefarcaster: existing?.usernamefarcaster || '',
    EOAWallet: address,
    SAWallet: existing?.SAWallet || '',

    LineaBoost: Number(existing?.LineaBoost || 0),
    BaseBoost: Number(existing?.BaseBoost || 0),
    MonadBoost: Number(existing?.MonadBoost || 0),
    MantleBoost: Number(existing?.MantleBoost || 0),
    MitosisBoost: Number(existing?.MitosisBoost || 0),

    totalScore_monad: Number(existing?.totalScore_monad || 0),
    totalTransactions_monad: Number(existing?.totalTransactions_monad || 0),
    totalImages_monad: Number(existing?.totalImages_monad || 0),

    totalScore_base: Number(existing?.totalScore_base || 0),
    totalTransactions_base: Number(existing?.totalTransactions_base || 0),
    totalImages_base: Number(existing?.totalImages_base || 0),

    totalScore_mantle: Number(existing?.totalScore_mantle || 0),
    totalTransactions_mantle: Number(existing?.totalTransactions_mantle || 0),
    totalImages_mantle: Number(existing?.totalImages_mantle || 0),

    totalScore_linea: Number(existing?.totalScore_linea || 0),
    totalTransactions_linea: Number(existing?.totalTransactions_linea || 0),
    totalImages_linea: Number(existing?.totalImages_linea || 0),

    totalScore_mitosis: Number(existing?.totalScore_mitosis || 0),
    totalTransactions_mitosis: Number(existing?.totalTransactions_mitosis || 0),
    totalImages_mitosis: Number(existing?.totalImages_mitosis || 0),

    // totals will be recomputed
    totalScore: 0,
    totalTransactions: 0,
    totalImages: 0,

    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  // 4) increment per-chain counters for this bridge (no images here)
  switch (src) {
    case 'base':
      row.totalScore_base += 1;
      row.totalTransactions_base += 1;
      break;
    case 'mantle':
      row.totalScore_mantle += 1;
      row.totalTransactions_mantle += 1;
      break;
    case 'linea':
      row.totalScore_linea += 1;
      row.totalTransactions_linea += 1;
      break;
  }

  // 5) recompute totals (same pattern as in app/page.tsx)
  row.totalScore =
    row.totalScore_monad +
    row.totalScore_base +
    row.totalScore_mantle +
    row.totalScore_linea +
    row.totalScore_mitosis;

  row.totalTransactions =
    row.totalTransactions_monad +
    row.totalTransactions_base +
    row.totalTransactions_mantle +
    row.totalTransactions_linea +
    row.totalTransactions_mitosis;

  row.totalImages =
    row.totalImages_monad +
    row.totalImages_base +
    row.totalImages_mantle +
    row.totalImages_linea +
    row.totalImages_mitosis;

  // 6) write to BLOB (same endpoint as main page)
  await fetch('/api/mgid-upsert', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(row),
  });
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BridgePage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient();

  const [src, setSrc] = React.useState<ChainKey>('base');
  const [dst, setDst] = React.useState<ChainKey>('mantle');
  const [tokenId, setTokenId] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [preview, setPreview] = React.useState<{
    name?: string;
    image?: string;
    rawUri?: string;
    rawImage?: string;
  } | null>(null);

  const [bridgeTxHash, setBridgeTxHash] = React.useState<
    `0x${string}` | undefined
  >(undefined);
  const [bridgeTxChainId, setBridgeTxChainId] = React.useState<
    number | undefined
  >(undefined);

  const [approvalTxHash, setApprovalTxHash] = React.useState<
    `0x${string}` | undefined
  >(undefined);

  const [busy, setBusy] = React.useState(false);

  const [tokenIdOptions, setTokenIdOptions] = React.useState<number[]>([]);
  const [loadingTokenIds, setLoadingTokenIds] = React.useState(false);
  
  const pathname = usePathname();
  const { isFarcasterMini, isBaseAppRoute, isCompactLayout } = useAppMode();

  const [fcUsername, setFcUsername] = React.useState<string>('');

  // keep dest always valid, and sync dstEid with chosen dest
  React.useEffect(() => {
    const allowed = allowedDestsFor(src);
    if (allowed.length === 0) return;
    if (!allowed.includes(dst)) {
      const newDst = allowed[0];
      setDst(newDst);
    }
  }, [src, dst]);


   React.useEffect(() => {
    if (!address) {
      setTokenIdOptions([]);
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        if (attempts === 0) {
          setLoadingTokenIds(true);
        }
        attempts += 1;

          const chainKey = chainIdToChainKey(chainId);
          if (!chainKey) {
            setTokenIdOptions([]);
            return;
          }

          let route: BridgeRoute;
          try {
            route = getBridgeRoute(src, dst);
          } catch {
            setTokenIdOptions([]);
            setLoadingTokenIds(false);
            return;
          }

        const res = await fetch(
          `/api/fc-token-ids?chain=${chainKey}&owner=${address}&contract=${route.token}`,
          { cache: 'no-store' },
        );

        if (!res.ok) {
          // don't nuke previously loaded IDs if backend temporarily fails
          if (attempts * 500 >= 10_000) {
            if (!cancelled && intervalId != null) {
              clearInterval(intervalId);
              intervalId = null;
            }
            setLoadingTokenIds(false);
          }
          return;
        }

        const data = await res.json();
        const hasTokenIds =
          Array.isArray(data.tokenIds) && data.tokenIds.length > 0;

        // Only overwrite state when we actually received something.
        if (hasTokenIds) {
          setTokenIdOptions(data.tokenIds);
        }

        // Stop polling when:
        //  - we successfully got a non-empty tokenIds array, OR
        //  - backend reports ok === true, OR
        //  - we hit the timeout.
        if (hasTokenIds || data.ok === true || attempts * 1000 >= 10_000) {
          if (!cancelled && intervalId != null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setLoadingTokenIds(false);
        }
      } catch (err) {
        console.error('Failed to fetch token IDs', err);
        // IMPORTANT: don't reset tokenIdOptions to [] here,
        // so earlier successful results are preserved.
        if (attempts * 1000 >= 10_000) {
          if (!cancelled && intervalId != null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setLoadingTokenIds(false);
        }
      }
    };

    // initial attempt immediately
    poll();
    // then poll every 1s until success or timeout
    intervalId = window.setInterval(poll, 1000);

    return () => {
      cancelled = true;
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [src, dst, address, chainId]);

  React.useEffect(() => {
    if (!isFarcasterMini) return;
    let alive = true;
    (async () => {
      try {
        // SDK context contains user fields, incl. username
        // (context is awaited per docs; username is optional) 
        const ctx = await (sdk as any).context; 
        const uname = ctx?.user?.username || '';
        if (alive) setFcUsername(uname);
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, [isFarcasterMini]);


    // Periodically sync leaderboard from bridge page as well (every 60s)
  React.useEffect(() => {
    if (!address) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fetch('/api/mgid-upsert', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-farcaster-username': fcUsername },
          body: JSON.stringify({ address }),
        });
      } catch (e) {
        console.error('periodic mgid-upsert (bridge) failed', e);
      }
    };

    // first attempt right away
    tick();

    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, fcUsername]);


  React.useEffect(() => {
    if (!chainId) return;

    const chainKey = chainIdToChainKey(chainId);
    if (chainKey) {
      setSrc(chainKey);
      setError(null);
    } else {
      setError('Unsupported chain. Please switch to Base, Mantle, Linea, Monad or 0G.');
    }
  }, [chainId]);
/*
  const onChangeSrc = (next: ChainKey) => {
    setSrc(next);
  };
*/
const onChangeDst = (next: ChainKey) => {
  setDst(next);
};

  React.useEffect(() => {
    if (!address || !publicClient) return;

    const job = loadBridgeJob(address);
    if (!job) return;

    const currentChainKey = chainIdToChainKey(chainId);
    if (currentChainKey !== job.src) return;

    if (job.sendHash && job.status === 'send-submitted') {
      setBridgeTxHash(job.sendHash);
      setBridgeTxChainId(job.sourceChainId);
      setStatus(
        `Resuming bridge ${chainLabel(job.src)} -> ${chainLabel(job.dst)} for token #${job.tokenId}…`,
      );

      let cancelled = false;

      (async () => {
        const receipt = await waitForReceiptWithTimeout({
          publicClient: publicClient as AnyPublicClient,
          hash: job.sendHash!,
          timeoutMs: 180_000,
        });

        if (cancelled) return;

        if (receipt) {
          saveBridgeJob({
            ...job,
            status: 'source-confirmed',
            updatedAt: Date.now(),
          });

          setStatus(
            'Source-chain bridge transaction confirmed. Cross-chain delivery will finalize through LayerZero.',
          );
        } else {
          setStatus(
            'Bridge transaction is still pending or RPC is slow. The tx hash is saved, so you can refresh safely.',
          );
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (job.approvalHash && job.status === 'approval-submitted') {
      setApprovalTxHash(job.approvalHash);
      setStatus(
        `Approval was submitted for token #${job.tokenId}. Click Bridge again to continue after approval confirms.`,
      );
    }
  }, [address, chainId, publicClient]);

  const handlePreview = async () => {
    setError(null);
    setStatus('Loading NFT metadata…');
    setPreview(null);

    if (!address) {
      setStatus(null);
      setError('Connect your wallet first.');
      return;
    }
    if (!publicClient) {
      setStatus(null);
      setError('Public client not ready for this chain.');
      return;
    }
    const idNum = Number(tokenId);
    if (!Number.isFinite(idNum) || idNum < 0) {
      setStatus(null);
      setError('Enter a valid tokenId (integer).');
      return;
    }

    try {
      const route = getBridgeRoute(src, dst);
      const token = route.token;

      const uri = (await publicClient.readContract({
        address: token,
        abi: ERC721_ABI as any,
        functionName: 'tokenURI',
        args: [BigInt(idNum)],
        authorizationList: undefined as any,
      })) as string;

      const meta = await resolveNftPreviewFromTokenUri(uri);

      setPreview({
        name: meta.name || `COOKIE #${idNum}`,
        image: meta.image,
        rawUri: uri,
        rawImage: meta.rawImage,
      });
    } catch (e: any) {
      console.error(e);
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Failed to load tokenURI.');
    }
  };

  const handleBridge = async () => {
    setError(null);
    setStatus(null);
    setBridgeTxHash(undefined);
    setApprovalTxHash(undefined);

    if (!address) {
      setError('Connect your wallet first.');
      return;
    }
    if (!publicClient || !walletClient) {
      setError('Clients not ready. Check wallet connection.');
      return;
    }

    const srcChainId = CHAIN_IDS[src];
    if (chainId !== srcChainId) {
      setError(`Switch your wallet to ${chainLabel(src)} network first.`);
      return;
    }

    const idNum = Number(tokenId);
    if (!Number.isFinite(idNum) || idNum < 0) {
      setError('Enter a valid tokenId (integer).');
      return;
    }
    const tokenIdBig = BigInt(idNum);

    setBusy(true);
    try {
      const route = getBridgeRoute(src, dst);
      const { token, oapp, sourceKind } = route;
      const createdAt = Date.now();

      // ── 1. Approve adapter only for adapter-source routes ─────────────────
      if (sourceKind === 'adapter') {
        setStatus('Checking adapter approval…');

        const alreadyApproved = await isApprovedForAdapter({
          publicClient: publicClient as AnyPublicClient,
          token,
          adapter: oapp,
          tokenId: tokenIdBig,
        });

        if (!alreadyApproved) {
          setStatus('Approving adapter to transfer your NFT…');

          const approveHash = await (walletClient as AnyWalletClient).writeContract({
            address: token,
            abi: ERC721_ABI as any,
            functionName: 'approve',
            args: [oapp, tokenIdBig],
            account: address as Address,
            chain: walletClient.chain,
          });

          setApprovalTxHash(approveHash);

          saveBridgeJob({
            version: 1,
            owner: address,
            src,
            dst,
            tokenId,
            approvalHash: approveHash,
            sourceChainId: CHAIN_IDS[src],
            status: 'approval-submitted',
            createdAt,
            updatedAt: Date.now(),
          });

          setStatus('Approval submitted. Detecting approval on-chain…');

          const approvedNow = await waitUntilApprovedForAdapter({
            chain: src,
            publicClient: publicClient as AnyPublicClient,
            token,
            adapter: oapp,
            tokenId: tokenIdBig,
            approvalHash: approveHash,
            timeoutMs: APPROVAL_POLL_TIMEOUT_MS,
          });

          if (!approvedNow) {
            setStatus(
              'Approval was submitted, but 0G/RPC is still syncing. Wait a few seconds and click Bridge again. Your approval tx hash is saved.',
            );
            return;
          }

          saveBridgeJob({
            version: 1,
            owner: address,
            src,
            dst,
            tokenId,
            approvalHash: approveHash,
            sourceChainId: CHAIN_IDS[src],
            status: 'approval-confirmed',
            createdAt,
            updatedAt: Date.now(),
          });
        }
      }

      // ── 2. quoteSend LayerZero fee ────────────────────────────────────────
      const sendParam = {
        dstEid: route.dstEid,
        to: addrToBytes32(address),
        tokenId: tokenIdBig,
        extraOptions: '0x' as `0x${string}`,
        composeMsg: '0x' as `0x${string}`,
        onftCmd: '0x' as `0x${string}`,
      };

      setStatus('Quoting LayerZero fee…');
      const [nativeLzFee, lzTokenFee] = (await (publicClient as AnyPublicClient).readContract({
        address: oapp,
        abi: ONFT_ABI as any,
        functionName: 'quoteSend',
        args: [sendParam, false],
        authorizationList: undefined as any,
      })) as readonly [bigint, bigint];

      const appFee =
        route.flatFeeWei + (nativeLzFee * APP_FEE_BPS) / 10_000n;
      const nativeFee = nativeLzFee + appFee;

      // ── 3. send bridge transaction ────────────────────────────────────────
      setStatus('Submitting LayerZero bridge transaction…');
      const sendHash = await (walletClient as AnyWalletClient).writeContract({
        address: oapp,
        abi: ONFT_ABI as any,
        functionName: 'send',
        args: [
          sendParam,
          { nativeFee, lzTokenFee },
          FEE_RECEIVER as Address,
        ],
        account: address as Address,
        value: nativeFee,
        chain: walletClient.chain,
      });

      setBridgeTxHash(sendHash);
      setBridgeTxChainId(chainId);

      saveBridgeJob({
        version: 1,
        owner: address,
        src,
        dst,
        tokenId,
        sendHash,
        sourceChainId: CHAIN_IDS[src],
        status: 'send-submitted',
        createdAt,
        updatedAt: Date.now(),
      });

      setStatus('Bridge transaction submitted. Waiting for source-chain confirmation…');

      const sourceReceipt = await waitForReceiptWithTimeout({
        publicClient: publicClient as AnyPublicClient,
        hash: sendHash,
        timeoutMs: 180_000,
      });

      if (!sourceReceipt) {
        setStatus(
          'Bridge transaction submitted. Source-chain confirmation is taking longer than expected. You can reopen this page and it will resume.',
        );
        return;
      }

      saveBridgeJob({
        version: 1,
        owner: address,
        src,
        dst,
        tokenId,
        sendHash,
        sourceChainId: CHAIN_IDS[src],
        status: 'source-confirmed',
        createdAt,
        updatedAt: Date.now(),
      });

      try {
        await fetch('/api/mgid-upsert', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-farcaster-username': fcUsername,
          },
          body: JSON.stringify({ address }),
        });
      } catch (e) {
        console.error('mgid-upsert failed', e);
      }

      setStatus(
        'Source-chain transaction confirmed. LayerZero delivery may still take time. Track it on LayerZeroScan.',
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || 'Bridge failed.');
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const explorerUrl =
    bridgeTxHash && bridgeTxChainId
      ? makeExplorerTxUrlLZ(bridgeTxChainId, bridgeTxHash)
      : '#';

  const approvalExplorerUrl =
    approvalTxHash && chainId
      ? makeExplorerTxUrl(chainId, approvalTxHash)
      : '#';

  const destOptions = allowedDestsFor(src);

  return (
    <div className="page">
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Fortune Cookie NFT Bridge
      </h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
        Bridge your Fortune Cookies between <strong>0G</strong>,{' '}
        <strong>Base</strong>, <strong>Mantle</strong>, <strong>Linea</strong>{' '}
        and <strong>Monad</strong> using LayerZero.
      </p>

      <div className="grid">
        {/* Left: controls */}
        <div className="col card card--fortune">
          <div className="card__title">Bridge parameters</div>

          <div className="field">
            <label className="label">Source chain</label>
            <select
              className="input"
              value={src}
              disabled
            >
              <option value="base">Base</option>
              <option value="mantle">Mantle</option>
              <option value="linea">Linea</option>
              <option value="monad">Monad</option>
              <option value="og">0G</option>
            </select>
            <p className="hint">
              Where your NFT currently lives. The app detects this from your wallet network.
            </p>
          </div>

          <div className="field">
            <label className="label">Destination chain</label>
            <select
              className="input"
              value={dst}
              onChange={(e) => onChangeDst(e.target.value as ChainKey)}
            >
              {destOptions.map((k) => (
                <option key={k} value={k}>
                  {chainLabel(k)}
                </option>
              ))}
            </select>
            <p className="hint">
              Available destinations are based on the configured LayerZero route for the current source chain.
            </p>
          </div>

          <div className="field">
            <label className="label">Token ID</label>

            {tokenIdOptions.length > 0 ? (
              <>
                <select
                  className="input"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                >
                  <option value="">Select your COOKIE ID</option>
                  {tokenIdOptions.map((id) => (
                    <option key={id} value={id.toString()}>
                      {id}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  COOKIE NFTs detected for your wallet on {chainLabel(src)} via
                  explorer API. Choose one to bridge.
                </p>
              </>
            ) : (
              <>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="e.g. 7"
                />
                <p className="hint">
                  {loadingTokenIds
                    ? 'Loading your COOKIE token IDs via explorer API…'
                    : 'No COOKIE NFTs detected via explorer API. Enter the Token ID manually.'}
                </p>
              </>
            )}
          </div>

          <div className="field">
            <button
              className="btn btn--accent"
              onClick={handlePreview}
              disabled={!tokenId || busy}
            >
              Preview NFT
            </button>
          </div>

          <div className="field">
            <button
              className="btn btn--primary"
              onClick={handleBridge}
              disabled={!tokenId || busy}
            >
              {busy ? 'Bridging…' : `Bridge to ${chainLabel(dst)} with LayerZero`}
            </button>
            {/*<p className="note">
              Steps: 1) Approve adapter (Base only) 2) Quote LayerZero fee 3){' '}
              Send.
            </p>*/}
          </div>

          {error && (
            <div className="alert">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Middle: NFT preview */}
        <div className="col card card--image">
          <div className="card__title">NFT preview</div>
          {preview ? (
            <>
              {preview.image && (
                <div
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    maxWidth: 360,
                  }}
                >
                  {/* Uncropped image preview */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.image}
                    alt={preview.name || 'Fortune Cookie'}
                    style={{ display: 'block', width: '100%' }}
                    onError={() => {
                      console.error('NFT preview image failed:', {
                        normalizedImage: preview.image,
                        rawImage: preview.rawImage,
                        tokenURI: preview.rawUri,
                      });
                      setError(
                        `NFT metadata loaded, but image failed to load. Raw image URI: ${
                          preview.rawImage || preview.image || 'unknown'
                        }`,
                      );
                    }}
                  />
                </div>
              )}
              {preview.name && (
                <p style={{ marginTop: 10, fontWeight: 500 }}>{preview.name}</p>
              )}
              {/*preview.rawUri && (
                <p className="note">
                  <span className="dash">tokenURI:</span> {preview.rawUri}
                </p>
              )*/} 
            </>
          ) : (
            <p className="muted">
              Enter a token ID and click <strong>Preview NFT</strong> to see
              the Fortune Cookie before bridging.
            </p>
          )}
        </div>

        {/* Right: status + tx links */}
        <div className="col card card--status">
          <div className="card__title">Bridge status</div>
          <div className="status">
            <div className="status__row">
              <span className="muted">Wallet:</span>
              <span>
                {address
                  ? `${address.slice(0, 6)}…${address.slice(-4)}`
                  : 'Not connected'}
              </span>
            </div>

            <div className="status__row">
              <span className="muted">Current chain:</span>
              <span>
                {chainIdToChainKey(chainId)
                  ? chainLabel(chainIdToChainKey(chainId)!)
                  : `Unknown (${chainId || 'n/a'})`}
              </span>
            </div>

            <div className="block">
              <div className="block__title">Transactions</div>
              <ul className="list">
                <li>
                  <span className="muted">Approval tx:</span>{' '}
                  {approvalTxHash ? (
                    <a
                      href={approvalExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                    >
                      {approvalTxHash.slice(0, 10)}… (view on explorer)
                    </a>
                  ) : (
                    <span className="muted">none yet</span>
                  )}
                </li>
                <li>
                  <span className="muted">Bridge tx:</span>{' '}
                  {bridgeTxHash ? (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                    >
                      {bridgeTxHash.slice(0, 10)}… (view on explorer)
                    </a>
                  ) : (
                    <span className="muted">none yet</span>
                  )}
                </li>
              </ul>
              <p className="note">
                The bridge transaction is clickable and opens the TX on the
                correct block explorer or LayerZeroScan.
              </p>
            </div>

            <div className="block">
              <div className="block__title">Status</div>
              <p className="muted">
                {status
                  ? status
                  : 'Waiting for you to preview and bridge an NFT.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Powered by LayerZero footer */}
      <div
        style={{
          marginTop: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: 0.85,
        }}
      >
        <span style={{ fontSize: 20, letterSpacing: '0.08em' }}>
          Powered by LayerZero
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/layerzero-logo.png"
          alt="LayerZero"
          style={{ height: 50 }}
        />
      </div>

      {/* ── Styles from your spec ──────────────────────────────────────────── */}
      <style jsx>{`
        :global(html),
        :global(body) {
          background: #0b0b10;
        }
        .page {
          color: #e5e7eb;
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 900px) {
          .grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
          .card--status {
            grid-column: 3;
            order: 3;
          }
          .card--image {
            grid-column: 2;
            order: 2;
          }
          .card--fortune {
            grid-column: 1;
            order: 1;
          }
        }

        .col {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .card {
          background: rgba(24, 24, 28, 0.82);
          border: 1px solid rgba(63, 63, 70, 0.7);
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .card__title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #a1a1aa;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .field {
          margin: 10px 0;
        }
        .label {
          display: block;
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 4px;
        }
        .input,
        select,
        .textarea {
          width: 90%;
          background: rgba(39, 39, 42, 0.7);
          border: 1px solid rgba(82, 82, 91, 0.6);
          border-radius: 10px;
          padding: 8px 12px;
          color: #e5e7eb;
          outline: none;
        }
        .textarea {
          min-height: 120px;
          resize: vertical;
        }
        .hint {
          margin-top: 6px;
          font-size: 12px;
          color: #9ca3af;
        }
        .two-col {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
        }
        .two-col .input {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }
        .btn {
          display: inline-block;
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          margin: 6px 0;
        }
        .btn--primary {
          background: #4f46e5;
          color: white;
        }
        .btn--primary:hover {
          background: #6366f1;
        }
        .btn--accent {
          background: #7c3aed;
          color: white;
        }
        .btn--accent:hover {
          background: #8b5cf6;
        }
        .alert {
          background: rgba(127, 29, 29, 0.25);
          border: 1px solid rgba(185, 28, 28, 0.35);
          color: #fecaca;
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 12px;
          font-size: 13px;
        }
        .status {
          display: grid;
          gap: 8px;
          font-size: 14px;
        }
        .status__row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .muted {
          color: #9ca3af;
        }
        .pill {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
        }
        .pill--ok {
          background: rgba(6, 95, 70, 0.3);
          color: #86efac;
        }
        .pill--off {
          background: rgba(82, 82, 91, 0.5);
          color: #e5e7eb;
        }
        .block {
          margin-top: 18px;
        }
        .block__title {
          font-weight: 600;
          color: #d4d4d8;
          margin-bottom: 6px;
          font-size: 14px;
        }
        .dash {
          color: #a1a1aa;
        }
        .list {
          list-style: disc;
          padding-left: 18px;
          display: grid;
          gap: 6px;
        }
        .line > * + * {
          margin-left: 10px;
        }
        .link {
          color: #a5b4fc;
          text-decoration: none;
        }
        .link:hover {
          text-decoration: underline;
        }
        .note {
          margin-top: 6px;
          font-size: 12px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
