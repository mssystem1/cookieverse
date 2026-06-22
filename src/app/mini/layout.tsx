import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Keep the Mini App's existing page metadata isolated from website and /app
// social-preview metadata. Farcaster embed tags still come from the root.
export const metadata: Metadata = {
  title: 'Cookieverse',
  description: 'AI blessing cookies',
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default function CookieverseMiniLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
