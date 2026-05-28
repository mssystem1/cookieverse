import { getAddress, isAddress } from "viem";
import { analyzeWalletRoast } from "./analyzeWalletRoast";
import { buildWalletRoastNftMetadata } from "./buildWalletRoastMetadata";
import { pinPngBufferToPinata } from "../server/pinata";
import {
  recordX402Usage,
  type X402Product,
  type X402Provider,
} from "../../server/x402UsageStore";

type Params = {
  walletInput: string;
  product: X402Product;
  provider: X402Provider;
  includeImage: boolean;
  includeMintMetadata: boolean;
};

function endpointFromProduct(product: X402Product) {
  return product === "identity-roast"
    ? "cookieverse-identity-roast"
    : "cookieverse-roast-json";
}

export async function buildPaidWalletRoastResponse(params: Params) {
  const { walletInput, product, provider, includeImage, includeMintMetadata } =
    params;

  if (!isAddress(walletInput)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Invalid EVM wallet address",
      },
    };
  }

  const wallet = getAddress(walletInput);
  const analysis = await analyzeWalletRoast(wallet);

  let image:
    | Awaited<ReturnType<typeof pinPngBufferToPinata>>
    | undefined;

  let metadata: unknown | undefined;

  if (includeImage) {
    const mod = await import("./renderCard");
    const png = await mod.renderCard(analysis);

    image = await pinPngBufferToPinata(
      Buffer.from(png),
      `cookieverse-wallet-roast-${wallet.slice(2, 10).toLowerCase()}.png`
    );
  }

  if (includeMintMetadata) {
    metadata = buildWalletRoastNftMetadata(analysis, image?.ipfsUri);
  }

  await recordX402Usage({
    wallet: wallet.toLowerCase() as `0x${string}`,
    product,
    provider,
    endpoint: endpointFromProduct(product),
    requestId: crypto.randomUUID(),
    imageUrl: image?.gatewayUrl,
    metadataReady: Boolean(metadata),
    createdAt: Date.now(),
  });

  return {
    status: 200,
    body: {
      ok: true,
      product,
      provider,
      wallet: analysis.wallet,
      chain: "base",
      archetype: analysis.classification?.archetype,
      tags: analysis.classification?.tags || [],
      walletScore: analysis.metrics?.wallet_score,
      degeneracyScore: analysis.metrics?.degeneracy_score,
      headline: analysis.roast_text?.headline,
      lightRoast: analysis.roast_text?.light_roast,
      savageRoast: analysis.roast_text?.savage_roast,
      verdict: analysis.roast_text?.verdict,
      traits: analysis.roast_inputs?.derived_traits || [],
      image,
      metadata,
      raw: analysis,
    },
  };
}