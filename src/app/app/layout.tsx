import type { ReactNode } from 'react';

import {
  buildCookieversePageMetadata,
  COOKIEVERSE_APP_DESCRIPTION,
} from '../../lib/siteMetadata';

export const metadata = buildCookieversePageMetadata({
  canonicalPath: '/app',
  description: COOKIEVERSE_APP_DESCRIPTION,
});

export default function CookieverseAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
