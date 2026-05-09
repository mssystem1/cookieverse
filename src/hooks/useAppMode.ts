'use client';

import { usePathname } from 'next/navigation';
import { useResponsiveMode } from './useResponsiveMode';

export function useAppMode() {
  const pathname = usePathname() || '/';
  const responsive = useResponsiveMode();

  const isFarcasterMini = pathname.startsWith('/mini');
  const isBaseAppRoute = pathname.startsWith('/app');
  const isWebRoute = !isFarcasterMini && !isBaseAppRoute;

  return {
    pathname,

    // Runtime mode
    isFarcasterMini,
    isBaseAppRoute,
    isWebRoute,

    // Style mode
    isMobile: responsive.isMobile,
    isTablet: responsive.isTablet,
    isDesktop: responsive.isDesktop,
    isCompactLayout: responsive.isCompactLayout,
    isTouch: responsive.isTouch,
  };
}