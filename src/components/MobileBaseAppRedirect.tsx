'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function MobileBaseAppRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (pathname !== '/') return;

    // Allow manual desktop override:
    // https://www.cookieverse.tech/?web=1
    if (searchParams.get('web') === '1') {
      window.localStorage.setItem('cookieverse:disable-mobile-redirect', '1');
      return;
    }

    const disabled =
      window.localStorage.getItem('cookieverse:disable-mobile-redirect') === '1';

    if (disabled) return;

    const isCompactDevice =
      window.innerWidth <= 1024 ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.('(pointer: coarse)').matches;

    if (!isCompactDevice) return;

    const qs = window.location.search || '';
    router.replace(`/app${qs}`);
  }, [pathname, router, searchParams]);

  return null;
}