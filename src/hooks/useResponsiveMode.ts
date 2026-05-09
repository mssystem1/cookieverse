'use client';

import * as React from 'react';

export function useResponsiveMode() {
  const [mode, setMode] = React.useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isCompactLayout: false,
    isTouch: false,
  });

  React.useEffect(() => {
    const calculate = () => {
      const width = window.innerWidth;

      const isTouch =
        window.matchMedia('(pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0;

      const isMobile = width <= 768;
      const isTablet = width > 768 && width <= 1024;
      const isDesktop = width > 1024;

      setMode({
        isMobile,
        isTablet,
        isDesktop,
        isCompactLayout: isMobile || isTablet || isTouch,
        isTouch,
      });
    };

    calculate();

    window.addEventListener('resize', calculate);
    window.addEventListener('orientationchange', calculate);

    return () => {
      window.removeEventListener('resize', calculate);
      window.removeEventListener('orientationchange', calculate);
    };
  }, []);

  return mode;
}