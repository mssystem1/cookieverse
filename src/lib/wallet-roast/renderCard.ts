import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import type { WalletRoastAnalysis } from "./types";

const TEMPLATE_MAP: Record<string, string> = {
  "Bridge Tourist": "bridge-tourist.png",
  "Dust Farmer": "dust-farmer.png",
  "Silent Whale": "silent-whale.png",
  "NFT Addict": "nft-addict.png",
  "DeFi Goblin": "defi-goblin.png",
  "Onchain Civilian": "onchain-civilian.png",
};

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;

  const fontDir = path.join(process.cwd(), "public", "fonts");

  const fonts = [
    path.join(fontDir, "Inter-Regular.ttf"),
    path.join(fontDir, "Inter-SemiBold.ttf"),
    path.join(fontDir, "Inter-Bold.ttf"),
  ];

  for (const fontPath of fonts) {
    try {
      GlobalFonts.registerFromPath(fontPath, "Inter");
    } catch (error) {
      console.warn("wallet roast font registration failed", {
        fontPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  fontsRegistered = true;
}

function getTemplatePath(archetype: string) {
  const file = TEMPLATE_MAP[archetype] || "bridge-tourist.png";
  return path.join(process.cwd(), "public", "wallet-roast", "templates", file);
}

async function getSafeTemplatePath(archetype: string) {
  const preferred = getTemplatePath(archetype);

  try {
    await fs.access(preferred);
    return preferred;
  } catch {
    return path.join(
      process.cwd(),
      "public",
      "wallet-roast",
      "templates",
      "bridge-tourist.png"
    );
  }
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isPng(buffer: Buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function stripPngMetadata(input: Buffer): Buffer {
  if (!isPng(input)) return input;

  const chunks: Buffer[] = [input.subarray(0, 8)];
  let offset = 8;

  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const chunkEnd = dataStart + length + 4;

    if (chunkEnd > input.length) {
      return input;
    }

    const type = input.toString("ascii", typeStart, typeStart + 4);

    // Keep critical PNG chunks only:
    // IHDR, PLTE, IDAT, IEND.
    // Also keep tRNS because some palette PNGs need it for transparency.
    const isCriticalChunk = type[0] >= "A" && type[0] <= "Z";
    const shouldKeep = isCriticalChunk || type === "tRNS";

    if (shouldKeep) {
      chunks.push(input.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;

    if (type === "IEND") break;
  }

  return Buffer.concat(chunks);
}

async function loadLocalImage(filePath: string) {
  const rawBytes = await fs.readFile(filePath);
  const safeBytes = stripPngMetadata(rawBytes);

  try {
    return await loadImage(safeBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Image decode failed for ${filePath}: ${message}`);
  }
}

async function tryLoadIcon(name: string) {
  const iconPath = path.join(
    process.cwd(),
    "public",
    "wallet-roast",
    "icons",
    "stats",
    `${name}.png`
  );

  try {
    await fs.access(iconPath);
    return await loadLocalImage(iconPath);
  } catch (error) {
    console.warn("wallet roast stat icon skipped", {
      name,
      iconPath,
      message: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

async function tryLoadTagIcon(name: string) {
  const iconPath = path.join(
    process.cwd(),
    "public",
    "wallet-roast",
    "icons",
    "tags",
    `${name}.png`
  );

  try {
    await fs.access(iconPath);
    return await loadLocalImage(iconPath);
  } catch (error) {
    console.warn("wallet roast tag icon skipped", {
      name,
      iconPath,
      message: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

function truncateMiddle(value: string, max = 18) {
  if (value.length <= max) return value;
  const left = Math.ceil((max - 3) / 2);
  const right = Math.floor((max - 3) / 2);
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function wrapTextLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (current) lines.push(current);

  const result = lines.slice(0, maxLines);

  if (result.length === maxLines) {
    const joined = result.join(" ");
    if (joined.length < text.length) {
      let last = result[result.length - 1];
      while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
        last = last.slice(0, -1);
      }
      result[result.length - 1] = `${last}…`;
    }
  }

  return result;
}

function formatUsd(n: number) {
  if (!Number.isFinite(n)) return "$0.00";
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

function formatCompactNumber(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function getDisplayName(data: WalletRoastAnalysis) {
  const identity = data.identity as WalletRoastAnalysis["identity"] & {
    basename?: string | null;
  };

  const value =
    identity?.basename ||
    data.identity?.name_tag ||
    data.identity?.label ||
    truncateMiddle(data.wallet, 18);

  return value.length > 22 ? truncateMiddle(value, 22) : value;
}

function getMainRoastText(data: WalletRoastAnalysis) {
  const text =
    data.roast_text?.light_roast ||
    data.roast_text?.headline ||
    "Quiet wallet. Minimal chaos. Nothing loud onchain.";

  return text.replace(/\s+/g, " ").trim();
}

function getVerdictText(data: WalletRoastAnalysis) {
  const text = data.roast_text?.verdict || "";
  return text.replace(/\s+/g, " ").trim();
}

function getRenderableTags(data: WalletRoastAnalysis): string[] {
  const raw = data.classification?.tags || [];
  const archetype = (data.classification?.archetype || "").trim().toLowerCase();
  const seen = new Set<string>();

  return raw
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((tag) => {
      const normalized = tag.toLowerCase();

      // Remove only an exact duplicate of the archetype label,
      // because the archetype is already represented by the card template.
      if (normalized === archetype) return false;

      // Remove duplicate tags (case-insensitive)
      if (seen.has(normalized)) return false;
      seen.add(normalized);

      return true;
    })
    .slice(0, 5);
}

function normalizeTagKey(tag: string) {
  return tag.trim().toLowerCase();
}

function getTagIconName(tag: string): string | null {
  switch (normalizeTagKey(tag)) {
    case "nft addict":
      return "nft-addict";
    case "nft minter":
      return "nft-minter";
    case "bridge tourist":
      return "bridge-tourist";
    case "bridge enjoyer":
      return "bridge-enjoyer";
    case "tx machine":
      return "tx-machine";
    case "tx spammer":
      return "tx-spammer";
    case "airdrop magnet":
      return "airdrop-magnet";
    case "dust farmer":
      return "dust-farmer";
    case "defi user":
      return "defi-user";
    case "micro lp":
      return "micro-lp";
    default:
      return null;
  }
}

type StatItem = {
  icon: string;
  label: string;
  value: string;
};

function getStats(data: WalletRoastAnalysis): StatItem[] {
  return [
    {
      icon: "usd",
      label: "USD",
      value: formatUsd(data.portfolio?.total_usd || 0),
    },
    {
      icon: "score",
      label: "SCORE",
      value: (data.metrics?.wallet_score || 0).toFixed(1),
    },
    {
      icon: "defi",
      label: "DEFI",
      value: `${Math.round(data.portfolio?.defi_ratio || 0)}%`,
    },
    {
      icon: "tokens",
      label: "TOKENS",
      value: formatCompactNumber(data.metrics?.unique_tokens || 0),
    },
    {
      icon: "dust",
      label: "DUST",
      value: `${Math.round(data.portfolio?.dust_ratio || 0)}%`,
    },
    {
      icon: "tx",
      label: "TX",
      value: formatCompactNumber(data.metrics?.tx_count_total || 0),
    },
  ];
}

type RectPx = { x: number; y: number; w: number; h: number };
type GradientStop = [number, string];

type TextStyle = {
  fontFamily?: string;
  fontWeight?: number;
  maxLines?: number;
  startSize: number;
  minSize: number;
  lineHeight: number;
  paddingX?: number;
  fill?: string;
  gradientStops?: GradientStop[];
  glow?: string;
  stroke?: string;
  strokeWidth?: number;
  shadowBlur?: number;
  visualOffsetY?: number;
};

type InlineBoxStyle = {
  box: RectPx;
  textStyle: TextStyle;
  iconSize?: number;
  iconGap?: number;
  textOffsetX?: number;
  textOffsetY?: number;
};

type ThemeLayout = {
  designWidth: number;
  designHeight: number;
  nameBox: RectPx;
  chainBox: RectPx;
  roastBox: RectPx;
  verdictBox: RectPx;
  stats: RectPx[];
  tags: RectPx[];
  nameStyle: TextStyle;
  roastStyle: TextStyle;
  verdictStyle: TextStyle;
  chainStyle: TextStyle;
  statStyle: TextStyle;
  tagStyle: TextStyle;
  chainInline: InlineBoxStyle;
  statInline: Omit<InlineBoxStyle, "box">;
  tagInline: Omit<InlineBoxStyle, "box">;
};

const DEFAULT_FONT = "Inter";

// Layout boxes below use PIXELS measured from the template PNG used as the design canvas.
// You can paste x, y, w, h directly from Paint.
// Bridge Tourist uses design size 270x647.
// The other uploaded templates use design size 854x2048.
// If the runtime template is a different size, coordinates are scaled automatically.

const THEME_LAYOUTS: Record<string, ThemeLayout> = {
  "Bridge Tourist": {
    designWidth: 270,
    designHeight: 647,
    nameBox: { x: 51, y: 71, w: 167, h: 42 },
    chainBox: { x: 89, y: 118, w: 92, h: 27 },
    roastBox: { x: 32, y: 159, w: 205, h: 188 },
    verdictBox: { x: 35, y: 356, w: 200, h: 61 },
    stats: [
      { x: 43, y: 387, w: 71, h: 20 },
      { x: 43, y: 421, w: 71, h: 20 },
      { x: 43, y: 453, w: 71, h: 20 },
      { x: 155, y: 386, w: 71, h: 20 },
      { x: 155, y: 419, w: 71, h: 20 },
      { x: 155, y: 454, w: 71, h: 20 },
    ],
    tags: [
      { x: 18, y: 553, w: 70, h: 20 },
      { x: 104, y: 553, w: 70, h: 20 },
      { x: 182, y: 553, w: 70, h: 20 },
    //  { x: 140, y: 553, w: 27, h: 18 },
    //  { x: 173, y: 553, w: 35, h: 18 },
    ],
    nameStyle: {
      startSize: 0.05,
      minSize: 0.031,
      lineHeight: 1.05,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#EAFBFF"], [0.45, "#8FD9FF"], [1, "#D8C4FF"]],
      glow: "rgba(84, 187, 255, 0.35)",
      stroke: "rgba(17, 10, 52, 0.95)",
      strokeWidth: 4,
      visualOffsetY: -8,
    },
    roastStyle: {
      startSize: 0.069,
      minSize: 0.044,
      maxLines: 4,
      lineHeight: 1.28,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFFFFF"], [0.45, "#D7C2FF"], [1, "#7AE7FF"]],
      glow: "rgba(107, 85, 255, 0.40)",
      stroke: "rgba(18, 8, 45, 0.96)",
      strokeWidth: 4,
      paddingX: 0.035,
      visualOffsetY: -30,
    },
    verdictStyle: {
      startSize: 0.054,
      minSize: 0.038,
      maxLines: 2,
      lineHeight: 1.2,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFF1B8"], [0.5, "#FFFFFF"], [1, "#BFE8FF"]],
      glow: "rgba(120, 104, 255, 0.28)",
      stroke: "rgba(23, 12, 54, 0.95)",
      strokeWidth: 3,
      paddingX: 0.04,
      visualOffsetY: -30,
    },
    chainStyle: {
      startSize: 0.031,
      minSize: 0.027,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#F5F7FF",
      shadowBlur: 6,
    },
    statStyle: {
      startSize: 0.028,
      minSize: 0.023,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFFFFF"], [1, "#CFE3FF"]],
      glow: "rgba(72, 141, 255, 0.22)",
      stroke: "rgba(12, 10, 35, 0.82)",
      strokeWidth: 2,
    },
    tagStyle: {
      startSize: 0.025,
      minSize: 0.021,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#EADFFF",
      shadowBlur: 4,
      visualOffsetY: -4,
    },
    chainInline: {
      box: { x: 89, y: 118, w: 92, h: 27 },
      textStyle: { startSize: 0.05, minSize: 0.045, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F5F7FF" },
      iconSize: 0.055,
      iconGap: 0.038,
      textOffsetY: -16,
    },
    statInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F6F5FF" },
      iconSize: 0.055,
      iconGap: 0.02,
      textOffsetY: +8 //-43,
    },
    tagInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#EADFFF" },
      iconSize: 0.055,
      iconGap: 0.015,
      textOffsetY: -10,
    },
  },
  "Dust Farmer": {
    designWidth: 270,
    designHeight: 647,
    nameBox: { x: 51, y: 71, w: 167, h: 42 },
    chainBox: { x: 89, y: 118, w: 92, h: 27 },
    roastBox: { x: 32, y: 159, w: 205, h: 188 },
    verdictBox: { x: 35, y: 356, w: 200, h: 61 },
    stats: [
      { x: 43, y: 387, w: 71, h: 20 },
      { x: 43, y: 421, w: 71, h: 20 },
      { x: 43, y: 453, w: 71, h: 20 },
      { x: 155, y: 386, w: 71, h: 20 },
      { x: 155, y: 419, w: 71, h: 20 },
      { x: 155, y: 454, w: 71, h: 20 },
    ],
    tags: [
      { x: 18, y: 553, w: 70, h: 20 },
      { x: 104, y: 553, w: 70, h: 20 },
      { x: 182, y: 553, w: 70, h: 20 },
    //  { x: 140, y: 553, w: 27, h: 18 },
    //  { x: 173, y: 553, w: 35, h: 18 },
    ],
    nameStyle: {
      startSize: 0.05,
      minSize: 0.031,
      lineHeight: 1.05,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFF6D8"], [0.35, "#FFD6F4"], [1, "#95DCFF"]],
      glow: "rgba(255, 135, 243, 0.30)",
      stroke: "rgba(24, 12, 52, 0.96)",
      strokeWidth: 4,
      visualOffsetY: 0,
    },
    roastStyle: {
      startSize: 0.069,
      minSize: 0.044,
      maxLines: 4,
      lineHeight: 1.28,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFFFFF"], [0.35, "#FFD4F7"], [1, "#8EDCFF"]],
      glow: "rgba(229, 98, 255, 0.35)",
      stroke: "rgba(20, 8, 44, 0.96)",
      strokeWidth: 4,
      paddingX: 0.035,
      visualOffsetY: -30,
    },
    verdictStyle: {
      startSize: 0.054,
      minSize: 0.038,
      maxLines: 2,
      lineHeight: 1.2,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFF0AE"], [0.45, "#FFFFFF"], [1, "#FFB4F1"]],
      glow: "rgba(242, 112, 255, 0.25)",
      stroke: "rgba(24, 9, 55, 0.95)",
      strokeWidth: 3,
      paddingX: 0.04,
      visualOffsetY: -30,
    },
    chainStyle: {
      startSize: 0.021,
      minSize: 0.017,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#FFF7FF",
      shadowBlur: 6,
    },
    statStyle: {
      startSize: 0.018,
      minSize: 0.013,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F4FFFF"], [1, "#F6C5FF"]],
      glow: "rgba(170, 124, 255, 0.20)",
      stroke: "rgba(15, 10, 40, 0.80)",
      strokeWidth: 2,
    },
    tagStyle: {
      startSize: 0.015,
      minSize: 0.011,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#F6E8FF",
      shadowBlur: 4,
      visualOffsetY: -2,
    },
    chainInline: {
      box: { x: 89, y: 118, w: 92, h: 27 },
      textStyle: { startSize: 0.05, minSize: 0.045, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#FFF7FF" },
      iconSize: 0.055,
      iconGap: 0.038,
      textOffsetY: -13,
    },
    statInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#FFF7FF" },
      iconSize: 0.055,
      iconGap: 0.02,
      textOffsetY: +8 //-43,
    },
    tagInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F6E8FF" },
      iconSize: 0.055,
      iconGap: 0.015,
      textOffsetY: -10,
    },
  },
  "Silent Whale": {
    designWidth: 270,
    designHeight: 647,
    nameBox: { x: 51, y: 71, w: 167, h: 42 },
    chainBox: { x: 89, y: 118, w: 92, h: 27 },
    roastBox: { x: 32, y: 159, w: 205, h: 188 },
    verdictBox: { x: 35, y: 356, w: 200, h: 61 },
    stats: [
      { x: 43, y: 387, w: 71, h: 20 },
      { x: 43, y: 421, w: 71, h: 20 },
      { x: 43, y: 453, w: 71, h: 20 },
      { x: 155, y: 386, w: 71, h: 20 },
      { x: 155, y: 419, w: 71, h: 20 },
      { x: 155, y: 454, w: 71, h: 20 },
    ],
    tags: [
      { x: 18, y: 553, w: 70, h: 20 },
      { x: 104, y: 553, w: 70, h: 20 },
      { x: 182, y: 553, w: 70, h: 20 },
    //  { x: 140, y: 553, w: 27, h: 18 },
    //  { x: 173, y: 553, w: 35, h: 18 },
    ],
    nameStyle: {
      startSize: 0.055,
      minSize: 0.036,
      lineHeight: 1.05,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#DDFBFF"], [0.45, "#78D6FF"], [1, "#E2C3FF"]],
      glow: "rgba(91, 203, 255, 0.28)",
      stroke: "rgba(12, 13, 42, 0.96)",
      strokeWidth: 4,
      visualOffsetY: -8,
    },
    roastStyle: {
      startSize: 0.069,
      minSize: 0.044,
      maxLines: 4,
      lineHeight: 1.28,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#EEFFFF"], [0.45, "#A2DCFF"], [1, "#DABFFF"]],
      glow: "rgba(86, 164, 255, 0.34)",
      stroke: "rgba(10, 14, 40, 0.96)",
      strokeWidth: 4,
      paddingX: 0.035,
      visualOffsetY: -34,
    },
    verdictStyle: {
      startSize: 0.054,
      minSize: 0.038,
      maxLines: 2,
      lineHeight: 1.2,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#DFFBFF"], [0.5, "#FFFFFF"], [1, "#CBB7FF"]],
      glow: "rgba(77, 165, 255, 0.24)",
      stroke: "rgba(13, 16, 46, 0.95)",
      strokeWidth: 3,
      paddingX: 0.04,
      visualOffsetY: -38,
    },
    chainStyle: {
      startSize: 0.021,
      minSize: 0.017,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#F2FDFF",
      shadowBlur: 6,
    },
    statStyle: {
      startSize: 0.018,
      minSize: 0.013,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F2FEFF"], [1, "#C9DBFF"]],
      glow: "rgba(53, 159, 255, 0.18)",
      stroke: "rgba(11, 14, 38, 0.82)",
      strokeWidth: 2,
    },
    tagStyle: {
      startSize: 0.015,
      minSize: 0.011,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#DEF6FF",
      shadowBlur: 4,
      visualOffsetY: -2,
    },
    chainInline: {
      box: { x: 89, y: 118, w: 92, h: 27 },
      textStyle: { startSize: 0.055, minSize: 0.05, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F2FDFF" },
      iconSize: 0.055,
      iconGap: 0.038,
      textOffsetY: -21,
    },
    statInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F2FDFF" },
      iconSize: 0.055,
      iconGap: 0.02,
      textOffsetY: +4 //-43,
    },
    tagInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#DEF6FF" },
      iconSize: 0.055,
      iconGap: 0.015,
      textOffsetY: -34,
    },
  },
  "NFT Addict": {
    designWidth: 270,
    designHeight: 647,
    nameBox: { x: 51, y: 71, w: 167, h: 42 },
    chainBox: { x: 89, y: 118, w: 92, h: 27 },
    roastBox: { x: 32, y: 159, w: 205, h: 188 },
    verdictBox: { x: 35, y: 356, w: 200, h: 61 },
    stats: [
      { x: 43, y: 387, w: 71, h: 20 },
      { x: 43, y: 421, w: 71, h: 20 },
      { x: 43, y: 453, w: 71, h: 20 },
      { x: 155, y: 386, w: 71, h: 20 },
      { x: 155, y: 419, w: 71, h: 20 },
      { x: 155, y: 454, w: 71, h: 20 },
    ],
    tags: [
      { x: 18, y: 553, w: 70, h: 20 },
      { x: 104, y: 553, w: 70, h: 20 },
      { x: 182, y: 553, w: 70, h: 20 },
    //  { x: 140, y: 553, w: 27, h: 18 },
    //  { x: 173, y: 553, w: 35, h: 18 },
    ],
    nameStyle: {
      startSize: 0.055,
      minSize: 0.036,
      lineHeight: 1.05,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#DDFDFF"], [0.28, "#B3C9FF"], [0.65, "#FF9BFF"], [1, "#F8E7FF"]],
      glow: "rgba(223, 87, 255, 0.30)",
      stroke: "rgba(16, 10, 45, 0.96)",
      strokeWidth: 4,
      visualOffsetY: -14,
    },
    roastStyle: {
      startSize: 0.069,
      minSize: 0.044,
      maxLines: 4,
      lineHeight: 1.28,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F0FFFF"], [0.28, "#A6D8FF"], [0.62, "#FFB0FF"], [1, "#E9D8FF"]],
      glow: "rgba(211, 87, 255, 0.34)",
      stroke: "rgba(17, 9, 44, 0.96)",
      strokeWidth: 4,
      paddingX: 0.035,
      visualOffsetY: -32,
    },
    verdictStyle: {
      startSize: 0.054,
      minSize: 0.038,
      maxLines: 2,
      lineHeight: 1.2,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F0FFFF"], [0.45, "#FFD8FF"], [1, "#C0DBFF"]],
      glow: "rgba(205, 90, 255, 0.24)",
      stroke: "rgba(18, 10, 48, 0.95)",
      strokeWidth: 3,
      paddingX: 0.04,
      visualOffsetY: -32,
    },
    chainStyle: {
      startSize: 0.021,
      minSize: 0.017,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#FFF7FF",
      shadowBlur: 6,
    },
    statStyle: {
      startSize: 0.018,
      minSize: 0.013,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F9FFFF"], [1, "#F9C8FF"]],
      glow: "rgba(179, 98, 255, 0.20)",
      stroke: "rgba(15, 10, 42, 0.82)",
      strokeWidth: 2,
    },
    tagStyle: {
      startSize: 0.05,
      minSize: 0.046,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#FDE6FF",
      shadowBlur: 4,
      visualOffsetY: -10,
    },
    chainInline: {
      box: { x: 89, y: 118, w: 92, h: 27 },
      textStyle: { startSize: 0.055, minSize: 0.05, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#FFF7FF" },
      iconSize: 0.055,
      iconGap: 0.038,
      textOffsetY: -25,
    },
    statInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#FFF7FF" },
      iconSize: 0.055,
      iconGap: 0.02,
      textOffsetY: +8 //-43,
    },
    tagInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#FDE6FF" },
      iconSize: 0.055,
      iconGap: 0.015,
      textOffsetY: -12,
    },
  },
  "DeFi Goblin": {
    designWidth: 270,
    designHeight: 647,
    nameBox: { x: 51, y: 71, w: 167, h: 42 },
    chainBox: { x: 89, y: 118, w: 92, h: 27 },
    roastBox: { x: 32, y: 159, w: 205, h: 188 },
    verdictBox: { x: 35, y: 356, w: 200, h: 61 },
    stats: [
      { x: 43, y: 387, w: 71, h: 20 },
      { x: 43, y: 421, w: 71, h: 20 },
      { x: 43, y: 453, w: 71, h: 20 },
      { x: 155, y: 386, w: 71, h: 20 },
      { x: 155, y: 419, w: 71, h: 20 },
      { x: 155, y: 454, w: 71, h: 20 },
    ],
    tags: [
      { x: 18, y: 553, w: 70, h: 20 },
      { x: 104, y: 553, w: 70, h: 20 },
      { x: 182, y: 553, w: 70, h: 20 },
    //  { x: 140, y: 553, w: 27, h: 18 },
    //  { x: 173, y: 553, w: 35, h: 18 },
    ],
    nameStyle: {
      startSize: 0.055,
      minSize: 0.036,
      lineHeight: 1.05,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#E9FFCC"], [0.45, "#9BFF6B"], [1, "#E1B6FF"]],
      glow: "rgba(115, 255, 81, 0.30)",
      stroke: "rgba(18, 10, 32, 0.96)",
      strokeWidth: 4,
      visualOffsetY: -14,
    },
    roastStyle: {
      startSize: 0.069,
      minSize: 0.044,
      maxLines: 4,
      lineHeight: 1.28,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F9FFEF"], [0.42, "#ABFF72"], [1, "#E0B2FF"]],
      glow: "rgba(110, 255, 92, 0.32)",
      stroke: "rgba(18, 10, 34, 0.96)",
      strokeWidth: 4,
      paddingX: 0.035,
      visualOffsetY: -34,
    },
    verdictStyle: {
      startSize: 0.054,
      minSize: 0.038,
      maxLines: 2,
      lineHeight: 1.2,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F7FFD7"], [0.45, "#FFFFFF"], [1, "#D2AFFF"]],
      glow: "rgba(120, 255, 73, 0.22)",
      stroke: "rgba(18, 10, 36, 0.95)",
      strokeWidth: 3,
      paddingX: 0.04,
      visualOffsetY: -37,
    },
    chainStyle: {
      startSize: 0.021,
      minSize: 0.017,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#F9FFEF",
      shadowBlur: 6,
    },
    statStyle: {
      startSize: 0.018,
      minSize: 0.013,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FAFFF3"], [1, "#CFFFB3"]],
      glow: "rgba(118, 255, 81, 0.20)",
      stroke: "rgba(15, 10, 35, 0.82)",
      strokeWidth: 2,
    },
    tagStyle: {
      startSize: 0.05,
      minSize: 0.046,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#E6FFD2",
      shadowBlur: 4,
      visualOffsetY: -10,
    },
    chainInline: {
      box: { x: 89, y: 118, w: 92, h: 27 },
      textStyle: { startSize: 0.055, minSize: 0.05,  lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F9FFEF" },
      iconSize: 0.055,
      iconGap: 0.038,
      textOffsetY: -25,
    },
    statInline: {
      textStyle: { startSize: 0.04, minSize: 0.035,  lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F9FFEF" },
      iconSize: 0.055,
      iconGap: 0.02,
      textOffsetY: +8 //-43,
    },
    tagInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#E6FFD2" },
      iconSize: 0.055,
      iconGap: 0.015,
      textOffsetY: -10,
    },
  },
  "Onchain Civilian": {
    designWidth: 270,
    designHeight: 647,
    nameBox: { x: 51, y: 71, w: 167, h: 42 },
    chainBox: { x: 89, y: 118, w: 92, h: 27 },
    roastBox: { x: 32, y: 159, w: 205, h: 188 },
    verdictBox: { x: 35, y: 356, w: 200, h: 61 },
    stats: [
      { x: 43, y: 387, w: 71, h: 20 },
      { x: 43, y: 421, w: 71, h: 20 },
      { x: 43, y: 453, w: 71, h: 20 },
      { x: 155, y: 386, w: 71, h: 20 },
      { x: 155, y: 419, w: 71, h: 20 },
      { x: 155, y: 454, w: 71, h: 20 },
    ],
    tags: [
      { x: 18, y: 553, w: 70, h: 20 },
      { x: 104, y: 553, w: 70, h: 20 },
      { x: 182, y: 553, w: 70, h: 20 },
    //  { x: 140, y: 553, w: 27, h: 18 },
    //  { x: 173, y: 553, w: 35, h: 18 },
    ],
    nameStyle: {
      startSize: 0.05,
      minSize: 0.031,
      lineHeight: 1.05,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#E7FAFF"], [0.45, "#87C9FF"], [1, "#DAB8FF"]],
      glow: "rgba(87, 158, 255, 0.28)",
      stroke: "rgba(14, 10, 42, 0.96)",
      strokeWidth: 4,
      visualOffsetY: -8,
    },
    roastStyle: {
      startSize: 0.069,
      minSize: 0.044,
      maxLines: 4,
      lineHeight: 1.28,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#FFFFFF"], [0.42, "#A2D6FF"], [1, "#D0B6FF"]],
      glow: "rgba(92, 147, 255, 0.30)",
      stroke: "rgba(14, 10, 42, 0.96)",
      strokeWidth: 4,
      paddingX: 0.035,
      visualOffsetY: -30,
    },
    verdictStyle: {
      startSize: 0.054,
      minSize: 0.038,
      maxLines: 2,
      lineHeight: 1.2,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#EDF9FF"], [0.5, "#FFFFFF"], [1, "#D1BCFF"]],
      glow: "rgba(85, 147, 255, 0.22)",
      stroke: "rgba(15, 10, 44, 0.95)",
      strokeWidth: 3,
      paddingX: 0.04,
      visualOffsetY: -30,
    },
    chainStyle: {
      startSize: 0.021,
      minSize: 0.017,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#F5FBFF",
      shadowBlur: 6,
    },
    statStyle: {
      startSize: 0.028,
      minSize: 0.023,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      gradientStops: [[0, "#F7FEFF"], [1, "#C9D8FF"]],
      glow: "rgba(85, 147, 255, 0.18)",
      stroke: "rgba(12, 10, 38, 0.82)",
      strokeWidth: 2,
    },
    tagStyle: {
      startSize: 0.05,
      minSize: 0.046,
      lineHeight: 1,
      fontFamily: DEFAULT_FONT,
      fill: "#EAF4FF",
      shadowBlur: 4,
      visualOffsetY: -10,
    },
    chainInline: {
      box: { x: 89, y: 118, w: 92, h: 27 },
      textStyle: { startSize: 0.050, minSize: 0.046, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F5FBFF" },
      iconSize: 0.055,
      iconGap: 0.038,
      textOffsetY: -16,
    },
    statInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#F5FBFF" },
      iconSize: 0.055,
      iconGap: 0.02,
      textOffsetY: +8 //-43,
    },
    tagInline: {
      textStyle: { startSize: 0.04, minSize: 0.035, lineHeight: 1, fontFamily: DEFAULT_FONT, fill: "#DFF2FF" },
      iconSize: 0.055,
      iconGap: 0.015,
      textOffsetY: -10,
    },
  },
};

function getThemeLayout(archetype: string): ThemeLayout {
  return THEME_LAYOUTS[archetype] || THEME_LAYOUTS["Bridge Tourist"];
}

function sx(value: number, theme: ThemeLayout, width: number) {
  return Math.round((value / theme.designWidth) * width);
}

function sy(value: number, theme: ThemeLayout, height: number) {
  return Math.round((value / theme.designHeight) * height);
}

function sp(value: number, theme: ThemeLayout, width: number) {
  // Font sizes and small spacing values can still be left as legacy ratios (< 2).
  if (value <= 2) return Math.round(value * width);
  return sx(value, theme, width);
}

function rr(rect: RectPx, theme: ThemeLayout, width: number, height: number) {
  return {
    x: sx(rect.x, theme, width),
    y: sy(rect.y, theme, height),
    w: sx(rect.w, theme, width),
    h: sy(rect.h, theme, height),
  };
}

function applyTextFont(
  ctx: SKRSContext2D,
  style: TextStyle,
  pixelSize: number
) {
  const weight = style.fontWeight || 700;
  ctx.font = `${weight} ${pixelSize}px Inter`;
}

function drawStyledText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
  width: number
) {
  const gradientStops = style.gradientStops;
  if (gradientStops && gradientStops.length > 0) {
    const left = x - width / 2;
    const right = x + width / 2;
    const gradient = ctx.createLinearGradient(left, y, right, y);
    for (const [offset, color] of gradientStops) {
      gradient.addColorStop(offset, color);
    }

    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = style.stroke || "rgba(20, 10, 52, 0.95)";
    ctx.lineWidth = style.strokeWidth || 3;
    ctx.shadowColor = style.glow || "rgba(125, 92, 255, 0.35)";
    ctx.shadowBlur = style.shadowBlur ?? 14;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = gradient;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    return;
  }

  ctx.fillStyle = style.fill || "#F5F1FF";
  ctx.shadowColor = style.glow || "rgba(0,0,0,0.25)";
  ctx.shadowBlur = style.shadowBlur ?? 6;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function drawTextBox(
  ctx: SKRSContext2D,
  text: string,
  box: RectPx,
  style: TextStyle,
  theme: ThemeLayout,
  width: number,
  height: number
) {
  if (!text) return;

  const rect = rr(box, theme, width, height);
  const paddingX = sp(style.paddingX ?? 0.03, theme, width);
  const usableWidth = Math.max(1, rect.w - paddingX * 2);
  const maxLines = style.maxLines ?? 1;

  let fontSize = sp(style.startSize, theme, width);
  const minSize = sp(style.minSize, theme, width);

  applyTextFont(ctx, style, fontSize);
  let lines = wrapTextLines(ctx, text, usableWidth, maxLines);

  while (
    (lines.length > maxLines || lines.some((line) => ctx.measureText(line).width > usableWidth)) &&
    fontSize > minSize
  ) {
    fontSize -= 1;
    applyTextFont(ctx, style, fontSize);
    lines = wrapTextLines(ctx, text, usableWidth, maxLines);
  }

  const lineGap = Math.max(fontSize, Math.round(fontSize * style.lineHeight));
  const totalHeight = lineGap * Math.max(1, lines.length);
  const offsetY = sy(style.visualOffsetY ?? 0, theme, height);
  const startY = rect.y + (rect.h - totalHeight) / 2 + lineGap / 2 + offsetY;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  applyTextFont(ctx, style, fontSize);

  lines.forEach((line, index) => {
    drawStyledText(
      ctx,
      line,
      rect.x + rect.w / 2,
      startY + index * lineGap,
      style,
      Math.max(ctx.measureText(line).width, usableWidth * 0.65)
    );
  });
}

async function drawInlineIconText(
  ctx: SKRSContext2D,
  text: string,
  iconName: string | undefined,
  inline: InlineBoxStyle,
  theme: ThemeLayout,
  width: number,
  height: number
) {
  const rect = rr(inline.box, theme, width, height);
  const style = inline.textStyle;
  const icon = iconName ? await tryLoadIcon(iconName) : null;
  const iconSize = icon && inline.iconSize ? sp(inline.iconSize, theme, width) : 0;
  const iconGap = sp(inline.iconGap ?? 0.007, theme, width);
  const minSize = sp(style.minSize, theme, width);
  let fontSize = sp(style.startSize, theme, width);

  let contentWidth = Infinity;
  while (fontSize >= minSize) {
    applyTextFont(ctx, style, fontSize);
    const textWidth = ctx.measureText(text).width;
    contentWidth = textWidth + (icon ? iconSize + iconGap : 0);
    if (contentWidth <= rect.w * 0.9) break;
    fontSize -= 1;
  }

  applyTextFont(ctx, style, fontSize);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const textWidth = ctx.measureText(text).width;
  const totalWidth = textWidth + (icon ? iconSize + iconGap : 0);
  let startX = rect.x + (rect.w - totalWidth) / 2 + sp(inline.textOffsetX ?? 0, theme, width);
  const centerY = rect.y + rect.h / 2 + sy(inline.textOffsetY ?? 0, theme, height);

  if (icon) {
    ctx.drawImage(icon, startX, centerY - iconSize / 2, iconSize, iconSize);
    startX += iconSize + iconGap;
  }

  drawStyledText(ctx, text, startX, centerY, style, Math.max(textWidth, rect.w * 0.6));
}

async function drawStatText(
  ctx: SKRSContext2D,
  stat: StatItem,
  box: RectPx,
  theme: ThemeLayout,
  width: number,
  height: number
) {
  const rect = rr(box, theme, width, height);
  const style = theme.statInline.textStyle;
  const icon = await tryLoadIcon(stat.icon);
  const iconSize = icon && theme.statInline.iconSize ? sp(theme.statInline.iconSize, theme, width) : 0;
  const iconGap = sp(theme.statInline.iconGap ?? 0.007, theme, width);
  const text = `${stat.label} ${stat.value}`;
  const minSize = sp(style.minSize, theme, width);
  let fontSize = sp(style.startSize, theme, width);

  while (fontSize >= minSize) {
    applyTextFont(ctx, style, fontSize);
    const totalWidth = ctx.measureText(text).width + (icon ? iconSize + iconGap : 0);
    if (totalWidth <= rect.w * 0.9) break;
    fontSize -= 1;
  }

  applyTextFont(ctx, style, fontSize);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const textWidth = ctx.measureText(text).width;
  const totalWidth = textWidth + (icon ? iconSize + iconGap : 0);
  let startX = rect.x + (rect.w - totalWidth) / 2;
  const centerY = rect.y + rect.h / 2 + sy(theme.statInline.textOffsetY ?? 0, theme, height);

  if (icon) {
    ctx.drawImage(icon, startX, centerY - iconSize / 2, iconSize, iconSize);
    startX += iconSize + iconGap;
  }

  drawStyledText(ctx, text, startX, centerY, theme.statStyle, Math.max(textWidth, rect.w * 0.6));
}

async function drawTagText(
  ctx: SKRSContext2D,
  text: string,
  box: RectPx,
  style: TextStyle,
  theme: ThemeLayout,
  width: number,
  height: number
) {
  const rect = rr(box, theme, width, height);
  const iconName = getTagIconName(text);
  const icon = iconName ? await tryLoadTagIcon(iconName) : null;

  // Tag icon sizing now works like statInline:
  // change theme.tagInline.iconSize and theme.tagInline.iconGap per template.
  const tagInline = theme.tagInline;
  const textStyle = tagInline.textStyle ?? style;
  const iconSize = icon ? sp(tagInline.iconSize ?? 0.031, theme, width) : 0;
  const iconGap = icon ? sp(tagInline.iconGap ?? 0.006, theme, width) : 0;
  const textOffsetX = sp(tagInline.textOffsetX ?? 0, theme, width);
  const centerY =
    rect.y +
    rect.h / 2 +
    sy(tagInline.textOffsetY ?? style.visualOffsetY ?? 0, theme, height);

  let fontSize = sp(textStyle.startSize, theme, width);
  const minSize = sp(textStyle.minSize, theme, width);

  while (fontSize >= minSize) {
    applyTextFont(ctx, textStyle, fontSize);
    const textWidth = ctx.measureText(text).width;
    const totalWidth = textWidth + (icon ? iconSize + iconGap : 0);
    if (totalWidth <= rect.w * 0.92) break;
    fontSize -= 1;
  }

  applyTextFont(ctx, textStyle, fontSize);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const textWidth = ctx.measureText(text).width;
  const totalWidth = textWidth + (icon ? iconSize + iconGap : 0);
  let startX = rect.x + (rect.w - totalWidth) / 2 + textOffsetX;

  if (icon) {
    ctx.drawImage(icon, startX, centerY - iconSize / 2, iconSize, iconSize);
    startX += iconSize + iconGap;
  }

  drawStyledText(ctx, text, startX, centerY, textStyle, Math.max(rect.w * 0.6, textWidth));
}

export async function renderCard(data: WalletRoastAnalysis): Promise<Buffer> {
  registerFonts();

  const archetype = data.classification?.archetype || "Bridge Tourist";
  const theme = getThemeLayout(archetype);
  const templatePath = await getSafeTemplatePath(archetype);

  const template = await loadLocalImage(templatePath);
  const width = template.width;
  const height = template.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(template, 0, 0, width, height);

  const displayName = getDisplayName(data);
  const mainRoast = getMainRoastText(data);
  const verdict = getVerdictText(data);
  const tags = getRenderableTags(data);
  const stats = getStats(data);

  drawTextBox(ctx, displayName, theme.nameBox, theme.nameStyle, theme, width, height);
  await drawInlineIconText(ctx, "Base", "base", theme.chainInline, theme, width, height);
  drawTextBox(ctx, mainRoast, theme.roastBox, theme.roastStyle, theme, width, height);
  drawTextBox(ctx, verdict, theme.verdictBox, theme.verdictStyle, theme, width, height);

  for (let i = 0; i < Math.min(stats.length, theme.stats.length); i++) {
    await drawStatText(ctx, stats[i], theme.stats[i], theme, width, height);
  }

  for (let i = 0; i < Math.min(tags.length, theme.tags.length); i++) {
    await drawTagText(ctx, tags[i], theme.tags[i], theme.tagStyle, theme, width, height);
  }

  const png = await canvas.encode("png");
  return Buffer.from(png);
}