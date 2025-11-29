'use client';
/*
import { useSmartAccount } from '../app/SmartAccountProvider';

import * as React from 'react'; // if not already present
import { useWalletClient, useChainId } from 'wagmi';
import { encodeFunctionData, parseEther, type Address, createWalletClient, custom} from 'viem';
import FortuneABI from '../abi/FortuneCookiesAI.json';
import { buildSmartAccount } from '../lib/aa/smartAccount';
import { bundlerClient, publicClient } from '../lib/aa/clients';

import { usePathname } from 'next/navigation'; // NEW
import { defaultChain } from '../lib/aa/clients';
//import { monadTestnet } from '../../src/lib/chain';
import { CHAINS } from '../lib/chain';

//import { sendAndWaitUserOperation } from "../lib/aa/userOp";

//const COOKIE_ADDRESS = process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`;

const getMiniSdk = async () => (await import('@farcaster/miniapp-sdk')).sdk;

export function SaStatusCard() {
  const {
    mode, setMode,
    eoaAddress, eoaBalance,
    saAddress, saBalance, saReady,
    chainId,
    tokenSymbol,   
  } = useSmartAccount();

 const wagmiChainId = useChainId();
 const activeChainId = wagmiChainId || defaultChain.id;
 const activeChain =
      CHAINS.find((c) => c.id === activeChainId) ?? defaultChain;

const pathname = usePathname();
const isMini = !!pathname && pathname.startsWith('/mini');

const { data: walletClient } = useWalletClient();
const [creating, setCreating] = React.useState(false);
const [saDeployed, setSaDeployed] = React.useState<boolean | null>(null);

// detect if SA contract code exists
React.useEffect(() => {
  let gone = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function check() {
    if (!saAddress) {
      if (!gone) setSaDeployed(null);
      return;
    }
    try {
      const code = await publicClient.getBytecode({ address: saAddress as Address });
      const deployed = !!code && code !== '0x';
      if (!gone) setSaDeployed(deployed);
      if (deployed && timer) {
        clearInterval(timer);
        timer = null;
      }
    } catch {
      if (!gone) setSaDeployed(false);
    }
  }

  // initial check fast
  check();

  // keep polling every 20s until deployed
  if (!saDeployed) {
    timer = setInterval(check, 20_000);
  }

  return () => {
    gone = true;
    if (timer) clearInterval(timer);
  };
  // include saAddress and saDeployed so we stop when it flips to true
}, [saAddress, saDeployed]);

// ADD near top of component body, after you read `saBalance`
const lowCreateBalance =
  // if we don’t know the balance yet, treat it as insufficient
  parseEther(String(saBalance ?? '0')) < parseEther('0.2');

async function onCreateSa() {
  // Prefer the Wagmi wallet (main). If missing AND we are on /mini, create from Farcaster provider.
  let wc = walletClient as any;
  if (!wc && isMini) {
    try {
      const sdk = await getMiniSdk();
      if (sdk?.wallet) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        wc = createWalletClient({
          // IMPORTANT: keep chain consistent with your AA infra (monadTestnet).
          // If your Mini wallet runs on Base (or another chain), switch this.
           chain: activeChain,
          transport: custom(ethProvider),
        });
      }
    } catch (e) {
      console.warn('Mini wallet fallback creation failed:', e);
    }
  }

  if (!wc) return;
  setCreating(true);
  try {
    // Build SA (counterfactual OK)
    const sa = await buildSmartAccount(wc);//(walletClient as any);

       // Pepper to make duplicate clicks not collide in bundler cache
   // const pepper = BigInt(Date.now() % 1_000_000);

    // Zero-value, zero-data call to the Smart Account itself.
    // This is a safe no-op that still produces a valid UserOperation
    // and triggers deployment on first UO.
    //  const calls = [{ to: sa.address as `0x${string}`, data: "0x" as `0x${string}`, value: 0n + pepper * 0n  }];
    //  const { hash } = await sendAndWaitUserOperation(bundlerClient, publicClient, { account: sa, calls });
    //  alert(`Smart account deployed!\n${hash}`);

    const code = await publicClient.getCode({ address: sa.address });

    if (!code || code === "0x") {
      const { factory, factoryData } = await sa.getFactoryArgs();
      const txHash = await walletClient.sendTransaction({ to: factory, data: factoryData });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Smart Account deployment failed");
    } 

    // Optionally: re-check deployment/code (leave your existing code here if you already do it)
    // const code = await publicClient.getBytecode({ address: sa.address as Address });
    // setSaDeployed(!!code && code !== '0x');
  } catch (e) {
    console.error("Deploy failed:", e?.data ?? e?.details ?? e?.message ?? e);
    alert("Failed to deploy smart account: " + (e?.data ?? e?.details ?? e?.message ?? e));
  } finally {
    setCreating(false);
  }
}

const smartPill =
    !saReady ? 'Disabled' : saAddress ? 'Connected' : 'Building…';

// + ADD: helper to shorten addresses like 0x1234…ABCD
function short(addr?: string, head: number = 6, tail: number = 4) {
  if (!addr) return '—';
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/*
<div className="block__title">Smart Account</div>

<div className="status__row">
  <span className="muted">Smart status:</span>
  <span
    className={`pill ${saReady && saAddress ? 'pill--ok' : 'pill--off'}`}
    suppressHydrationWarning
  >
    {smartPill}
  </span>
</div>

<div className="status__row">
  <span className="muted">EOA:</span>
  <span title={eoaAddress ?? ''} suppressHydrationWarning>
    {short(eoaAddress)}
  </span>
</div>
        <div className="status__row">
          <span className="muted">EOA balance:</span>
          <span>{eoaBalance ?? '—'} MON</span>
        </div>

                <div className="status__row">
          <span className="muted">Mode:</span>
          <span className="pill pill--attention" suppressHydrationWarning>
            {mode === 'sa' ? 'Smart Account' : 'Simple Wallet (EOA)'}
          </span>        
        </div>

          <button
            className="btn btn--primary"
            disabled={!saReady || mode === 'eoa'}
            onClick={() => saReady && setMode('eoa')}
            title={saReady ? 'Use Simple wallet (EOA)' : 'Set NEXT_PUBLIC_BUNDLER_RPC_URL'}
           suppressHydrationWarning
          >
            Use Wallet EOA
          </button>
          <button
            className="btn btn--accent"
            disabled={!saReady || mode === 'sa'}
            onClick={() => saReady && setMode('sa')}
            title={saReady ? 'Use Smart Account (AA)' : 'Set NEXT_PUBLIC_BUNDLER_RPC_URL'}
          suppressHydrationWarning
          >
            Use Smart Account
          </button>



React.useEffect(() => {
  if (mode !== 'sa') {
    setMode('sa');
  }
  // empty dep array so it runs only once
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  return (
    <div className="block">
      
      <div className="status">


        <div className="status__row">
           {/* Use exactly your existing button styles }

        </div>

        <div className="status__row">
          <span className="muted">Smart Account status:</span>
          <span
            className={`pill ${saReady && saAddress && saDeployed ? 'pill--ok' : 'pill--warning'}`}
            suppressHydrationWarning
          >
            {!saReady ? 'Disabled' : saDeployed === false ? 'Not deployed' : saAddress ? 'deployed' : 'Building…'}
          </span>
        </div>

        {mode === 'sa' && saReady && saAddress && saDeployed === false ? (
          <div className="status__row" style={{ marginTop: 8 }}>
            {lowCreateBalance && (
              <div className="note" style={{ marginRight: 12 }}>
                need to top up Smart account &gt; 0.2 {tokenSymbol}
              </div>
            )}
            <button
              className="btn btn--accent"
              onClick={onCreateSa}
              disabled={creating || lowCreateBalance}
              title={lowCreateBalance ? 'Top up Smart Account first' : 'Deploy Smart Account'}
            >
              {creating ? 'Creating…' : 'Create Smart Account'}
            </button>
          </div>
        ) : null}

        <div className="status__row">
          <span className="muted">Selected address:</span>
          <span
            title={mode === 'sa' ? (saAddress ?? '') : (eoaAddress ?? '')}
            suppressHydrationWarning
          >
            {mode === 'sa' ? short(saAddress) : short(eoaAddress)}
          </span>
        </div>

        <div className="status__row">
          <span className="muted">SA:</span>
          <span title={saAddress ?? ''} suppressHydrationWarning>
            {saReady ? (saAddress) : '—'}
          </span>
        </div>
        <div className="status__row">
          <span className="muted">SA balance:</span>
          <span title={saBalance ?? ''} suppressHydrationWarning> 
            {saReady ? (saBalance ?? '—') : '—'} {tokenSymbol}
          </span>
        </div>

        {!saReady ? (
          <div className="note">Set <code>NEXT_PUBLIC_BUNDLER_RPC_URL</code> to enable Smart mode.</div>
        ) : null}
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
        .note {
          font-size: 6px;
          color: #e30c49ff;        
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
        .pill--attention {
          background: rgba(6, 95, 70, 0.3);
          color: #f3f70eff;
        } 
        .pill--warning {
          background: rgba(6, 95, 70, 0.3);
          color: #f7290eff;
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
*/