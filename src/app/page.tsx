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
  useWalletClient,
} from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ⬇️ RELATIVE imports (keep your own)
import FortuneABI from '../abi/FortuneCookiesAI.json';
//import { monadTestnet } from '../lib/chain';

import { usePathname } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';

import { useAppMode } from '../hooks/useAppMode'

import { shareToX } from '../lib/share';

import {
  callCookieverseX402Roast,
  type CookieverseX402Product,
} from "../lib/x402/client";
import { x402Enabled, x402Provider } from "../lib/x402/config";

import type { WorldCupProphecyResult } from '../lib/xcup/types';

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
  xlayer: 196,
} as const;

function cookieAddressFor(chainId?: number): `0x${string}` | undefined {
  if (chainId === CHAIN_IDS.base) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_BASE as `0x${string}`;
  if (chainId === CHAIN_IDS.mantle) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE as `0x${string}`;
  if (chainId === CHAIN_IDS.linea) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_LINEA as `0x${string}`;
  if (chainId === CHAIN_IDS.mitosis) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS as `0x${string}`;
  if (chainId === CHAIN_IDS.og) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_OG as `0x${string}`;
  if (chainId === CHAIN_IDS.xlayer) return process.env.NEXT_PUBLIC_COOKIE_ADDRESS_XLAYER as `0x${string}`;

  return process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`;
}

function makeExplorerNftUrl(chainId: number | undefined, contract: `0x${string}`, tokenId: number): string {
  if (chainId === CHAIN_IDS.base) return `https://basescan.org/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.mantle) return `https://mantlescan.xyz/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.linea) return `https://lineascan.build/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.mitosis) return `https://mitoscan.io/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.og) return `https://chainscan.0g.ai/token/${contract}?a=${tokenId}`;
  if (chainId === CHAIN_IDS.xlayer) {
    return `https://www.okx.com/web3/explorer/xlayer/token/${contract}?a=${tokenId}`;
  }

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



type WorldCupTeamOption = {
  name: string;
  code: string;
  aliases: string[];
};

// 48 teams from the FIFA World Cup 2026 match schedule/groups.
// Use flagcdn image codes because Windows/Canvas often renders emoji flags as "AR", "FR", etc.
const WORLD_CUP_TEAM_OPTIONS: WorldCupTeamOption[] = [
  { name: 'Argentina', code: 'ar', aliases: ['arg', 'argentina', 'albiceleste', 'messi'] },
  { name: 'Australia', code: 'au', aliases: ['aus', 'australia', 'socceroos'] },
  { name: 'Austria', code: 'at', aliases: ['aut', 'austria', 'österreich', 'osterreich'] },
  { name: 'Belgium', code: 'be', aliases: ['bel', 'belgium', 'red devils'] },
  { name: 'Bosnia and Herzegovina', code: 'ba', aliases: ['bih', 'bosnia', 'bosnia and herzegovina', 'bosnia-herzegovina'] },
  { name: 'Brazil', code: 'br', aliases: ['bra', 'brazil', 'brasil', 'seleção', 'selecao'] },
  { name: 'Cabo Verde', code: 'cv', aliases: ['cpv', 'cabo verde', 'cape verde'] },
  { name: 'Canada', code: 'ca', aliases: ['can', 'canada'] },
  { name: 'Colombia', code: 'co', aliases: ['col', 'colombia', 'cafeteros'] },
  { name: 'Congo DR', code: 'cd', aliases: ['cod', 'congo dr', 'dr congo', 'drc', 'democratic republic of congo', 'congo'] },
  { name: "Côte d'Ivoire", code: 'ci', aliases: ['civ', "côte d'ivoire", 'cote divoire', 'ivory coast'] },
  { name: 'Croatia', code: 'hr', aliases: ['cro', 'croatia', 'hrvatska'] },
  { name: 'Curaçao', code: 'cw', aliases: ['cuw', 'curaçao', 'curacao'] },
  { name: 'Czechia', code: 'cz', aliases: ['cze', 'czechia', 'czech republic'] },
  { name: 'Ecuador', code: 'ec', aliases: ['ecu', 'ecuador'] },
  { name: 'Egypt', code: 'eg', aliases: ['egy', 'egypt', 'pharaohs', 'salah'] },
  { name: 'England', code: 'gb-eng', aliases: ['eng', 'england', 'three lions'] },
  { name: 'France', code: 'fr', aliases: ['fra', 'france', 'les bleus', 'mbappe', 'mbappé'] },
  { name: 'Germany', code: 'de', aliases: ['ger', 'germany', 'deutschland', 'mannschaft'] },
  { name: 'Ghana', code: 'gh', aliases: ['gha', 'ghana', 'black stars'] },
  { name: 'Haiti', code: 'ht', aliases: ['hai', 'haiti', 'grenadiers'] },
  { name: 'IR Iran', code: 'ir', aliases: ['irn', 'iran', 'ir iran', 'team melli'] },
  { name: 'Iraq', code: 'iq', aliases: ['irq', 'iraq'] },
  { name: 'Japan', code: 'jp', aliases: ['jpn', 'japan', 'samurai blue'] },
  { name: 'Jordan', code: 'jo', aliases: ['jor', 'jordan'] },
  { name: 'Korea Republic', code: 'kr', aliases: ['kor', 'korea republic', 'south korea', 'korea', 'taeguk warriors'] },
  { name: 'Mexico', code: 'mx', aliases: ['mex', 'mexico', 'méxico', 'el tri'] },
  { name: 'Morocco', code: 'ma', aliases: ['mar', 'morocco', 'atlas lions'] },
  { name: 'Netherlands', code: 'nl', aliases: ['ned', 'netherlands', 'holland', 'oranje'] },
  { name: 'New Zealand', code: 'nz', aliases: ['nzl', 'new zealand', 'all whites'] },
  { name: 'Norway', code: 'no', aliases: ['nor', 'norway', 'haaland'] },
  { name: 'Panama', code: 'pa', aliases: ['pan', 'panama', 'panamá'] },
  { name: 'Paraguay', code: 'py', aliases: ['par', 'paraguay'] },
  { name: 'Portugal', code: 'pt', aliases: ['por', 'portugal', 'cristiano', 'ronaldo'] },
  { name: 'Qatar', code: 'qa', aliases: ['qat', 'qatar'] },
  { name: 'Saudi Arabia', code: 'sa', aliases: ['ksa', 'saudi', 'saudi arabia'] },
  { name: 'Scotland', code: 'gb-sct', aliases: ['sco', 'scotland'] },
  { name: 'Senegal', code: 'sn', aliases: ['sen', 'senegal', 'teranga lions'] },
  { name: 'South Africa', code: 'za', aliases: ['rsa', 'south africa', 'bafana bafana'] },
  { name: 'Spain', code: 'es', aliases: ['esp', 'spain', 'españa', 'la roja'] },
  { name: 'Sweden', code: 'se', aliases: ['swe', 'sweden', 'sverige'] },
  { name: 'Switzerland', code: 'ch', aliases: ['sui', 'switzerland', 'swiss'] },
  { name: 'Tunisia', code: 'tn', aliases: ['tun', 'tunisia'] },
  { name: 'Türkiye', code: 'tr', aliases: ['tur', 'turkey', 'türkiye', 'turkiye'] },
  { name: 'Uruguay', code: 'uy', aliases: ['uru', 'uruguay', 'la celeste'] },
  { name: 'USA', code: 'us', aliases: ['usa', 'united states', 'usmnt', 'america'] },
  { name: 'Uzbekistan', code: 'uz', aliases: ['uzb', 'uzbekistan'] },
];

function normalizeWorldCupSearchText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[⚽🏆🏴]/gu, '')
    .replace(/\b[A-Z]{2}\s+/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9\s.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripWorldCupFlag(value: string) {
  return String(value || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[⚽🏆🏴]/gu, '')
    .replace(/\b[A-Z]{2}\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWorldCupTeamName(value: string) {
  return normalizeWorldCupSearchText(stripWorldCupFlag(value));
}

function findWorldCupTeam(value: string) {
  const clean = normalizeWorldCupTeamName(value);

  if (!clean) return undefined;

  return WORLD_CUP_TEAM_OPTIONS.find((team) => {
    const name = normalizeWorldCupSearchText(team.name);
    if (name === clean) return true;
    return team.aliases.some((alias) => normalizeWorldCupSearchText(alias) === clean);
  });
}

function worldCupFlagUrl(team?: WorldCupTeamOption) {
  if (!team?.code) return '';
  return `https://flagcdn.com/w40/${team.code}.png`;
}

function decorateWorldCupTeamName(value: string) {
  const raw = stripWorldCupFlag(value);
  if (!raw) return raw;

  const found = findWorldCupTeam(raw);
  return found ? found.name : raw;
}

function searchWorldCupTeams(query: string, limit = 10) {
  const clean = normalizeWorldCupTeamName(query);

  const ranked = WORLD_CUP_TEAM_OPTIONS.map((team) => {
    const name = normalizeWorldCupSearchText(team.name);
    const aliases = team.aliases.map((x) => normalizeWorldCupSearchText(x));
    const haystack = [name, ...aliases].join(' ');

    let score = 0;

    if (!clean) score = 1;
    else if (name === clean) score = 100;
    else if (name.startsWith(clean)) score = 80;
    else if (aliases.some((alias) => alias === clean)) score = 70;
    else if (aliases.some((alias) => alias.startsWith(clean))) score = 55;
    else if (haystack.includes(clean)) score = 35;

    return { team, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.team.name.localeCompare(b.team.name))
    .slice(0, limit)
    .map((x) => x.team);

  return ranked.length ? ranked : WORLD_CUP_TEAM_OPTIONS.slice(0, limit);
}



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

  const isBaseChain = connected && chain?.id === CHAIN_IDS.base;
  const shouldUseX402Roast = Boolean(x402Enabled && isBaseChain);

  const pathname = usePathname();
  const { isFarcasterMini, isBaseAppRoute, isCompactLayout } = useAppMode();

  const [fcUsername, setFcUsername] = React.useState<string>('');

  type ChainKey = 'monad' | 'base' | 'mantle' | 'mitosis' | 'linea' | 'og' | 'xlayer';

  const CHAIN_BY_ID: Record<number, ChainKey> = {
    [CHAIN_IDS.monad]: 'monad',
    [CHAIN_IDS.base]: 'base',
    [CHAIN_IDS.mantle]: 'mantle',
    [CHAIN_IDS.linea]: 'linea',
    [CHAIN_IDS.mitosis]: 'mitosis',
    [CHAIN_IDS.og]: 'og',
    [CHAIN_IDS.xlayer]: 'xlayer',
  };

  function currentKey(id?: number): ChainKey {
    return id && CHAIN_BY_ID[id] ? CHAIN_BY_ID[id] : 'monad';
  }

  // scoreByChain & imagesByChain come from holdings (you already set these as shown earlier)
  const [scoreByChain, setScoreByChain] = React.useState<Record<ChainKey, number>>({
    monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0, xlayer: 0
  });
  const [imagesByChain, setImagesByChain] = React.useState<Record<ChainKey, number>>({
    monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0, xlayer: 0
  });

  // NEW: transactionsByChain (accumulated from BLOB)
  const [txByChain, setTxByChain] = React.useState<Record<ChainKey, number>>({
    monad: 0, base: 0, mantle: 0, mitosis: 0, linea: 0, og: 0, xlayer: 0
  });

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

  // world cup prophecy
  const wcDateInputRef = React.useRef<HTMLInputElement | null>(null);
  const [wcHomeTeam, setWcHomeTeam] = React.useState('');
  const [wcAwayTeam, setWcAwayTeam] = React.useState('');
  const [wcHomeTeamOpen, setWcHomeTeamOpen] = React.useState(false);
  const [wcAwayTeamOpen, setWcAwayTeamOpen] = React.useState(false);
  const [wcMatchDate, setWcMatchDate] = React.useState('');
  const [wcProphecy, setWcProphecy] =
    React.useState<WorldCupProphecyResult | null>(null);

  const [wcImageUrl, setWcImageUrl] = React.useState<string | null>(null);
  const [wcImageBlob, setWcImageBlob] = React.useState<Blob | null>(null);
  const [wcImageB64, setWcImageB64] = React.useState<string | null>(null);
  const [wcPinCid, setWcPinCid] = React.useState<string | null>(null);

  type WorldCupStage =
    | 'idle'
    | 'researching'
    | 'scoring'
    | 'rendering'
    | 'ready'
    | 'error';

  const [wcBusy, setWcBusy] = React.useState(false);
  const [wcStage, setWcStage] = React.useState<WorldCupStage>('idle');
  const [wcStartedAt, setWcStartedAt] = React.useState<number | null>(null);
  const [wcElapsedSec, setWcElapsedSec] = React.useState(0);

  const [wcMintBusy, setWcMintBusy] = React.useState(false);

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

  const [x402RoastBusy, setX402RoastBusy] =
  React.useState<CookieverseX402Product | null>(null);

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

  React.useEffect(() => {
  if (!wcBusy || !wcStartedAt) {
    setWcElapsedSec(0);
    return;
  }

  const id = window.setInterval(() => {
    setWcElapsedSec(Math.max(0, Math.floor((Date.now() - wcStartedAt) / 1000)));
  }, 1000);

  return () => window.clearInterval(id);
}, [wcBusy, wcStartedAt]);

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

const generateWalletRoastViaX402 = async (product: CookieverseX402Product) => {
  setUiError(null);

  if (!address) {
    setUiError("Connect wallet first.");
    return;
  }

  if (!walletClient) {
    setUiError("Wallet client is not ready.");
    return;
  }

  if (chain?.id !== 8453) {
    setUiError("Switch to Base to pay with x402 USDC.");
    return;
  }

  setX402RoastBusy(product);

  try {
    const data = await callCookieverseX402Roast({
      walletClient,
      wallet: address,
      product,
    });

    if (roastImageUrl) {
      URL.revokeObjectURL(roastImageUrl);
    }

    setRoastWallet(address);
    setRoastData(data.raw || data);
    setRoastImageUrl(null);
    setRoastImageBlob(null);
    setRoastImageB64(null);
    setPinCid(null);
    setWalletRoastMintStage("idle");

    if (data.image?.gatewayUrl) {
      const imgRes = await fetch(data.image.gatewayUrl, { cache: "no-store" });

      if (!imgRes.ok) {
        throw new Error(`Failed to fetch x402 roast image: HTTP ${imgRes.status}`);
      }

      const blob = await imgRes.blob();
      const url = URL.createObjectURL(blob);
      const b64 = await blobToBase64(blob);

      setRoastImageBlob(blob);
      setRoastImageUrl(url);
      setRoastImageB64(b64);
    }
  } catch (e: any) {
    setUiError(String(e?.message || e));
  } finally {
    setX402RoastBusy(null);
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

function worldCupStageLabel(stage: WorldCupStage) {
  switch (stage) {
    case 'researching':
      return 'AI is studying previous matches, team style and tournament context…';
    case 'scoring':
      return 'Calculating form, attack, defense, momentum, fans and confidence…';
    case 'rendering':
      return 'Rendering your collectible World Cup prophecy card…';
    case 'ready':
      return 'Prophecy card is ready.';
    case 'error':
      return 'Prophecy generation failed.';
    default:
      return '';
  }
}

function worldCupStagePercent(stage: WorldCupStage) {
  switch (stage) {
    case 'researching':
      return 34;
    case 'scoring':
      return 62;
    case 'rendering':
      return 86;
    case 'ready':
      return 100;
    case 'error':
      return 100;
    default:
      return 0;
  }
}

const worldCupIsLoading = wcBusy || ['researching', 'scoring', 'rendering'].includes(wcStage);

// Large inline prophecy loading panel removed.


async function generateWorldCupProphecy() {
  setUiError(null);

  const normalizedHomeTeam = decorateWorldCupTeamName(wcHomeTeam);
  const normalizedAwayTeam = decorateWorldCupTeamName(wcAwayTeam);

  if (!normalizedHomeTeam || !normalizedAwayTeam) {
    setUiError('Choose or type both World Cup teams first.');
    return;
  }

  setWcHomeTeam(normalizedHomeTeam);
  setWcAwayTeam(normalizedAwayTeam);

  setWcBusy(true);
  setWcStage('researching');
  setWcStartedAt(Date.now());

  try {
    if (wcImageUrl) URL.revokeObjectURL(wcImageUrl);

    setWcProphecy(null);
    setWcImageUrl(null);
    setWcImageBlob(null);
    setWcImageB64(null);
    setWcPinCid(null);

    const prophecyRes = await fetch('/api/xcup/prophecy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        homeTeam: normalizedHomeTeam,
        awayTeam: normalizedAwayTeam,
        matchDate: wcMatchDate,
      }),
    });

    const prophecyData = await prophecyRes.json();

    if (!prophecyRes.ok) {
      throw new Error(prophecyData?.error || 'Failed to generate World Cup prophecy');
    }

    setWcStage('scoring');
    setWcProphecy(prophecyData);

    // Give the UI one frame to visibly move from AI research → scoring/rendering.
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    setWcStage('rendering');

    const renderRes = await fetch('/api/xcup/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...prophecyData,
        mintedBy: address,
      }),
    });

    if (!renderRes.ok) {
      const err = await renderRes.json().catch(() => null);
      throw new Error(err?.error || 'Failed to render World Cup prophecy card');
    }

    const blob = await renderRes.blob();
    const url = URL.createObjectURL(blob);
    const b64 = await blobToBase64(blob);

    setWcImageBlob(blob);
    setWcImageUrl(url);
    setWcImageB64(b64);
    setWcStage('ready');
  } catch (e: any) {
    setWcStage('error');
    setUiError(String(e?.message || e));
  } finally {
    setWcBusy(false);
    setWcStartedAt(null);
  }
}

async function uploadWorldCupProphecyToPinata(): Promise<string> {
  if (!wcImageB64) {
    throw new Error('Generate World Cup prophecy card first.');
  }

  const filename = `world-cup-prophecy-${wcHomeTeam}-vs-${wcAwayTeam}.png`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-');

  const res = await fetch('/api/pinata', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      b64: wcImageB64,
      filename,
    }),
  });

  const j = await res.json();

  if (!res.ok) {
    throw new Error(j?.error || 'Failed to save prophecy card to IPFS');
  }

  if (!j?.cid) {
    throw new Error('Pinata did not return CID.');
  }

  setWcPinCid(j.cid);
  return j.cid;
}

async function mintWorldCupProphecy() {
  setUiError(null);

  if (!connected || !address) {
    setUiError('Connect your wallet first.');
    return;
  }

  if (!wcProphecy) {
    setUiError('Generate prophecy first.');
    return;
  }

  if (!wcImageB64) {
    setUiError('Generate prophecy card first.');
    return;
  }

  setWcMintBusy(true);

  try {
    const cid = wcPinCid || (await uploadWorldCupProphecyToPinata());

    const fortuneText = [
      `${wcProphecy.homeTeam} vs ${wcProphecy.awayTeam}`,
      `Pick: ${wcProphecy.pick}`,
      `Score: ${wcProphecy.scoreline}`,
      `Confidence: ${wcProphecy.confidence}%`,
    ]
      .join(' | ')
      .slice(0, 220);

    const call: any = {
      address: COOKIE_ADDRESS,
      abi: FortuneABI as Abi,
      functionName: 'mintWithImage',
      args: [fortuneText, `ipfs://${cid}`],
    };

    if (typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n) {
      call.value = onchainMintPrice;
    }

    const hash = await writeContractAsync(call);

    setPendingMintType('image');
    setTxHash(hash);
  } catch (e: any) {
    setUiError(String(e?.shortMessage || e?.message || e));
  } finally {
    setWcMintBusy(false);
  }
}

async function downloadWorldCupProphecy() {
  try {
    if (!wcImageBlob) throw new Error('Generate prophecy card first.');
    downloadBlob(wcImageBlob, 'cookieverse-world-cup-prophecy.png');
  } catch (e: any) {
    setUiError(String(e?.message || e));
  }
}

async function copyWorldCupProphecy() {
  try {
    if (!wcImageBlob) throw new Error('Generate prophecy card first.');
    await copyImageToClipboard(wcImageBlob);
  } catch (e: any) {
    setUiError(String(e?.message || e));
  }
}

async function shareWorldCupProphecy() {
  try {
    setUiError(null);

    if (!wcProphecy) throw new Error('Generate prophecy first.');
    if (!wcImageBlob) throw new Error('Render prophecy image first.');

    const appUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${isBaseAppRoute ? '/app' : '/'}`
        : 'https://www.cookieverse.tech/';

    const text =
      `World Cup prophecy just dropped ⚽🍪\n\n` +
      `${wcProphecy.homeTeam} vs ${wcProphecy.awayTeam}\n` +
      `Pick: ${wcProphecy.pick}\n` +
      `Score: ${wcProphecy.scoreline}\n` +
      `Confidence: ${wcProphecy.confidence}%\n\n` +
      `Minted in Cookieverse by @MSSystemWEB3.`;

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
      imageBlob: wcImageBlob,
      filename: 'cookieverse-world-cup-prophecy.png',
    });

    if (result.ok) {
      if (result.method === 'native-image-share') return;

      if (result.method === 'clipboard-plus-x-intent') {
        setUiError('Text copied. X composer opened. Attach image manually if needed.');
        return;
      }

      if (result.method === 'x-intent') {
        setUiError('X composer opened. X Web Intent does not attach images automatically.');
        return;
      }
    }

    if ('error' in result && result.error !== 'Share cancelled.') {
      throw new Error(result.error);
    }
  } catch (e: any) {
    setUiError(String(e?.message || e));
  }
}

React.useEffect(() => {
  return () => {
    if (wcImageUrl) URL.revokeObjectURL(wcImageUrl);
  };
}, [wcImageUrl]);



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
  
/*
                  <button
                    className="btn btn--primary"
                    onClick={() => generateWalletRoastViaX402("roast-json")}
                    disabled={roastBusy || roastRenderBusy || !!x402RoastBusy || !connected}
                    title={`Pay with x402 via ${x402Provider}`}
                  >
                    {x402RoastBusy === "roast-json"
                      ? "Paying x402…"
                      : "x402 Fast Roast"}
                  </button>
*/


  const wcHomeTeamSuggestions = React.useMemo(
    () => searchWorldCupTeams(wcHomeTeam),
    [wcHomeTeam],
  );

  const wcAwayTeamSuggestions = React.useMemo(
    () => searchWorldCupTeams(wcAwayTeam),
    [wcAwayTeam],
  );

  const renderWorldCupTeamInput = React.useCallback(
    (params: {
      label: string;
      value: string;
      onChange: (value: string) => void;
      open: boolean;
      setOpen: (open: boolean) => void;
      suggestions: WorldCupTeamOption[];
      placeholder: string;
    }) => {
      const { label, value, onChange, open, setOpen, suggestions, placeholder } = params;
      const selectedTeam = findWorldCupTeam(value);
      const selectedFlagUrl = worldCupFlagUrl(selectedTeam);

      return (
        <div
          className="field field--full"
          style={{
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <label className="label">{label}</label>

          <div
            style={{
              position: 'relative',
              width: '100%',
              overflow: 'visible',
            }}
          >
            {selectedFlagUrl ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 26,
                  height: 18,
                  borderRadius: 5,
                  overflow: 'hidden',
                  border: '1px solid rgba(253,230,138,0.72)',
                  boxShadow: '0 0 12px rgba(250,204,21,0.22)',
                  zIndex: 3,
                  background: 'rgba(15,23,42,0.75)',
                  display: 'inline-flex',
                }}
              >
                <img
                  src={selectedFlagUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </span>
            ) : null}

            <input
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 140);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onChange(decorateWorldCupTeamName(value));
                  setOpen(false);
                }

                if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                height: 36,
                boxSizing: 'border-box',
                padding: selectedFlagUrl ? '0 48px 0 44px' : '0 48px 0 14px',
                borderRadius: 12,
                border: '1px solid rgba(250,204,21,0.48)',
                outline: 'none',
                color: '#ffffff',
                background:
                  'radial-gradient(circle at right, rgba(250,204,21,0.15), transparent 34%), linear-gradient(135deg, rgba(18,18,28,0.98), rgba(8,10,24,0.98))',
                boxShadow:
                  'inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px rgba(250,204,21,0.08)',
                fontSize: 13,
                fontWeight: 850,
                letterSpacing: '0.015em',
              }}
            />

            <button
              type="button"
              aria-label={`Open ${label} team list`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(!open)}
              style={{
                position: 'absolute',
                top: '50%',
                right: 8,
                width: 34,
                height: 28,
                transform: 'translateY(-50%)',
                borderRadius: 999,
                border: '1px solid rgba(253,230,138,0.86)',
                background: 'linear-gradient(135deg, #facc15, #f59e0b)',
                color: '#111827',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow:
                  '0 0 0 1px rgba(15,23,42,0.72), 0 0 16px rgba(250,204,21,0.28)',
                zIndex: 4,
                padding: 0,
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              ⚽
            </button>

            {open ? (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 60,
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  maxHeight: 260,
                  overflow: 'auto',
                  padding: 8,
                  borderRadius: 16,
                  border: '1px solid rgba(250,204,21,0.48)',
                  background:
                    'radial-gradient(circle at top right, rgba(250,204,21,0.18), transparent 34%), radial-gradient(circle at bottom left, rgba(124,58,237,0.18), transparent 38%), rgba(3,7,18,0.97)',
                  boxShadow:
                    '0 20px 52px rgba(0,0,0,0.58), 0 0 24px rgba(250,204,21,0.14)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <div
                  style={{
                    padding: '4px 8px 8px',
                    color: '#fde68a',
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                  }}
                >
                  Choose team or keep typing
                </div>

                {suggestions.map((team) => {
                  const flagUrl = worldCupFlagUrl(team);

                  return (
                    <button
                      key={`${label}-${team.name}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(team.name);
                        setOpen(false);
                      }}
                      style={{
                        width: '100%',
                        border: 0,
                        borderRadius: 12,
                        padding: '9px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'transparent',
                        color: '#f9fafb',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(124,58,237,0.16))';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 20,
                          borderRadius: 5,
                          overflow: 'hidden',
                          border: '1px solid rgba(253,230,138,0.52)',
                          boxShadow: '0 0 8px rgba(250,204,21,0.18)',
                          background: 'rgba(15,23,42,0.75)',
                          flex: '0 0 auto',
                        }}
                      >
                        <img
                          src={flagUrl}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </span>

                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 850,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {team.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      );
    },
    [],
  );

  const content = (
    <main className="page">
      {worldCupIsLoading ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 18,
            transform: 'translateX(-50%)',
            width: 'min(520px, calc(100vw - 28px))',
            zIndex: 9998,
            padding: 14,
            borderRadius: 18,
            border: '1px solid rgba(250,204,21,0.55)',
            background:
              'radial-gradient(circle at top left, rgba(250,204,21,0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(124,58,237,0.20), transparent 42%), rgba(2,6,23,0.94)',
            boxShadow:
              '0 24px 70px rgba(0,0,0,0.58), 0 0 32px rgba(250,204,21,0.18)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                color: '#fde68a',
                fontWeight: 950,
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: '#facc15',
                  boxShadow: '0 0 18px rgba(250,204,21,0.9)',
                  display: 'inline-block',
                  animation: 'cookieversePulse 1.1s ease-in-out infinite',
                }}
              />
              AI is cooking Match Prophecy
            </div>

            <div
              style={{
                color: '#fde68a',
                fontSize: 11,
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {wcElapsedSec}s
            </div>
          </div>

          <div
            style={{
              color: '#e5e7eb',
              fontSize: 12,
              lineHeight: 1.35,
              marginBottom: 10,
            }}
          >
            {worldCupStageLabel(wcStage)}
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'rgba(250,204,21,0.12)',
              overflow: 'hidden',
              border: '1px solid rgba(250,204,21,0.18)',
            }}
          >
            <div
              style={{
                width: `${worldCupStagePercent(wcStage)}%`,
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg,#facc15,#f97316,#a855f7)',
                boxShadow: '0 0 18px rgba(250,204,21,0.42)',
                transition: 'width 420ms ease',
              }}
            />
          </div>

          <div
            style={{
              marginTop: 9,
              color: '#9ca3af',
              fontSize: 11,
              lineHeight: 1.35,
            }}
          >
            Do not close this page. First AI researches the match, then Cookieverse renders the card.
          </div>
        </div>
      ) : null}
      {uiError ? <div className="alert">{uiError}</div> : null}
      {confirmError ? (
        <div className="alert">
          {(confirmError as any)?.shortMessage ||
            (confirmError as any)?.message ||
            String(confirmError)}
        </div>
      ) : null}

      <div className="grid">
        {/* LEFT: World Cup Prophecy */}
        <section
          className="card card--fortune card--world-cup"
          style={{
            background:
              'radial-gradient(circle at top left, rgba(250,204,21,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(124,58,237,0.16), transparent 34%), rgba(15,15,19,0.94)',
            border: '1px solid rgba(250,204,21,0.32)',
            boxShadow:
              '0 22px 70px rgba(0,0,0,0.34), 0 0 30px rgba(124,58,237,0.14)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(250,204,21,0.4)',
                  background: 'rgba(2,6,23,0.72)',
                  color: '#fde68a',
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                ⚽ World Cup Mode
              </div>

              <h2
                className="card__title"
                style={{
                  color: '#facc15',
                  textShadow: '0 0 18px rgba(250,204,21,0.22)',
                  marginBottom: 4,
                }}
              >
                Match Prophecy
              </h2>

              <p className="hint" style={{ margin: 0 }}>
                  Enter teams and match date. AI researches the matchup, calculates prophecy criteria, renders a card.
              </p>
            </div>

          </div>

          <div className="row" style={{ alignItems: 'stretch', gap: 16 }}>
            <div className="col" style={{ minWidth: 280 }}>
              <div className="two-col">
                {renderWorldCupTeamInput({
                  label: 'Team 1',
                  value: wcHomeTeam,
                  onChange: setWcHomeTeam,
                  open: wcHomeTeamOpen,
                  setOpen: setWcHomeTeamOpen,
                  suggestions: wcHomeTeamSuggestions,
                  placeholder: 'Search or type team 1',
                })}

                {renderWorldCupTeamInput({
                  label: 'Team 2',
                  value: wcAwayTeam,
                  onChange: setWcAwayTeam,
                  open: wcAwayTeamOpen,
                  setOpen: setWcAwayTeamOpen,
                  suggestions: wcAwayTeamSuggestions,
                  placeholder: 'Search or type team 2',
                })}
              </div>

<div className="field field--full">
  <label className="label">Match date</label>

  <div className="world-cup-date-wrap">
    <input
      ref={wcDateInputRef}
      className="input input--world-cup-date"
      type="date"
      value={wcMatchDate}
      onChange={(e) => setWcMatchDate(e.target.value)}
      title="Select match date"
      onClick={() => {
        const input = wcDateInputRef.current;
        if (!input) return;

        if (typeof input.showPicker === 'function') {
          input.showPicker();
        }
      }}
    />

    <button
      type="button"
      className="world-cup-date-button"
      aria-label="Select match date"
      onClick={() => {
        const input = wcDateInputRef.current;
        if (!input) return;

        if (typeof input.showPicker === 'function') {
          input.showPicker();
        } else {
          input.focus();
        }
      }}
    >
      <span aria-hidden="true">📅</span>
    </button>
  </div>
</div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={generateWorldCupProphecy}
                  disabled={worldCupIsLoading}
                  style={{
                    background: worldCupIsLoading
                      ? 'linear-gradient(135deg,#fde68a,#f59e0b)'
                      : 'linear-gradient(135deg,#facc15,#f59e0b)',
                    color: '#111827',
                    position: 'relative',
                    overflow: 'hidden',
                    minWidth: 210,
                  }}
                >
                  {worldCupIsLoading ? 'AI is creating prophecy…' : 'Create Match Prophecy'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn--primary" onClick={downloadWorldCupProphecy} disabled={!wcImageBlob}>
                  Download
                </button>

                <button className="btn btn--primary" onClick={copyWorldCupProphecy} disabled={!wcImageBlob}>
                  Copy
                </button>

                <button className="btn btn--primary" onClick={shareWorldCupProphecy} disabled={!wcImageBlob || !wcProphecy}>
                  {isFarcasterMini ? 'Share on Farcaster' : 'Share on X'}
                </button>
              </div>

              {wcPinCid ? (
                <div className="hint" style={{ marginTop: 10, color: '#bbf7d0' }}>
                  IPFS: ipfs://{wcPinCid}
                </div>
              ) : null}

              {wcProphecy ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(250,204,21,0.22)',
                    background: 'rgba(2,6,23,0.42)',
                  }}
                >
                  <div className="hint">
                    Pick: <strong>{wcProphecy.pick}</strong>
                  </div>
                  <div className="hint">
                    Scoreline: <strong>{wcProphecy.scoreline}</strong>
                  </div>
                  <div className="hint">
                    Confidence: <strong>{wcProphecy.confidence}%</strong>
                  </div>
                  <div className="hint" style={{ marginTop: 8 }}>
                    AI criteria:{' '}
                    Form {wcProphecy.criteria.form} • Attack {wcProphecy.criteria.attack} • Defense{' '}
                    {wcProphecy.criteria.defense} • Momentum {wcProphecy.criteria.momentum} • Fans{' '}
                    {wcProphecy.criteria.fans}
                  </div>
                  {wcProphecy.location ? (
                    <div className="hint" style={{ marginTop: 6 }}>
                      Location: <strong>{wcProphecy.location}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="col" style={{ minWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="label">Prophecy card preview</label>
              {worldCupIsLoading ? (
                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: 12,
                    border: '1px solid rgba(250,204,21,0.32)',
                    background: 'rgba(250,204,21,0.08)',
                    color: '#fde68a',
                    fontSize: 12,
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  {worldCupStageLabel(wcStage)}
                </div>
              ) : null}

              <div
                onClick={() => {
                  if (wcImageUrl) openPreviewLightbox(wcImageUrl, 'World Cup Prophecy preview');
                }}
                title={wcImageUrl ? 'Click to open full preview' : undefined}
                style={{
                  border: '1px solid rgba(250,204,21,0.32)',
                  borderRadius: 18,
                  padding: 8,
                  minHeight: 360,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'radial-gradient(circle at top, rgba(250,204,21,0.08), rgba(2,6,23,0.72))',
                  cursor: wcImageUrl ? 'zoom-in' : 'default',
                  overflow: 'hidden',
                }}
              >
                  {wcImageUrl ? (
                    <img
                      src={wcImageUrl}
                      alt="World Cup Prophecy preview"
                      draggable={false}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 360,
                        borderRadius: 12,
                        display: 'block',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        boxShadow: '0 18px 45px rgba(0,0,0,0.32)',
                      }}
                    />
                  ) : worldCupIsLoading ? (
                    <div style={{ textAlign: 'center', padding: 18 }}>
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: '50%',
                          border: '3px solid rgba(250,204,21,0.18)',
                          borderTopColor: '#facc15',
                          margin: '0 auto 14px',
                          animation: 'cookieverseSpin 0.9s linear infinite',
                        }}
                      />

                      <div
                        style={{
                          color: '#fde68a',
                          fontWeight: 900,
                          marginBottom: 6,
                        }}
                      >
                        Building your prophecy card
                      </div>

                      <div className="hint" style={{ maxWidth: 290 }}>
                        AI is generating the match logic, then Cookieverse renders the collectible image.
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          width: 220,
                          maxWidth: '100%',
                          height: 7,
                          borderRadius: 999,
                          overflow: 'hidden',
                          background: 'rgba(250,204,21,0.12)',
                          border: '1px solid rgba(250,204,21,0.18)',
                        }}
                      >
                        <div
                          style={{
                            width: `${worldCupStagePercent(wcStage)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg,#facc15,#f97316,#a855f7)',
                            transition: 'width 420ms ease',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="muted" style={{ textAlign: 'center' }}>
                      Your World Cup prophecy card will appear here.
                    </span>
                  )}
              </div>

               <button
                  type="button"
                  className="btn btn--accent"
                  onClick={mintWorldCupProphecy}
                  disabled={!wcImageB64 || wcMintBusy || isConfirming || !connected}
                >
                  {wcMintBusy
                    ? wcPinCid
                      ? 'Waiting for wallet…'
                      : 'Saving to IPFS…'
                    : isConfirming
                      ? 'Confirming…'
                      : 'Mint this Prophecy'}
                </button>

           </div>
          </div>
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
                {shouldUseX402Roast ? (
                  <button
                    className="btn btn--accent"
                    onClick={() => generateWalletRoastViaX402("identity-roast")}
                    disabled={roastBusy || roastRenderBusy || !!x402RoastBusy || !connected}
                    title={`Pay with x402 via ${x402Provider}`}
                  >
                    {x402RoastBusy === "identity-roast"
                      ? "Paying x402…"
                      : "x402 Wallet Roast"}
                  </button>
                ) : (
                  <button
                    className="btn btn--primary"
                    onClick={generateWalletRoast}
                    disabled={roastBusy || roastRenderBusy || !!x402RoastBusy}
                  >
                    {roastBusy || roastRenderBusy ? "Generating Roast…" : "Wallet Roast"}
                  </button>
                )}
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
          .card--world-cup { grid-column: 2; order: 2; }
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
        @keyframes cookieversePulse {
          0%, 100% {
            opacity: 0.55;
            transform: scale(0.92);
          }

          50% {
            opacity: 1;
            transform: scale(1.18);
          }
        }

        @keyframes cookieverseSpin {
          to {
            transform: rotate(360deg);
          }
        } 
          
.world-cup-date-wrap {
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.input--world-cup-date {
  width: 100%;
  max-width: 100%;
  height: 42px;
  box-sizing: border-box;
  padding-right: 52px;
  color: #ffffff;
  color-scheme: dark;
  cursor: pointer;
  font-weight: 800;
  letter-spacing: 0.04em;
  background:
    radial-gradient(circle at right, rgba(250, 204, 21, 0.12), transparent 36%),
    linear-gradient(135deg, rgba(31, 31, 36, 0.98), rgba(24, 24, 30, 0.98));
  border: 1px solid rgba(250, 204, 21, 0.42);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.025),
    0 0 12px rgba(250, 204, 21, 0.08);
}

.input--world-cup-date:hover {
  border-color: rgba(250, 204, 21, 0.72);
  box-shadow:
    0 0 0 1px rgba(250, 204, 21, 0.18),
    0 0 16px rgba(250, 204, 21, 0.14);
}

.input--world-cup-date:focus {
  outline: none;
  border-color: rgba(250, 204, 21, 0.92);
  box-shadow:
    0 0 0 1px rgba(250, 204, 21, 0.32),
    0 0 20px rgba(250, 204, 21, 0.18);
}

/* Hide native browser calendar icon */
.input--world-cup-date::-webkit-calendar-picker-indicator {
  opacity: 0;
  display: none;
}

/* Keep date text bright */
.input--world-cup-date::-webkit-datetime-edit,
.input--world-cup-date::-webkit-datetime-edit-fields-wrapper,
.input--world-cup-date::-webkit-datetime-edit-month-field,
.input--world-cup-date::-webkit-datetime-edit-day-field,
.input--world-cup-date::-webkit-datetime-edit-year-field {
  color: #ffffff;
}

.input--world-cup-date::-webkit-datetime-edit-text {
  color: rgba(255, 255, 255, 0.72);
}

.world-cup-date-button {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 34px;
  height: 28px;
  transform: translateY(-50%);
  border-radius: 999px;
  border: 1px solid rgba(253, 230, 138, 0.85);
  background: linear-gradient(135deg, #facc15, #f59e0b);
  color: #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.74),
    0 0 14px rgba(250, 204, 21, 0.26);
  z-index: 2;
  padding: 0;
}

.world-cup-date-button:hover {
  background: linear-gradient(135deg, #fde047, #f59e0b);
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.74),
    0 0 18px rgba(250, 204, 21, 0.36);
}

.world-cup-date-button span {
  font-size: 14px;
  line-height: 1;
}

.wc-team-field {
  position: relative;
  overflow: visible;
}

.wc-team-combobox {
  position: relative;
  width: 100%;
  overflow: visible;
}

.input--world-cup-team {
  width: 100%;
  box-sizing: border-box;
  padding-right: 48px;
  color: #ffffff;
  font-weight: 850;
  letter-spacing: 0.015em;
  background:
    radial-gradient(circle at right, rgba(250,204,21,0.14), transparent 36%),
    linear-gradient(135deg, rgba(18,18,28,0.98), rgba(8,10,24,0.98));
  border: 1px solid rgba(250,204,21,0.34);
}

.input--world-cup-team:hover,
.input--world-cup-team:focus {
  border-color: rgba(250,204,21,0.78);
  box-shadow:
    0 0 0 1px rgba(250,204,21,0.18),
    0 0 18px rgba(250,204,21,0.14);
}

.wc-team-picker-button {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 34px;
  height: 28px;
  transform: translateY(-50%);
  border-radius: 999px;
  border: 1px solid rgba(253,230,138,0.86);
  background: linear-gradient(135deg, #facc15, #f59e0b);
  color: #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(15,23,42,0.72),
    0 0 16px rgba(250,204,21,0.28);
  z-index: 4;
  padding: 0;
  font-size: 15px;
  line-height: 1;
}

.wc-team-picker-button:hover {
  background: linear-gradient(135deg, #fde047, #f97316);
  box-shadow:
    0 0 0 1px rgba(15,23,42,0.72),
    0 0 20px rgba(250,204,21,0.38);
}

.wc-team-popover {
  position: absolute;
  z-index: 40;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow: auto;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid rgba(250,204,21,0.38);
  background:
    radial-gradient(circle at top right, rgba(250,204,21,0.14), transparent 34%),
    radial-gradient(circle at bottom left, rgba(124,58,237,0.16), transparent 38%),
    rgba(3,7,18,0.96);
  box-shadow:
    0 20px 52px rgba(0,0,0,0.46),
    0 0 24px rgba(250,204,21,0.10);
  backdrop-filter: blur(14px);
}

.wc-team-popover__title {
  padding: 4px 8px 8px;
  color: #fde68a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.wc-team-option {
  width: 100%;
  border: 0;
  border-radius: 12px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  color: #f9fafb;
  cursor: pointer;
  text-align: left;
}

.wc-team-option:hover {
  background: linear-gradient(135deg, rgba(250,204,21,0.18), rgba(124,58,237,0.16));
}

.wc-team-option__flag {
  width: 28px;
  font-size: 19px;
  line-height: 1;
  text-align: center;
  filter: drop-shadow(0 0 8px rgba(250,204,21,0.25));
}

.wc-team-option__name {
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0.02em;
}

@media (max-width: 520px) {
  .wc-team-popover {
    max-height: 220px;
  }

  .wc-team-option {
    padding: 8px 9px;
  }
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