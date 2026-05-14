'use client';

import * as React from 'react';
import type { Abi } from 'viem';
//import { parseAbi } from 'viem';
import { isAddressEqual, parseEventLogs, zeroAddress } from 'viem';
import {
  useAccount,
  useAccountEffect,
  useWaitForTransactionReceipt,
  useWriteContract,
  useBalance,
  useReadContract,
} from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ⬇️ RELATIVE imports (keep your own)
import FortuneABI from '../abi/FortuneCookiesAI.json';
//import { monadTestnet } from '../lib/chain';

import { usePathname } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';

import { useAppMode } from '../hooks/useAppMode'

import { shareToX } from '../lib/share';

// [FIXED] Privy + banner
//import { PrivyProvider } from '@privy-io/react-auth';
//import MonadGamesIdBanner from '../components/MonadGamesIdBanner';

//import { getServerSession } from 'next-auth';

// — Auto-resolve COOKIE contract & NFT explorer per connected chain —
const CHAIN_IDS = {
  monad: 143,
  base: 8453,
  mantle: 5000,
  linea: 59144,
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
  og: 16661,
} as const;

function cookieAddressFor(chainId?: number): `0x${string}` | undefined {
  if (chainId === CHAIN_IDS.base) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (chainId === CHAIN_IDS.mantle) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (chainId === CHAIN_IDS.linea) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;
  if (chainId === CHAIN_IDS.mitosis) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  if (chainId === CHAIN_IDS.og) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG as `0x${string}`;

  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`;
}

function makeExplorerNftUrl(chainId: number | undefined, contract: `0x${string}`, tokenId: number): string {
  // Known explorers
  if (chainId === CHAIN_IDS.base) return `https://basescan.org/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.mantle) return `https://mantlescan.xyz/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.linea) return `https://lineascan.build/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.mitosis) return `https://mitoscan.io/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.og) return `https://chainscan.0g.ai/token/${contract}?a=${tokenId}`;

  return `https://monadvision.com/nft/${contract}/${tokenId}`;
}

function makeXShareText(chainName: string | undefined, tokenId: number): string {
  const net = chainName || 'this network';

  return (
    `My COOKIE #${tokenId} on ${net} 🍪✨\n\n` +
    `Minted in Cookieverse 🍪\n` +
    `AI fortunes. Onchain cookies. Cross-chain vibes.`
  );
}

function shortAddress(address?: string | null) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}


export default function Page() {
  const qc = useQueryClient();
  const { address, chain, isConnected } = useAccount();
  const connected = isConnected && !!address;
  const COOKIE_ADDRESS = React.useMemo(
    () => cookieAddressFor(chain?.id),
    [chain?.id]
  );
  if (connected && !COOKIE_ADDRESS) {
    return <main className="page"><div className="muted">Unsupported network.</div></main>;
  }

  const pathname = usePathname();
  const { isFarcasterMini, isBaseAppRoute, isCompactLayout } = useAppMode();

  const [fcUsername, setFcUsername] = React.useState<string>('');

  type ChainKey = 'monad' | 'base' | 'mantle' | 'mitosis' | 'linea' | "og";

  const CHAIN_BY_ID: Record<number, ChainKey> = {
    [CHAIN_IDS.monad]: 'monad',
    [CHAIN_IDS.base]: 'base',
    [CHAIN_IDS.mantle]: 'mantle',
    [CHAIN_IDS.linea]: 'linea',
    [CHAIN_IDS.mitosis]: 'mitosis',
    [CHAIN_IDS.og]: "og",
  };

  function currentKey(id?: number): ChainKey {
    return id && CHAIN_BY_ID[id] ? CHAIN_BY_ID[id] : 'monad';
  }

  // scoreByChain & imagesByChain come from holdings (you already set these as shown earlier)
  const [scoreByChain, setScoreByChain] = React.useState<Record<ChainKey, number>>({
    monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0,
  });
  const [imagesByChain, setImagesByChain] = React.useState<Record<ChainKey, number>>({
    monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0,
  });

  // NEW: transactionsByChain (accumulated from BLOB)
  const [txByChain, setTxByChain] = React.useState<Record<ChainKey, number>>({
    monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0,
  });

  /*
  async function upsertMgid({
    address,
    incrementImages,
    SAWallet,
    usernamefarcaster,
  }: {
    address: `0x${string}`;
    incrementImages: boolean;
    SAWallet?: `0x${string}`;
    usernamefarcaster?: string;
  }) {
    const sessionResp = await fetch('/api/auth/session', { cache: 'no-store' });
    const session = sessionResp.ok ? await sessionResp.json() : null;
    const twitter_username = session?.twitter_username || '';

    const k = currentKey(chain?.id);

    const readResp = await fetch(`/api/mgid-get?address=${address}`, { cache: 'no-store' });
    const existing = readResp.ok ? await readResp.json() : null;

    const row = {
      usernameX: twitter_username,
      usernamefarcaster: usernamefarcaster || existing?.usernamefarcaster || '',
      EOAWallet: address,
      SAWallet: SAWallet || existing?.SAWallet || '',

      LineaBoost: Number(existing?.LineaBoost),
      BaseBoost: Number(existing?.BaseBoost),
      MonadBoost: Number(existing?.MonadBoost),
      MantleBoost: Number(existing?.MantleBoost),
      MitosisBoost: Number(existing?.MitosisBoost),

      totalScore_monad:  Number(existing?.totalScore_monad  ?? scoreByChain.monad),
      totalTransactions_monad: Number(existing?.totalTransactions_monad ?? txByChain.monad),
      totalImages_monad: Number(existing?.totalImages_monad ?? imagesByChain.monad),

      totalScore_base:   Number(existing?.totalScore_base   ?? scoreByChain.base),
      totalTransactions_base: Number(existing?.totalTransactions_base ?? txByChain.base),
      totalImages_base:  Number(existing?.totalImages_base  ?? imagesByChain.base),

      totalScore_mantle: Number(existing?.totalScore_mantle ?? scoreByChain.mantle),
      totalTransactions_mantle: Number(existing?.totalTransactions_mantle ?? txByChain.mantle),
      totalImages_mantle: Number(existing?.totalImages_mantle ?? imagesByChain.mantle),

      totalScore_linea: Number(existing?.totalScore_linea ?? scoreByChain.linea),
      totalTransactions_linea: Number(existing?.totalTransactions_linea ?? txByChain.linea),
      totalImages_linea: Number(existing?.totalImages_linea ?? imagesByChain.linea),

      totalScore_mitosis: Number(existing?.totalScore_mitosis ?? scoreByChain.mitosis),
      totalTransactions_mitosis: Number(existing?.totalTransactions_mitosis ?? txByChain.mitosis),
      totalImages_mitosis: Number(existing?.totalImages_mitosis ?? imagesByChain.mitosis),

      totalScore: 0,
      totalTransactions: 0,
      totalImages: 0,

      updatedAt: Date.now(),
    };

    switch (k) {
      case 'base':
        row.totalScore_base += 1;
        row.totalTransactions_base += 1;
        if (incrementImages) row.totalImages_base += 1;
        break;
      case 'mantle':
        row.totalScore_mantle += 1;
        row.totalTransactions_mantle += 1;
        if (incrementImages) row.totalImages_mantle += 1;
        break;
      case 'linea':
        row.totalScore_linea += 1;
        row.totalTransactions_linea += 1;
        if (incrementImages) row.totalImages_linea += 1;
        break;
      case 'mitosis':
        row.totalScore_mitosis += 1;
        row.totalTransactions_mitosis += 1;
        if (incrementImages) row.totalImages_mitosis += 1;
        break;
      default:
        row.totalScore_monad += 1;
        row.totalTransactions_monad += 1;
        if (incrementImages) row.totalImages_monad += 1;
        break;
    }

    row.totalScore =
      row.totalScore_monad + row.totalScore_base + row.totalScore_mantle + row.totalScore_linea + row.totalScore_mitosis;

    row.totalTransactions =
      row.totalTransactions_monad + row.totalTransactions_base + row.totalTransactions_mantle + row.totalTransactions_linea + row.totalTransactions_mitosis;

    row.totalImages =
      row.totalImages_monad + row.totalImages_base + row.totalImages_mantle + row.totalImages_linea + row.totalImages_mitosis;

    await fetch('/api/mgid-upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row),
    });

    setTxByChain(prev => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
    if (incrementImages) setImagesByChain(prev => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
    setScoreByChain(prev => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
  }
  */

  /*
  const [privyCfg, setPrivyCfg] = React.useState<{ appId: string; providerAppId: string } | null>(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/privy-config', { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { appId: string; providerAppId: string };
        if (alive) setPrivyCfg(j);
      } catch {
        if (alive) setPrivyCfg(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  */

  // Wallet balance (shown in top bar)
  /*
  const { data: balance } = useBalance({
    address,
    chainId: monadTestnet.id,
    query: { enabled: !!address },
  });
  */

  const [imageIds, setImageIds] = React.useState<number[]>([]);
  const [pendingMintType, setPendingMintType] = React.useState<null | 'text' | 'image'>(null);
  const [lastProcessedTx, setLastProcessedTx] = React.useState<string | null>(null);

  // ---------- UI state ----------
  const [topic, setTopic] = React.useState('');
  const [vibe, setVibe] = React.useState('optimistic');
  const [nameOpt, setNameOpt] = React.useState('');
  const [fortune, setFortune] = React.useState('');
  const [genBusy, setGenBusy] = React.useState(false);
  const [mintBusy, setMintBusy] = React.useState(false);
  const [uiError, setUiError] = React.useState<string | null>(null);
  const [lastMinted, setLastMinted] = React.useState<number | null>(null);
  const [holdingIds, setHoldingIds] = React.useState<number[]>([]);
  const [scanNote, setScanNote] = React.useState<string | null>(null);

  const [showAll, setShowAll] = React.useState(false);

  // image minting state
  const [imgPrompt, setImgPrompt] = React.useState('');
  const [imgB64, setImgB64] = React.useState<string | null>(null);
  const [pinCid, setPinCid] = React.useState<string | null>(null);
  const [imgBusy, setImgBusy] = React.useState(false);
  const [pinBusy, setPinBusy] = React.useState(false);
  const [mintImgBusy, setMintImgBusy] = React.useState(false);
  const [zoom, setZoom] = React.useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = React.useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = React.useState('Preview');

  // wallet roast state
  const [roastWallet, setRoastWallet] = React.useState('');
  const [roastBusy, setRoastBusy] = React.useState(false);
  const [roastRenderBusy, setRoastRenderBusy] = React.useState(false);
  const [roastData, setRoastData] = React.useState<any | null>(null);
  const [roastImageUrl, setRoastImageUrl] = React.useState<string | null>(null);
  const [roastImageBlob, setRoastImageBlob] = React.useState<Blob | null>(null);
  const [roastImageB64, setRoastImageB64] = React.useState<string | null>(null);
  const [walletRoastMintStage, setWalletRoastMintStage] =
    React.useState<'idle' | 'pinning' | 'minting'>('idle');

  const { data: onchainMintPrice } = useReadContract({
    address: COOKIE_ADDRESS,
    abi: FortuneABI,
    functionName: 'mintPrice',
    query: { enabled: !!COOKIE_ADDRESS, refetchInterval: 60000 },
  });

  const prevAddrRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (address) prevAddrRef.current = address;
  }, [address]);

  // ---------- Clear everything on disconnect ----------
  const clearWalletUI = React.useCallback(() => {
    setLastMinted(null);
    setHoldingIds([]);
    setScanNote(null);
    setUiError(null);
    qc.removeQueries({ queryKey: ['lastMinted'] });
    qc.removeQueries({ queryKey: ['holdings'] });
    try {
      const a = prevAddrRef.current ?? address ?? '';
      localStorage.removeItem('fc:lastMinted');
      if (a) {
        localStorage.removeItem(`fc:lastMinted:${a}`);
        localStorage.removeItem(`fc:holdings:${a}`);
      }
    } catch {}
  }, [qc, address]);

  useAccountEffect({
    onDisconnect() {
      clearWalletUI();
    },
  });

  // ---------- Queries ----------

  // ---------- Linea Proof of Humanity (no polling) ----------
  const isLinea = connected && chain?.id === CHAIN_IDS.linea;

  const [pohStatus, setPohStatus] = React.useState<{
    loading: boolean;
    isHuman: boolean | null;
    error: boolean;
  }>({
    loading: false,
    isHuman: null,
    error: false,
  });

  React.useEffect(() => {
    if (!isLinea || !address) {
      setPohStatus({ loading: false, isHuman: null, error: false });
      return;
    }

    let cancelled = false;

    const fetchPoH = async () => {
      try {
        setPohStatus({ loading: true, isHuman: null, error: false });

        const res = await fetch(`https://poh-api.linea.build/poh/v2/${address}`);
        if (!res.ok) {
          throw new Error(`PoH HTTP ${res.status}`);
        }

        const txt = (await res.text()).trim().toLowerCase();
        if (cancelled) return;

        setPohStatus({
          loading: false,
          isHuman: txt === 'true',
          error: false,
        });
      } catch {
        if (cancelled) return;
        setPohStatus({
          loading: false,
          isHuman: null,
          error: true,
        });
      }
    };

    fetchPoH();

    return () => {
      cancelled = true;
    };
  }, [isLinea, address]);

  React.useEffect(() => {
    if (!isFarcasterMini) return;
    let alive = true;
    (async () => {
      try {
        const ctx = await (sdk as any).context;
        const uname = ctx?.user?.username || '';
        if (alive) setFcUsername(uname);
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, [isFarcasterMini]);

  const lastMintQ = useQuery({
    queryKey: ['lastMinted', address, chain?.id],
    enabled: !!address && !!COOKIE_ADDRESS && !!chain?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const r = await fetch(`/api/holdings?address=${address}`, {
        cache: 'no-store',
        headers: {
          'x-chain-id': String(chain?.id ?? ''),
        },
      });

      if (!r.ok) return null;

      const j = await r.json();
      const ids = Array.isArray(j?.tokenIds)
        ? j.tokenIds
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isFinite(id))
        : [];

      if (!ids.length) return null;

      return Math.max(...ids);
    },
  });

  React.useEffect(() => {
    if (!connected) return;
    const serverVal = lastMintQ.data;
    if (serverVal != null) {
      setLastMinted(serverVal);
      try {
        localStorage.setItem(`fc:lastMinted:${address}`, String(serverVal));
      } catch {}
      return;
    }
    try {
      const s = localStorage.getItem(`fc:lastMinted:${address}`);
      if (s && !Number.isNaN(Number(s))) setLastMinted(Number(s));
    } catch {}
  }, [connected, address, lastMintQ.data]);

  const holdingsQ = useQuery({
    queryKey: ['holdings', address, chain?.id],
    enabled: !!address && !!COOKIE_ADDRESS,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(
        `/api/holdings?address=${address}`,
        {
          cache: 'no-store',
          headers: { 'x-chain-id': String(chain?.id ?? '') },
        },
      );
      if (!r.ok) return [] as number[];
      const j = await r.json();
      if (j?.note) setScanNote(j.note as string);

      const ids = Array.isArray(j?.tokenIds) ? (j.tokenIds as number[]) : [];
      const imgs = Array.isArray(j?.imageIds) ? (j.imageIds as number[]) : [];

      const uniqIds = Array.from(new Set(ids)).sort((a, b) => a - b);
      const uniqImgs = Array.from(new Set(imgs)).sort((a, b) => a - b);

      setImageIds(uniqImgs);
      return uniqIds;
    },
  });

  React.useEffect(() => {
    if (lastMintQ.isLoading) return;
    if (!connected) return;
    if (lastMintQ.data == null && holdingsQ.data && holdingsQ.data.length > 0) {
      const mx = holdingsQ.data[holdingsQ.data.length - 1];
      setLastMinted(mx);
      try {
        localStorage.setItem(`fc:lastMinted:${address}`, String(mx));
      } catch {}
    }
  }, [connected, address, lastMintQ.isLoading, lastMintQ.data, holdingsQ.data]);

  React.useEffect(() => {
    setHoldingIds(holdingsQ.data ?? []);
  }, [holdingsQ.data]);

  React.useEffect(() => {
    if (!connected || !address) return;

    const ids = Array.isArray(holdingIds)
      ? holdingIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      : [];

    if (!ids.length) {
      setLastMinted(null);
      return;
    }

    const latestHeldId = Math.max(...ids);
    setLastMinted(latestHeldId);

    try {
      localStorage.setItem(`fc:lastMinted:${address}`, String(latestHeldId));
    } catch {}
  }, [connected, address, holdingIds]);

  React.useEffect(() => {
    if (!connected) return;
    const t = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: ['lastMinted', address, chain?.id] });
      qc.invalidateQueries({ queryKey: ['holdings', address, chain?.id] });
    }, 60_000);
    return () => window.clearInterval(t);
  }, [connected, address, qc]);

  const totalScore_current = React.useMemo(
    () => (Array.isArray(holdingIds) ? holdingIds.length : 0),
    [holdingIds]
  );

  const totalImages_current = React.useMemo(
    () => (Array.isArray(imageIds) ? imageIds.length : 0),
    [imageIds]
  );

  React.useEffect(() => {
    if (!connected || !address) return;

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
        console.error('periodic mgid-upsert failed', e);
      }
    };

    tick();

    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected, address]);

  const totalTransactions_current = totalScore_current;

  const displayedIds = React.useMemo(() => {
    const ids = Array.isArray(holdingIds) ? holdingIds : [];
    const desc = [...ids].sort((a, b) => b - a);
    return showAll ? desc : desc.slice(0, 10);
  }, [holdingIds, showAll]);

  /*
  const ALL_CHAIN_IDS: number[] = React.useMemo(
    () => [CHAIN_IDS.monad, CHAIN_IDS.base, CHAIN_IDS.mantle, CHAIN_IDS.mitosis],
    []
  );

  React.useEffect(() => {
    if (!connected || !address) return;

    let alive = true;
    (async () => {
      const getResp = await fetch(`/api/mgid-get?address=${address}`, { cache: 'no-store' });
      const existing = getResp.ok ? await getResp.json() : null;

      const txInit: Record<ChainKey, number> = {
        monad: Number(existing?.totalTransactions_monad ?? 0),
        base: Number(existing?.totalTransactions_base ?? 0),
        mantle: Number(existing?.totalTransactions_mantle ?? 0),
        mitosis: Number(existing?.totalTransactions_mitosis ?? 0),
      };

      if (alive) setTxByChain(txInit);
    })();

    return () => { alive = false; };
  }, [connected, address]);

  const key = currentKey(chain?.id);

  const totalScore_current = scoreByChain[key];
  const totalImages_current = imagesByChain[key];
  const totalTransactions_current = txByChain[key];

  const totalScore_monad  = scoreByChain.monad;
  const totalScore_base   = scoreByChain.base;
  const totalScore_mantle = scoreByChain.mantle;
  const totalScore_mitosis= scoreByChain.mitosis;

  const totalTransactions_monad  = totalScore_monad;
  const totalTransactions_base   = totalScore_base;
  const totalTransactions_mantle = totalScore_mantle;
  const totalTransactions_mitosis= totalScore_mitosis;

  const totalImages_monad  = imagesByChain.monad;
  const totalImages_base   = imagesByChain.base;
  const totalImages_mantle = imagesByChain.mantle;
  const totalImages_mitosis= imagesByChain.mitosis;

  const totalScore =
    scoreByChain.monad + scoreByChain.base + scoreByChain.mantle + scoreByChain.mitosis;

  const totalTransactions =
    txByChain.monad + txByChain.base + txByChain.mantle + txByChain.mitosis;

  const totalImages =
    imagesByChain.monad + imagesByChain.base + imagesByChain.mantle + imagesByChain.mitosis;
  */

  // ---------- Generate with AI ----------
  const onGenerate = async () => {
    setUiError(null);
    setGenBusy(true);
    try {
      const r = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || undefined,
          vibe: vibe || undefined,
          name: nameOpt || undefined,
        }),
      });
      const j = await r.json();
      const f = j?.fortune ?? j?.text ?? j?.message ?? '';
      if (!f) throw new Error('No fortune returned');
      setFortune(f);
    } catch (e: any) {
      setUiError(e?.message || 'Failed to generate fortune');
    } finally {
      setGenBusy(false);
    }
  };

  // ---------- Mint ----------
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);

  const genImage = async () => {
    const prompt = (imgPrompt || '').trim();
    if (!prompt) {
      setUiError('Enter a topic/hint');
      return;
    }
    setUiError(null);
    setImgBusy?.(true);
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, size: '1024x1024' }),
      });

      let data: any = null;
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const b64: string | undefined = data?.b64;
      if (!b64) {
        throw new Error('No image returned');
      }
      setImgB64?.(b64);
      setPinCid?.(null);
    } catch (err: any) {
      setUiError(String(err?.message || err));
      throw err;
    } finally {
      setImgBusy?.(false);
    }
  };

  const saveToPinata = async () => {
    setUiError(null);
    if (!imgB64) { setUiError('No image to save.'); return; }
    setPinBusy(true);
    try {
      const r = await fetch('/api/pinata', { method: 'POST', body: JSON.stringify({ b64: imgB64, filename: 'monad-cookie.png' }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed to save to Pinata');
      setPinCid(j.cid);
    } catch (e: any) {
      setUiError(String(e?.message || e));
    } finally {
      setPinBusy(false);
    }
  };

  const onMintImage = async () => {
    setUiError(null);
    if (!connected || !address) { setUiError('Connect your wallet first.'); return; }
    if (!pinCid) { setUiError('Save the image to Pinata first.'); return; }

    setMintImgBusy(true);
    try {
      const call: any = {
        address: COOKIE_ADDRESS!,
        abi: FortuneABI as Abi,
        functionName: 'mintWithImage',
        args: [`fortune`, `ipfs://${pinCid}`],
      };
      if (typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n) {
        call.value = onchainMintPrice;
      }
      const txHash = await writeContractAsync(call);
      setPendingMintType('image');
      setTxHash(txHash);
      //await upsertMgid({ address: address as `0x${string}`, incrementImages: true, SAWallet: undefined, usernamefarcaster: undefined });
    } catch (e: any) {
      setUiError(String(e?.message || e));
    } finally {
      setMintImgBusy(false);
    }
  };

  /*
  const onMint = async () => {
    setUiError(null);
    if (!connected || !address) {
      setUiError('Connect your wallet first.');
      return;
    }
    if (!fortune?.trim()) {
      setUiError('Enter or generate a fortune first.');
      return;
    }
    setMintBusy(true);
    try {
      const hash = await writeContractAsync({
        address: COOKIE_ADDRESS,
        abi: FortuneABI as Abi,
        functionName: 'mintWithFortune',
        args: [fortune.trim()],
        account: address as `0x${string}`,
        chain: monadTestnet,
        value: 1000000000000000000
      });
      setTxHash(hash);
    } catch (e: any) {
      setUiError(e?.shortMessage || e?.message || 'Mint failed');
    } finally {
      setMintBusy(false);
    }
  };
  */
  const onMint = async () => {
    setUiError(null);
    if (!connected || !address) {
      setUiError('Connect your wallet first.');
      return;
    }
    if (!fortune?.trim()) {
      setUiError('Enter or generate a fortune first.');
      return;
    }
    setMintBusy(true);
    try {
      const call: any = {
        address: COOKIE_ADDRESS!,
        abi: FortuneABI as Abi,
        functionName: 'mintWithFortune',
        args: [fortune],
      };
      if (typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n) {
        call.value = onchainMintPrice;
      }
      const hash = await writeContractAsync(call);
      setPendingMintType('text');
      setTxHash(hash);
      //await upsertMgid({ address: address as `0x${string}`, incrementImages: false, SAWallet: undefined, usernamefarcaster: undefined });
    } catch (e: any) {
      setUiError(String(e?.message || e));
    } finally {
      setMintBusy(false);
    }
  };

  // ---------- Wallet Roast helpers ----------
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to convert blob to base64'));
          return;
        }

        const commaIndex = result.indexOf(',');
        if (commaIndex === -1) {
          reject(new Error('Invalid data URL'));
          return;
        }

        resolve(result.slice(commaIndex + 1));
      };

      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyImageToClipboard(blob: Blob) {
    if (!navigator.clipboard || !(window as any).ClipboardItem) {
      throw new Error('Clipboard image copy is not supported in this browser');
    }

    const item = new (window as any).ClipboardItem({
      [blob.type]: blob,
    });

    await navigator.clipboard.write([item]);
  }

  function buildWalletRoastShareText(roast: any) {
    const headline = roast?.roast_text?.headline || 'Wallet Roast';
    const archetype = roast?.classification?.archetype || 'Onchain Civilian';
    return `${headline} | Archetype: ${archetype} 🍪`;
  }


  const openPreviewLightbox = React.useCallback((src: string, alt = 'Preview') => {
    setLightboxImageUrl(src);
    setLightboxAlt(alt);
  }, []);

  const closePreviewLightbox = React.useCallback(() => {
    setLightboxImageUrl(null);
  }, []);

  React.useEffect(() => {
    if (!lightboxImageUrl) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImageUrl(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImageUrl]);

const generateWalletRoast = async () => {
  setUiError(null);

  const walletToAnalyze = (roastWallet || address || '').trim();
  if (!walletToAnalyze) {
    setUiError('Paste wallet address or connect wallet.');
    return;
  }

  setRoastBusy(true);
  setRoastRenderBusy(true);

  try {
    const analyzeRes = await fetch('/api/wallet-roast/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet: walletToAnalyze }),
    });

    const analyzeData = await analyzeRes.json();
    if (!analyzeRes.ok) {
      throw new Error(analyzeData?.error || 'Failed to analyze wallet');
    }

    if (roastImageUrl) {
      URL.revokeObjectURL(roastImageUrl);
    }

    setRoastData(analyzeData);
    setRoastImageUrl(null);
    setRoastImageBlob(null);
    setRoastImageB64(null);
    setPinCid(null);
    setWalletRoastMintStage('idle');

    const renderRes = await fetch('/api/wallet-roast/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(analyzeData),
    });

    const renderContentType = renderRes.headers.get('content-type') || '';

    if (!renderRes.ok) {
      if (renderContentType.includes('application/json')) {
        const renderErr = await renderRes.json();
        throw new Error(renderErr?.error || 'Failed to render roast card');
      }

      const renderText = await renderRes.text();
      throw new Error(renderText || 'Failed to render roast card');
    }

    const blob = await renderRes.blob();
    const url = URL.createObjectURL(blob);
    const b64 = await blobToBase64(blob);

    setRoastImageBlob(blob);
    setRoastImageUrl(url);
    setRoastImageB64(b64);
  } catch (e: any) {
    setUiError(String(e?.message || e));
  } finally {
    setRoastBusy(false);
    setRoastRenderBusy(false);
  }
};

  const onMintWalletRoast = async () => {
    setUiError(null);

    if (!roastImageB64) {
      setUiError('Render wallet roast first.');
      return;
    }

    setImgB64(roastImageB64);
    setPinCid(null);
    setWalletRoastMintStage('pinning');
  };

  const onDownloadWalletRoast = async () => {
    try {
      if (!roastImageBlob) throw new Error('Render wallet roast first.');
      downloadBlob(roastImageBlob, 'wallet-roast.png');
    } catch (e: any) {
      setUiError(String(e?.message || e));
    }
  };

  const onCopyWalletRoast = async () => {
    try {
      if (!roastImageBlob) throw new Error('Render wallet roast first.');
      await copyImageToClipboard(roastImageBlob);
    } catch (e: any) {
      setUiError(String(e?.message || e));
    }
  };

  /*
  const onShareWalletRoast = async () => {
    try {
      if (!roastData) throw new Error('Analyze wallet first.');

     // const walletUsed = (roastWallet || address || '').trim();
      const light_roast = roastData?.roast_text?.light_roast || 'Wallet Roast';
      const archetype = roastData?.classification?.archetype || 'Onchain Civilian';
      const verdict = roastData?.roast_text?.verdict || 'Wallet Roast';

      const text =
        `Wallet Roast: ${light_roast}\n` +
        `Archetype: ${archetype}\n` +
        `Verdict: ${verdict}\n` +
        //`${walletUsed ? `Wallet: ${walletUsed}\n` : ''}` +
        `Made with Cookieverse 🍪 on @base 🟦`;

      const appUrl =
        typeof window !== 'undefined'
          ? window.location.origin + (pathname || '')
          : undefined;

      if (isFarcasterMini) {
        await (sdk as any).actions.composeCast({
          text,
          embeds: appUrl ? [appUrl] : undefined,
        });
        return;
      }

      const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}${appUrl ? `&url=${encodeURIComponent(appUrl)}` : ''
        }`;

      window.open(xUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setUiError(String(e?.message || e));
    }
  };
*/

const onShareWalletRoast = async () => {
  try {
    setUiError(null);

    if (!roastData) {
      throw new Error('Analyze wallet first.');
    }

    if (!roastImageBlob) {
      throw new Error('Render wallet roast image first.');
    }

    const basename =
      roastData?.identity?.basename ||
      roastData?.identity?.label ||
      roastData?.identity?.name_tag ||
      shortAddress(roastData?.wallet) ||
      'Unknown wallet';

    const lightRoast =
      roastData?.roast_text?.light_roast || 'Wallet Roast';

    const archetype =
      roastData?.classification?.archetype || 'Onchain Civilian';

    const verdict =
      roastData?.roast_text?.verdict || 'Wallet Roast';

    const appUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${isBaseAppRoute ? '/app' : '/'}`
        : 'https://www.cookieverse.tech/app';

    const text =
      `Name: ${basename}\n` +
      `Wallet Roast: ${lightRoast}\n` +
      `Archetype: ${archetype}\n` +
      `Verdict: ${verdict}\n\n` +
      `Wallet Roast Made with Cookieverse 🍪 on @base 🟦 and powered with @0G_labs, @canva and @etherscan`;

    if (isFarcasterMini) {
      await (sdk as any).actions.composeCast({
        text,
        embeds: [appUrl],
      });
      return;
    }

const result = await shareToX({
  text,
  url: appUrl,
  imageBlob: roastImageBlob,
  filename: 'cookieverse-wallet-roast.png',
});

if (result.ok) {
  if (result.method === 'native-image-share') {
    setUiError(null);
    return;
  }

  if (result.method === 'clipboard-plus-x-intent') {
    setUiError(
      'Text copied. X composer opened with text/link. If image is missing, attach it manually.',
    );
    return;
  }

  if (result.method === 'x-intent') {
    setUiError(
      'X composer opened with text/link. Image sharing is not supported by X Web Intent.',
    );
    return;
  }
}

if ('error' in result && result.error !== 'Share cancelled.') {
  throw new Error(result.error);
}
  } catch (e: any) {
    setUiError(String(e?.message || e));
  }
};

  React.useEffect(() => {
    if (walletRoastMintStage !== 'pinning') return;
    if (!imgB64) return;

    let cancelled = false;

    (async () => {
      try {
        await saveToPinata();
        if (!cancelled) {
          setWalletRoastMintStage('minting');
        }
      } catch {
        if (!cancelled) {
          setWalletRoastMintStage('idle');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletRoastMintStage, imgB64]);

  React.useEffect(() => {
    if (walletRoastMintStage !== 'minting') return;
    if (!pinCid) return;

    let cancelled = false;

    (async () => {
      try {
        await onMintImage();
      } finally {
        if (!cancelled) {
          setWalletRoastMintStage('idle');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletRoastMintStage, pinCid]);


  React.useEffect(() => {
    return () => {
      if (roastImageUrl) URL.revokeObjectURL(roastImageUrl);
    };
  }, [roastImageUrl]);

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash });


const onShareCookieToX = React.useCallback(
  async (params: {
    tokenId: number;
    url: string;
  }) => {
    try {
      setUiError(null);

      if (isFarcasterMini) {
        await (sdk as any).actions.composeCast({
          text: makeXShareText(chain?.name, params.tokenId),
          embeds: [params.url],
        });
        return;
      }

      const result = await shareToX({
        text: makeXShareText(chain?.name, params.tokenId),
        url: params.url,
        filename: `cookie-${params.tokenId}.png`,
      });

      if (result.ok) {
        if (result.method === 'clipboard-plus-x-intent') {
          setUiError('Text copied. X composer opened.');
        }

        if (result.method === 'x-intent') {
          setUiError('X composer opened.');
        }

        return;
      }

      if ('error' in result && result.error !== 'Share cancelled.') {
        throw new Error(result.error);
      }
    } catch (e: any) {
      setUiError(String(e?.message || e));
    }
  },
  [chain?.name, isFarcasterMini],
);


  // Parse receipt logs safely with parseEventLogs
  React.useEffect(() => {
    if (!isConfirmed || !receipt || !address || !txHash) return;

    const ok =
      (receipt as any)?.status === 'success' ||
      (typeof (receipt as any)?.status === 'number' && (receipt as any).status === 1);

    const sameTx =
      typeof (receipt as any)?.transactionHash === 'string' &&
      (receipt as any).transactionHash.toLowerCase() === txHash.toLowerCase();

    if (!ok || !sameTx || lastProcessedTx === txHash) return;

    let foundTokenId: number | null = null;

    try {
      const decoded = parseEventLogs({
        abi: FortuneABI as Abi,
        logs: (receipt.logs ?? []) as any,
      });

      for (const ev of decoded) {
        if (!ev || (ev as any).eventName == null) continue;

        const evAddr = (ev as any).address as `0x${string}` | undefined;
        if (evAddr && evAddr.toLowerCase() !== COOKIE_ADDRESS!.toLowerCase()) continue;

        if (ev.eventName === 'CookieMinted') {
          const args: any = ev.args;
          const tid = Number(args?.tokenId ?? args?.tokenID ?? args?.id);
          const minter = args?.minter as `0x${string}` | undefined;
          if (!Number.isNaN(tid) && (!minter || isAddressEqual(minter, address as `0x${string}`))) {
            foundTokenId = tid;
            break;
          }
        }

        if (ev.eventName === 'Transfer') {
          const args: any = ev.args;
          const from = args?.from as `0x${string}`;
          const to = args?.to as `0x${string}`;
          const tid = Number(args?.tokenId);
          if (
            from &&
            to &&
            isAddressEqual(from, zeroAddress) &&
            isAddressEqual(to, address as `0x${string}`) &&
            !Number.isNaN(tid)
          ) {
            foundTokenId = tid;
            break;
          }
        }
      }
    } catch {
      // ignore parsing errors
    }

    if (foundTokenId != null) {
      setLastMinted(foundTokenId);
      try {
        localStorage.setItem(`fc:lastMinted:${address}`, String(foundTokenId));
      } catch {}
    }

    if (pendingMintType) {
      (async () => {
        try {
          await fetch('/api/mgid-upsert', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-farcaster-username': fcUsername },
            body: JSON.stringify({ address }),
          });
        } catch (e) {
          console.error('mgid-upsert failed', e);
        } finally {
          setLastProcessedTx(txHash);
          setPendingMintType(null);
          setTxHash(undefined);
        }
      })();
    }

    qc.invalidateQueries({ queryKey: ['lastMinted', address, chain?.id] });
    qc.invalidateQueries({ queryKey: ['holdings', address, chain?.id] });
  }, [isConfirmed, receipt, address, qc, chain?.id, txHash, pendingMintType, lastProcessedTx]);


  const content = (
    <main className="page">
      {uiError ? <div className="alert">{uiError}</div> : null}
      {confirmError ? (
        <div className="alert">
          {(confirmError as any)?.shortMessage ||
            (confirmError as any)?.message ||
            String(confirmError)}
        </div>
      ) : null}

      <div className="grid">
        {/* LEFT: Mint Card */}
        <section className="card card--fortune">
          <h2 className="card__title">Generate Fortune</h2>

          <div className="two-col">
            <div className="field field--full">
              <label className="label">Prompt </label>
              <input
                className="input"
                placeholder="e.g., gas efficiency, launch day, testnet"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="row">
              <div className="field field--full">
                <label className="label">Vibe</label>
                <input
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  className="input"
                  placeholder="optimistic"
                />
              </div>
              <div className="field field--full">
                <label className="label">Name (optional)</label>
                <input
                  value={nameOpt}
                  onChange={(e) => setNameOpt(e.target.value)}
                  className="input"
                  placeholder="your name/team"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--primary"
            onClick={onGenerate}
            disabled={genBusy}
          >
            {genBusy ? 'Generating…' : 'Generate with AI'}
          </button>

          <div className="two-col">
            <div className="field field--full">
              <label className="label">Fortune (preview)</label>
              <textarea
                className="textarea"
                value={fortune}
                onChange={(e) => setFortune(e.target.value)}
                placeholder="Your fortune will appear here…"
              />
              <p className="hint">Tip: keep under ~160 chars (contract allows up to 240 bytes).</p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--accent"
            onClick={onMint}
            disabled={mintBusy || isConfirming || !connected}
          >
            {mintBusy ? 'Waiting for wallet…' : isConfirming ? 'Confirming…' : 'Mint This Fortune'}
          </button>
        </section>

        {/* Wallet Roast */}
        <section className="card card--image card--wallet-roast">
          <h2 className="card__title card__title--blue">Wallet Roast (based only 🟦)</h2>

          <p className="hint" style={{ marginBottom: 12 }}>
            Paste any wallet address or use your connected address. Generate a roast card, preview it, share it, copy it, download it, and mint it.
          </p>

          <div className="row">
            <div className="col">
              <label className="label">Wallet Address</label>
              <input
                className="input"
                value={roastWallet}
                onChange={(e) => setRoastWallet(e.target.value)}
                placeholder={address || '0x...'}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn--primary"
                  onClick={generateWalletRoast}
                  disabled={roastBusy || roastRenderBusy}
                >
                  {roastBusy || roastRenderBusy ? 'Generating Roast…' : 'Generate Wallet Roast'}
                </button>
              </div>

              {roastData ? (
                <>
                  <div className="hint" style={{ marginTop: 10 }}>
                    Archetype: <strong>{roastData.classification?.archetype}</strong>
                  </div>

                  <div className="hint" style={{ marginTop: 6 }}>
                    Roast: {roastData.roast_text?.headline}
                  </div>
                </>
              ) : null}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn--primary"
                  onClick={onDownloadWalletRoast}
                  disabled={!roastImageBlob}
                >
                  Download
                </button>

                <button
                  className="btn btn--primary"
                  onClick={onCopyWalletRoast}
                  disabled={!roastImageBlob}
                >
                  Copy
                </button>

                <button
                  className="btn btn--primary"
                  onClick={onShareWalletRoast}
                  disabled={!roastData}
                >
                  {isFarcasterMini ? 'Share on Farcaster' : 'Share on X'}
                </button>
              </div>
            </div>

            <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="label">Preview</label>

              <div
                onClick={() => {
                  if (roastImageUrl) openPreviewLightbox(roastImageUrl, 'Wallet Roast preview');
                }}
                title={roastImageUrl ? 'Click to open full preview' : undefined}
                style={{
                  border: '1px solid rgba(63,63,70,0.7)',
                  borderRadius: 12,
                  padding: 8,
                  minHeight: 340,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(24,24,28,0.5)',
                  cursor: roastImageUrl ? 'zoom-in' : 'default',
                  overflow: 'hidden',
                }}
              >
                {roastImageUrl ? (
                  <img
                    src={roastImageUrl}
                    alt="Wallet Roast preview"
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 340,
                      borderRadius: 8,
                      display: 'block',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                  />
                ) : roastData ? (
                  <div className="muted" style={{ textAlign: 'center' }}>
                    <div>{roastData.roast_text?.headline || 'Roast ready'}</div>
                    <div style={{ marginTop: 8 }}>
                      {roastData.classification?.archetype || 'Archetype pending'}
                    </div>
                  </div>
                ) : (
                  <span className="muted">No roast yet</span>
                )}
              </div>

              <button
                className="btn btn--accent"
                onClick={onMintWalletRoast}
                disabled={!roastImageB64 || walletRoastMintStage !== 'idle' || pinBusy || mintImgBusy || isConfirming || !connected}
              >
                {walletRoastMintStage === 'pinning'
                  ? 'Saving to Pinata…'
                  : walletRoastMintStage === 'minting' || mintImgBusy
                    ? 'Waiting for wallet…'
                    : isConfirming
                      ? 'Confirming…'
                      : 'Mint this Roast'}
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT: Status Card */}
        <section className="card card--status">
          <h2 className="card__title">Status</h2>

          <div className="status">
            <div className="status__row">
              <span className="muted">Status:</span>
              <span className={`pill ${connected ? 'pill--ok' : 'pill--off'}`}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Linea Proof of Humanity */}
            {isLinea && (
              <>
                <div className="status__row">
                  <span className="muted">Proof of Humanity:</span>

                  {pohStatus.loading ? (
                    <span className="pill pill--off">Checking…</span>
                  ) : pohStatus.error ? (
                    <span className="pill pill--warn">Error</span>
                  ) : pohStatus.isHuman === true ? (
                    <span className="pill pill--human-true">Verified</span>
                  ) : pohStatus.isHuman === false ? (
                    <span className="pill pill--human-false">Not verified</span>
                  ) : (
                    <span className="pill pill--off">—</span>
                  )}
                </div>

                {pohStatus.isHuman === false && (
                  <div className="status__note">
                    To verify your humanity,&nbsp;
                    <a
                      href="https://linea.build/hub"
                      target="_blank"
                      rel="noreferrer"
                      className="link link--inline"
                    >
                      visit the Linea Hub
                    </a>
                    , select <strong>Connect</strong> in the upper right corner, and
                    complete the <strong>Verify Humanity</strong> steps.
                  </div>
                )}
              </>
            )}

            <div className="status__row">
              <span className="muted">Network:</span>
              <span>{connected ? chain?.name ?? '—' : '—'}</span>
            </div>
            <div className="status__row">
              <span className="muted">Address:</span>
              <span>
                {connected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}
              </span>
            </div>

            <div className="status__row">
              <span className="muted">Total mints:</span>
              <span>{connected ? totalScore_current : '—'}</span>
            </div>
            <div className="status__row">
              <span className="muted">Total Minted Images:</span>
              <span>{connected ? totalImages_current : '—'}</span>
            </div>
            <div className="status__row">
              <span className="muted">Total Minted Fortunes:</span>
              <span>{connected ? totalScore_current - totalImages_current : '—'}</span>
            </div>
            <div className="status__row">
              <span className="muted">Total Transactions:</span>
              <span>{connected ? totalTransactions_current : '—'}</span>
            </div>
          </div>

          {/* Last minted */}
          <div className="block">
            <div className="block__title">Last minted</div>
            {!connected ? (
              <div className="dash">—</div>
            ) : lastMintQ.isLoading ? (
              <div className="muted">loading…</div>
            ) : lastMinted == null ? (
              <div className="dash">—</div>
            ) : (
              <div className="line">
                <span>{`COOKIE #${lastMinted}`}</span>
                {(() => {
                  const url = COOKIE_ADDRESS
                    ? makeExplorerNftUrl(chain?.id, COOKIE_ADDRESS, lastMinted)
                    : '#';

                  return (
                    <>
                      <a href={url} target="_blank" rel="noreferrer" className="link">
                        view
                      </a>

                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          onShareCookieToX({
                            tokenId: lastMinted,
                            url,
                          })
                        }
                        style={{
                          background: 'transparent',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                      >
                        share on X
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Holdings */}
          <div className="block">
            <div className="block__title">
              All minted to this wallet <span className="muted">(currently holding)</span>
            </div>

            {!connected ? (
              <div className="dash">—</div>
            ) : holdingsQ.isLoading ? (
              <div className="muted">loading…</div>
            ) : holdingIds.length === 0 ? (
              <div className="dash">—</div>
            ) : (
              <ul className="list">
                {displayedIds.map((id) => (
                  <li key={id} className="line">
                    <span>{`COOKIE #${id}`}</span>
                    {(() => {
                      const url = COOKIE_ADDRESS
                        ? makeExplorerNftUrl(chain?.id, COOKIE_ADDRESS, id)
                        : '#';

                      return (
                        <>
                          <a href={url} target="_blank" rel="noreferrer" className="link">
                            view
                          </a>

                          <button
                            type="button"
                            className="link"
                            onClick={() =>
                              onShareCookieToX({
                                tokenId: id,
                                url,
                              })
                            }
                            style={{
                              background: 'transparent',
                              border: 0,
                              padding: 0,
                              cursor: 'pointer',
                              font: 'inherit',
                            }}
                          >
                            share on X
                          </button>
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}

            {holdingIds.length > 10 && (
              <div style={{ marginTop: 8 }}>
                <button className="btn btn--primary" onClick={() => setShowAll(v => !v)}>
                  {showAll ? 'Show less' : 'Show all'}
                </button>
              </div>
            )}

            {connected && scanNote ? <div className="note">{scanNote}</div> : null}
          </div>
        </section>
      </div>

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
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (min-width: 900px) {
          .card--status { grid-column: 3; order: 3; }
          .card--image { grid-column: 1; order: 1; }
          .card--fortune { grid-column: 2; order: 2; }
        }

        .col { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
        .card {
          background: rgba(24, 24, 28, 0.82);
          border: 1px solid rgba(63, 63, 70, 0.7);
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .card--wallet-roast {
          border: 1px solid rgba(59, 130, 246, 0.55);
          box-shadow:
            0 0 0 1px rgba(59, 130, 246, 0.12),
            0 12px 34px rgba(29, 78, 216, 0.18);
        }
        .card__title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #a1a1aa;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .card__title--blue {
          color: #93c5fd;
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
        .pill--human-true {
          background: radial-gradient(circle at 0 0, #22c55e 0, #15803d 55%, #052e16 100%);
          color: #bbf7d0;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.4);
          font-weight: 600;
        }
        .pill--human-false {
          background: radial-gradient(circle at 0 0, #b91c1c 0, #7f1d1d 55%, #450a0a 100%);
          color: #fecaca;
          box-shadow: 0 0 10px rgba(248, 113, 113, 0.4);
          font-weight: 600;
        }
        .pill--warn {
          background: rgba(202, 138, 4, 0.25);
          color: #facc15;
        }
        .status__note {
          margin-top: 4px;
          font-size: 12px;
          color: #e5e7eb;
          line-height: 1.5;
          max-width: 360px;
        }
        .link--inline {
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 600;
        }
      `}</style>
      {lightboxImageUrl && (
        <div
          onClick={closePreviewLightbox}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 9999,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxImageUrl}
            alt={lightboxAlt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(92vw, 1100px)',
              maxHeight: '92vh',
              width: 'auto',
              height: 'auto',
              borderRadius: 16,
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              display: 'block',
              background: '#0b0b0f',
            }}
          />
          <button
            type="button"
            onClick={closePreviewLightbox}
            aria-label="Close preview"
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              width: 42,
              height: 42,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(20,20,24,0.82)',
              color: '#fff',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}

    </main>
  );

  /*
  return privyCfg ? (
    <PrivyProvider
      appId={privyCfg.appId}
      config={{
        loginMethodsAndOrder: {
          primary: [`privy:${privyCfg.providerAppId}`],
        },
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
      }}
    >
      {content}
    </PrivyProvider>
  ) : (
    content
  );
  */
  return content;
}