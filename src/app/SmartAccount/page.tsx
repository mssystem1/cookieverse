/*
'use client';

import * as React from 'react';
import type { Abi } from 'viem';
import { parseAbi } from 'viem';        
import { isAddressEqual, parseEventLogs, encodeFunctionData, parseEther, zeroAddress, type Address   } from 'viem';
import {
  useAccount,
  useAccountEffect,
  useWaitForTransactionReceipt,
  useWriteContract,
  useBalance,
  useReadContract, 
  useWalletClient,
} from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SaStatusCard } from '../../../src/components/SaStatusCard';
import { useSmartAccount } from '../../app/SmartAccountProvider';
import { bundlerClient } from '../../../src/lib/aa/clients';

// + ADD (keep your other imports intact)
import { buildSmartAccount } from '../../../src/lib/aa/smartAccount';

// ⬇️ RELATIVE imports (keep your own)
import FortuneABI from '../../abi/FortuneCookiesAI.json';
import { monadTestnet } from '../../lib/chain';

import { usePathname } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';

// [FIXED] Privy + banner
//import { PrivyProvider } from '@privy-io/react-auth';
//import MonadGamesIdBanner from '../components/MonadGamesIdBanner';

const CHAIN_IDS = {
  monad: 10143,
  base: 8453,
  mantle: 5000,
  linea: 59144,  
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
} as const;

function cookieAddressFor(chainId?: number): `0x${string}` | undefined {
  if (chainId === CHAIN_IDS.base)    return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (chainId === CHAIN_IDS.mantle)  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (chainId === CHAIN_IDS.linea)  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;  
  if (chainId === CHAIN_IDS.mitosis) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  // default → Monad testnet
  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`;
}

function makeExplorerNftUrl(chainId: number | undefined, contract: `0x${string}`, tokenId: number): string {
  // Known explorers
  if (chainId === CHAIN_IDS.base)    return `https://basescan.org/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.mantle)  return `https://mantlescan.xyz/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.linea)  return `https://lineascan.build/token/${contract}?a=${tokenId}`;  
  if (chainId === CHAIN_IDS.mitosis) return `https://mitoscan.io/token/${contract}?a=${tokenId}`;
  // Monad testnet
  return `https://testnet.monadexplorer.com/nft/${contract}/${tokenId}`;
}

function makeXShareUrl(chainName: string | undefined, url: string, tokenId: number): string {
  const net = chainName || 'this network';
  const text = `My COOKIE #${tokenId} on ${net} 🍪✨`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

//const MIN_ABI = parseAbi([
//  'function mintPrice() view returns (uint256)',
 // If your contract takes different args (e.g., (string imageCid, string fortune)), adjust here and in onMintImage()
 // 'function mintWithImage(string fortune, string imageCid) payable returns (uint256)',
//]);

// Minimal AA sender to avoid TS2589 noise
const sendSaUo = async ({
  sa,
  to,
  data,
  value,
}: {
  sa: any; // SmartAccount at runtime
  to: Address;
  data: `0x${string}`;
  value: bigint;
}) => {
  // 1) submit the UserOperation → get userOp hash
  const uoHash = await (bundlerClient as any).sendUserOperation({
    account: sa as any,
    calls: [{ to, data, value }] as any,
  });

  // 2) wait for bundler to include it → get UserOp receipt
  const uoReceipt = await (bundlerClient as any).waitForUserOperationReceipt({
    hash: uoHash,
  });

  // 3) extract L1/L2 transaction hash from receipt
  const txHash =
    (uoReceipt?.receipt?.transactionHash ??
      uoReceipt?.transactionHash ??
      uoReceipt?.logs?.[0]?.transactionHash) as `0x${string}` | undefined;

  if (!txHash) throw new Error('No transaction hash returned by bundler');

  return txHash;
};

export default function Page() {
  const qc = useQueryClient();
  const { address, chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const connected = isConnected && !!address;
  const COOKIE_ADDRESS = React.useMemo(
      () => cookieAddressFor(chain?.id),
      [chain?.id]
    );
  if (connected && !COOKIE_ADDRESS) {
    return <main className="page"><div className="muted">Unsupported network.</div></main>;
    }

  const pathname = usePathname();
  const isMini = !!pathname && pathname.startsWith('/mini');
    
  const [fcUsername, setFcUsername] = React.useState<string>('');

  type ChainKey = 'monad' | 'base' | 'mantle' | 'mitosis' | 'linea';
    
      const CHAIN_BY_ID: Record<number, ChainKey> = {
        [CHAIN_IDS.monad]: 'monad',
        [CHAIN_IDS.base]: 'base',
        [CHAIN_IDS.mantle]: 'mantle',
        [CHAIN_IDS.linea]: 'linea',        
        [CHAIN_IDS.mitosis]: 'mitosis',
      };
    
      function currentKey(id?: number): ChainKey {
        return id && CHAIN_BY_ID[id] ? CHAIN_BY_ID[id] : 'monad';
      }
    
      // scoreByChain & imagesByChain come from holdings (you already set these as shown earlier)
    const [scoreByChain, setScoreByChain] = React.useState<Record<ChainKey, number>>({
      monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0,
    });
    const [imagesByChain, setImagesByChain] = React.useState<Record<ChainKey, number>>({
      monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0,
    });
    
    // NEW: transactionsByChain (accumulated from BLOB)
    const [txByChain, setTxByChain] = React.useState<Record<ChainKey, number>>({
      monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0,
    });
    
    
    async function upsertMgid({
      address,
      incrementImages,
      SAWallet,                 // pass from your smart-account page; on main page pass undefined
      usernamefarcaster,        // pass from mini when Farcaster connected; otherwise undefined
    }: {
      address: `0x${string}`;
      incrementImages: boolean;  // true only for onMintImage
      SAWallet?: `0x${string}`;
      usernamefarcaster?: string;
    }) {
      // 1) X username from session (client-side)
      const sessionResp = await fetch('/api/auth/session', { cache: 'no-store' });
      const session = sessionResp.ok ? await sessionResp.json() : null;
      const twitter_username = session?.twitter_username || '';
    
      // 2) current chain key
      const k = currentKey(chain?.id);
    
      // 3) read existing row
      const readResp = await fetch(`/api/mgid-get?address=${address}`, { cache: 'no-store' });
      const existing = readResp.ok ? await readResp.json() : null;
    
      // 4) build base row using your requested field names
      const row = {
        usernameX: twitter_username,
        usernamefarcaster: usernamefarcaster || existing?.usernamefarcaster || '',  // keep if already present
        EOAWallet: address,
        SAWallet: SAWallet || existing?.SAWallet || '',

        LineaBoost: Number(existing?.LineaBoost),
        BaseBoost: Number(existing?.BaseBoost),
        MonadBoost: Number(existing?.MonadBoost),
        MantleBoost: Number(existing?.MantleBoost),
        MitosisBoost: Number(existing?.MitosisBoost),
    
        // per-chain: seed from existing if available, else from current derived maps
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
    
        // totals (recomputed next)
        totalScore: 0,
        totalTransactions: 0,
        totalImages: 0,
   
        updatedAt: Date.now(),
      };
    
      // 5) increment ONLY the selected chain counters
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
        default: // monad
          row.totalScore_monad += 1;
          row.totalTransactions_monad += 1;
          if (incrementImages) row.totalImages_monad += 1;
          break;
      }
    
      // 6) recompute totals
      row.totalScore =
        row.totalScore_monad + row.totalScore_base + row.totalScore_mantle + row.totalScore_linea +  row.totalScore_mitosis;
    
      row.totalTransactions =
        row.totalTransactions_monad + row.totalTransactions_base + row.totalTransactions_mantle + row.totalTransactions_linea + row.totalTransactions_mitosis;
    
      row.totalImages =
        row.totalImages_monad + row.totalImages_base + row.totalImages_mantle + row.totalImages_linea +  row.totalImages_mitosis;
    
      // 7) write to BLOB
      await fetch('/api/mgid-upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(row),
      });
    
      // 8) update local txByChain so UI reflects increment immediately
      setTxByChain(prev => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
      if (incrementImages) setImagesByChain(prev => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
      setScoreByChain(prev => ({ ...prev, [k]: (prev[k] ?? 0) + 1 }));
    }


  // [FIXED] load Privy config from server-only env via /api/privy-config
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

  // Wallet balance (shown in top bar)
 // const { data: balance } = useBalance({
 //   address,
 //   chainId: monadTestnet.id,
//    query: { enabled: !!address },
 // });

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

  const { data: onchainMintPrice } = useReadContract({
    address: COOKIE_ADDRESS,
    abi: FortuneABI,
    functionName: 'mintPrice',
    query: { refetchInterval: 120000 }, // 120s
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

  // + ADD (don’t remove your current address logic)
const { mode, eoaAddress, saAddress, saReady, saBalance } = useSmartAccount();

// The wallet address that should drive reads (holdings)
//const selectedAddress: Address | undefined = mode === 'sa' ? saAddress : eoaAddress;

  // ---------- Queries ----------

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

const lastMintQ = useQuery({
  queryKey: ['lastMinted', saAddress, chain?.id],
  enabled: !!address && !!COOKIE_ADDRESS,
  staleTime: 60_000,
  queryFn: async () => {
    const r = await fetch(`/api/holdings?address=${saAddress}&contract=${COOKIE_ADDRESS}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const ids = Array.isArray(j?.tokenIds) ? (j.tokenIds as number[]) : [];
    if (!ids.length) return null;
    return Math.max(...ids);
  },
});

  // Load localStorage fallback on connect (only if server returned null)
  React.useEffect(() => {
    if (!connected) return;
    const serverVal = lastMintQ.data;
    if (serverVal != null) {
      setLastMinted(serverVal);
      try {
        localStorage.setItem(`fc:lastMinted:${saAddress}`, String(serverVal));
      } catch {}
      return;
    }
    // server null/404 → try localStorage
    try {
      const s = localStorage.getItem(`fc:lastMinted:${saAddress}`);
      if (s && !Number.isNaN(Number(s))) setLastMinted(Number(s));
    } catch {}
  }, [connected, saAddress, lastMintQ.data]);


  const holdingsQ = useQuery({
    queryKey: ['holdings', saAddress, chain?.id],
    enabled: !!address && !!COOKIE_ADDRESS,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(
        `/api/holdings?address=${saAddress}`, // &contract=${COOKIE_ADDRESS}
        {
            cache: 'no-store',
            headers: { 'x-chain-id': String(chain?.id ?? '') },  // ← this tells the server the connected chain
          },
      );
      if (!r.ok) return [] as number[];
      //const j = await r.json();
      //if (j?.note) setScanNote(j.note as string);
      //const ids = Array.isArray(j?.tokenIds) ? (j.tokenIds as number[]) : [];
      //return Array.from(new Set(ids)).sort((a, b) => a - b);
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

  // If lastMint still null but we have holdings, use max tokenId as fallback
  React.useEffect(() => {
    if (lastMintQ.isLoading) return;
    if (!connected) return;
    if (lastMintQ.data == null && holdingsQ.data && holdingsQ.data.length > 0) {
      const mx = holdingsQ.data[holdingsQ.data.length - 1];
      setLastMinted(mx);
      try {
        localStorage.setItem(`fc:lastMinted:${saAddress}`, String(mx));
      } catch {}
    }
  }, [connected, saAddress, lastMintQ.isLoading, lastMintQ.data, holdingsQ.data]);

  React.useEffect(() => {
    setHoldingIds(holdingsQ.data ?? []);
  }, [holdingsQ.data]);

  // Gentle refresh every 60s while connected
  React.useEffect(() => {
    if (!connected) return;
    const t = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: ['lastMinted', saAddress, chain?.id] });
      qc.invalidateQueries({ queryKey: ['holdings', saAddress, chain?.id] });
    }, 60_000);
    return () => window.clearInterval(t);
  }, [connected, saAddress, qc]);

  const totalScore_current = React.useMemo(
    () => (Array.isArray(holdingIds) ? holdingIds.length : 0),
    [holdingIds]
  );

  const totalImages_current = React.useMemo(
    () => (Array.isArray(imageIds) ? imageIds.length : 0),
    [imageIds]
  );

    // Periodically push on-chain state into BLOB leaderboard (every 60s)
  React.useEffect(() => {
    if (!connected || !address) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fetch('/api/mgid-upsert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address }),
        });
      } catch (e) {
        console.error('periodic mgid-upsert failed', e);
      }
    };

    // optional: first sync immediately
    tick();

    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected, address]);

  // Transactions == Score in your semantics
  const totalTransactions_current = totalScore_current;

  const displayedIds = React.useMemo(() => {
  const ids = Array.isArray(holdingIds) ? holdingIds : [];
  const desc = [...ids].sort((a, b) => b - a); // newest → oldest
  return showAll ? desc : desc.slice(0, 10);
  }, [holdingIds, showAll]);

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
//  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);


  const genImage = async () => {
    const prompt = (imgPrompt || '').trim();
    if (!prompt) {
      setUiError('Enter a topic/hint');
      // Optional: toast or inline error UI
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

      // Always parse JSON; surface server error text
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
      setPinCid?.(null); // reset any previous CID
    } catch (err: any) {
      setUiError(String(err?.message || err));
      throw err; // keep existing catch path behavior if you have one
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

  // --- Smart Account path (ONLY when Smart is ON) ---
  if (mode === 'sa' && bundlerClient && saReady) {
    // guard: SA balance must be >= 1.1 MON
    if (parseEther(String(saBalance ?? '0')) < parseEther('1.1')) {
      setUiError('need to top up Smart account > 1.1 MON');
      return;
    }
    setMintImgBusy(true);
    try {
      // same signer as your app uses
      // @ts-ignore – relax generics for wagmi helper
      //const walletClient = await (await import('wagmi')).getWalletClient({ chainId: monadTestnet.id });
      if (!walletClient) throw new Error('No wallet client');

      const sa = await buildSmartAccount(walletClient as any);

      // EXACT same ABI/function/args as your EOA path:
      const data = encodeFunctionData({
        abi: FortuneABI,
        functionName: 'mintWithImage',
        args: [`fortune`, `ipfs://${pinCid}`],
      });

      const value = (typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n)
        ? onchainMintPrice : 0n;

    const txHash = await sendSaUo({
      sa,
      to: COOKIE_ADDRESS! as Address,
      data: data as `0x${string}`,
      value,
    });
    setPendingMintType('image');
    setTxHash(txHash);    // <-- important
    } catch (e: any) {
      setUiError(String(e?.message || e));
    } finally {
      setMintImgBusy(false);
    }

    //await upsertMgid({ address: address as `0x${string}`, incrementImages: true, SAWallet: saAddress, usernamefarcaster: undefined });

   return; // do not run EOA path
  }
  // --- end Smart Account path ---

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
      // @ts-ignore
      //const walletClient = await (await import('wagmi')).getWalletClient({ chainId: monadTestnet.id });
      if (!walletClient) throw new Error('No wallet client');

      const sa = await buildSmartAccount(walletClient as any);

      // EXACT same ABI/function/args/value as your EOA path:
      const data = encodeFunctionData({
        abi: FortuneABI as Abi,
        functionName: 'mintWithFortune',
        args: [fortune.trim()],
      });

      const value = (typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n)
        ? onchainMintPrice : 0n;

    const txHash = await sendSaUo({
      sa,
      to: COOKIE_ADDRESS! as Address,
      data: data as `0x${string}`,
      value,
    });
    setPendingMintType('text');
    setTxHash(txHash);    // <-- important
    } catch (e: any) {
      setUiError(e?.shortMessage || e?.message || 'Mint failed');
    } finally {
      setMintBusy(false);
    }

    //await upsertMgid({ address: address as `0x${string}`, incrementImages: false, SAWallet: saAddress, usernamefarcaster: undefined });
  
    return; // do not run EOA path
  }
  // --- end Smart Account path ---

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Parse receipt logs safely with parseEventLogs
 React.useEffect(() => {
  if (!isConfirmed || !receipt || !address || !txHash) return;

  // Accept both shapes of success: viem's "success" or numeric 1
  const ok =
    (receipt as any)?.status === 'success' ||
    (typeof (receipt as any)?.status === 'number' && (receipt as any).status === 1);

  // Ensure we're handling the tx we submitted (avoid reacting to someone else's tx)
  const sameTx =
    typeof (receipt as any)?.transactionHash === 'string' &&
    (receipt as any).transactionHash.toLowerCase() === txHash.toLowerCase();

  // Prevent double-processing of the same tx
  if (!ok || !sameTx || lastProcessedTx === txHash) return;

  let foundTokenId: number | null = null;

  try {
    const decoded = parseEventLogs({
      abi: FortuneABI as Abi,
      logs: (receipt.logs ?? []) as any,
    });

    for (const ev of decoded) {
      if (!ev || (ev as any).eventName == null) continue;

      const evAddr = (ev as any).saAddress as `0x${string}` | undefined;
      if (evAddr && evAddr.toLowerCase() !== COOKIE_ADDRESS!.toLowerCase()) continue;

      if (ev.eventName === 'CookieMinted') {
        const args: any = ev.args;
        const tid = Number(args?.tokenId ?? args?.tokenID ?? args?.id);
        const minter = args?.minter as `0x${string}` | undefined;
        if (!Number.isNaN(tid) && (!minter || isAddressEqual(minter, saAddress as `0x${string}`))) {
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
          isAddressEqual(to, saAddress as `0x${string}`) &&
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
      localStorage.setItem(`fc:lastMinted:${saAddress}`, String(foundTokenId));
    } catch {}
  }

  // ✅ Fire once per successful tx, for BOTH pendingMintType values.
  if (pendingMintType) {
   // const incrementImages: boolean = pendingMintType === 'image';
  //  upsertMgid({
   //   address: address as `0x${string}`,
   //   incrementImages,
   //   SAWallet: saAddress,
   //   usernamefarcaster: isMini ? (fcUsername || undefined) : undefined,
  //  }).catch(() => {});
      (async () => {
      try {
        await fetch('/api/mgid-upsert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address }),
        });
      } catch (e) {
        console.error('mgid-upsert failed', e);
      } finally {
      setLastProcessedTx(txHash);     // mark processed
      setPendingMintType(null);       // clear type
      setTxHash(undefined);           // clear tracked tx
      }
    })();
  }

  // keep your invalidations
  qc.invalidateQueries({ queryKey: ['lastMinted', saAddress, chain?.id] });
  qc.invalidateQueries({ queryKey: ['holdings', saAddress, chain?.id] });
}, [isConfirmed, receipt, saAddress, qc, chain?.id, txHash, pendingMintType, lastProcessedTx]);


  // ---------- UI ----------
/*{privyCfg ? <MonadGamesIdBanner /> : null}*/
/*
      <h1 style={{
        fontSize: 40, fontWeight: 900, letterSpacing: "-0.02em",
        color: "white", marginBottom: 8
      }}>
        Monad Fortune Cookies
      </h1>
      <div style={{
        height: 2, width: 200, background: "linear-gradient(90deg,#7c3aed,#a855f7)",
        borderRadius: 999, marginBottom: 20
      }} />


  // [FIXED] Declare content BEFORE using it
  const content = (
    <main className="page">
      {/* Monad Games ID banner }
      
      {uiError ? <div className="alert">{uiError}</div> : null}
      {confirmError ? (
        <div className="alert">
          {(confirmError as any)?.shortMessage ||
            (confirmError as any)?.message ||
            String(confirmError)}
        </div>
      ) : null}

      <div className="grid">
        {/* LEFT: Mint Card }
        <section className="card card--fortune">
          <h2 className="card__title">Generate Fortune</h2>

          <div className="two-col">
            <div className="field field--full">
              <label className="label">Prompt </label> {}
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


{/* Image generation + mint }
<section className="card card--image">
  <h2 className="card__title">Generate Image with AI</h2>

  <div className="row">
    <div className="col">
      <label className="label">Topic / Hint</label>
      <input
        className="input"
        value={imgPrompt}
        onChange={(e) => setImgPrompt(e.target.value)}
        placeholder="e.g., neon cyber cookie with Monad logo"
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn--primary" onClick={genImage} disabled={imgBusy}>
          {imgBusy ? 'Generating…' : 'Generate Image with AI'}
        </button>
        <button className="btn btn--primary" onClick={saveToPinata} disabled={!imgB64 || pinBusy}>
          {pinBusy ? 'Saving…' : 'Save to Pinata'}
        </button>
      </div>
      {pinCid ? <div className="hint" style={{ marginTop: 8 }}>CID: {pinCid}</div> : null}
    </div>

    <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="label">Preview</label>
      <div
        style={{
          border: '1px solid rgba(63,63,70,0.7)',
          borderRadius: 12,
          padding: 8,
          minHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(24,24,28,0.5)',
          cursor: imgB64 ? 'zoom-in' : 'default',
        }}
        onClick={() => imgB64 && setZoom(true)}
        title={imgB64 ? 'Click to zoom' : ''}
      >
        {imgB64 ? (
          <img
            src={`data:image/png;base64,${imgB64}`}
            style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }}
            alt="AI preview"
          />
        ) : (
          <span className="muted">No image yet</span>
        )}
      </div>

      <button
        className="btn btn--accent"
        onClick={onMintImage}
        disabled={!pinCid || mintImgBusy || isConfirming || !connected}
      >
        {mintImgBusy ? 'Waiting for wallet…' : isConfirming ? 'Confirming…' : 'Mint this Image'}
      </button>
    </div>
  </div>

  {/* Simple zoom modal }
  {zoom && imgB64 ? (
    <div
      onClick={() => setZoom(false)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <img src={`data:image/png;base64,${imgB64}`} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
    </div>
  ) : null}
</section>


        {/* RIGHT: Status Card }
        <section className="card card--status">
          <h2 className="card__title">Status</h2>

          <div className="status">
            <div className="status__row">
              <span className="muted">Status:</span>
              <span className={`pill ${connected ? 'pill--ok' : 'pill--off'}`}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
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
              <span>{connected ? totalScore_current-totalImages_current : '—'}</span>
            </div>
            <div className="status__row">
              <span className="muted">Total Transactions:</span>
              <span>{connected ? totalTransactions_current : '—'}</span>
            </div>
            
          </div>

          <SaStatusCard />

          {/* Last minted }
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
                  const url = COOKIE_ADDRESS ? makeExplorerNftUrl(chain?.id, COOKIE_ADDRESS, lastMinted) : '#';
                  const x  = makeXShareUrl(chain?.name, url, lastMinted);
                  return <>
                    <a href={url} target="_blank" className="link">view</a>
                    <a href={x}   target="_blank" className="link">share on X</a>
                  </>;
                })()}
              </div>
            )}
          </div>

          {/* Holdings }
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
                      const url = COOKIE_ADDRESS ? makeExplorerNftUrl(chain?.id, COOKIE_ADDRESS, id) : '#';
                      const x  = makeXShareUrl(chain?.name, url, id);
                      return (
                        <>
                          <a href={url} target="_blank" className="link">view</a>
                          <a href={x}   target="_blank" className="link">share on X</a>
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
{/*
          .grid {
            grid-template-columns: 1fr 1fr;
          }

         @media (min-width: 560px) {
          .row {
            grid-template-columns: 1fr 1fr;
          }
        }
}
      {/* --- Card CSS --- }
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
          .card--image { grid-column: 2; order: 2; }
          .card--fortune { grid-column: 1; order: 1; }
        }
 
        .col { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
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
    </main>
  );

  // [FIXED] Correct loginMethodsAndOrder.primary (remove "wallet")
  /*
  return privyCfg ? (
    <PrivyProvider
      appId={privyCfg.appId}
      config={{
        loginMethodsAndOrder: {
          primary: [`privy:${privyCfg.providerAppId}`], // [FIXED] 'email', 'google', 
        },
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
      }}
    >
      {content}
    </PrivyProvider>
  ) : (
    content
  );
  
 return content;
}
*/