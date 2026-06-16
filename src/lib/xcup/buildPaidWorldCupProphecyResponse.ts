import { getAddress, isAddress } from "viem";
import { POST as generateWorldCupProphecyPost } from "../../app/api/xcup/prophecy/route";
import { renderWorldCupProphecyCard } from "./renderProphecyCard";
import type { WorldCupProphecyInput, WorldCupProphecyResult } from "./types";
import { pinPngBufferToPinata } from "../server/pinata";
import {
  recordX402Usage,
  type X402Provider,
} from "../../server/x402UsageStore";

type PaidProphecyChain = "base" | "mantle" | "xlayer";

type Params = {
  input: WorldCupProphecyInput;
  payerWallet: string;
  provider: X402Provider;
  chain: PaidProphecyChain;
  includeImage?: boolean;
  includeMintMetadata?: boolean;
};

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function prophecyRiskSummary(prophecy: WorldCupProphecyResult) {
  const items = [
    ["Draw Risk", prophecy.drawRisk],
    ["Counter Risk", prophecy.counterAttackRisk],
    ["Clean Sheet Risk", prophecy.cleanSheetRisk],
    ["Set Piece Risk", prophecy.setPieceRisk],
    ["Upset Risk", prophecy.upsetRisk],
    ["Late Goal Risk", prophecy.lateGoalRisk],
    ["Heat/Fatigue Risk", prophecy.heatFatigueRisk],
    ["Travel Risk", prophecy.travelDisruptionRisk],
  ] as const;

  return items
    .map(([label, value]) => (value ? `${label}: ${value}` : ""))
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
}

function buildMetadata(params: {
  prophecy: WorldCupProphecyResult;
  imageUri?: string;
  chain: PaidProphecyChain;
  payerWallet: string;
}) {
  const { prophecy, imageUri, chain, payerWallet } = params;
  const risks = prophecyRiskSummary(prophecy);

  return {
    name: `Cookieverse World Cup Prophecy: ${prophecy.homeTeam} vs ${prophecy.awayTeam}`,
    description:
      `${prophecy.prophecy}\n\n` +
      (risks ? `Risks: ${risks}\n\n` : "") +
      `A paid Cookieverse x402 World Cup prophecy generated and rendered as a collectible match card.`,
    image: imageUri,
    external_url: "https://www.cookieverse.tech/app",
    attributes: [
      { trait_type: "Product", value: "World Cup Prophecy" },
      { trait_type: "Chain", value: chain },
      { trait_type: "Home Team", value: prophecy.homeTeam },
      { trait_type: "Away Team", value: prophecy.awayTeam },
      { trait_type: "Match Date", value: prophecy.matchDate },
      { trait_type: "Pick", value: prophecy.pick },
      { trait_type: "Scoreline", value: prophecy.scoreline },
      { trait_type: "Confidence", value: prophecy.confidence },
      ...(risks ? [{ trait_type: "Inline Risks", value: risks }] : []),
    ],
    cookieverse: {
      version: "1.0",
      product: "xcup-prophecy",
      chain,
      payerWallet,
      prophecy,
    },
  };
}

export async function buildPaidWorldCupProphecyResponse(params: Params) {
  if (!isAddress(params.payerWallet)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Invalid payer wallet address",
      },
    };
  }

  const payerWallet = getAddress(params.payerWallet);

  const req = new Request("http://cookieverse.local/api/xcup/prophecy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params.input),
  });

  const prophecyRes = await generateWorldCupProphecyPost(req as any);
  const prophecy = (await prophecyRes.json()) as WorldCupProphecyResult & {
    error?: string;
  };

  if (!prophecyRes.ok || prophecy.error) {
    return {
      status: prophecyRes.status || 500,
      body: {
        ok: false,
        error: prophecy.error || "Failed to generate World Cup prophecy",
      },
    };
  }

  let image:
    | Awaited<ReturnType<typeof pinPngBufferToPinata>>
    | undefined;

  let metadata: unknown | undefined;

  if (params.includeImage !== false) {
    const png = await renderWorldCupProphecyCard({
      ...prophecy,
      mintedBy: payerWallet,
    });

    image = await pinPngBufferToPinata(
      Buffer.from(png),
      `cookieverse-world-cup-prophecy-${cleanSlug(prophecy.homeTeam)}-vs-${cleanSlug(
        prophecy.awayTeam
      )}.png`
    );
  }

  if (params.includeMintMetadata !== false) {
    metadata = buildMetadata({
      prophecy,
      imageUri: image?.ipfsUri,
      chain: params.chain,
      payerWallet,
    });
  }

  await recordX402Usage({
    wallet: payerWallet.toLowerCase() as `0x${string}`,
    product: "xcup-prophecy",
    provider: params.provider,
    chain: params.chain,
    endpoint: "cookieverse-xcup-prophecy",
    requestId: crypto.randomUUID(),
    imageUrl: image?.gatewayUrl,
    metadataReady: Boolean(metadata),
    createdAt: Date.now(),
  });

  return {
    status: 200,
    body: {
      ok: true,
      product: "xcup-prophecy",
      provider: params.provider,
      chain: params.chain,
      payerWallet,
      prophecy,
      image,
      metadata,
    },
  };
}
