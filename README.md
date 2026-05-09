# 🍪 Cookieverse

<p align="center">
  <img src="public/ms-logo.png" alt="Cookieverse" width="160" />
</p>

<p align="center">
  <b>Cookieverse: mint AI fortune COOKIE NFTs, roast wallets, bridge cross-chain, and climb the leaderboard.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/OpenAI-Powered-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI powered" />
  <img src="https://img.shields.io/badge/0G-Compute-111827?style=for-the-badge" alt="0G Compute" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Base%20App-Supported-0052FF?style=for-the-badge&logo=coinbase&logoColor=white" alt="Base App supported" />
  <img src="https://img.shields.io/badge/Farcaster-Mini%20App-855DCD?style=for-the-badge" alt="Farcaster Mini App" />
  <img src="https://img.shields.io/badge/Mobile%20%2F%20Tablet-Ready-22C55E?style=for-the-badge" alt="Mobile and tablet ready" />
  <img src="https://img.shields.io/badge/LayerZero-Bridge-000000?style=for-the-badge" alt="LayerZero bridge" />
</p>

---

Cookieverse is a Next.js dApp for AI fortune COOKIE NFTs, multi-chain bridge flows, leaderboards, Farcaster Mini App usage, and the newer Base App / Wallet Roast experience. It is built for desktop, mobile, and tablet usage, with dedicated compact shells for Farcaster and Base App contexts.

The project is built around:

- 🧠 AI-generated fortune text and images
- 🍪 COOKIE NFT minting through `FortuneCookiesAI`
- 🌉 LayerZero ONFT bridge routes across supported chains
- 🏆 Leaderboard and dashboard state stored through Vercel Blob
- 🧑‍🚀 X OAuth and Farcaster Mini App identity surfaces
- 🔥 Base wallet analysis, roast classification, card rendering, sharing, and minting
- 🔵 Base App support through `/app` routes and mobile-first layout constraints
- 🟣 Farcaster Mini App support through `/mini` routes and launch metadata
- ⚡ OpenAI and 0G powered AI flows for fortunes and Wallet Roast generation
- 📱 Responsive desktop, mobile, and tablet experiences

## ✨ Feature Snapshot

| Area | What it does |
| --- | --- |
| 🍪 Fortune minting | Generate AI fortunes and mint them as COOKIE NFTs. |
| 🔥 Wallet Roast | Analyze a Base wallet, classify it, render a roast card, share it, or mint it. |
| 🌉 Bridge | Move COOKIE NFTs with LayerZero ONFT adapter flows. |
| 🏆 Leaderboards | Track mints, boosts, quests, ranks, and MGID stats. |
| 🔵 Base App | Compact `/app` shell with Base App metadata and mobile/tablet UI. |
| 🟣 Farcaster | `/mini` routes optimized for Farcaster Mini App embeds. |
| 🤖 AI providers | OpenAI by default, optional 0G Compute provider for Wallet Roast. |

---

## 🧭 Current App Surfaces

### 🖥️ Main Web App

Routes:

- `/` - main COOKIE minting page, Wallet Roast UI, and connected wallet flows
- `/bridge` - LayerZero ONFT bridge page
- `/leaderboard` - COOKIE and MGID leaderboard UI
- `/dashboard` - multi-chain holdings, quest progress, boosts, and rank UI

The main app is wrapped by `MainChrome` and requires X login before exposing the full dApp shell.

### 🟣 Farcaster Mini App

Routes:

- `/mini`
- `/mini/bridge`
- `/mini/dashboard`
- `/mini/leaderboard`

Mini routes use `MiniProviders` and `MiniNav`. Metadata is generated in `src/app/layout.tsx` and `src/app/mini/head.tsx`.

Farcaster support includes Mini App launch metadata, splash assets, compact navigation, and a separate `/mini` route family for wallet, bridge, dashboard, leaderboard, and smart account flows.

### 🔵 Base App / Compact Web App

Routes:

- `/app`
- `/app/bridge`
- `/app/leaderboard`
- `/app/dashboard`

The Base App shell is isolated by `BaseAppOnly`, `BaseAppNav`, and `src/app/app/baseAppStyles.ts`. Mobile users landing on `/` are redirected to `/app` by `MobileBaseAppRedirect`, unless `?web=1` is used.

Base App support includes the `base:app_id` metadata, a compact route family under `/app`, mobile/tablet-friendly navigation, wallet connection, X profile display, and layout overrides that make the existing dApp tools usable in constrained viewports.

### 📱 Mobile and Tablet Support

Cookieverse supports desktop, mobile, and tablet layouts:

- Desktop users get the full main web shell.
- Mobile and tablet users can use the compact `/app` shell.
- Touch and coarse-pointer devices are automatically routed from `/` to `/app`.
- Farcaster users get a separate `/mini` shell optimized for Mini App embeds.
- `?web=1` disables the automatic mobile redirect when a user wants the full web app.

---

## 🚀 Core Features

### 🍪 AI Fortune Minting

- `/api/fortune` calls OpenAI to generate a short fortune.
- `/api/images` creates or handles image generation assets.
- `/api/pinata` uploads NFT metadata and images.
- `src/app/page.tsx` handles wallet connect, generation, preview, Pinata upload, and minting.
- `src/abi/FortuneCookiesAI.json` provides the COOKIE ERC-721 ABI.

### 🔥 Wallet Roast

Wallet Roast is now part of the main mint page and Base App experience.

User flow:

1. Paste a wallet address or use the connected wallet.
2. POST `/api/wallet-roast/analyze` analyzes the wallet on Base.
3. The analysis is classified into an archetype and tags.
4. POST `/api/wallet-roast/render` renders a PNG roast card.
5. The card can be previewed, copied, downloaded, shared to X, or minted.

Important files:

- `src/lib/wallet-roast/analyzeWalletRoast.ts` - full analysis pipeline
- `src/lib/wallet-roast/fetchBaseWalletData.ts` - Base data from Etherscan V2 plus Basename lookup
- `src/lib/wallet-roast/normalizeWalletData.ts` - raw data normalization
- `src/lib/wallet-roast/computeMetrics.ts` - portfolio and activity metrics
- `src/lib/wallet-roast/classifyArchetype.ts` - archetype scoring
- `src/lib/wallet-roast/buildTags.ts` - visible tag selection
- `src/lib/wallet-roast/buildTraits.ts` - prompt traits
- `src/lib/wallet-roast/generateRoast.ts` - provider switch between OpenAI and 0G
- `src/lib/wallet-roast/generateOpenAIRoast.ts` - OpenAI roast generation
- `src/lib/wallet-roast/generateOgRoast.ts` - 0G roast generation
- `src/lib/wallet-roast/renderCard.ts` - server-side PNG rendering with `@napi-rs/canvas`
- `src/lib/share.ts` - native mobile image sharing and X intent fallback

Assets:

- `public/wallet-roast/templates/` - archetype card templates
- `public/wallet-roast/icons/stats/` - stat icons
- `public/wallet-roast/icons/tags/` - tag icons

Supported roast archetype templates include Bridge Tourist, Dust Farmer, Silent Whale, NFT Addict, DeFi Goblin, and Onchain Civilian.

### 🤖 Wallet Roast Providers

`WALLET_ROAST_PROVIDER` controls text generation:

- `openai` - uses `OPENAI_API_KEY_MFC_NEW` and `WALLET_ROAST_OPENAI_MODEL`
- `og` - uses 0G Compute broker configuration

Cookieverse is powered by both OpenAI and 0G:

- OpenAI powers fortune text, image-related AI routes, and the default Wallet Roast provider.
- 0G Compute can power Wallet Roast text generation when `WALLET_ROAST_PROVIDER=og`.
- The provider abstraction lives in `src/lib/wallet-roast/generateRoast.ts`, so roast generation can switch providers without changing the UI.

Diagnostic routes:

- `/api/diag-wallet-roast-openai`
- `/api/diag-wallet-roast-og`

0G helper scripts:

- `npm run check:og` - validates wallet, ledger, provider, and service metadata
- `npm run setup:og` - creates/checks a 0G Compute ledger, acknowledges the provider, and transfers provider inference funds

### 🌉 LayerZero Bridge

- `/bridge`, `/mini/bridge`, and `/app/bridge` expose bridge flows.
- The bridge reads owned COOKIE token IDs through `/api/fc-token-ids`.
- It quotes and sends through configured ONFT adapter contracts.
- It can update MGID stats after bridge actions.

Important environment groups:

- `NEXT_PUBLIC_ADAPTER_*`
- `NEXT_PUBLIC_ONFT_*`
- `NEXT_PUBLIC_CANONICAL_ERC721*`
- `NEXT_PUBLIC_EID_*`
- `NEXT_PUBLIC_FLAT_FEE_WEI_*`
- `NEXT_PUBLIC_APP_FEE_BPS`
- `NEXT_PUBLIC_FEE_RECEIVER`

### 🏆 Leaderboards, Dashboard, and MGID

APIs:

- `/api/mgid-get`
- `/api/mgid-upsert`
- `/api/mgid-leaderboard`
- `/api/mgid-boosts`
- `/api/leaderboard`
- `/api/holdings`
- `/api/collection-holders`
- `/api/adapter-sends`
- `/api/last-minted`

Storage:

- `src/server/mgidStore.ts` stores MGID snapshots in Vercel Blob.
- `HOLDINGS_DB_PATH` can point to a local last-good holdings cache.

UI:

- `src/app/leaderboard/ui/LeaderboardClient.tsx`
- `src/app/mgid-leaderboard/ui/MgidLeaderboardClient.tsx`
- `src/app/dashboard/ui/DashboardClient.tsx`

### 🧑‍🚀 Identity and Auth

- X OAuth uses NextAuth in `src/lib/auth.ts`.
- Session fields are typed in `src/types/next-auth.d.ts`.
- X profile information is shown in the main and Base App shells.
- Farcaster Mini App routes use the Farcaster Mini App SDK providers.
- Smart account support uses Privy and MetaMask delegation/account abstraction helpers.

---

## 🛠️ Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Wagmi, Viem, RainbowKit
- NextAuth Twitter provider
- Farcaster Mini App SDK
- Privy
- OpenAI SDK
- 0G Serving Broker
- Vercel Blob
- Pinata
- Etherscan V2 API
- BlockVision
- `@napi-rs/canvas` for server-side Wallet Roast PNG rendering

---

## 📁 Project Structure

```text
src/
  abi/
    FortuneCookiesAI.json
  app/
    layout.tsx
    page.tsx
    app/
      page.tsx
      bridge/page.tsx
      dashboard/page.tsx
      leaderboard/page.tsx
      baseAppStyles.ts
    bridge/page.tsx
    dashboard/
      page.tsx
      ui/DashboardClient.tsx
    leaderboard/
      page.tsx
      ui/LeaderboardClient.tsx
    mgid-leaderboard/
      page.tsx
      ui/MgidLeaderboardClient.tsx
    mini/
      page.tsx
      bridge/page.tsx
      dashboard/page.tsx
      leaderboard/page.tsx
      smartaccount/page.tsx
      head.tsx
    api/
      fortune/route.ts
      images/route.ts
      pinata/route.ts
      wallet-roast/analyze/route.ts
      wallet-roast/render/route.ts
      diag-wallet-roast-openai/route.ts
      diag-wallet-roast-og/route.ts
      holdings/route.ts
      leaderboard/route.ts
      mgid-get/route.ts
      mgid-upsert/route.ts
      mgid-leaderboard/route.ts
      mgid-boosts/route.ts
      adapter-sends/route.ts
      fc-token-ids/route.ts
      auth/[...nextauth]/route.ts
  components/
    BaseAppNav.tsx
    MainChrome.tsx
    MobileBaseAppRedirect.tsx
    NavTabs.tsx
    XAuthButton.tsx
    mini/
      MiniNav.tsx
      MiniProviders.client.tsx
  hooks/
    useAppMode.ts
    useResponsiveMode.ts
  lib/
    aa/
      clients.ts
      smartAccount.ts
    wallet-roast/
      analyzeWalletRoast.ts
      fetchBaseWalletData.ts
      generateRoast.ts
      renderCard.ts
      types.ts
    auth.ts
    chain.ts
    share.ts
    wagmi.ts
  server/
    mgidStore.ts
public/
  wallet-roast/
    templates/
    icons/
```

---

## ⚙️ Environment

Create `.env.local` in the project root.

### 🔐 App and Auth

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
NEXT_PUBLIC_BASE_URL=http://localhost:3000

TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### ⛓️ RPC and Chains

```bash
NEXT_PUBLIC_DEFAULT_CHAIN=monad
NEXT_PUBLIC_RPC_HTTP_MONAD=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_RPC_HTTP_BASE=https://mainnet.base.org
NEXT_PUBLIC_RPC_HTTP_MANTLE=https://rpc.mantle.xyz
NEXT_PUBLIC_RPC_HTTP_LINEA=https://rpc.linea.build
NEXT_PUBLIC_RPC_HTTP_MITOS=https://rpc.mitosis.org
NEXT_PUBLIC_MITOSIS_CHAIN_ID=777777
NEXT_PUBLIC_MITOSIS_EXPLORER=https://explorer.mitosis.org
```

### 🍪 COOKIE and Bridge Contracts

```bash
NEXT_PUBLIC_COOKIE_ADDRESS=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_BASE=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_LINEA=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS=0x...

NEXT_PUBLIC_CANONICAL_ERC721=0x...
NEXT_PUBLIC_CANONICAL_ERC721_MONAD=0x...
NEXT_PUBLIC_CANONICAL_ERC721_MANTLE=0x...
NEXT_PUBLIC_CANONICAL_ERC721_LINEA=0x...

NEXT_PUBLIC_ADAPTER_BASE=0x...
NEXT_PUBLIC_ADAPTER_MANTLE=0x...
NEXT_PUBLIC_ADAPTER_LINEA=0x...
NEXT_PUBLIC_ADAPTER_MONAD=0x...

NEXT_PUBLIC_ONFT_BASE=0x...
NEXT_PUBLIC_ONFT_MANTLE=0x...
NEXT_PUBLIC_ONFT_LINEA=0x...
NEXT_PUBLIC_ONFT_MONAD=0x...

NEXT_PUBLIC_EID_BASE=30184
NEXT_PUBLIC_EID_MANTLE=30181
NEXT_PUBLIC_EID_LINEA=40231
NEXT_PUBLIC_EID_MONAD=...

NEXT_PUBLIC_FEE_RECEIVER=0x...
NEXT_PUBLIC_APP_FEE_BPS=0
NEXT_PUBLIC_FLAT_FEE_WEI_ETH=0
NEXT_PUBLIC_FLAT_FEE_WEI_MON=0
NEXT_PUBLIC_FLAT_FEE_WEI_MNT=0
```

### 🤖 AI, Wallet Roast, and Media

```bash
OPENAI_API_KEY_MFC_NEW=sk-...
MFC_OPENAI_KEY_NAME=OPENAI_API_KEY_MFC_NEW

WALLET_ROAST_PROVIDER=openai
WALLET_ROAST_OPENAI_MODEL=gpt-5-mini
WALLET_ROAST_DUST_THRESHOLD_USD=1.5
WALLET_ROAST_RESPONSE_TOKEN_LIMIT=25
WALLET_ROAST_DEBUG=false

ETHERSCAN_API_KEY=...
BASE_RPC_URL=https://mainnet.base.org
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
ENABLE_BASENAME_ENSIP19_FALLBACK=false

PINATA_JWT=...
PINATA_GATEWAY=https://your-gateway.pinata.cloud
```

### ⚡ 0G Wallet Roast Provider

Only required when `WALLET_ROAST_PROVIDER=og`.

```bash
OG_PRIVATE_KEY=0x...
OG_EVM_RPC_URL=https://evmrpc-testnet.0g.ai
OG_PROVIDER_ADDRESS=0x...
OG_MODEL=openai/gpt-oss-20b
OG_LEDGER_FUND_AMOUNT=3
OG_PROVIDER_FUND_AMOUNT=2
```

### 💾 Storage, Indexing, and Smart Accounts

```bash
BLOB_READ_WRITE_TOKEN=...
BLOCKVISION_API_KEY=...
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
HOLDINGS_DB_PATH=.holdings_last_good.json

PRIVY_APP_ID=...
MONAD_GAMES_PROVIDER_APP_ID=...
NEXT_PUBLIC_BUNDLER_RPC_URL=...
NEXT_PUBLIC_BUNDLER_RPC_URL_BASE=...
NEXT_PUBLIC_BUNDLER_RPC_URL_MANTLE=...
NEXT_PUBLIC_BUNDLER_RPC_URL_LINEA=...

SIGNER_PRIVATE_KEY=0x...
```

### 🧪 Optional API Tuning

```bash
ETHERSCAN_MAX_CONCURRENT=2
ETHERSCAN_RETRIES=2
ETHERSCAN_PAGE_SIZE=10000
ETHERSCAN_MAX_PAGES=10

HOLDINGS_TTL_MS=45000
BV_MAX_RETRIES=5
BV_BASE_DELAY_MS=400
BV_PAGE_DELAY_MS=300
BV_REQ_TIMEOUT_MS=12000
```

---

## 🧰 Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run check:og
npm run setup:og
```

Notes:

- `postinstall` runs `scripts/patch-ox.js`.
- `vercel-build` runs prebuild checks, patches `ox`, then builds Next.js.
- `next.config.js` marks `@napi-rs/canvas` as a server external package.
- TypeScript and ESLint build errors are currently ignored in `next.config.js`.

---

## 🚦 Getting Started

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/app`
- `http://localhost:3000/mini`
- `http://localhost:3000/bridge`
- `http://localhost:3000/leaderboard`
- `http://localhost:3000/dashboard`

---

## 🧾 Metadata

The app metadata is generated dynamically in `src/app/layout.tsx`.

Current metadata includes:

- `title`: `Cookieverse`
- `description`: `AI blessing cookies`
- `base:app_id`: `69413c95d19763ca26ddc346`
- `fc:miniapp` and `fc:frame` JSON embeds pointing to `/mini`
- launch image `/ms-logo-32.png`
- splash image `/ms-logo-mini.png`

For production deployments, set `NEXT_PUBLIC_BASE_URL`, `NEXTAUTH_URL`, and the deployed host correctly so Farcaster and Base App launch URLs resolve to the public HTTPS origin.

---

## 📝 Implementation Notes

- Wallet Roast analysis is Base-only today and uses Etherscan V2 chain ID `8453`.
- Etherscan Pro-only token balance endpoints are avoided; balances are reconstructed from transfer history.
- Basename resolution first uses the Base L2 resolver and can optionally attempt ENSIP-19 fallback with an Ethereum RPC.
- Wallet Roast rendering expects PNG templates and icons under `public/wallet-roast`.
- The Base App route shares the main page implementation through `src/app/app/page.tsx`.
- The compact Base App layout has separate CSS constraints to make the existing dApp UI usable on mobile.
