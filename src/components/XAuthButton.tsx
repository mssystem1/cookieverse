'use client';

import { useEffect, useState } from 'react';

export default function XAuthButton() {
  const [username, setUsername] = useState<string | null>(null);
  const [twitterImage, setTwitterImage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const r = await fetch('/api/auth/session');
      const data = r.ok ? await r.json() : null;
      if (!ignore) {
        setUsername(data?.twitter_username || null);
        setTwitterImage(data?.twitter_image || null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // If already connected (just in case this component is shown)
  if (username) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {twitterImage && (
          <img
            src={twitterImage.replace('_normal', '_200x200')}
            alt="X avatar"
            width={72}
            height={72}
            style={{
              borderRadius: '50%',
              border: '2px solid rgba(148, 163, 184, 0.6)',
              boxShadow: '0 0 30px rgba(56, 189, 248, 0.35)',
            }}
          />
        )}
        <div
          style={{
            fontSize: 13,
            color: '#e5e7eb',
            opacity: 0.9,
          }}
        >
          Connected as <b>@{username}</b>
        </div>
        <a
          href="/"
          style={{
            padding: '10px 18px',
            borderRadius: 9999,
            border: '1px solid #4b5563',
            background:
              'radial-gradient(circle at top left, #22c55e33, #0f172a 45%, #1d4ed833)',
            color: '#f9fafb',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          Enter app
        </a>
      </div>
    );
  }

  // when not yet logged in
  const callbackUrl = '/';

  return (
    <a
      href={`/api/auth/signin/twitter?callbackUrl=${encodeURIComponent(
        callbackUrl,
      )}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 22px',
        borderRadius: 9999,
        border: '1px solid rgba(148, 163, 184, 0.6)',
        background:
          'radial-gradient(circle at top left, #38bdf833, #020617 45%, #8b5cf633)',
        color: '#f9fafb',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.9)',
        transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out, border-color 0.12s ease-out',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px) scale(1.01)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          '0 22px 45px rgba(15,23,42,0.95)';
        (e.currentTarget as HTMLAnchorElement).style.borderColor =
          '#e5e7eb';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0) scale(1)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          '0 18px 40px rgba(15, 23, 42, 0.9)';
        (e.currentTarget as HTMLAnchorElement).style.borderColor =
          'rgba(148,163,184,0.6)';
      }}
    >
      {/* X icon */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#020617',
          border: '1px solid rgba(148,163,184,0.7)',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        𝕏
      </span>
      <span>Sign in with X</span>
    </a>
  );
}
