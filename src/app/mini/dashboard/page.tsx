// src/app/mini/dashboard/page.tsx
'use client';

import * as React from 'react';

// (kept for future – same pattern as other mini pages)
// const getSdk = async () => (await import('@farcaster/miniapp-sdk')).sdk;

import DashboardClient from '../../../app/dashboard/ui/DashboardClient';
import MiniNav from '../../../components/mini/MiniNav';

export default function MiniDashboardPage() {
  /*
  // If you want to fully follow the Farcaster splash pattern, you can
  // uncomment this block once you're sure miniapp-sdk is available:
  React.useEffect(() => {
    (async () => {
      try {
        const sdk = await getSdk();
        await sdk.actions.ready().catch(() => {});
        const provider: any = await sdk.wallet.getEthereumProvider().catch(() => null);
        if (provider) {
          (window as any).ethereum = provider;
          provider?.on?.('accountsChanged', () => {});
          provider?.on?.('disconnect', () => {});
        }
      } catch {
        // Not inside Farcaster host — safe no-op so /mini/dashboard still renders in browser
      }
    })();
  }, []);
  */

  return (
    <div className="mini-root">

      {/* Main scrollable area per mini guidelines */}
      <div className="page">
        <div className="grid">
          <div className="card">
            <div className="card__title">Cookieverse Dashboard</div>
            {/* Reuse your full Dashboard logic 1:1 */}
            <DashboardClient />
          </div>
        </div>
      </div>

      {/* Farcaster Mini layout overrides (424x695 vertical modal) */}
      <style jsx global>{`
        /* Outer modal size per docs (web mini): 424 x 695 */
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

        /* Header vs scrollable area */
        .mini-header {
          flex: 0 0 auto;
          padding: 0 12px;
        }

        .mini-root .page {
          flex: 1 1 auto;
          overflow: auto; /* vertical scroll in the content only */
          max-width: 100%;
          padding: 12px; /* tighter padding for mini */
        }

        /* Layout: stack cards in single column */
        .mini-root .grid {
          display: grid;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        /* Tighter cards for mini surface */
        .mini-root .card {
          padding: 14px !important;
          border-radius: 14px !important;
        }

        .mini-root .card__title {
          font-size: 12px !important;
          margin-bottom: 8px !important;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9ca3af;
        }

        /* Inputs/buttons (if any inside Dashboard) fit 424px comfortably */
        .mini-root .input,
        .mini-root input {
          padding: 8px 10px !important;
          font-size: 14px !important;
        }

        .mini-root .textarea,
        .mini-root textarea {
          min-height: 100px !important;
        }

        .mini-root .btn,
        .mini-root button {
          padding: 9px 12px !important;
          font-size: 13px !important;
          border-radius: 10px !important;
        }

        /* Generic 2-col helpers collapse on mini */
        .mini-root .two-col {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .mini-root .list {
          gap: 4px !important;
        }

        /* Keep global background consistent when embedded */
        :root,
        :global(html),
        :global(body) {
          background: #0b0b10;
        }
      `}</style>
    </div>
  );
}
