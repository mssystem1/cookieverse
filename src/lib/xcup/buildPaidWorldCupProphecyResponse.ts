import { getAddress, isAddress } from "viem";
import { POST as generateWorldCupProphecyPost } from "../../app/api/xcup/prophecy/route";
import { renderWorldCupProphecyCard } from "./renderProphecyCard";
import type { WorldCupProphecyInput, WorldCupProphecyResult } from "./types";
import { buildWorldCupProphecyMetadata } from "./buildProphecyMetadata";
import { pinJsonToPinata, pinPngBufferToPinata } from "../server/pinata";
import {
  recordX402Usage,
  type X402Provider,
} from "../../server/x402UsageStore";

type PaidProphecyChain = "base" | "mantle" | "xlayer" | "arbitrum";
const MAX_METADATA_RISKS = 5;

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

function cleanText(value: unknown, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function riskSeverityScore(level: string) {
  if (level === "High") return 5;
  if (level === "Medium-High") return 4;
  if (level === "Medium") return 3;
  if (level === "Low-Medium") return 2;
  if (level === "Low") return 1;
  return 0;
}

function riskSpecificityBonus(label: string) {
  if (label === "Set Piece Risk") return 0.5;
  if (label === "Heat/Fatigue Risk") return 0.5;
  if (label === "Travel Risk") return 0.5;
  if (label === "Late Goal Risk") return 0.35;
  if (label === "Counter Risk") return 0.25;
  return 0;
}

function formatMetadataRisk(label: string, value: unknown, reason?: unknown) {
  const level = cleanText(value);
  if (!level || level === "Low") return null;

  const cleanReason = cleanText(reason).replace(/[.!?]+$/g, "");

  return {
    text: cleanReason
      ? `${label}: ${level} - ${cleanReason}`
      : `${label}: ${level}`,
    score: riskSeverityScore(level) + riskSpecificityBonus(label),
  };
}

function prophecyRiskSummary(prophecy: WorldCupProphecyResult) {
  const items = [
    formatMetadataRisk("Draw Risk", prophecy.drawRisk, prophecy.drawRiskReason),
    formatMetadataRisk(
      "Counter Risk",
      prophecy.counterAttackRisk,
      prophecy.counterAttackRiskReason
    ),
    formatMetadataRisk(
      "Clean Sheet Risk",
      prophecy.cleanSheetRisk,
      prophecy.cleanSheetRiskReason
    ),
    formatMetadataRisk("Set Piece Risk", prophecy.setPieceRisk, prophecy.setPieceRiskReason),
    formatMetadataRisk("Upset Risk", prophecy.upsetRisk, prophecy.upsetRiskReason),
    formatMetadataRisk("Late Goal Risk", prophecy.lateGoalRisk, prophecy.lateGoalRiskReason),
    formatMetadataRisk(
      "Heat/Fatigue Risk",
      prophecy.heatFatigueRisk,
      prophecy.heatFatigueRiskReason
    ),
    formatMetadataRisk(
      "Travel Risk",
      prophecy.travelDisruptionRisk,
      prophecy.travelDisruptionRiskReason
    ),
    formatMetadataRisk(
      "Goalkeeper Risk",
      prophecy.goalkeeperHeroRisk,
      prophecy.goalkeeperHeroRiskReason
    ),
    formatMetadataRisk(
      "Physical Risk",
      prophecy.physicalMismatchRisk,
      prophecy.physicalMismatchRiskReason
    ),
  ] as const;

  return items
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_METADATA_RISKS)
    .map((risk) => risk.text)
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

  const metadata = buildWorldCupProphecyMetadata({
    prophecy,
    imageUri,
    chain,
    payerWallet,
  });

  if (risks) {
    metadata.attributes.push({ trait_type: "Inline Risks", value: risks });
  }

  return metadata;
}

export async function buildPaidWorldCupProphecyResponse(params: Params) {
  const requestStartedAt = Date.now();
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
  let metadataPin:
    | Awaited<ReturnType<typeof pinJsonToPinata>>
    | undefined;

  if (params.includeImage !== false) {
    const renderStartedAt = Date.now();
    const png = await renderWorldCupProphecyCard({
      ...prophecy,
      mintedBy: payerWallet,
    });

    console.info("[xcup paid image] rendered", {
      provider: params.provider,
      chain: params.chain,
      durationMs: Date.now() - renderStartedAt,
      bytes: png.byteLength,
    });

    const imagePinStartedAt = Date.now();
    image = await pinPngBufferToPinata(
      Buffer.from(png),
      `cookieverse-world-cup-prophecy-${cleanSlug(prophecy.homeTeam)}-vs-${cleanSlug(
        prophecy.awayTeam
      )}.png`
    );

    console.info("[xcup paid image] pinned", {
      provider: params.provider,
      chain: params.chain,
      durationMs: Date.now() - imagePinStartedAt,
      cid: image.cid,
    });
  }

  if (params.includeMintMetadata !== false) {
    metadata = buildMetadata({
      prophecy,
      imageUri: image?.ipfsUri,
      chain: params.chain,
      payerWallet,
    });

    const metadataPinStartedAt = Date.now();
    metadataPin = await pinJsonToPinata(
      metadata,
      `cookieverse-world-cup-prophecy-${cleanSlug(prophecy.homeTeam)}-vs-${cleanSlug(
        prophecy.awayTeam
      )}.json`
    );

    console.info("[xcup paid metadata] pinned", {
      provider: params.provider,
      chain: params.chain,
      durationMs: Date.now() - metadataPinStartedAt,
      cid: metadataPin.cid,
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

  console.info("[xcup paid response] ready", {
    provider: params.provider,
    chain: params.chain,
    durationMs: Date.now() - requestStartedAt,
    hasImage: Boolean(image),
    hasMetadata: Boolean(metadataPin),
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
      metadataPin,
    },
  };
}
