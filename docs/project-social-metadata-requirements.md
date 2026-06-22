# Cookieverse Project and Social Metadata — Technical Requirements

Status: proposed  
Scope: Cookieverse website and `/app` social previews only  
Target production origin: `https://www.cookieverse.tech`

## 1. Objective

Make Cookieverse links display a consistent project title, description, and
promotional image across:

- the public website `/`;
- the compact web/Base App route `/app`;
- ordinary web and messaging link previews;
- X/Twitter cards.

The intended presentation is similar to the supplied screenshot:

```txt
Cookieverse

Roast your Base wallet, mint AI fortune COOKIE NFTs, bridge with
LayerZero, farm quests, and climb the Cookieverse leaderboard.

[wide Cookieverse promotional image]
```

## 2. Important Platform Boundary

This work changes website metadata only.

### 2.1 Website metadata

Next.js controls metadata returned by:

```txt
https://www.cookieverse.tech/
https://www.cookieverse.tech/app
```

This includes:

- HTML title and description;
- canonical URL;
- Open Graph title, description, URL, and image;
- Twitter/X large-image card;
- icons and optional web app manifest;

### 2.2 Base App project metadata

As of April 9, 2026, Base App treats apps as standard web apps and uses the
metadata configured on the associated Base.dev project for search and
discovery. The owner has already configured this metadata and understands that
it appears only after Base App team approval.

The existing `base:app_id` must continue to reference the same Base.dev project:

```txt
69413c95d19763ca26ddc346
```

This implementation must not alter Base.dev project metadata and does not
require Base.dev access or credentials.

### 2.3 Mini App metadata

The `/mini` route, `fc:miniapp` metadata, and
`public/.well-known/farcaster.json` are outside this task and must remain
unchanged.

## 3. Current-State Findings

### 3.1 Deployed website metadata

The deployed root and `/app` currently return:

```txt
title: Cookieverse
description: AI blessing cookies
base:app_id: 69413c95d19763ca26ddc346
```

They do not return:

- `og:title`;
- `og:description`;
- `og:image`;
- `og:url`;
- `og:site_name`;
- `twitter:card`;
- `twitter:title`;
- `twitter:description`;
- `twitter:image`;
- canonical URL.

This explains why normal social and messaging previews do not have a reliable
project picture and rich description.

### 3.2 Current inherited metadata

The root layout currently creates one Mini App embed for every route:

```txt
version: next
imageUrl: /ms-logo-32.png
launch URL: /mini
```

Website Open Graph and Twitter metadata is absent. The existing Mini App embed
is noted only because it shares the root layout; its content and launch
behavior are not part of this change.

### 3.4 Existing assets

The approved direction uses the existing MSSystem logo identity in a new World
Cup-themed composition.

Relevant existing assets:

```txt
public/ms-logo.png
  1024x1024, square legacy MSSystem art

public/ms-logo-32.png
  1024x683, approximately 3:2 legacy MSSystem art

public/xcup/world-cup-header-desktop.png
  2172x724, 3:1 World Cup-only banner

public/xcup/world-cup-header-mobile.png
  1672x941, World Cup-only banner
```

The World Cup images should not become global project metadata because they
misrepresent the full Cookieverse product.

## 4. Required Brand Copy

Use one source of truth in code for shared metadata strings.

Recommended values:

```txt
Site title:
Cookieverse

Base App title:
Cookieverse on the Base App

Short tagline:
Roast. Mint. Bridge. Climb.

Primary description:
Roast your wallet, mint AI fortune and World Cup prophecy NFTs, bridge with
LayerZero, complete quests, and climb the Cookieverse leaderboard.

Base-focused description:
Roast your Base wallet, mint AI fortune COOKIE NFTs, bridge with LayerZero,
farm quests, and climb the Cookieverse leaderboard.
```

Keep the social title concise and the description readable in common messaging
previews. Avoid stuffing the description with every supported network.

## 5. Required Image Assets

Use the established MSSystem mascot and wordmark. Do not invent a replacement
Cookieverse mascot or replace the `MSSystem` wordmark.

### 5.1 3:2 web/app image

```txt
Path: public/brand/mssystem-world-cup-embed-1200x800.jpg
Size: 1200x800
Aspect ratio: exactly 3:2
Format: optimized JPG or PNG
Recommended size: below 1 MB
```

The design uses:

```txt
the existing MSSystem mascot and wordmark
purple/blue World Cup stadium lighting
a gold World Cup-style trophy
restrained cookie motifs and gold confetti
```

Important text and faces must remain inside a central safe area because clients
may crop edges.

### 5.2 Open Graph/Twitter image

```txt
Path: public/brand/mssystem-world-cup-og-1200x630.jpg
Size: 1200x630
Aspect ratio: approximately 1.91:1
Format: optimized JPG or PNG
Recommended size: below 1 MB
```

Used by:

- Open Graph previews;
- Twitter/X `summary_large_image`;
- general messaging clients.

This may be a separately composed crop of the 3:2 artwork. It should not be
generated by stretching the 3:2 file.

## 6. Next.js Metadata Requirements

### 6.1 Shared metadata constants

Add a small server-safe metadata module, for example:

```txt
src/lib/siteMetadata.ts
```

It should define:

- canonical production origin;
- site name;
- shared title and descriptions;
- OG image URL and dimensions;
- 3:2 web/app image URL and dimensions;
- Base App ID;

Do not change or duplicate Mini App metadata as part of this module.

### 6.2 Root metadata

Update `src/app/layout.tsx` to return complete Next.js metadata:

```txt
metadataBase: https://www.cookieverse.tech
title: Cookieverse
description: approved primary description
applicationName: Cookieverse
alternates.canonical: /
openGraph.type: website
openGraph.url: /
openGraph.siteName: Cookieverse
openGraph.title: Cookieverse
openGraph.description: approved primary description
openGraph.images: 1200x630 project image with alt text
twitter.card: summary_large_image
twitter.title: Cookieverse
twitter.description: approved primary description
twitter.images: 1200x630 project image
icons: Cookieverse icon assets
```

The `base:app_id` custom tag must remain present exactly once.

Prefer a fixed canonical production origin from a server environment variable
with a production fallback:

```txt
SITE_URL=https://www.cookieverse.tech
```

Do not derive canonical metadata from arbitrary request `Host` headers. Local
development may use localhost for embed testing, but production metadata must
resolve to the canonical domain.

### 6.3 Route-specific metadata

Define route-appropriate metadata for:

```txt
/
  Canonical website title and primary description

/app
  Title: Cookieverse on the Base App
  Base-focused description
  Embed action URL: /app

```

The `/app` page is currently a client component. Add a server layout under
`src/app/app/layout.tsx` for metadata rather than converting the whole page to a
server component.

### 6.4 Static metadata image convention

Recommended implementation:

```txt
src/app/opengraph-image.jpg
src/app/twitter-image.jpg
src/app/opengraph-image.alt.txt
src/app/twitter-image.alt.txt
```

Alternatively, reference the optimized files under `public/brand/` through
`openGraph.images` and `twitter.images`.

Choose one ownership mechanism. Do not define conflicting root OG images in
both file conventions and metadata objects.

## 7. Browser and Web App Metadata

Recommended additions:

```txt
src/app/icon.png
src/app/apple-icon.png
src/app/manifest.ts
```

The web manifest should include:

- name: `Cookieverse`;
- short name: `Cookieverse`;
- approved description;
- start URL: `/app` or `/`, based on confirmed product entry point;
- display: `standalone`;
- background and theme colors;
- 192x192 and 512x512 icons;
- maskable icon if an appropriately padded asset is supplied.

This work improves browser/install presentation and remains independent from
the already configured Base.dev project.

## 8. Caching and Delivery Requirements

All metadata images must:

- return HTTP `200`;
- use the correct image content type;
- be publicly accessible without authentication;
- use absolute HTTPS URLs in social/manifest metadata;
- remain below platform file-size limits;
- avoid query-string URLs that change on every deployment;
- use stable filenames when Base.dev or clients cache by URL.

When replacing an already cached image, prefer a versioned filename such as:

```txt
mssystem-world-cup-og-v2-1200x630.jpg
```

Then update metadata to the new URL. Replacing bytes behind the same URL may
not refresh previews promptly.

## 9. Verification Requirements

### 12.1 Automated checks

Add a metadata verification script that fetches production or a supplied
preview origin and checks:

- title and description;
- canonical URL;
- Open Graph fields;
- Twitter/X fields;
- exactly one `base:app_id`;
- 1200x630 OG dimensions;
- all referenced assets return `200`;

Suggested command:

```txt
npm run check:metadata -- https://www.cookieverse.tech
```

### 12.2 Manual checks

Verify:

1. Share `https://www.cookieverse.tech/` in a general messaging client.
2. Share `https://www.cookieverse.tech/app`.
3. Confirm the title, description, and artwork match approved copy.
4. Confirm the image is legible at mobile preview size.
5. Confirm X uses a large-image card.
6. Confirm `/mini` metadata and behavior are unchanged.

## 10. Acceptance Criteria

- Root and `/app` return complete title, description, canonical, Open
  Graph, and Twitter/X metadata.
- Social previews display the approved MSSystem World Cup artwork.
- `base:app_id` remains `69413c95d19763ca26ddc346` and appears once.
- `/mini`, Farcaster metadata, and Base.dev metadata remain unchanged.
- No wallet, chain, x402, prophecy, bridge, leaderboard, Next/TLS, or business
  logic changes are required.
- Production build and metadata verification script pass.

## 11. Expected Code Change Set

Expected:

```txt
src/app/layout.tsx
src/app/app/layout.tsx
src/lib/siteMetadata.ts
public/brand/*
README.md
scripts/check-metadata.ts
package.json
```

Optional:

```txt
src/app/manifest.ts
src/app/opengraph-image.jpg
src/app/twitter-image.jpg
```

Not expected:

```txt
next.config.js
src/proxy.ts
payment/x402 routes
wallet or chain configuration
prophecy generation
NFT metadata builders
bridge, dashboard, or leaderboard logic
```

Any need to edit the “Not expected” files must be explained before
implementation.

## 12. Confirmed Decisions

1. Title: `Cookieverse`.
2. Artwork: newly generated World Cup composition using the established
   MSSystem logo.
3. Routes: website `/` and `/app` only.
4. Excluded: `/mini`, Farcaster metadata, and Base.dev project metadata.
