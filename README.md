# 🍪 Cookieverse

<p align="center">
  <img src="public/ms-logo.png" alt="Cookieverse" width="160" />
</p>

<p align="center">
  <b>Cookieverse turns wallets into AI-powered social identities: fortune NFTs, Wallet Roast cards, cross-chain COOKIEs, dashboards, and leaderboards.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Wagmi-Viem-646CFF?style=for-the-badge" alt="Wagmi and Viem" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Base%20App-Supported-0052FF?style=for-the-badge&logo=coinbase&logoColor=white" alt="Base App supported" />
  <img src="https://img.shields.io/badge/Farcaster-Mini%20App-855DCD?style=for-the-badge" alt="Farcaster Mini App" />
  <img src="https://img.shields.io/badge/LayerZero-Bridge-000000?style=for-the-badge" alt="LayerZero Bridge" />
  <img src="https://img.shields.io/badge/0G-Compute%20%2B%20Chain-111827?style=for-the-badge" alt="0G Compute and Chain" />
</p>

---

## Overview

Cookieverse is a consumer crypto app that makes onchain activity fun, visual, and shareable.

Users can generate AI fortunes, mint COOKIE NFTs, roast wallets, render beautiful share cards, bridge COOKIE NFTs across supported chains, track activity in a dashboard, and compete on leaderboards.

Cookieverse is built as a multi-surface product:

- Main web app
- Base App compact experience
- Farcaster Mini App routes
- Cross-chain NFT bridge
- Wallet Roast identity layer
- NFT minting and social sharing flows

The product goal is simple:

> Make wallet activity feel like a social identity, not just a block explorer history.

---

## Feature Snapshot

| Area | What it does |
| --- | --- |
| 🍪 AI Fortunes | Generate short AI fortune text and mint it as a COOKIE NFT. |
| 🖼️ AI Image Mints | Generate or upload image-based COOKIE NFTs with IPFS metadata. |
| 🔥 Wallet Roast | Analyze a Base wallet and turn it into a funny AI roast card. |
| 🧠 Wallet Archetypes | Classify wallets as Bridge Tourist, Dust Farmer, Silent Whale, NFT Addict, DeFi Goblin, or Onchain Civilian. |
| 🤖 AI Providers | Uses OpenAI by default and can route Wallet Roast generation through 0G Compute. |
| ⛓️ 0G Mainnet | Supports Wallet Roast NFT minting on 0G Mainnet for product expansion and hackathon proof. |
| 🌉 LayerZero Bridge | Bridges COOKIE NFTs across supported networks. |
| 🔵 Base App | Mobile-first compact Cookieverse shell for Base App users. |
| 🟣 Farcaster Mini App | Dedicated `/mini` routes for Farcaster Mini App contexts. |
| 🏆 Leaderboard | Ranks users by Cookieverse activity. |
| 📊 Dashboard | Tracks holdings, image mints, quests, boosts, and activity. |
| 🐦 X Sharing | Lets users share generated cards, mints, and roast content on X. |

---

## App Surfaces

### Main Web App

Routes:

```txt
/
 /bridge
 /dashboard
 /leaderboard
 /mgid-leaderboard
```

The main web app includes AI fortune minting, Wallet Roast, NFT minting, bridge flows, dashboards, and leaderboards.

### Base App

Routes:

```txt
/app
/app/bridge
/app/dashboard
/app/leaderboard
```

The Base App surface is a compact mobile/tablet experience. It uses a dedicated shell and layout constraints to make Cookieverse usable inside Base App-style environments.

### Farcaster Mini App

Routes:

```txt
/mini
/mini/bridge
/mini/dashboard
/mini/leaderboard
/mini/smartaccount
```

The Farcaster Mini App surface uses dedicated mini routes, metadata, compact navigation, and Mini App providers.

---

## System Architecture

```mermaid
flowchart TD
    U[User] --> SURFACES[Cookieverse App Surfaces<br/>Web App / Base App / Farcaster Mini App]

    SURFACES --> FORTUNE[AI Fortune Minting]
    SURFACES --> ROAST[Wallet Roast]
    SURFACES --> BRIDGE[LayerZero Bridge]
    SURFACES --> DASH[Dashboard]
    SURFACES --> BOARD[Leaderboard]

    FORTUNE --> FORTUNE_AI[AI Fortune Generator]
    FORTUNE_AI --> FORTUNE_IMG[Image / Metadata Handling]
    FORTUNE_IMG --> PINATA1[Pinata / IPFS]
    PINATA1 --> COOKIE_NFT[FortuneCookiesAI NFT Contracts]

    ROAST --> WALLET_DATA[Base Wallet Data<br/>Etherscan V2 + Basename]
    WALLET_DATA --> METRICS[Wallet Metrics Engine<br/>Portfolio, DeFi, NFTs,<br/>Bridge Activity, Dust, Tx Count]
    METRICS --> ARCHETYPE[Archetype Classifier<br/>Bridge Tourist / Dust Farmer<br/>Silent Whale / NFT Addict<br/>DeFi Goblin / Onchain Civilian]
    ARCHETYPE --> PROMPT[Roast Prompt Builder]

    PROMPT --> AI_SWITCH{AI Provider Switch<br/>WALLET_ROAST_PROVIDER}

    AI_SWITCH -->|openai| OPENAI[OpenAI Provider]
    AI_SWITCH -->|og| OGCOMPUTE[0G Compute Provider]

    OGCOMPUTE --> OGBROKER[0G Serving Broker<br/>Service Metadata + Request Headers]
    OGBROKER --> OGINFERENCE[0G Compute Inference]
    OGINFERENCE --> OGVERIFY[0G Response Processing<br/>processResponse]

    OPENAI --> ROAST_JSON[Roast Text JSON]
    OGVERIFY --> ROAST_JSON

    ROAST_JSON --> CARD[Wallet Roast Card Renderer<br/>PNG with @napi-rs/canvas]
    CARD --> PINATA2[Pinata / IPFS]
    PINATA2 --> ROAST_MINT[Mint Wallet Roast NFT<br/>mintWithImage fortune + imageURI]

    COOKIE_NFT --> CHAINS[Supported NFT Networks<br/>Monad / Base / Mantle / Linea / Mitosis]
    ROAST_MINT --> OGCHAIN[0G Mainnet<br/>CookieverseWalletRoastOG ERC-721]

    BRIDGE --> LZ[LayerZero ONFT Bridge]
    LZ --> CHAINS

    DASH --> HOLDINGS[Holdings API]
    HOLDINGS --> CHAINS
    HOLDINGS --> OGCHAIN

    BOARD --> MGID[MGID / Ranking Storage<br/>Vercel Blob]

    CARD --> SHARE[Share to X<br/>Copy / Download / Native Share]

    OGCHAIN --> OGEXPLORER[0G ChainScan<br/>Contract + Mint Transaction Proof]
```

---

## Core Product Flows

### 1. AI Fortune Minting

User flow:

```txt
User enters topic / vibe / optional name
→ Cookieverse generates a short AI fortune
→ User mints the fortune through FortuneCookiesAI
→ NFT appears in holdings and dashboard
```

Important app areas:

```txt
src/app/page.tsx
src/app/api/fortune/route.ts
src/app/api/images/route.ts
src/app/api/pinata/route.ts
src/abi/FortuneCookiesAI.json
```

### 2. Wallet Roast

Wallet Roast turns a wallet into a shareable AI identity card.

User flow:

```txt
User pastes a Base wallet or uses connected wallet
→ Cookieverse fetches Base wallet activity
→ Wallet metrics are computed
→ Wallet is classified into an archetype
→ AI generates roast text
→ Cookieverse renders a PNG roast card
→ User can copy, download, share, or mint the card
```

Important app areas:

```txt
src/app/api/wallet-roast/analyze/route.ts
src/app/api/wallet-roast/render/route.ts
src/lib/wallet-roast/analyzeWalletRoast.ts
src/lib/wallet-roast/fetchBaseWalletData.ts
src/lib/wallet-roast/normalizeWalletData.ts
src/lib/wallet-roast/computeMetrics.ts
src/lib/wallet-roast/classifyArchetype.ts
src/lib/wallet-roast/buildTags.ts
src/lib/wallet-roast/buildTraits.ts
src/lib/wallet-roast/buildRoastPrompt.ts
src/lib/wallet-roast/generateRoast.ts
src/lib/wallet-roast/generateOpenAIRoast.ts
src/lib/wallet-roast/generateOgRoast.ts
src/lib/wallet-roast/renderCard.ts
```

Supported Wallet Roast archetypes:

```txt
Bridge Tourist
Dust Farmer
Silent Whale
NFT Addict
DeFi Goblin
Onchain Civilian
```

### 3. Wallet Roast Card Rendering

Cookieverse renders Wallet Roast cards server-side using `@napi-rs/canvas`.

Card assets:

```txt
public/wallet-roast/templates/
public/wallet-roast/icons/stats/
public/wallet-roast/icons/tags/
```

Output:

```txt
PNG roast card
Shareable image
IPFS image for NFT minting
```

### 4. Cross-chain COOKIE Bridge

Cookieverse supports bridging COOKIE NFTs across supported networks using LayerZero ONFT-style bridge flows.

Bridge routes:

```txt
/bridge
/app/bridge
/mini/bridge
```

Bridge-related environment groups:

```txt
NEXT_PUBLIC_ADAPTER_*
NEXT_PUBLIC_ONFT_*
NEXT_PUBLIC_CANONICAL_ERC721*
NEXT_PUBLIC_EID_*
NEXT_PUBLIC_FLAT_FEE_WEI_*
NEXT_PUBLIC_APP_FEE_BPS
NEXT_PUBLIC_FEE_RECEIVER
```

### 5. Dashboard and Leaderboard

Cookieverse tracks user activity across mints, image mints, holdings, quests, boosts, and ranking data.

Important app areas:

```txt
src/app/dashboard/ui/DashboardClient.tsx
src/app/leaderboard/ui/LeaderboardClient.tsx
src/app/mgid-leaderboard/ui/MgidLeaderboardClient.tsx
src/server/mgidStore.ts
src/app/api/holdings/route.ts
src/app/api/mgid-get/route.ts
src/app/api/mgid-upsert/route.ts
src/app/api/mgid-leaderboard/route.ts
src/app/api/mgid-boosts/route.ts
```

---

## 0G Integration

Cookieverse uses 0G as one part of the wider product architecture. The app is not only a 0G demo, but 0G adds an important AI and onchain minting path for Wallet Roast.

Cookieverse uses:

1. **0G Compute** for optional Wallet Roast AI text generation.
2. **0G Mainnet** for Wallet Roast NFT minting.

### 0G Compute Flow

When `WALLET_ROAST_PROVIDER=og`, Cookieverse routes Wallet Roast generation through 0G Compute.

```txt
/api/wallet-roast/analyze
→ analyzeWalletRoast()
→ generateRoast()
→ generateOgRoast()
→ createOgOpenAIClient()
→ 0G Compute provider
→ processResponse()
→ Wallet Roast JSON
→ PNG card renderer
→ IPFS upload
→ mintWithImage()
```

Important files:

```txt
src/lib/wallet-roast/generateRoast.ts
src/lib/wallet-roast/generateOgRoast.ts
src/lib/wallet-roast/ogRoastClient.ts
src/lib/wallet-roast/ogBroker.ts
src/lib/wallet-roast/config.ts
src/app/api/diag-wallet-roast-og/route.ts
scripts/check-og-compute.ts
scripts/setup-og-compute-account.ts
```

### 0G Chain Flow

Cookieverse can mint generated Wallet Roast cards on 0G Mainnet.

```txt
Wallet Roast card PNG
→ Pinata / IPFS
→ mintWithImage(fortune, imageURI)
→ CookieverseWalletRoastOG ERC-721
→ 0G Mainnet mint transaction
→ 0G ChainScan proof
```

### 0G Proof for Reviewers

Fill these values after deployment:

```txt
0G Component: 0G Compute
0G Chain Component: 0G Mainnet NFT minting
0G Mainnet Chain ID: 16661
0G RPC: https://evmrpc.0g.ai
0G Explorer: https://chainscan.0g.ai

Contract: FortuneCookiesAI_OG
Contract address: 0x951AC8cB1524A7856B2940966AB9751c2259aF63
Contract explorer link: https://chainscan.0g.ai/address/0x951AC8cB1524A7856B2940966AB9751c2259aF63
Example Wallet Roast mint transaction: https://chainscan.0g.ai/token/0x951ac8cb1524a7856b2940966ab9751c2259af63, 
https://chainscan.0g.ai/token/0x951ac8cb1524a7856b2940966ab9751c2259af63
```

### Why This Proves 0G Integration

Cookieverse proves 0G integration through the actual user-facing Wallet Roast product flow:

1. Runtime proof: Wallet Roast text can be generated through 0G Compute.
2. Product proof: The generated roast card is rendered and used inside the app.
3. Onchain proof: The generated roast card can be minted as an NFT on 0G Mainnet.
4. Explorer proof: The 0G ChainScan transaction shows real 0G network usage.

---

## AI Provider Configuration

Wallet Roast supports provider switching through:

```txt
WALLET_ROAST_PROVIDER
```

Supported values:

```txt
openai
og
```

Default:

```txt
0G
```

### OpenAI Provider

Used when:

```bash
WALLET_ROAST_PROVIDER=openai
```

Required variables:

```bash
OPENAI_API_KEY_MFC_NEW=sk-...
WALLET_ROAST_OPENAI_MODEL=gpt-5-mini
```

### 0G Compute Provider

Used when:

```bash
WALLET_ROAST_PROVIDER=og
```

Required variables:

```bash
OG_PRIVATE_KEY=0x...
OG_EVM_RPC_URL=https://evmrpc.0g.ai
OG_PROVIDER_ADDRESS=0x...
OG_MODEL=...
OG_LEDGER_FUND_AMOUNT=3
OG_PROVIDER_FUND_AMOUNT=2
```

Useful scripts:

```bash
npm run check:og
npm run setup:og
```

---

## Supported Networks

Cookieverse currently supports or is designed around these networks:

| Network | Purpose |
| --- | --- |
| Monad | COOKIE NFT minting and bridge route.  |
| Base | Wallet Roast analysis, Base App surface, COOKIE minting. |
| Mantle | COOKIE NFT support and bridge route. |
| Linea | COOKIE NFT support and bridge route. |
| Mitosis | COOKIE NFT support |
| 0G Mainnet | Wallet Roast NFT minting and bridge route. |

---

## Smart Contracts

### COOKIE NFT Contracts

Cookieverse uses `FortuneCookiesAI` style ERC-721 contracts for fortune and image minting.

Existing contract source repo:

```txt
https://github.com/mssystem1/mfv3-verify
```

Core functions used by the app:

```solidity
mintWithFortune(string calldata fortune)
mintWithImage(string calldata fortune, string calldata imageURI)
mintPrice()
tokenURI(uint256 tokenId)
getFortune(uint256 tokenId)
getImageURI(uint256 tokenId)
getAllMints()
```

Important note:

```txt
Cookieverse holdings API expects getAllMints().
If a deployed contract does not include getAllMints(), minting may still work,
but holdings/dashboard reads can fail.
```

### Recommended 0G Contract

For 0G Mainnet, use:

```txt
CookieverseWalletRoastOG
```

Recommended constructor:

```solidity
constructor(string memory logoMIME)
```

Recommended deployment argument:

```txt
image/png
```

Recommended contract features:

```txt
ERC-721
mintWithImage()
mintWithFortune()
getAllMints()
mintPrice()
royalty support
IPFS imageURI metadata
Wallet Roast metadata attributes
```

---

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript |
| Wallets | Wagmi, Viem, RainbowKit |
| Auth | NextAuth with X OAuth |
| Base App | Base App metadata and compact `/app` routes |
| Farcaster | Farcaster Mini App SDK and `/mini` routes |
| AI | OpenAI SDK, 0G Serving Broker |
| Rendering | `@napi-rs/canvas` |
| Storage | Vercel Blob, Pinata / IPFS |
| Smart contracts | Solidity, ERC-721, ERC-2981, OpenZeppelin |
| Bridge | LayerZero ONFT-style routes |
| Data | Etherscan V2, Basename lookup, app APIs |

---

## Project Structure

```txt
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

    mini/
      page.tsx
      bridge/page.tsx
      dashboard/page.tsx
      leaderboard/page.tsx
      smartaccount/page.tsx
      head.tsx

    bridge/
      page.tsx

    dashboard/
      page.tsx
      ui/DashboardClient.tsx

    leaderboard/
      page.tsx
      ui/LeaderboardClient.tsx

    mgid-leaderboard/
      page.tsx
      ui/MgidLeaderboardClient.tsx

    api/
      fortune/route.ts
      images/route.ts
      pinata/route.ts

      wallet-roast/
        analyze/route.ts
        render/route.ts

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
      buildRoastPrompt.ts
      buildTags.ts
      buildTraits.ts
      classifyArchetype.ts
      computeMetrics.ts
      config.ts
      fallbackRoast.ts
      fetchBaseWalletData.ts
      generateOpenAIRoast.ts
      generateOgRoast.ts
      generateRoast.ts
      normalizeWalletData.ts
      ogBroker.ts
      ogRoastClient.ts
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
      stats/
      tags/

scripts/
  check-og-compute.ts
  setup-og-compute-account.ts
  patch-ox.js
```

---

## Environment Variables

Create:

```txt
.env.local
```

### App and Auth

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

NEXT_PUBLIC_BASE_URL=http://localhost:3000

TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### RPC and Chains

```bash
NEXT_PUBLIC_DEFAULT_CHAIN=monad

NEXT_PUBLIC_RPC_HTTP_MONAD=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_RPC_HTTP_BASE=https://mainnet.base.org
NEXT_PUBLIC_RPC_HTTP_MANTLE=https://rpc.mantle.xyz
NEXT_PUBLIC_RPC_HTTP_LINEA=https://rpc.linea.build
NEXT_PUBLIC_RPC_HTTP_MITOS=https://rpc.mitosis.org
NEXT_PUBLIC_RPC_HTTP_OG=https://evmrpc.0g.ai

NEXT_PUBLIC_MITOSIS_CHAIN_ID=777777
NEXT_PUBLIC_MITOSIS_EXPLORER=https://explorer.mitosis.org
```

### COOKIE NFT Contracts

```bash
NEXT_PUBLIC_COOKIE_ADDRESS=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_BASE=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_MANTLE=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_LINEA=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_MITOSIS=0x...
NEXT_PUBLIC_COOKIE_ADDRESS_OG=0x...
```

### LayerZero Bridge

```bash
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

### AI and Wallet Roast

```bash
OPENAI_API_KEY_MFC_NEW=sk-...
MFC_OPENAI_KEY_NAME=OPENAI_API_KEY_MFC_NEW

WALLET_ROAST_PROVIDER=0G
WALLET_ROAST_OPENAI_MODEL=gpt-5-mini
WALLET_ROAST_DUST_THRESHOLD_USD=1.5
WALLET_ROAST_RESPONSE_TOKEN_LIMIT=25
WALLET_ROAST_DEBUG=false

ETHERSCAN_API_KEY=...
BASE_RPC_URL=https://mainnet.base.org
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
ENABLE_BASENAME_ENSIP19_FALLBACK=false
```

### 0G Compute

Only required when:

```bash
WALLET_ROAST_PROVIDER=og
```

```bash
OG_PRIVATE_KEY=0x...
OG_EVM_RPC_URL=https://evmrpc.0g.ai
OG_PROVIDER_ADDRESS=0x...
OG_MODEL=...
OG_LEDGER_FUND_AMOUNT=3
OG_PROVIDER_FUND_AMOUNT=2
```

### Media and Storage

```bash
PINATA_JWT=...
PINATA_GATEWAY=https://your-gateway.pinata.cloud

BLOB_READ_WRITE_TOKEN=...
HOLDINGS_DB_PATH=.holdings_last_good.json
```

### Indexing and Optional APIs

```bash
BLOCKVISION_API_KEY=...
MONAD_RPC_URL=https://testnet-rpc.monad.xyz

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

### Smart Account / AA

```bash
PRIVY_APP_ID=...
MONAD_GAMES_PROVIDER_APP_ID=...

NEXT_PUBLIC_BUNDLER_RPC_URL=...
NEXT_PUBLIC_BUNDLER_RPC_URL_BASE=...
NEXT_PUBLIC_BUNDLER_RPC_URL_MANTLE=...
NEXT_PUBLIC_BUNDLER_RPC_URL_LINEA=...

SIGNER_PRIVATE_KEY=0x...
```

---

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run check:og
npm run setup:og
```

Current package scripts include:

```txt
check:og
setup:og
postinstall
prebuild
build
vercel-build
dev
start
lint
```

---

## Getting Started

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/
http://localhost:3000/app
http://localhost:3000/mini
http://localhost:3000/bridge
http://localhost:3000/dashboard
http://localhost:3000/leaderboard
```

---

## Running Wallet Roast with OpenAI

Set:

```bash
WALLET_ROAST_PROVIDER=openai
OPENAI_API_KEY_MFC_NEW=sk-...
ETHERSCAN_API_KEY=...
```

Run:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/app
```

Use Wallet Roast:

```txt
Paste Base wallet
→ Generate roast
→ Render card
→ Share or mint
```

---

## Running Wallet Roast with 0G Compute

Set:

```bash
WALLET_ROAST_PROVIDER=og
OG_EVM_RPC_URL=https://evmrpc.0g.ai
OG_PRIVATE_KEY=0x...
OG_PROVIDER_ADDRESS=0x...
OG_MODEL=...
OG_LEDGER_FUND_AMOUNT=3
OG_PROVIDER_FUND_AMOUNT=2
ETHERSCAN_API_KEY=...
```

Check 0G setup:

```bash
npm run check:og
```

If needed, run one-time setup:

```bash
npm run setup:og
```

Run app:

```bash
npm run dev
```

Diagnostic endpoint:

```txt
http://localhost:3000/api/diag-wallet-roast-og
```

Wallet Roast endpoint:

```txt
POST http://localhost:3000/api/wallet-roast/analyze
```

Example body:

```json
{
  "wallet": "0x0000000000000000000000000000000000000000"
}
```

## Implementation Notes

- Wallet Roast analysis currently focuses on Base wallet data.
- Wallet Roast minting can happen on the connected supported chain, including 0G after chain support is added.
- OpenAI is the default Wallet Roast provider.
- 0G Compute can be enabled with `WALLET_ROAST_PROVIDER=og`.
- The Wallet Roast card is rendered as PNG before upload and mint.
- `mintWithImage()` is the preferred mint path for Wallet Roast cards.
- `getAllMints()` is recommended for all deployed COOKIE contracts used by Cookieverse holdings APIs.
- 0G proof should be shown as both a runtime app flow and a ChainScan mint transaction.

---

## License

ISC

