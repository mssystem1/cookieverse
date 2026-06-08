# Cookieverse Mantle 402 Payment Guide

## Current Finding

The Mantle DevKit payment path should not be treated as production-ready for Cookieverse Mantle mainnet yet.

From the HAR captured on June 7, 2026:

- The first request to `/api/x402/mantle-devkit/wallet-roast/identity` returned `402 Payment Required`.
- The challenge advertised:
  - `x-402-network: mantle`
  - `x-402-chain-id: 5000`
  - `x-402-token: MNT`
  - `x-402-amount: 0.07`
  - `x-402-recipient: 0xDa64eefe238283717d8Ef0e2B8876b3a7643142f`
- The retry request included:
  - `x-402-transaction-hash: 0x643381c366367fff99e63abc125b43d8f8de90f4425e8d25a1d847e00b393b03`
- The retry still returned `402 Payment Required`.

That means Cookieverse successfully issued a Mantle DevKit-style payment challenge, but the DevKit validator did not accept the submitted payment proof.

The most likely reasons are:

- The Mantle DevKit dashboard project was created for Mantle Sepolia, not Mantle mainnet.
- `x402-mantle-sdk` examples and dashboard flow are still testnet-first.
- The SDK uses a custom `x-402-transaction-hash` flow, not the standard x402 `PAYMENT-SIGNATURE` / `PAYMENT-REQUIRED` lifecycle used by Coinbase/CDP.
- Native MNT payments are not the same thing as official x402 EVM `exact` payments, which are ERC-20 based through EIP-3009 or Permit2.

## Recommendation

Use this provider strategy:

```txt
Base      -> Coinbase/CDP official x402
X Layer   -> OKX x402
Mantle    -> Cookieverse Mantle-native 402 MVP
Questflow -> optional future Mantle provider if access is available
DevKit    -> local/debug only, disabled by default
```

For Mantle production, Cookieverse should add its own Mantle-native HTTP 402 payment gate using native MNT transfers.

This is the fastest reliable solution for Cookieverse because:

- It works on Mantle mainnet now.
- Users pay with native MNT, no Permit2 approval.
- The server can verify the transaction directly with viem.
- Cookieverse already has paid routes that can wrap Wallet Roast and World Cup Prophecy.
- The product UX can stay the same as x402: request -> 402 -> pay -> retry -> receive rendered PNG.

Important naming: this MVP is `x402-style` or `HTTP 402`, not fully official x402 `exact` yet.

## Why Not Full Official x402 First?

Official EVM x402 `exact` is designed around ERC-20 payments:

- EIP-3009 for tokens that implement `transferWithAuthorization`.
- Permit2 for generic ERC-20 tokens.

Native MNT is not an ERC-20 token. A true standards-aligned Mantle x402 facilitator should therefore use an ERC-20 token on Mantle, for example a stablecoin or wrapped MNT, and implement `/verify` and `/settle`.

For Cookieverse, native MNT is better for the first Mantle release. Full official x402 can be a second phase.

## Provider Names

Add a new Mantle server provider:

```txt
X402_MANTLE_SERVER_PROVIDER=cookieverse-mantle
NEXT_PUBLIC_X402_MANTLE_PROVIDER=cookieverse-mantle
NEXT_PUBLIC_X402_MANTLE_ENABLED=true
```

Keep existing providers:

```txt
coinbase        -> Base
okx             -> X Layer
questflow       -> Mantle only when Questflow access is ready
mantle-devkit   -> local/debug only
cookieverse-mantle -> Mantle mainnet production MVP
```

## Environment Variables

Local:

```env
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000

NEXT_PUBLIC_X402_MANTLE_ENABLED=true
NEXT_PUBLIC_X402_MANTLE_PROVIDER=cookieverse-mantle
X402_MANTLE_SERVER_PROVIDER=cookieverse-mantle

MANTLE_RPC_URL=https://rpc.mantle.xyz
MANTLE_CHAIN_ID=5000
MANTLE_PAY_TO=0xYourCookieverseTreasuryWallet

MANTLE_WALLET_ROAST_PRICE_WEI=100000000000000000
MANTLE_XCUP_PROPHECY_PRICE_WEI=100000000000000000
```

Production:

```env
NEXT_PUBLIC_APP_URL=https://www.cookieverse.tech

NEXT_PUBLIC_X402_MANTLE_ENABLED=true
NEXT_PUBLIC_X402_MANTLE_PROVIDER=cookieverse-mantle
X402_MANTLE_SERVER_PROVIDER=cookieverse-mantle

MANTLE_RPC_URL=https://rpc.mantle.xyz
MANTLE_CHAIN_ID=5000
MANTLE_PAY_TO=0xYourCookieverseTreasuryWallet

MANTLE_WALLET_ROAST_PRICE_WEI=100000000000000000
MANTLE_XCUP_PROPHECY_PRICE_WEI=100000000000000000
```

`100000000000000000 wei = 0.1 MNT`.

Do not trust price, recipient, product, or chain values from the client.

## Routes

Use routes parallel to the existing x402 product routes:

```txt
POST /api/x402/mantle-native/wallet-roast/identity
POST /api/x402/mantle-native/xcup/prophecy
```

The initial unpaid request returns:

```json
{
  "ok": false,
  "error": "Payment Required",
  "x402Version": 2,
  "provider": "cookieverse-mantle",
  "accepts": [
    {
      "scheme": "mantle-native-exact",
      "network": "eip155:5000",
      "asset": "MNT",
      "amount": "100000000000000000",
      "payTo": "0xYourCookieverseTreasuryWallet",
      "product": "wallet-roast",
      "resource": "/api/x402/mantle-native/wallet-roast/identity"
    }
  ]
}
```

The paid retry sends:

```json
{
  "wallet": "0xUserWallet",
  "paymentTxHash": "0xMantleMainnetTxHash"
}
```

For World Cup:

```json
{
  "wallet": "0xUserWallet",
  "homeTeam": "Korea Republic",
  "awayTeam": "South Africa",
  "matchDate": "2026-06-11",
  "paymentTxHash": "0xMantleMainnetTxHash"
}
```

## Server Verification

Create a server helper:

```txt
src/lib/server/mantleNative402.ts
```

It should export:

```ts
type MantleNativeProduct = "wallet-roast" | "xcup-prophecy";

function mantleNativeCorsHeaders(req: NextRequest): Record<string, string>;

function mantleNativePaymentRequired(
  req: NextRequest,
  product: MantleNativeProduct
): NextResponse;

async function requireMantleNativePayment(
  req: NextRequest,
  product: MantleNativeProduct,
  body: unknown
): Promise<null | NextResponse>;
```

Required checks:

```txt
1. paymentTxHash exists on paid retry.
2. tx exists on Mantle mainnet RPC.
3. receipt exists.
4. receipt.status is success.
5. transaction.chainId is 5000 if available.
6. tx.from equals the payer wallet from the request.
7. tx.to equals MANTLE_PAY_TO.
8. tx.value >= product price resolved server-side.
9. tx hash has not been used before.
10. tx hash is bound to product and feature request hash.
```

Recommended viem flow:

```ts
const publicClient = createPublicClient({
  chain: mantle,
  transport: http(process.env.MANTLE_RPC_URL),
});

const tx = await publicClient.getTransaction({ hash });
const receipt = await publicClient.getTransactionReceipt({ hash });
```

## Request Binding

A payment should unlock exactly one product request.

Build a deterministic request hash:

```txt
wallet-roast:
  sha256("wallet-roast:" + lower(wallet))

xcup-prophecy:
  sha256("xcup-prophecy:" + lower(wallet) + ":" + homeTeam + ":" + awayTeam + ":" + matchDate)
```

Store:

```json
{
  "txHash": "0x...",
  "payer": "0x...",
  "payTo": "0x...",
  "amountWei": "100000000000000000",
  "product": "wallet-roast",
  "featureRequestHash": "0x...",
  "chainId": 5000,
  "createdAt": "2026-06-07T00:00:00.000Z"
}
```

## Replay Protection Store

Best production option: Upstash Redis through the Vercel Marketplace.

Use an atomic insert:

```txt
SET mantle-payment:{txHash} payload NX
```

If the key already exists:

```txt
return 402 or 409: payment transaction already used
```

Vercel Blob is acceptable for analytics and audit history, but it is not ideal as the primary replay lock because it is not an atomic `SET NX` store.

Recommended:

```txt
Upstash Redis REST -> replay lock
Vercel Blob -> optional append-only audit events and payment history
```

Use these env names for new Vercel Marketplace Redis integrations:

```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

The code also accepts older `KV_REST_API_URL` and `KV_REST_API_TOKEN` names if a migrated store already exposes them.

## Frontend Flow

Add a Mantle-native payment helper in:

```txt
src/lib/x402/client.ts
```

Flow:

```txt
1. POST product request to Mantle-native route.
2. If status is 402, parse accepts[0].
3. Ensure wallet is on Mantle chainId 5000.
4. Send native MNT transaction:
   to: accepts[0].payTo
   value: BigInt(accepts[0].amount)
5. Wait for wallet to return txHash.
6. Retry product request with paymentTxHash.
7. Server verifies tx and returns paid JSON + rendered PNG info.
```

With wagmi:

```ts
const hash = await walletClient.sendTransaction({
  account: walletClient.account,
  chain: mantle,
  to: payTo,
  value: amountWei,
});
```

The UI should show:

```txt
Payment -> Confirming Mantle tx -> Collecting on-chain data -> AI roast/prophecy -> PNG render
```

## Route Implementation Shape

Wallet Roast:

```ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const paymentResponse = await requireMantleNativePayment(
    req,
    "wallet-roast",
    body
  );

  if (paymentResponse) return paymentResponse;

  const result = await buildPaidWalletRoastResponse({
    walletInput: String(body.wallet || body.address || "").trim(),
    product: "identity-roast",
    provider: "cookieverse-mantle",
    chain: "mantle",
    includeImage: true,
    includeMintMetadata: true,
  });

  return NextResponse.json(result.body, { status: result.status });
}
```

World Cup:

```ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const paymentResponse = await requireMantleNativePayment(
    req,
    "xcup-prophecy",
    body
  );

  if (paymentResponse) return paymentResponse;

  const result = await buildPaidWorldCupProphecyResponse({
    payerWallet: String(body.wallet || "").trim(),
    homeTeam: String(body.homeTeam || "").trim(),
    awayTeam: String(body.awayTeam || "").trim(),
    matchDate: String(body.matchDate || "").trim(),
    provider: "cookieverse-mantle",
  });

  return NextResponse.json(result.body, { status: result.status });
}
```

## Rollout Plan

1. Keep `mantle-devkit` in code but mark it debug-only.
2. Add `cookieverse-mantle` as a new provider in `src/lib/x402/config.ts`.
3. Add `src/lib/server/mantleNative402.ts`.
4. Add two Mantle-native paid routes.
5. Add client-side native MNT payment retry logic.
6. Add Upstash Redis replay lock.
7. Add local tests:
   - unpaid request returns 402
   - invalid tx hash returns 402
   - wrong receiver returns 402
   - wrong payer returns 402
   - too-small value returns 402
   - successful Mantle tx unlocks once
   - same tx cannot unlock twice
8. Deploy to Vercel with provider set to `cookieverse-mantle`.
9. Disable `mantle-devkit` on production.

## Future Upgrade Path

After the native MNT path works:

1. Add full `/verify` and `/settle` endpoints.
2. Add ERC-20 exact support on Mantle with Permit2 or EIP-3009.
3. Support a stablecoin on Mantle if there is a reliable wallet/user path.
4. Register the Cookieverse facilitator in the x402 ecosystem once it implements the expected protocol.

## Final Decision

For Cookieverse today:

```txt
Use native MNT HTTP 402 on Mantle mainnet.
Do not rely on Mantle DevKit for production mainnet payments.
Treat full official Mantle x402 as phase 2.
```
