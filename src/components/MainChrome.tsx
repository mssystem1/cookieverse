'use client';

import { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';

export function MainChrome({ children }: PropsWithChildren) {
  const pathname = usePathname() || '/';

  if (pathname.startsWith('/mini')) return null;
  if (pathname.startsWith('/app')) return null;

  return <>{children}</>;
}

export function FarcasterMiniOnly({ children }: PropsWithChildren) {
  const pathname = usePathname() || '/';

  return pathname.startsWith('/mini') ? <>{children}</> : null;
}

export function BaseAppOnly({ children }: PropsWithChildren) {
  const pathname = usePathname() || '/';

  return pathname.startsWith('/app') ? <>{children}</> : null;
}