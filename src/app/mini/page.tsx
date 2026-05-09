// src/app/mini/page.tsx
'use client';

import * as React from 'react';
// lazy import the SDK so /mini can render even outside Warpcast
const getSdk = async () => (await import('@farcaster/miniapp-sdk')).sdk;

// reuse your main page 1:1 (all logic/cards/queries)
import MainPage from '../page';

export default function MiniMirrorPage() {
  /*
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
*/
  return (
    <div className="mini-root">
      {/* exact same content as app/page.tsx */}
      <MainPage />

      {/* --- MINI OVERRIDES (scoped) --- */}
      <style jsx global>{`
        /* Outer modal size per docs (web mini): 424 x 695 */
        .mini-root {
          box-sizing: border-box;
          width: 424px;
          max-width: 100%;
          height: 695px;
          margin: 0 auto;
          padding: 8px 0 12px;
          overflow: hidden;           /* contain the app UI to modal bounds */
          display: flex;
          flex-direction: column;
          background: #0b0b10;
        }

        /* Make the scroll area only the main content, not the header */
        .mini-header {
          flex: 0 0 auto;
          padding: 0 12px;
        }
        .mini-root .page {
          flex: 1 1 auto;
          overflow: auto;             /* vertical scroll in the content only */
          max-width: 100%;
          padding: 12px;              /* tighter padding for mini */
        }

        /* Layout: stack cards in one column; keep small gaps */
        .mini-root .grid {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .mini-root .card--wallet-roast {
          order: -100;
          padding: 14px !important;
          border-radius: 18px !important;
          border-color: rgba(139, 92, 246, 0.45);
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.24), transparent 36%),
            radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.16), transparent 36%),
            rgba(255, 255, 255, 0.065);
          box-shadow:
            0 14px 42px rgba(88, 28, 135, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .mini-root .card--wallet-roast img {
          display: block;
          width: 100%;
          max-width: 100%;
          height: auto;
          margin: 10px auto;
          border-radius: 16px;
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.36);
        }

        .mini-root .card--wallet-roast .btn,
        .mini-root .card--wallet-roast button {
          width: 100%;
        }

        /* Tighter components for mini surface */
        .mini-root .card {
          padding: 14px !important;
          border-radius: 14px !important;
        }
        .mini-root .card__title {
          font-size: 12px !important;
          margin-bottom: 8px !important;
          letter-spacing: 0.08em;
        }

        /* Form controls trimmed to fit 424 width comfortably */
        .mini-root .input,
        .mini-root .textarea {
          width: 90% !important;
          padding: 8px 10px !important;
          font-size: 14px !important;
        }
        .mini-root .textarea {
          min-height: 100px !important;
        }

        /* Buttons: slightly smaller padding for mini */
        .mini-root .btn {
          padding: 9px 12px !important;
          font-size: 13px !important;
          border-radius: 10px !important;
        }

        /* 2-col groups collapse nicely inside the 424px surface */
        .mini-root .two-col {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        /* Status list spacing tweaks */
        .mini-root .list {
          gap: 4px !important;
        }

        /* Ensure the body background stays consistent when embedded */
        :root, :global(html), :global(body) {
          background: #0b0b10;
        }
      `}</style>
    </div>
  );
}
