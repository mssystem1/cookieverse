'use client';

import * as React from 'react';

// lazy import the SDK so /mini-bridge can render even outside Warpcast
const getSdk = async () => (await import('@farcaster/miniapp-sdk')).sdk;

// reuse your bridge page 1:1 (all logic/cards/queries)
import BridgePage from '../../bridge/page';

export default function MiniBridgePage() {
  /*
  React.useEffect(() => {
    (async () => {
      try {
        const sdk = await getSdk();

        // Hide the splash **after** your UI is ready
        sdk.actions.ready().catch(() => {});

        // Expose Farcaster EIP-1193 so wagmi injected() picks it up
        const provider: any = await sdk.wallet
          .getEthereumProvider()
          .catch(() => null);

        if (provider) {
          (window as any).ethereum = provider;

          // Optional: attach listeners so host doesn’t complain
          provider?.on?.('accountsChanged', () => {});
          provider?.on?.('disconnect', () => {});
        }
      } catch {
        // Not inside Farcaster host — safe no-op so /mini-bridge still renders in browser
      }
    })();
  }, []);
*/
  return (
    <div className="mini-root">
      {/* exact same content as app/bridge/page.tsx */}
      <BridgePage />

      {/* --- MINI OVERRIDES (scoped) --- */}
      <style jsx global>{`
        /* Outer modal size per Farcaster Mini docs (web surface): 424 x 695 */
        .mini-root {
          box-sizing: border-box;
          width: 424px;
          max-width: 100%;
          height: 695px;
          margin: 0 auto;
          padding: 8px 0 12px;
          overflow: hidden; /* contain the app UI to modal bounds */
          display: flex;
          flex-direction: column;
          background: #0b0b10;
        }

        /* If you use a header on bridge page, you can give it .mini-header to freeze it */
        .mini-header {
          flex: 0 0 auto;
          padding: 0 12px;
        }

        /* Reuse your .page class from bridge; make only main content scrollable */
        .mini-root .page {
          flex: 1 1 auto;
          overflow: auto;
          max-width: 100%;
          padding: 12px; /* tighter padding for mini */
        }

        /* Layout: single column cards for 424px viewport */
        .mini-root .grid {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        /* Tighter card styling for mini surface */
        .mini-root .card {
          padding: 14px !important;
          border-radius: 14px !important;
        }
        .mini-root .card__title {
          font-size: 12px !important;
          margin-bottom: 8px !important;
          letter-spacing: 0.08em;
        }

        /* Form controls trimmed to fit inside 424px comfortably */
        .mini-root .input,
        .mini-root .textarea,
        .mini-root select {
          width: 90% !important;
          max-width: 100%;
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

        /* Any 2-col sections on bridge page collapse nicely on mini */
        .mini-root .two-col {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        /* Status list spacing tweaks for mini */
        .mini-root .list {
          gap: 4px !important;
        }

        /* Ensure body background stays consistent when embedded */
        :root,
        :global(html),
        :global(body) {
          background: #0b0b10;
        }
      `}</style>
    </div>
  );
}
