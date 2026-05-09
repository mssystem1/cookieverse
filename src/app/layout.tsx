import type { Metadata } from "next";
import Providers from "./providers";
import NavTabs from "../components/NavTabs";
import { headers } from 'next/headers'

//import { SmartAccountProvider } from './SmartAccountProvider';

import{MainChrome, FarcasterMiniOnly, BaseAppOnly} from "../components/MainChrome";

import MobileBaseAppRedirect from '../components/MobileBaseAppRedirect';
import BaseAppNav from '../components/BaseAppNav';

import MiniProviders from "../components/mini/MiniProviders.client";

import MiniNav from '../components/mini/MiniNav'

import TopUpMenu from '../components/TopUpMenu';

import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth"; // we'll create this in step 2
import XAuthButton from "../components/XAuthButton";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`

  const embed = {
  //  title: "Cookieverse",
  //  description: "AI blessing cookies",
    version: 'next',
    imageUrl: `${origin}/ms-logo-32.png`,
    button: {
      title: 'Open App',
      action: {
        type: 'launch_miniapp',
        name: 'Open App',
        url: `${origin}/mini`,
        splashImageUrl: `${origin}/ms-logo-mini.png`,
        splashBackgroundColor: '#0B0118',
      },
    },
  }

  return {
    title: "Cookieverse",
    description: "AI blessing cookies",  
    other: {
      'base:app_id': '69413c95d19763ca26ddc346',
      "fc:miniapp": JSON.stringify(embed),
      'fc:frame': JSON.stringify(embed),
    },
  }
}

/*
export const metadata: Metadata = {
  title: "Fortune Cookie",
  description: "AI blessing cookies",
};
*/

export default async function RootLayout({ children }: { children: React.ReactNode }) {

  const session = await getServerSession(authOptions);

  const isLoggedIn = !!session?.twitter_username;

    const twitterUsername =
    (session as any)?.twitter_username as string | undefined;
  const twitterImage =
    (session as any)?.twitter_image as string | undefined;
// <SmartAccountProvider>{children}</SmartAccountProvider>

/*
      <title>Cookieverse</title>
        <meta
          name="fc:miniapp"
          content='{
            "title": "Cookieverse",
            "description": "AI blessing cookies",
            "version": "1",
            "imageUrl": "https://www.cookieverse.tech/ms-logo.png",
            "button": {
              "title": "Open App",
              "action": {
                "type": "launch_miniapp",
                "name": "Cookieverse",
                "url": "https://www.cookieverse.tech/mini",
                "splashImageUrl": "https://www.cookieverse.tech/ms-logo-mini.png",
                "splashBackgroundColor": "#0B0118",  
              }
            }
          }'
        />
*/
  return (
    <html lang="en">
    <head>
      <meta name="base:app_id" content="69413c95d19763ca26ddc346" />
    </head>
      <body
        style={{
          background: "#000", // global BG black
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >

        <MobileBaseAppRedirect />

        {/* === NON-MINI (default app) === */}
        <MainChrome>
        {!isLoggedIn ? (
          // X login splash screen
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              background:
                'radial-gradient(circle at top, #111827 0, #020617 45%, #020617 100%)',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 460,
                borderRadius: 24,
                padding: 28,
                border: '1px solid rgba(55,65,81,0.9)',
                background:
                  'radial-gradient(circle at top left, #1d293b 0, #020617 55%)',
                boxShadow:
                  '0 30px 90px rgba(15,23,42,0.95), 0 0 0 1px rgba(15,23,42,0.9)',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* Logo & title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src="/ms-logo.png"
                  alt="MS System"
                  style={{
                    height: 52,
                    width: 52,
                    borderRadius: 12,
                    objectFit: 'cover',
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      color: '#e5e7eb',
                    }}
                  >
                    Cookieverse
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#9ca3af',
                      marginTop: 2,
                    }}
                  >
                    Connect your X account to save stats, leaderboards and mints.
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  width: '100%',
                  background:
                    'linear-gradient(90deg, transparent, rgba(148,163,184,0.6), transparent)',
                  opacity: 0.8,
                }}
              />

              {/* Call to action */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: '#d1d5db',
                    lineHeight: 1.5,
                    textAlign: 'center',   
                  }}
                >
                  You’ll be redirected to X to authorize Cookieverse. We only
                  read your public profile (handle & avatar).
                </div>
                <div style={{ marginTop: 4, textAlign: 'center', }}>
                  <XAuthButton />
                </div>
              </div>

              {/* Footnote */}
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: '#6b7280',
                  lineHeight: 1.4,
                  textAlign: 'center',   
                }}
              >
                By continuing you agree that your X username can be used for
                leaderboards, raffles and on-chain achievements in the MSSystem
                ecosystem.
              </div>
            </div>
          </div>
        ) : (
          <Providers>
          {/* Header (tabs + wallet button). Keep shell same; only page below changes with routing */}
               
        {/* Header (logo + X profile) */}
        <div style={{ background: "#111", borderBottom: "1px solid #2a2a2e" }}>
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            {/* LEFT: logo + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/ms-logo.png"
                alt="MS System"
                style={{
                  height: 80,
                  width: 80,
                  borderRadius: 10,
                  objectFit: "cover",
                }}
              />
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "#3c1dd9ff",
                }}
              >
                Cookieverse
              </div>
            </div>

            {/* RIGHT: X profile pill + wallet */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {twitterUsername && (
                <a
                  href={`https://x.com/${twitterUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 9999,
                    background:
                      "linear-gradient(135deg, #111827 0%, #020617 100%)",
                    border: "1px solid #4b5563",
                    textDecoration: "none",
                    color: "#e5e7eb",
                    fontSize: 12,
                    boxShadow: "0 0 0 1px rgba(15,23,42,0.6)",
                  }}
                >
                  {twitterImage && (
                    <img
                      src={twitterImage.replace("_normal", "_200x200")}
                      alt="X avatar"
                      width={48}
                      height={48}
                      style={{
                        borderRadius: "50%",
                        border: "1px solid #1f2937",
                      }}
                    />
                  )}
                  <span style={{ opacity: 0.7, fontSize: 11 }}>X profile</span>
                  <span style={{ fontWeight: 600 }}>@{twitterUsername}</span>
                </a>
              )}

       {/* 
           <TopUpMenu />
           */}     
            </div>
          </div>
        </div>


          
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: 8 }}>
            <NavTabs />
          </div>

          {/* Page content */}
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: 8 }}>
          {children}
          </div>
        </Providers>
        )}
        </MainChrome>

        {/* === MINI (Farcaster Mini App) ===
            No Providers, no Header, no Tabs, no SmartAccountProvider.
            Mini pages will import and use @farcaster/miniapp-sdk themselves. */}
        <FarcasterMiniOnly>
          <MiniProviders>

          <div style={{ background: '#111', borderBottom: '1px solid #2a2a2e' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/ms-logo-mini.png"        // ← put your file in /public and keep this path
                alt="MS System"
                style={{
                  height: 80,             // fits your existing header height
                  width: 80,
                  borderRadius: 10,
                  objectFit: 'cover'
                }}
              />
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#3c1dd9ff' }}>
                Cookieverse
              </div>
              {/* removed the purple gradient line */}
            </div>
          </div>
        </div>

          <div style={{ maxWidth: 1280, margin: "0 auto", padding: 8 }}>
            <MiniNav />
          </div>
            {children}
          </MiniProviders>
        </FarcasterMiniOnly>


        {/* === BASE APP / COMPACT WEB === */}
        <BaseAppOnly>
          {!isLoggedIn ? (
            <div className="base-app-login">
              <div className="base-app-login__card">
                <div className="base-app-login__brand">
                  <img
                    src="/ms-logo-mini.png"
                    alt="Cookieverse"
                    className="base-app-login__logo"
                  />
                  <div>
                    <div className="base-app-login__title">Cookieverse</div>
                    <div className="base-app-login__subtitle">
                      Connect X to save stats, leaderboards and mints.
                    </div>
                  </div>
                </div>

                <div className="base-app-login__divider" />

                <div className="base-app-login__text">
                  You’ll be redirected to X to authorize Cookieverse. We only read your
                  public profile: handle and avatar.
                </div>

                <div className="base-app-login__button">
                  <XAuthButton />
                </div>

                <div className="base-app-login__footnote">
                  Your X username can be used for leaderboards, raffles and on-chain
                  achievements in Cookieverse.
                </div>
              </div>
            </div>
          ) : (
            <Providers>
              <div className="base-app-shell">
                <BaseAppNav
                  twitterUsername={twitterUsername}
                  twitterImage={twitterImage}
                />

                <main className="base-app-content">{children}</main>
              </div>
            </Providers>
          )}

          <style>{`
            .base-app-shell {
              box-sizing: border-box;
              width: 100%;
              min-height: 100dvh;
              margin: 0 auto;
              background: #0b0b10;
              color: #e5e7eb;
              overflow-x: hidden;
            }

            .base-app-content {
              width: 100%;
              max-width: 480px;
              margin: 0 auto;
              padding: 8px 8px 18px;
              box-sizing: border-box;
            }

            .base-app-nav {
              width: 100%;
              max-width: 480px;
              margin: 0 auto;
              padding: 10px 8px 8px;
              box-sizing: border-box;
              background: #111;
              border-bottom: 1px solid #2a2a2e;
              display: flex;
              flex-direction: column;
              gap: 10px;
              position: sticky;
              top: 0;
              z-index: 40;
            }

            .base-app-nav__top {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
              min-width: 0;
            }

            .base-app-nav__brand {
              display: inline-flex;
              align-items: center;
              gap: 10px;
              min-width: 0;
              text-decoration: none;
            }

            .base-app-nav__logo {
              width: 44px;
              height: 44px;
              border-radius: 10px;
              object-fit: cover;
              flex: 0 0 auto;
            }

            .base-app-nav__title {
              font-size: 18px;
              font-weight: 900;
              letter-spacing: -0.02em;
              color: #3c1dd9ff;
              line-height: 1.05;
            }

            .base-app-nav__subtitle {
              margin-top: 2px;
              font-size: 11px;
              font-weight: 700;
              color: #8b8fa3;
              line-height: 1;
            }

            .base-app-nav__x {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              max-width: 138px;
              min-width: 0;
              padding: 5px 8px;
              border-radius: 999px;
              border: 1px solid #374151;
              background: linear-gradient(135deg, #111827 0%, #020617 100%);
              color: #e5e7eb;
              text-decoration: none;
              font-size: 11px;
              font-weight: 700;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }

            .base-app-nav__avatar {
              width: 22px;
              height: 22px;
              border-radius: 999px;
              border: 1px solid #1f2937;
              flex: 0 0 auto;
            }

            .base-app-nav__wallet {
              display: flex;
              justify-content: flex-start;
              align-items: center;
              min-height: 34px;
            }

            .base-app-nav__tabs {
              display: flex;
              align-items: center;
              gap: 7px;
              overflow-x: auto;
              overscroll-behavior-x: contain;
              scrollbar-width: none;
              padding-bottom: 2px;
            }

            .base-app-nav__tabs::-webkit-scrollbar {
              display: none;
            }

            .base-app-nav__tab {
              flex: 0 0 auto;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 8px 10px;
              border-radius: 10px;
              border: 1px solid rgba(63, 63, 70, 0.7);
              background: rgba(24, 24, 28, 0.82);
              color: #e5e7eb;
              font-size: 12px;
              font-weight: 800;
              line-height: 1;
              text-decoration: none;
              white-space: nowrap;
            }

            .base-app-nav__tab--active {
              background: #4f46e5;
              border-color: #7c3aed;
              color: #fff;
              box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18);
            }

            .base-app-content .base-app-root {
              max-width: 100% !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
            }

            .base-app-content .page {
              max-width: 100%;
              padding: 8px 0 12px;
            }

            .base-app-content .grid {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }

            .base-app-content .card {
              padding: 14px !important;
              border-radius: 14px !important;
            }

            .base-app-content .card__title {
              font-size: 12px !important;
              margin-bottom: 8px !important;
              letter-spacing: 0.08em;
            }

            .base-app-content .input,
            .base-app-content .textarea,
            .base-app-content select,
            .base-app-content input,
            .base-app-content textarea {
              width: 100% !important;
              max-width: 100%;
              padding: 8px 10px !important;
              font-size: 14px !important;
              box-sizing: border-box;
            }

            .base-app-content .textarea,
            .base-app-content textarea {
              min-height: 100px !important;
            }

            .base-app-content .btn,
            .base-app-content button {
              padding: 9px 12px !important;
              font-size: 13px !important;
              border-radius: 10px !important;
            }

            .base-app-content .two-col {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }

            .base-app-content .list {
              gap: 4px !important;
            }

            .base-app-content table {
              font-size: 12px !important;
            }

            .base-app-content th,
            .base-app-content td {
              padding: 7px 6px !important;
            }

            .base-app-login {
              min-height: 100dvh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 16px;
              box-sizing: border-box;
              background: radial-gradient(circle at top, #111827 0, #020617 45%, #020617 100%);
            }

            .base-app-login__card {
              width: 100%;
              max-width: 420px;
              border-radius: 22px;
              padding: 22px;
              border: 1px solid rgba(55, 65, 81, 0.9);
              background: radial-gradient(circle at top left, #1d293b 0, #020617 55%);
              box-shadow: 0 24px 70px rgba(15, 23, 42, 0.95);
              display: flex;
              flex-direction: column;
              gap: 16px;
              box-sizing: border-box;
            }

            .base-app-login__brand {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .base-app-login__logo {
              width: 48px;
              height: 48px;
              border-radius: 12px;
              object-fit: cover;
            }

            .base-app-login__title {
              font-size: 21px;
              font-weight: 900;
              letter-spacing: -0.02em;
              color: #e5e7eb;
            }

            .base-app-login__subtitle {
              margin-top: 2px;
              font-size: 12px;
              color: #9ca3af;
              line-height: 1.35;
            }

            .base-app-login__divider {
              height: 1px;
              width: 100%;
              background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.6), transparent);
            }

            .base-app-login__text {
              font-size: 13px;
              color: #d1d5db;
              line-height: 1.5;
              text-align: center;
            }

            .base-app-login__button {
              text-align: center;
            }

            .base-app-login__footnote {
              font-size: 11px;
              color: #6b7280;
              line-height: 1.4;
              text-align: center;
            }

            @media (min-width: 769px) {
              .base-app-nav,
              .base-app-content {
                max-width: 720px;
              }
            }

            @media (min-width: 1025px) {
              .base-app-nav,
              .base-app-content {
                max-width: 960px;
              }
            }
          `}</style>
        </BaseAppOnly>

      </body>
    </html>
  );
}
