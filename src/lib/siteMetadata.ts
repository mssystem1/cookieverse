import type { Metadata } from 'next';

export const COOKIEVERSE_SITE_NAME = 'Cookieverse';

export const COOKIEVERSE_DESCRIPTION =
  'Roast your wallet, mint AI fortune and World Cup prophecy NFTs, bridge with LayerZero, complete quests, and climb the Cookieverse leaderboard.';

export const COOKIEVERSE_APP_DESCRIPTION =
  'Roast your Base wallet, mint AI fortune COOKIE NFTs, bridge with LayerZero, farm quests, and climb the Cookieverse leaderboard.';

export const COOKIEVERSE_OG_IMAGE = {
  path: '/brand/mssystem-world-cup-og-v2-1200x630.jpg',
  width: 1200,
  height: 630,
  alt: 'Cookieverse World Cup experience by MSSystem',
} as const;

export function cookieverseSiteUrl() {
  const configured = String(process.env.SITE_URL || '').trim();

  try {
    return new URL(configured || 'https://www.cookieverse.tech');
  } catch {
    return new URL('https://www.cookieverse.tech');
  }
}

export function buildCookieversePageMetadata(options: {
  canonicalPath: '/' | '/app';
  description: string;
}): Metadata {
  const { canonicalPath, description } = options;

  return {
    metadataBase: cookieverseSiteUrl(),
    title: COOKIEVERSE_SITE_NAME,
    description,
    applicationName: COOKIEVERSE_SITE_NAME,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: 'website',
      url: canonicalPath,
      siteName: COOKIEVERSE_SITE_NAME,
      title: COOKIEVERSE_SITE_NAME,
      description,
      images: [
        {
          url: COOKIEVERSE_OG_IMAGE.path,
          width: COOKIEVERSE_OG_IMAGE.width,
          height: COOKIEVERSE_OG_IMAGE.height,
          alt: COOKIEVERSE_OG_IMAGE.alt,
          type: 'image/jpeg',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: COOKIEVERSE_SITE_NAME,
      description,
      images: [
        {
          url: COOKIEVERSE_OG_IMAGE.path,
          alt: COOKIEVERSE_OG_IMAGE.alt,
          width: COOKIEVERSE_OG_IMAGE.width,
          height: COOKIEVERSE_OG_IMAGE.height,
        },
      ],
    },
  };
}
