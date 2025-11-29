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

// ─────────────────────────────────────────────────────────────────────────────
// Chain & LayerZero config (matches your .env and src/lib/chain.ts)
// ─────────────────────────────────────────────────────────────────────────────

const CHAIN_IDS = {
  base: 8453,
  mantle: 5000,
  linea: 59144,
  monad: 143,
} as const;

const LZ_EIDS = {
  base: 30184,
  mantle: 30181,
  linea: 30183,
  monad: 30390,
} as const;

type ChainKey = keyof typeof CHAIN_IDS;

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
    default:
      return null;
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

const ADAPTER_BASE = process.env.NEXT_PUBLIC_ADAPTER_BASE as Address;
const ADAPTER_MANTLE = process.env.NEXT_PUBLIC_ADAPTER_MANTLE as Address;
const ADAPTER_LINEA = process.env.NEXT_PUBLIC_ADAPTER_LINEA as Address;
const ADAPTER_MONAD = process.env.NEXT_PUBLIC_ADAPTER_MONAD as Address;

const ONFT_MANTLE = process.env.NEXT_PUBLIC_ONFT_MANTLE as Address;
const ONFT_LINEA = process.env.NEXT_PUBLIC_ONFT_LINEA as Address;
const ONFT_BASE = process.env.NEXT_PUBLIC_ONFT_BASE as Address;

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
); // Base & Linea

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
  return '#';
}

function makeExplorerTxUrlLZ(chainId: number | undefined, hash: string): string {
  if (!hash) return '#';
  return `https://layerzeroscan.com/tx/${hash}`;

  return '#';
}

function getContractsFor(chain: ChainKey): {
  token: Address;
  oapp: Address;
} {
  // Where the NFT currently lives (token) and which contract exposes send()/quoteSend (oapp)
  if (chain === 'base') {
    // Source flow: canonical ERC721 on Base + adapter as OApp
    return { token: CANONICAL_BASE, oapp: ADAPTER_BASE };
  }
  if (chain === 'mantle') {
    // ONFT mirror on Mantle
    return { token: CANONICAL_MANTLE, oapp: ADAPTER_MANTLE };
  }
  if (chain === 'monad') {
    // ONFT mirror on Mantle
    return { token: CANONICAL_MONAD, oapp: ADAPTER_MONAD };
  }  
  // linea
  return { token: CANONICAL_LINEA, oapp: ADAPTER_LINEA };
}

// Allowed destinations for each source
function allowedDestsFor(src: ChainKey): ChainKey[] {
  if (src === 'base') return ['mantle', 'linea'];
  if (src === 'mantle') return ['base'];
  if (src === 'linea') return ['mantle'];
  if (src === 'monad') return ['base'];
  return [];
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

  const [dstEidState, setDstEidState] = React.useState<number>(
  LZ_EIDS['mantle'], // initial matches default dst = 'mantle'
);

  const [preview, setPreview] = React.useState<{
    name?: string;
    image?: string;
    rawUri?: string;
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
  const isMini = !!pathname && pathname.startsWith('/mini');

  const [fcUsername, setFcUsername] = React.useState<string>('');

  // keep dest always valid, and sync dstEid with chosen dest
  React.useEffect(() => {
    const allowed = allowedDestsFor(src);
    if (!allowed.includes(dst)) {
      const newDst = allowed[0];
      setDst(newDst);
      setDstEidState(LZ_EIDS[newDst]);
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

        const res = await fetch(
          `/api/fc-token-ids?chain=${chainKey}&owner=${address}`,
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
  }, [src, address]);

  React.useEffect(() => {
    if (!isMini) return;
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
  }, [isMini]);


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

    if (chainId === CHAIN_IDS.base) {
      setSrc('base');
    } else if (chainId === CHAIN_IDS.mantle) {
      setSrc('mantle');
    } else if (chainId === CHAIN_IDS.linea) {
      setSrc('linea');
    } else if (chainId === CHAIN_IDS.monad) {
      setSrc('monad');
    } else {
      setError('Unsupported chain. Please switch to Base, Mantle or Linea.');
    }
  }, [chainId]);
/*
  const onChangeSrc = (next: ChainKey) => {
    setSrc(next);
  };
*/
const onChangeDst = (next: ChainKey) => {
  setDst(next);
  setDstEidState(LZ_EIDS[next]);
};

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
      const { token } = getContractsFor(src);
      const uri = (await publicClient.readContract({
        address: token,
        abi: ERC721_ABI,
        functionName: 'tokenURI',
        args: [BigInt(idNum)],
          // viem v2 typing requires this property
        authorizationList: undefined as any,
      })) as string;

      let name: string | undefined;
      let image: string | undefined;

      if (uri.startsWith('data:application/json;base64,')) {
        const b64 = uri.split(',')[1] || '';
        let jsonStr = '';
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          jsonStr = window.atob(b64);
        } else {
          // Node polyfill fallback (build time)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const buf = Buffer.from(b64, 'base64');
          jsonStr = buf.toString('utf8');
        }
        try {
          const meta = JSON.parse(jsonStr);
          name = meta.name;
          image = meta.image;
        } catch {
          // ignore parse errors, show raw URI
        }
      } else if (uri.startsWith('ipfs://')) {
        image = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
      } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        image = uri;
      }

      setPreview({ name, image, rawUri: uri });
      setStatus('Preview loaded.');
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
      setError(`Switch your wallet to ${src.toUpperCase()} network first.`);
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
      const { token, oapp } = getContractsFor(src);

      // adapter that will actually call send() on this chain
      const expectedAdapter =
        src === 'base'
          ? ADAPTER_BASE
          : src === 'mantle'
          ? ADAPTER_MANTLE
          : src === 'monad'
          ? ADAPTER_MONAD          
          : ADAPTER_LINEA;

      // ── 1. Approve adapter on *current* chain ──────────────────────────────
      setStatus('Checking approval for adapter…');
      const currentApproved = (await publicClient.readContract({
        address: token,
        abi: ERC721_ABI,
        functionName: 'getApproved',
        args: [tokenIdBig],
        authorizationList: undefined as any,
      })) as Address;

      if (currentApproved.toLowerCase() !== expectedAdapter.toLowerCase()) {
        setStatus('Approving adapter to transfer your NFT…');
        const approveHash = await walletClient.writeContract({
          address: token,
          abi: ERC721_ABI,
          functionName: 'approve',
          args: [expectedAdapter, tokenIdBig],
          account: address as Address,
          chain: walletClient.chain,
        });
        setApprovalTxHash(approveHash);
        await publicClient.waitForTransactionReceipt({
          hash: approveHash,
        });
      }   

      // ── 2. quoteSend (LayerZero fee) ──────────────────────────────────────
      const dstEid = dstEidState;
        const sendParam = {
        dstEid,
        to: addrToBytes32(address),
        tokenId: tokenIdBig,
        extraOptions: '0x' as `0x${string}`,
        composeMsg: '0x' as `0x${string}`,
        onftCmd: '0x' as `0x${string}`,
        };

      setStatus('Quoting LayerZero fee…');
      const [nativeLzFee, lzTokenFee] = (await publicClient.readContract({
        address: oapp,
        abi: ONFT_ABI,
        functionName: 'quoteSend',
        args: [sendParam, false],
        authorizationList: undefined as any,
      })) as readonly [bigint, bigint];

        // pick flat fee depending on source chain
        const flatFeeWei =
          src === 'monad'
            ? FLAT_FEE_WEI_MON
            : src === 'mantle'
              ? FLAT_FEE_WEI_MNT
              : FLAT_FEE_WEI_ETH;  // default for base, linea, mitosis


        const appFee =
        flatFeeWei + (nativeLzFee * APP_FEE_BPS) / 10_000n;
        const nativeFee = nativeLzFee + appFee;

      // ── 3. send (bridging tx, same as sendWithFee.ts but via wallet signer) ─
      setStatus('Sending NFT through LayerZero bridge…');
      const sendHash = await walletClient.writeContract({
        address: oapp,
        abi: ONFT_ABI,
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
        setStatus('Waiting for bridge transaction confirmation…');

        // wait for tx confirm on source chain
        await publicClient.waitForTransactionReceipt({ hash: sendHash });

        // ✅ write to blob after successful bridge
        (async () => {
          try {
            await fetch('/api/mgid-upsert', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-farcaster-username': fcUsername  },
              body: JSON.stringify({ address }),
            });
          } catch (e) {
            console.error('mgid-upsert failed', e);
          }
        })();

        setStatus(
        'Bridge transaction confirmed on source chain. Cross-chain delivery will finalize shortly.',
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
        Bridge your Fortune Cookies between <strong>Base</strong>,{' '}
        <strong>Mantle</strong> and <strong>Linea</strong> using LayerZero
        ZK core. 
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
            </select>
            <p className="hint">
              Where your NFT currently lives. For&apos;vice versa&apos; flow,
              choose Mantle / Linea as destination and Base as source.
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
                  {k === 'base'
                    ? 'Base'
                    : k === 'mantle'
                    ? 'Mantle'
                    : 'Linea'}
                </option>
              ))}
            </select>
            <p className="hint">
              From Base you can bridge to Mantle or Linea. From Mantle / Linea
              you can bridge back to Base.
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
                  COOKIE NFTs detected for your wallet on {src.toUpperCase()} via
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
              {busy ? 'Bridging…' : 'Bridge NFT with LayerZero'}
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
                {chainId === CHAIN_IDS.base
                  ? 'Base'
                  : chainId === CHAIN_IDS.mantle
                  ? 'Mantle'
                  : chainId === CHAIN_IDS.linea
                  ? 'Linea'
                  : chainId === CHAIN_IDS.monad
                  ? 'monad'                  
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
                correct block explorer (BaseScan, MantleScan, LineaScan).
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
