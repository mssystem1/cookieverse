import type { Metadata } from "next";
import Providers from "./providers";
import NavTabs from "../components/NavTabs";
import { headers } from 'next/headers'

//import { SmartAccountProvider } from './SmartAccountProvider';

import{MainChrome, MiniOnly} from "../components/MainChrome";
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
    title: "Cookieverse",
    description: "AI blessing cookies",
    version: '1',
    imageUrl: `${origin}/ms-logo.png`,
    button: {
      title: 'Open',
      action: {
        type: 'launch_frame',
        name: 'Cookieverse',
        url: `${origin}/mini`,
        splashImageUrl: `${origin}/ms-logo.png`,
        splashBackgroundColor: '#0B0118',
      },
    },
  }

  return {
    other: {
      'fc:miniapp': JSON.stringify(embed),
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
  return (
    <html lang="en">
      <body
        style={{
          background: "#000", // global BG black
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >
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
        <MiniOnly>
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
        </MiniOnly>
      </body>
    </html>
  );
}
