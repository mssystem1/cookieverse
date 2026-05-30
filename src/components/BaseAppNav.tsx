'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

type BaseAppNavProps = {
  twitterUsername?: string;
  twitterImage?: string;
};

export default function BaseAppNav({
  twitterUsername,
  twitterImage,
}: BaseAppNavProps) {
  const pathname = usePathname();

  const items = [
    { href: '/app', label: 'Main' },
    { href: '/app/bridge', label: 'Bridge' },
    { href: '/app/leaderboard', label: 'Leaderboard' },
    { href: '/app/dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="base-app-nav">
      {/* Small responsive banner. Image must fit inside, no crop. */}
      <Link
        href="/app"
        className="base-app-nav__banner"
        aria-label="Cookieverse World Cup"
      >
        <img
          src="/xcup/world-cup-header-desktop.png"
          alt="Cookieverse World Cup"
          className="base-app-nav__banner-img"
        />
      </Link>

      {/* Top row: logo + X profile */}
      <div className="base-app-nav__top">
        <Link href="/app" className="base-app-nav__brand">
          <img
            src="/ms-logo-mini.png"
            alt="Cookieverse"
            className="base-app-nav__logo"
          />
          <div>
            <div className="base-app-nav__title">Cookieverse</div>
            <div className="base-app-nav__subtitle">World Cup Mode</div>
          </div>
        </Link>

        {twitterUsername ? (
          <a
            href={`https://x.com/${twitterUsername}`}
            target="_blank"
            rel="noreferrer"
            className="base-app-nav__x"
          >
            {twitterImage ? (
              <img
                src={twitterImage.replace('_normal', '_200x200')}
                alt="X avatar"
                className="base-app-nav__avatar"
              />
            ) : null}
            <span>@{twitterUsername}</span>
          </a>
        ) : null}
      </div>

      {/* Wallet */}
      <div className="base-app-nav__wallet">
        <ConnectButton
          chainStatus="icon"
          accountStatus={{ smallScreen: 'avatar', largeScreen: 'avatar' }}
          showBalance={{ smallScreen: false, largeScreen: true }}
        />
      </div>

      {/* Tabs */}
      <nav className="base-app-nav__tabs" aria-label="Base App navigation">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/app' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'base-app-nav__tab base-app-nav__tab--active'
                  : 'base-app-nav__tab'
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}