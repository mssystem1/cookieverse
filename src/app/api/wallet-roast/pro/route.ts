import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { analyzeWalletRoast } from "../../../../lib/wallet-roast/analyzeWalletRoast";
import { buildWalletRoastNftMetadata } from "../../../../lib/wallet-roast/buildWalletRoastMetadata";
import { requireCookieverseServiceKey } from "../../../../lib/server/serviceAuth";
import { pinPngBufferToPinata } from "../../../../lib/server/pinata";
import {
  recordX402Usage,
  type X402Product,
  type X402Provider,
} from "../../../../server/x402UsageStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  wallet?: string;
  address?: string;
  chain?: string;
  style?: string;
  product?: X402Product;
  provider?: X402Provider;
  includeImage?: boolean;
  includeMintMetadata?: boolean;
};

function productFromRequest(req: NextRequest, body: Body): X402Product {
  const header = req.headers.get("x-cookieverse-x402-product") || "";
  const raw = String(body.product || header || "identity-roast");

  if (raw === "roast-json" || raw === "identity-roast") return raw;

  return "identity-roast";
}

function providerFromRequest(req: NextRequest, body: Body): X402Provider {
  const header = req.headers.get("x-cookieverse-x402-provider") || "";
  const raw = String(body.provider || header || "bankr").toLowerCase();

  if (raw === "coinbase" || raw === "bankr") return raw;

  return "bankr";
}

function endpointFromProduct(product: X402Product) {
  return product === "identity-roast"
    ? "cookieverse-identity-roast"
    : "cookieverse-roast-json";
}

function requestIdFromHeaders(req: NextRequest) {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-bankr-request-id") ||
    req.headers.get("x402-request-id") ||
    crypto.randomUUID()
  );
}

function compactResponse(params: {
  product: X402Product;
  provider: X402Provider;
  analysis: Awaited<ReturnType<typeof analyzeWalletRoast>>;
  image?: Awaited<ReturnType<typeof pinPngBufferToPinata>>;
  metadata?: unknown;
}) {
  const { product, provider, analysis, image, metadata } = params;

  return {
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
    raw: analysis
  };
}

export async function POST(req: NextRequest) {
  try {
    requireCookieverseServiceKey(req);

    const body = (await req.json().catch(() => ({}))) as Body;
    const walletInput = String(body.wallet || body.address || "").trim();
    const chain = String(body.chain || "base").toLowerCase();
    const product = productFromRequest(req, body);
    const provider = providerFromRequest(req, body);

    if (chain !== "base") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Wallet Roast paid API v1 is Base-only because the current Cookieverse analyzer uses Base/Etherscan V2 data."
        },
        { status: 400 }
      );
    }

    if (!isAddress(walletInput)) {
      return NextResponse.json(
        { ok: false, error: "Invalid EVM wallet address" },
        { status: 400 }
      );
    }

    const wallet = getAddress(walletInput);

    const shouldIncludeImage =
      typeof body.includeImage === "boolean"
        ? body.includeImage
        : product === "identity-roast";

    const shouldIncludeMetadata =
      typeof body.includeMintMetadata === "boolean"
        ? body.includeMintMetadata
        : product === "identity-roast";

    const analysis = await analyzeWalletRoast(wallet);

    let image: Awaited<ReturnType<typeof pinPngBufferToPinata>> | undefined;
    let metadata: unknown | undefined;

    if (shouldIncludeImage) {
      const mod = await import("../../../../lib/wallet-roast/renderCard");
      const png = await mod.renderCard(analysis);

      image = await pinPngBufferToPinata(
        Buffer.from(png),
        `cookieverse-wallet-roast-${wallet.slice(2, 10).toLowerCase()}.png`
      );
    }

    if (shouldIncludeMetadata) {
      metadata = buildWalletRoastNftMetadata(analysis, image?.ipfsUri);
    }

    const requestId = requestIdFromHeaders(req);

    await recordX402Usage({
      wallet: wallet.toLowerCase() as `0x${string}`,
      product,
      provider,
      endpoint: endpointFromProduct(product),
      requestId,
      imageUrl: image?.gatewayUrl,
      metadataReady: Boolean(metadata),
      createdAt: Date.now(),
    });

  return NextResponse.json(
    compactResponse({ product, provider, analysis, image, metadata }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet Roast Pro failed";
    const status = (error as any)?.status || 500;

    if (
      message.includes("fetch failed") ||
      message.includes("Connect Timeout") ||
      message.includes("aborted")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Explorer, 0G, or image request timed out. Try Fast Roast first."
        },
        { status: 504 }
      );
    }

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}