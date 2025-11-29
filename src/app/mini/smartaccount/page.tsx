/*
'use client'

import * as React from 'react'
import type { Abi, Address } from 'viem'
import {
  isAddressEqual,
  parseEventLogs,
  encodeFunctionData,
  parseEther,
  zeroAddress,
} from 'viem'
import {
  useAccount,
  useAccountEffect,
  useWaitForTransactionReceipt,
  useWriteContract,
  useBalance,
  useReadContract,
  useWalletClient,
} from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// same components/libs as main smartaccount page (adjusted relative paths)
import { SaStatusCard } from '../../../components/SaStatusCard'
import { useSmartAccount } from '../../../app/SmartAccountProvider'
import { bundlerClient } from '../../../lib/aa/clients'
import { buildSmartAccount } from '../../../lib/aa/smartAccount'

import FortuneABI from '../../../abi/FortuneCookiesAI.json'
import { monadTestnet } from '../../../lib/chain'

const getSdk = async () => (await import('@farcaster/miniapp-sdk')).sdk;

const COOKIE_ADDRESS = process.env.NEXT_PUBLIC_COOKIE_ADDRESS as `0x${string}`

const explorerNftUrl = (tokenId: number) =>
  `https://testnet.monadexplorer.com/nft/${COOKIE_ADDRESS}/${tokenId}`
const xShareUrl = (tokenId: number) => {
  const text = `My COOKIE #${tokenId} on Monad 🍪✨`
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
    explorerNftUrl(tokenId),
  )}`
}

// Minimal AA sender (same as main)
const sendSaUo = async ({
  sa,
  to,
  data,
  value,
}: {
  sa: any
  to: Address
  data: `0x${string}`
  value: bigint
}) => {
  return (bundlerClient as any).sendUserOperation({
    account: sa as any,
    calls: [{ to, data, value }] as any,
  })
}

export default function MiniSmartAccountPage() {
    React.useEffect(() => {
      (async () => {
        try {
          const sdk = await getSdk();
          // Hide the splash **after** your UI is ready
          sdk.actions.ready().catch(() => {});
          // Expose Farcaster EIP-1193 so wagmi injected() picks it up
          const provider: any = await sdk.wallet.getEthereumProvider().catch(() => null);
          if (provider) {
            (window as any).ethereum = provider;
            provider?.on?.('accountsChanged', () => {});
            provider?.on?.('disconnect', () => {});
          }
        } catch {
          // Not inside Farcaster host — safe no-op so /mini still renders
        }
      })();
    }, []);

  const qc = useQueryClient()
  const { address, chain, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const connected = isConnected && !!address

  // SA context
  const { mode, eoaAddress, saAddress, saReady, saBalance } = useSmartAccount()

  // top bar balance (same as main)
  useBalance({
    address,
    chainId: monadTestnet.id,
    query: { enabled: !!address },
  })

  // ---------- UI state ----------
  const [topic, setTopic] = React.useState('')
  const [vibe, setVibe] = React.useState('optimistic')
  const [nameOpt, setNameOpt] = React.useState('')
  const [fortune, setFortune] = React.useState('')
  const [genBusy, setGenBusy] = React.useState(false)
  const [mintBusy, setMintBusy] = React.useState(false)
  const [uiError, setUiError] = React.useState<string | null>(null)
  const [lastMinted, setLastMinted] = React.useState<number | null>(null)
  const [holdingIds, setHoldingIds] = React.useState<number[]>([])
  const [scanNote, setScanNote] = React.useState<string | null>(null)

  const [imgPrompt, setImgPrompt] = React.useState('')
  const [imgB64, setImgB64] = React.useState<string | null>(null)
  const [pinCid, setPinCid] = React.useState<string | null>(null)
  const [imgBusy, setImgBusy] = React.useState(false)
  const [pinBusy, setPinBusy] = React.useState(false)
  const [mintImgBusy, setMintImgBusy] = React.useState(false)
  const [zoom, setZoom] = React.useState(false)

  const { data: onchainMintPrice } = useReadContract({
    address: COOKIE_ADDRESS,
    abi: FortuneABI as Abi,
    functionName: 'mintPrice',
    query: { refetchInterval: 120_000 },
  })

  const prevAddrRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (address) prevAddrRef.current = address
  }, [address])

  const clearWalletUI = React.useCallback(() => {
    setLastMinted(null)
    setHoldingIds([])
    setScanNote(null)
    setUiError(null)
    qc.removeQueries({ queryKey: ['lastMinted'] })
    qc.removeQueries({ queryKey: ['holdings'] })
    try {
      const a = prevAddrRef.current ?? address ?? ''
      localStorage.removeItem('fc:lastMinted')
      if (a) {
        localStorage.removeItem(`fc:lastMinted:${a}`)
        localStorage.removeItem(`fc:holdings:${a}`)
      }
    } catch {}
  }, [qc, address])

  useAccountEffect({
    onDisconnect() {
      clearWalletUI()
    },
  })

  // ---------- Queries (SA address–driven) ----------
  const lastMintQ = useQuery({
    queryKey: ['lastMinted', saAddress, COOKIE_ADDRESS],
    enabled: !!saAddress && !!COOKIE_ADDRESS,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(
        `/api/holdings?address=${saAddress}&contract=${COOKIE_ADDRESS}`,
        { cache: 'no-store' },
      )
      if (!r.ok) return null
      const j = await r.json()
      const ids = Array.isArray(j?.tokenIds) ? (j.tokenIds as number[]) : []
      if (!ids.length) return null
      return Math.max(...ids)
    },
  })

  React.useEffect(() => {
    if (!connected) return
    const serverVal = lastMintQ.data
    if (serverVal != null) {
      setLastMinted(serverVal)
      try {
        localStorage.setItem(`fc:lastMinted:${saAddress}`, String(serverVal))
      } catch {}
      return
    }
    try {
      const s = localStorage.getItem(`fc:lastMinted:${saAddress}`)
      if (s && !Number.isNaN(Number(s))) setLastMinted(Number(s))
    } catch {}
  }, [connected, saAddress, lastMintQ.data])

  const holdingsQ = useQuery({
    queryKey: ['holdings', saAddress, COOKIE_ADDRESS],
    enabled: !!saAddress && !!COOKIE_ADDRESS,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(
        `/api/holdings?address=${saAddress}&contract=${COOKIE_ADDRESS}`,
        { cache: 'no-store' },
      )
      if (!r.ok) return [] as number[]
      const j = await r.json()
      if (j?.note) setScanNote(j.note as string)
      const ids = Array.isArray(j?.tokenIds) ? (j.tokenIds as number[]) : []
      return Array.from(new Set(ids)).sort((a, b) => a - b)
    },
  })

  // Fallback: if lastMint still null but we have holdings, use max tokenId
  React.useEffect(() => {
    if (lastMintQ.isLoading) return
    if (!connected) return
    if (lastMintQ.data == null && holdingsQ.data && holdingsQ.data.length > 0) {
      const mx = holdingsQ.data[holdingsQ.data.length - 1]
      setLastMinted(mx)
      try {
        localStorage.setItem(`fc:lastMinted:${saAddress}`, String(mx))
      } catch {}
    }
  }, [connected, saAddress, lastMintQ.isLoading, lastMintQ.data, holdingsQ.data])

  React.useEffect(() => {
    setHoldingIds(holdingsQ.data ?? [])
  }, [holdingsQ.data])

  React.useEffect(() => {
    if (!connected) return
    const t = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: ['lastMinted', saAddress] })
      qc.invalidateQueries({ queryKey: ['holdings', saAddress, COOKIE_ADDRESS] })
    }, 60_000)
    return () => window.clearInterval(t)
  }, [connected, saAddress, qc])

  // ---------- Generate with AI ----------
  const onGenerate = async () => {
    setUiError(null)
    setGenBusy(true)
    try {
      const r = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || undefined,
          vibe: vibe || undefined,
          name: nameOpt || undefined,
        }),
      })
      const j = await r.json()
      const f = j?.fortune ?? j?.text ?? j?.message ?? ''
      if (!f) throw new Error('No fortune returned')
      setFortune(f)
    } catch (e: any) {
      setUiError(e?.message || 'Failed to generate fortune')
    } finally {
      setGenBusy(false)
    }
  }

  // ---------- Mint (SA path; mirrors main smartaccount) ----------
  //const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined)

  const onMintImage = async () => {
    setUiError(null)
    if (!connected || !address) { setUiError('Connect your wallet first.'); return }
    if (!pinCid) { setUiError('Save the image to Pinata first.'); return }

    if (mode === 'sa' && bundlerClient && saReady) {
      if (parseEther(String(saBalance ?? '0')) < parseEther('1.1')) {
        setUiError('need to top up Smart account > 1.1 MON')
        return
      }
      setMintImgBusy(true)
      try {
        if (!walletClient) throw new Error('No wallet client')
        const sa = await buildSmartAccount(walletClient as any)

        const data = encodeFunctionData({
          abi: FortuneABI as Abi,
          functionName: 'mintWithImage',
          args: [`fortune`, `ipfs://${pinCid}`],
        })

        const value =
          typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n
            ? onchainMintPrice
            : 0n

        await sendSaUo({
          sa,
          to: COOKIE_ADDRESS as Address,
          data: data as `0x${string}`,
          value,
        })
      } catch (e: any) {
        setUiError(String(e?.message || e))
      } finally {
        setMintImgBusy(false)
      }
      return
    }
  }

  const onMint = async () => {
    setUiError(null)
    if (!connected || !address) { setUiError('Connect your wallet first.'); return }
    if (!fortune?.trim()) { setUiError('Enter or generate a fortune first.'); return }

    setMintBusy(true)
    try {
      if (!walletClient) throw new Error('No wallet client')
      const sa = await buildSmartAccount(walletClient as any)

      const data = encodeFunctionData({
        abi: FortuneABI as Abi,
        functionName: 'mintWithFortune',
        args: [fortune.trim()],
      })

      const value =
        typeof onchainMintPrice === 'bigint' && onchainMintPrice > 0n
          ? onchainMintPrice
          : 0n

      await sendSaUo({
        sa,
        to: COOKIE_ADDRESS as Address,
        data: data as `0x${string}`,
        value,
      })
    } catch (e: any) {
      setUiError(e?.shortMessage || e?.message || 'Mint failed')
    } finally {
      setMintBusy(false)
    }
  }

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // Parse logs; set lastMinted; invalidate queries (mirror main)
  React.useEffect(() => {
    if (!isConfirmed || !receipt || !saAddress) return

    let foundTokenId: number | null = null
    try {
      const decoded = parseEventLogs({
        abi: FortuneABI as Abi,
        logs: (receipt.logs ?? []) as any,
      })
      for (const ev of decoded) {
        if (!ev || (ev as any).eventName == null) continue

        const evAddr = (ev as any).saAddress as `0x${string}` | undefined
        if (evAddr && evAddr.toLowerCase() !== COOKIE_ADDRESS.toLowerCase()) continue

        if ((ev as any).eventName === 'CookieMinted') {
          const args: any = (ev as any).args
          const tid = Number(args?.tokenId ?? args?.tokenID ?? args?.id)
          const minter = args?.minter as `0x${string}` | undefined
          if (!Number.isNaN(tid) && (!minter || isAddressEqual(minter, saAddress as `0x${string}`))) {
            foundTokenId = tid
            break
          }
        }

        if ((ev as any).eventName === 'Transfer') {
          const args: any = (ev as any).args
          const from = args?.from as `0x${string}`
          const to = args?.to as `0x${string}`
          const tid = Number(args?.tokenId)
          if (
            from &&
            to &&
            isAddressEqual(from, zeroAddress) &&
            isAddressEqual(to, saAddress as `0x${string}`) &&
            !Number.isNaN(tid)
          ) {
            foundTokenId = tid
            break
          }
        }
      }
    } catch {}

    if (foundTokenId != null) {
      setLastMinted(foundTokenId)
      try {
        localStorage.setItem(`fc:lastMinted:${saAddress}`, String(foundTokenId))
      } catch {}
    }

    qc.invalidateQueries({ queryKey: ['lastMinted', saAddress] })
    qc.invalidateQueries({ queryKey: ['holdings', saAddress, COOKIE_ADDRESS] })
  }, [isConfirmed, receipt, saAddress, qc])

  // ---------- UI ----------
  return (
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
        {/* LEFT: Mint Fortune }
        <section className="card card--fortune">
          <h2 className="card__title">Generate Fortune</h2>

          <div className="two-col">
            <div className="field field--full">
              <label className="label">Prompt</label>
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

          <button className="btn btn--primary" onClick={onGenerate} disabled={genBusy}>
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
            className="btn btn--accent"
            onClick={onMint}
            disabled={mintBusy || !connected}
          >
            {mintBusy ? 'Waiting for wallet…' : 'Mint This Fortune (SA)'}
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
                placeholder="e.g., neon cyber cookie with logo"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn--primary" onClick={async () => {
                  const p = imgPrompt.trim()
                  if (!p) { setUiError('Enter a topic/hint'); return }
                  setUiError(null); setImgBusy(true); setImgB64(null); setPinCid(null)
                  try {
                    const res = await fetch('/api/images', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ prompt: p, size: '1024x1024' }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
                    if (!data?.b64) throw new Error('No image returned')
                    setImgB64(data.b64)
                  } catch (e: any) { setUiError(e?.message || 'Generation failed') }
                  finally { setImgBusy(false) }
                }} disabled={imgBusy}>
                  {imgBusy ? 'Generating…' : 'Generate Image with AI'}
                </button>
                <button className="btn btn--primary" onClick={async () => {
                  if (!imgB64) { setUiError('No image to save.'); return }
                  setUiError(null); setPinBusy(true); setPinCid(null)
                  try {
                    const r = await fetch('/api/pinata', {
                      method: 'POST',
                      body: JSON.stringify({ b64: imgB64, filename: 'monad-cookie.png' }),
                    })
                    const j = await r.json()
                    if (!r.ok) throw new Error(j?.error || 'Failed to save to Pinata')
                    setPinCid(j.cid)
                  } catch (e: any) { setUiError(e?.message || 'Pinning failed') }
                  finally { setPinBusy(false) }
                }} disabled={!imgB64 || pinBusy}>
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
                disabled={!pinCid || mintImgBusy || !connected}
              >
                {mintImgBusy ? 'Waiting for wallet…' : 'Mint this Image (SA)'}
              </button>
            </div>
          </div>

          {zoom && imgB64 ? (
            <div
              onClick={() => setZoom(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <img
                src={`data:image/png;base64,${imgB64}`}
                style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }}
              />
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
          </div>

          <SaStatusCard />

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
                <a href={explorerNftUrl(lastMinted)} target="_blank" className="link">
                  view
                </a>
                <a href={xShareUrl(lastMinted)} target="_blank" className="link">
                  share on X
                </a>
              </div>
            )}
          </div>

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
                {holdingIds.map((id) => (
                  <li key={id} className="line">
                    <span>{`COOKIE #${id}`}</span>
                    <a href={explorerNftUrl(id)} target="_blank" className="link">
                      view
                    </a>
                    <a href={xShareUrl(id)} target="_blank" className="link">
                      share on X
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {connected && scanNote ? <div className="note">{scanNote}</div> : null}
          </div>
        </section>
      </div>

      {/* Mini styles }
      <style jsx>{`
        /* Global background stays consistent inside Warpcast webview 
          :global(html), :global(body) { background: #0b0b10; }

          /* The mini surface: fixed size, centered, scrolls internally 
          .page {
            /* Farcaster web mini recommended surface ~424 x 695 
            box-sizing: border-box;
            width: 424px;
            max-width: 100%;
            height: 695px;
            margin: 0 auto;
            color: #e5e7eb;

            /* Padding tighter than desktop 
            padding: 12px;

            /* Scroll only the content inside this surface 
            overflow: auto;

            /* Optional: subtle in-view background in case parent is transparent 
            background: #0b0b10;
          }

          /* Force single column for mini; keep small gaps 
          .grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          /* Drop the desktop 2-col override (it makes columns on wide screens) 
          /* (Remove your previous @media that reorders columns) 

          .col { min-width: 0; display: flex; flex-direction: column; gap: 8px; }

          .card {
            background: rgba(24,24,28,.82);
            border: 1px solid rgba(63,63,70,.7);
            border-radius: 14px;          /* slightly tighter than desktop 
            padding: 14px;                 /* tighter than desktop 
            box-shadow: 0 10px 30px rgba(0,0,0,.3);
          }

          .card__title {
            font-size: 12px;               /* compact titles 
            text-transform: uppercase;
            letter-spacing: .08em;
            color: #a1a1aa;
            margin-bottom: 8px;
            font-weight: 700;
          }

          .row { display: grid; grid-template-columns: 1fr; gap: 12px; }
          .field { margin: 8px 0; }
          .label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; }

          /* Inputs: full width on mini; compact spacing 
          .input, .textarea {
            width: 90%;
            background: rgba(39,39,42,.7);
            border: 1px solid rgba(82,82,91,.6);
            border-radius: 10px;
            padding: 8px 10px;
            font-size: 14px;
            color: #e5e7eb;
            outline: none;
          }
          .textarea { min-height: 100px; resize: vertical; }

          .hint { margin-top: 6px; font-size: 12px; color: #9ca3af; }

          /* 2-col groups collapse to 1 column in mini 
          .two-col {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .two-col .input { width: 100%; box-sizing: border-box; }

          /* Buttons: slightly smaller padding & font for mini 
          .btn {
            display: inline-block;
            border-radius: 10px;
            padding: 9px 12px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            margin: 6px 0;
            font-size: 13px;
          }
          .btn--primary { background: #4f46e5; color: #fff; }
          .btn--primary:hover { background: #6366f1; }
          .btn--accent { background: #7c3aed; color: #fff; }
          .btn--accent:hover { background: #8b5cf6; }

          .alert {
            background: rgba(127,29,29,.25);
            border: 1px solid rgba(185,28,28,.35);
            color: #fecaca;
            padding: 10px 12px;
            border-radius: 10px;
            margin-bottom: 12px;
            font-size: 13px;
          }

          .status { display: grid; gap: 8px; font-size: 14px; }
          .status__row { display: flex; align-items: center; gap: 8px; }
          .muted { color: #9ca3af; }
          .pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
          .pill--ok { background: rgba(6,95,70,.3); color: #86efac; }
          .pill--off { background: rgba(82,82,91,.5); color: #e5e7eb; }

          .block { margin-top: 16px; }
          .block__title { font-weight: 600; color: #d4d4d8; margin-bottom: 6px; font-size: 14px; }
          .dash { color: #a1a1aa; }
          .list { list-style: disc; padding-left: 18px; display: grid; gap: 6px; }
          .line > * + * { margin-left: 10px; }
          .link { color: #a5b4fc; text-decoration: none; }
          .link:hover { text-decoration: underline; }
          .note { margin-top: 6px; font-size: 12px; color: #9ca3af; }

          /* Zoom overlay should always be on top 
          :global(.zoom-overlay) { z-index: 1000; }
      `}</style>
    </main>
  )
}
*/