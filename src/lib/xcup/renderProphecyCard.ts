// src/lib/xcup/renderProphecyCard.ts
import 'server-only';

import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type SKRSContext2D,
} from '@napi-rs/canvas';

import type { WorldCupProphecyCardInput } from './types';

const DEFAULT_FONT = 'Inter';

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;

  const fontDir = path.join(process.cwd(), 'public', 'fonts');

  for (const file of ['Inter-Regular.ttf', 'Inter-SemiBold.ttf', 'Inter-Bold.ttf']) {
    try {
      GlobalFonts.registerFromPath(path.join(fontDir, file), DEFAULT_FONT);
    } catch (error) {
      console.warn('world cup font registration failed', {
        file,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  fontsRegistered = true;
}

type RectPx = { x: number; y: number; w: number; h: number };

type TextStyle = {
  startSizePx: number;
  minSizePx: number;
  lineHeight: number;
  maxLines?: number;
  weight?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  glow?: string;
  shadowBlur?: number;
  paddingX?: number;
  visualOffsetY?: number;
  align?: CanvasTextAlign;
};

type CriterionBox = {
  valueBox: RectPx;
  labelBox: RectPx;
};

type ThemeLayout = {
  designWidth: number;
  designHeight: number;
  templateFile: string;

  homeTeamBox: RectPx;
  awayTeamBox: RectPx;
  dateBox: RectPx;

  summaryBox: RectPx;
  prophecyBox: RectPx;
  reasoningBox: RectPx;

  criteria: CriterionBox[];
  footerBox: RectPx;

  teamStyle: TextStyle;
  dateStyle: TextStyle;
  summaryStyle: TextStyle;
  prophecyStyle: TextStyle;
  reasoningStyle: TextStyle;
  criteriaValueStyle: TextStyle;
  criteriaLabelStyle: TextStyle;
  footerStyle: TextStyle;
};

const THEME_LAYOUTS: Record<string, ThemeLayout> = {
 worldCup: {
    designWidth: 1122,
    designHeight: 1402,
    templateFile: 'world-cup-prophecy-template.png',

    homeTeamBox: { x: 125, y: 382, w: 315, h: 44 },
    awayTeamBox: { x: 682, y: 382, w: 315, h: 44 },

    dateBox: { x: 423, y: 522, w: 276, h: 26 },

    summaryBox: { x: 112, y: 575, w: 898, h: 54 },
    prophecyBox: { x: 112, y: 660, w: 898, h: 205 },
    reasoningBox: { x: 112, y: 895, w: 898, h: 48 },

    criteria: [
    { valueBox: { x: 84,  y: 1170, w: 120, h: 32 }, labelBox: { x: 84,  y: 1221, w: 120, h: 20 } },
    { valueBox: { x: 252, y: 1170, w: 120, h: 32 }, labelBox: { x: 252, y: 1221, w: 120, h: 20 } },
    { valueBox: { x: 418, y: 1170, w: 120, h: 32 }, labelBox: { x: 418, y: 1221, w: 120, h: 20 } },
    { valueBox: { x: 588, y: 1170, w: 120, h: 32 }, labelBox: { x: 588, y: 1221, w: 120, h: 20 } },
    { valueBox: { x: 755, y: 1170, w: 120, h: 32 }, labelBox: { x: 755, y: 1221, w: 120, h: 20 } },
    { valueBox: { x: 922, y: 1170, w: 120, h: 32 }, labelBox: { x: 922, y: 1221, w: 120, h: 20 } },
    ],

    footerBox: { x: 320, y: 1370, w: 482, h: 20 },

    teamStyle: {
    startSizePx: 28,
    minSizePx: 16,
    lineHeight: 1,
    weight: 900,
    fill: '#111827',
    stroke: 'rgba(255,255,255,0.35)',
    strokeWidth: 2,
    maxLines: 1,
    paddingX: 10,
    visualOffsetY: 0,
    },

    dateStyle: {
    startSizePx: 14,
    minSizePx: 10,
    lineHeight: 1,
    weight: 900,
    fill: '#facc15',
    stroke: 'rgba(0,0,0,0.9)',
    strokeWidth: 3,
    maxLines: 1,
    paddingX: 8,
    visualOffsetY: 0,
    },

    summaryStyle: {
      startSizePx: 24,
      minSizePx: 16,
      lineHeight: 1.08,
      weight: 900,
      fill: '#2b1d05',
      stroke: 'rgba(255,255,255,0.18)',
      strokeWidth: 1,
      maxLines: 1,
      paddingX: 18,
    },

    prophecyStyle: {
      startSizePx: 23,
      minSizePx: 13,
      lineHeight: 1.25,
      weight: 800,
      fill: '#2b1d05',
      stroke: 'rgba(255,255,255,0.14)',
      strokeWidth: 1,
      maxLines: 5,
      paddingX: 34,
    },

    reasoningStyle: {
      startSizePx: 21,
      minSizePx: 16,
      lineHeight: 1.18,
      weight: 700,
      fill: '#5a3b11',
      stroke: 'rgba(255,255,255,0.14)',
      strokeWidth: 1,
      maxLines: 2,
      paddingX: 24,
    },

    criteriaValueStyle: {
    startSizePx: 22,
    minSizePx: 16,
    lineHeight: 1,
    weight: 900,
    fill: '#fde68a',
    stroke: 'rgba(0,0,0,0.92)',
    strokeWidth: 3,
    maxLines: 1,
    paddingX: 2,
    visualOffsetY: 0,
    },

    criteriaLabelStyle: {
    startSizePx: 10,
    minSizePx: 8,
    lineHeight: 1,
    weight: 900,
    fill: '#ffffff',
    stroke: 'rgba(0,0,0,0.92)',
    strokeWidth: 2,
    maxLines: 1,
    paddingX: 2,
    visualOffsetY: 0,
    },

    footerStyle: {
    startSizePx: 9,
    minSizePx: 7,
    lineHeight: 1,
    weight: 800,
    fill: '#fde68a',
    stroke: 'rgba(0,0,0,0.92)',
    strokeWidth: 2,
    maxLines: 1,
    paddingX: 4,
    visualOffsetY: 0,
    },
},
};

function scaleRect(rect: RectPx, layout: ThemeLayout): RectPx {
  return rect;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function shortAddress(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatMatchDate(value: string) {
  const raw = cleanText(value);
  if (!raw) return 'MATCH DATE';

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.toUpperCase();

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
    .format(d)
    .toUpperCase();
}

type WorldCupTeamOption = {
  name: string;
  code: string;
  aliases: string[];
};

const WORLD_CUP_TEAM_OPTIONS: WorldCupTeamOption[] = [
  { name: 'Argentina', code: 'ar', aliases: ['arg', 'argentina', 'albiceleste', 'messi'] },
  { name: 'Australia', code: 'au', aliases: ['aus', 'australia', 'socceroos'] },
  { name: 'Austria', code: 'at', aliases: ['aut', 'austria', 'österreich', 'osterreich'] },
  { name: 'Belgium', code: 'be', aliases: ['bel', 'belgium', 'red devils'] },
  { name: 'Bosnia and Herzegovina', code: 'ba', aliases: ['bih', 'bosnia', 'bosnia and herzegovina', 'bosnia-herzegovina'] },
  { name: 'Brazil', code: 'br', aliases: ['bra', 'brazil', 'brasil', 'seleção', 'selecao'] },
  { name: 'Cabo Verde', code: 'cv', aliases: ['cpv', 'cabo verde', 'cape verde'] },
  { name: 'Canada', code: 'ca', aliases: ['can', 'canada'] },
  { name: 'Colombia', code: 'co', aliases: ['col', 'colombia', 'cafeteros'] },
  { name: 'Congo DR', code: 'cd', aliases: ['cod', 'congo dr', 'dr congo', 'drc', 'democratic republic of congo', 'congo'] },
  { name: "Côte d'Ivoire", code: 'ci', aliases: ['civ', "côte d'ivoire", 'cote divoire', 'ivory coast'] },
  { name: 'Croatia', code: 'hr', aliases: ['cro', 'croatia', 'hrvatska'] },
  { name: 'Curaçao', code: 'cw', aliases: ['cuw', 'curaçao', 'curacao'] },
  { name: 'Czechia', code: 'cz', aliases: ['cze', 'czechia', 'czech republic'] },
  { name: 'Ecuador', code: 'ec', aliases: ['ecu', 'ecuador'] },
  { name: 'Egypt', code: 'eg', aliases: ['egy', 'egypt', 'pharaohs', 'salah'] },
  { name: 'England', code: 'gb-eng', aliases: ['eng', 'england', 'three lions'] },
  { name: 'France', code: 'fr', aliases: ['fra', 'france', 'les bleus', 'mbappe', 'mbappé'] },
  { name: 'Germany', code: 'de', aliases: ['ger', 'germany', 'deutschland', 'mannschaft'] },
  { name: 'Ghana', code: 'gh', aliases: ['gha', 'ghana', 'black stars'] },
  { name: 'Haiti', code: 'ht', aliases: ['hai', 'haiti', 'grenadiers'] },
  { name: 'IR Iran', code: 'ir', aliases: ['irn', 'iran', 'ir iran', 'team melli'] },
  { name: 'Iraq', code: 'iq', aliases: ['irq', 'iraq'] },
  { name: 'Japan', code: 'jp', aliases: ['jpn', 'japan', 'samurai blue'] },
  { name: 'Jordan', code: 'jo', aliases: ['jor', 'jordan'] },
  { name: 'Korea Republic', code: 'kr', aliases: ['kor', 'korea republic', 'south korea', 'korea', 'taeguk warriors'] },
  { name: 'Mexico', code: 'mx', aliases: ['mex', 'mexico', 'méxico', 'el tri'] },
  { name: 'Morocco', code: 'ma', aliases: ['mar', 'morocco', 'atlas lions'] },
  { name: 'Netherlands', code: 'nl', aliases: ['ned', 'netherlands', 'holland', 'oranje'] },
  { name: 'New Zealand', code: 'nz', aliases: ['nzl', 'new zealand', 'all whites'] },
  { name: 'Norway', code: 'no', aliases: ['nor', 'norway', 'haaland'] },
  { name: 'Panama', code: 'pa', aliases: ['pan', 'panama', 'panamá'] },
  { name: 'Paraguay', code: 'py', aliases: ['par', 'paraguay'] },
  { name: 'Portugal', code: 'pt', aliases: ['por', 'portugal', 'cristiano', 'ronaldo'] },
  { name: 'Qatar', code: 'qa', aliases: ['qat', 'qatar'] },
  { name: 'Saudi Arabia', code: 'sa', aliases: ['ksa', 'saudi', 'saudi arabia'] },
  { name: 'Scotland', code: 'gb-sct', aliases: ['sco', 'scotland'] },
  { name: 'Senegal', code: 'sn', aliases: ['sen', 'senegal', 'teranga lions'] },
  { name: 'South Africa', code: 'za', aliases: ['rsa', 'south africa', 'bafana bafana'] },
  { name: 'Spain', code: 'es', aliases: ['esp', 'spain', 'españa', 'la roja'] },
  { name: 'Sweden', code: 'se', aliases: ['swe', 'sweden', 'sverige'] },
  { name: 'Switzerland', code: 'ch', aliases: ['sui', 'switzerland', 'swiss'] },
  { name: 'Tunisia', code: 'tn', aliases: ['tun', 'tunisia'] },
  { name: 'Türkiye', code: 'tr', aliases: ['tur', 'turkey', 'türkiye', 'turkiye'] },
  { name: 'Uruguay', code: 'uy', aliases: ['uru', 'uruguay', 'la celeste'] },
  { name: 'USA', code: 'us', aliases: ['usa', 'united states', 'usmnt', 'america'] },
  { name: 'Uzbekistan', code: 'uz', aliases: ['uzb', 'uzbekistan'] },
];

function normalizeWorldCupSearchText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[⚽🏆🏴]/gu, '')
    .replace(/\b[A-Z]{2}\s+/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9\s.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripWorldCupFlag(value: string) {
  return String(value || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[⚽🏆🏴]/gu, '')
    .replace(/\b[A-Z]{2}\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findWorldCupTeam(value: string) {
  const clean = normalizeWorldCupSearchText(stripWorldCupFlag(value));
  if (!clean) return undefined;

  return WORLD_CUP_TEAM_OPTIONS.find((team) => {
    const name = normalizeWorldCupSearchText(team.name);
    if (name === clean) return true;
    return team.aliases.some((alias) => normalizeWorldCupSearchText(alias) === clean);
  });
}

function escapeRegExp(value: string) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const flagImageCache = new Map<string, Promise<any | null>>();

async function loadFlagImage(code: string) {
  if (!code) return null;

  const cached = flagImageCache.get(code);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch(`https://flagcdn.com/w80/${code}.png`, {
          cache: 'force-cache',
          signal: controller.signal,
        });

        if (!res.ok) return null;

        const bytes = Buffer.from(await res.arrayBuffer());
        return await loadImage(bytes);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.warn('world cup flag load failed', {
        code,
        message: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  })();

  flagImageCache.set(code, promise);
  return promise;
}

async function drawTeamBoxWithFlag(
  ctx: SKRSContext2D,
  rawTeam: string,
  rect: RectPx,
  style: TextStyle,
  canvasWidth: number,
) {
  const clean = stripWorldCupFlag(cleanText(rawTeam, 'TEAM'));
  const team = findWorldCupTeam(clean);
  const name = (team?.name || clean || 'TEAM').toUpperCase();
  const flag = team ? await loadFlagImage(team.code) : null;

  if (!flag) {
    drawTextBox(ctx, name, rect, style, canvasWidth);
    return;
  }

  const box = rect;
  const paddingX = style.paddingX ?? 0;
  const maxWidth = Math.max(10, box.w - paddingX * 2);
  const flagW = 42;
  const flagH = 28;
  const gap = 12;

  let sizePx = style.startSizePx;
  let px = setFont(ctx, style, sizePx);

  while (sizePx > style.minSizePx) {
    px = setFont(ctx, style, sizePx);
    const textW = ctx.measureText(name).width;
    const groupW = flagW + gap + textW;
    if (groupW <= maxWidth && px * style.lineHeight <= box.h) break;
    sizePx -= 1;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const textW = ctx.measureText(name).width;
  const groupW = flagW + gap + textW;
  const startX = box.x + box.w / 2 - groupW / 2;
  const centerY = box.y + box.h / 2 + (style.visualOffsetY ?? 0);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6;
  ctx.drawImage(flag, startX, centerY - flagH / 2, flagW, flagH);
  ctx.restore();

  const textX = startX + flagW + gap;

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  if (style.stroke) {
    ctx.lineWidth = style.strokeWidth ?? 2;
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(name, textX, centerY);
  }

  ctx.fillStyle = style.fill ?? '#ffffff';
  ctx.fillText(name, textX, centerY);

  ctx.restore();
}

function safeFontWeight(weight?: number) {
  const w = Number(weight ?? 800);
  if (!Number.isFinite(w)) return 800;

  // Canvas/CSS supports 100-900. Do not use 950.
  return Math.max(100, Math.min(900, Math.round(w / 100) * 100));
}

function setFont(ctx: SKRSContext2D, style: TextStyle, sizePx: number) {
  const px = Math.max(1, Math.round(sizePx));
  const weight = safeFontWeight(style.weight);

  ctx.font = `${weight} ${px}px ${DEFAULT_FONT}, Arial, sans-serif`;

  return px;
}

function wrapLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines = 999,
) {
  const paragraphs = String(text || '').split(/\n+/g);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      lines.push('');
      if (lines.length >= maxLines) break;
      continue;
    }

    let line = words[0];

    for (let i = 1; i < words.length; i += 1) {
      const next = `${line} ${words[i]}`;
      const width = ctx.measureText(next).width;

      if (width <= maxWidth) {
        line = next;
      } else {
        lines.push(line);
        if (lines.length >= maxLines) return lines.slice(0, maxLines);
        line = words[i];
      }
    }

    lines.push(line);
    if (lines.length >= maxLines) return lines.slice(0, maxLines);
  }

  return lines.slice(0, maxLines);
}

function drawTextBox(
  ctx: SKRSContext2D,
  rawText: string,
  rect: RectPx,
  style: TextStyle,
  _canvasWidth: number,
) {
  const text = cleanText(rawText);
  if (!text) return;

  const box = rect;
  const maxLines = style.maxLines ?? 1;
  const paddingX = style.paddingX ?? 0;
  const maxWidth = Math.max(10, box.w - paddingX * 2);

  let sizePx = style.startSizePx;
  let px = setFont(ctx, style, sizePx);
  let lines = wrapLines(ctx, text, maxWidth, maxLines);

  while (sizePx > style.minSizePx) {
    px = setFont(ctx, style, sizePx);
    lines = wrapLines(ctx, text, maxWidth, maxLines);

    const tooTall = lines.length * px * style.lineHeight > box.h;
    const tooWide = lines.some((line) => ctx.measureText(line).width > maxWidth);

    if (!tooTall && !tooWide) break;

    sizePx -= 1;
  }

  ctx.save();

  // Critical: prevent any text from escaping its assigned zone.
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();

  ctx.textAlign = style.align ?? 'center';
  ctx.textBaseline = 'middle';

  const totalHeight = lines.length * px * style.lineHeight;

  let y =
    box.y +
    box.h / 2 -
    totalHeight / 2 +
    (px * style.lineHeight) / 2 +
    (style.visualOffsetY ?? 0);

  const x =
    ctx.textAlign === 'left'
      ? box.x + paddingX
      : ctx.textAlign === 'right'
        ? box.x + box.w - paddingX
        : box.x + box.w / 2;

  for (const line of lines) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (style.stroke) {
      ctx.lineWidth = style.strokeWidth ?? 2;
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(line, x, y);
    }

    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = style.shadowBlur ?? 10;
    }

    ctx.fillStyle = style.fill ?? '#ffffff';
    ctx.fillText(line, x, y);

    y += px * style.lineHeight;
  }

  ctx.restore();
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const JPEG_SIGNATURE_A = Buffer.from([0xff, 0xd8, 0xff]);

function isPng(buffer: Buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isJpeg(buffer: Buffer) {
  return (
    buffer.length >= 3 &&
    buffer.subarray(0, 3).equals(JPEG_SIGNATURE_A)
  );
}

function startsWithText(buffer: Buffer, text: string) {
  return buffer
    .subarray(0, Math.min(buffer.length, text.length + 20))
    .toString('utf8')
    .trimStart()
    .toLowerCase()
    .startsWith(text.toLowerCase());
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

    const type = input.toString('ascii', typeStart, typeStart + 4);

    // Keep critical chunks only:
    // IHDR, PLTE, IDAT, IEND.
    // Keep tRNS for transparent palette PNGs.
    const isCriticalChunk = type[0] >= 'A' && type[0] <= 'Z';
    const shouldKeep = isCriticalChunk || type === 'tRNS';

    if (shouldKeep) {
      chunks.push(input.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;

    if (type === 'IEND') break;
  }

  return Buffer.concat(chunks);
}

async function loadLocalImage(filePath: string) {
  const rawBytes = await fs.readFile(filePath);
  const bytes = Buffer.from(rawBytes);

  if (startsWithText(bytes, '<svg')) {
    throw new Error(
      `Template is SVG, not PNG: ${filePath}. Export it from Canva as PNG and replace the file.`,
    );
  }

  if (startsWithText(bytes, '<!doctype') || startsWithText(bytes, '<html')) {
    throw new Error(
      `Template is HTML, not PNG: ${filePath}. You probably saved a webpage/download response instead of the image.`,
    );
  }

  if (!isPng(bytes) && !isJpeg(bytes)) {
    const signature = bytes.subarray(0, 16).toString('hex');
    throw new Error(
      `Unsupported template image format for ${filePath}. Expected PNG or JPEG. First bytes: ${signature}`,
    );
  }

  const safeBytes = isPng(bytes) ? stripPngMetadata(bytes) : bytes;

  try {
    return await loadImage(safeBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Image decode failed for ${filePath}: ${message}. Re-export the template as a clean PNG.`,
    );
  }
}

async function loadTemplate(templateFile: string) {
  const filePath = path.join(process.cwd(), 'public', 'xcup', templateFile);
  return loadLocalImage(filePath);
}

function drawDebugBox(ctx: SKRSContext2D, rect: RectPx, label: string) {
  if (process.env.XCUP_RENDER_DEBUG_BOXES !== '1') return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,0,0,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  ctx.font = '700 14px Arial';
  ctx.fillStyle = 'red';
  ctx.fillText(label, rect.x + 4, rect.y + 16);
  ctx.restore();
}

function drawGoldDivider(
  ctx: SKRSContext2D,
  y: number,
  options?: {
    x?: number;
    w?: number;
    centerDiamond?: boolean;
    alpha?: number;
  },
) {
  const x = options?.x ?? 160;
  const w = options?.w ?? 802;
  const alpha = options?.alpha ?? 0.72;
  const centerDiamond = options?.centerDiamond ?? true;

  const centerX = x + w / 2;
  const leftEnd = centerDiamond ? centerX - 16 : x + w;
  const rightStart = centerDiamond ? centerX + 16 : centerX;

  ctx.save();

  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.4;

  const gradLeft = ctx.createLinearGradient(x, y, leftEnd, y);
  gradLeft.addColorStop(0, 'rgba(90,58,14,0)');
  gradLeft.addColorStop(0.18, 'rgba(130,88,24,0.55)');
  gradLeft.addColorStop(1, 'rgba(184,132,42,0.9)');

  ctx.strokeStyle = gradLeft;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(leftEnd, y);
  ctx.stroke();

  const gradRight = ctx.createLinearGradient(rightStart, y, x + w, y);
  gradRight.addColorStop(0, 'rgba(184,132,42,0.9)');
  gradRight.addColorStop(0.82, 'rgba(130,88,24,0.55)');
  gradRight.addColorStop(1, 'rgba(90,58,14,0)');

  ctx.strokeStyle = gradRight;
  ctx.beginPath();
  ctx.moveTo(rightStart, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();

  if (centerDiamond) {
    ctx.fillStyle = 'rgba(129,83,22,0.72)';
    ctx.strokeStyle = 'rgba(245,197,92,0.58)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(centerX, y - 6);
    ctx.lineTo(centerX + 6, y);
    ctx.lineTo(centerX, y + 6);
    ctx.lineTo(centerX - 6, y);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,231,142,0.82)';
    ctx.beginPath();
    ctx.arc(centerX, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export async function renderWorldCupProphecyCard(
  input: WorldCupProphecyCardInput,
): Promise<Buffer> {
  registerFonts();

  const layout = THEME_LAYOUTS.worldCup;

  const canvas = createCanvas(layout.designWidth, layout.designHeight);
  const ctx = canvas.getContext('2d');

  const template = await loadTemplate(layout.templateFile);
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  const rawHome = stripWorldCupFlag(cleanText(input.homeTeam, 'HOME'));
  const rawAway = stripWorldCupFlag(cleanText(input.awayTeam, 'AWAY'));

  const homeTeam = findWorldCupTeam(rawHome);
  const awayTeam = findWorldCupTeam(rawAway);

  const home = (homeTeam?.name || rawHome || 'HOME').toUpperCase();
  const away = (awayTeam?.name || rawAway || 'AWAY').toUpperCase();
  const date = formatMatchDate(input.matchDate);

  const pick = cleanText(input.pick, 'TOO CLOSE TO CALL').toUpperCase();
  const scoreline = cleanText(input.scoreline, '1-1').toUpperCase();
  const confidence = Math.max(0, Math.min(100, Math.round(Number(input.confidence) || 50)));

  const compactScoreline = scoreline
    .replace(new RegExp(escapeRegExp(home), 'gi'), '')
    .replace(new RegExp(escapeRegExp(away), 'gi'), '')
    .replace(new RegExp(escapeRegExp(rawHome), 'gi'), '')
    .replace(new RegExp(escapeRegExp(rawAway), 'gi'), '')
    .replace(/\s+/g, ' ')
    .trim();

  const safeScoreline = compactScoreline || scoreline;

  const summary = `PICK: ${pick}  •  SCORE: ${safeScoreline}  •  CONFIDENCE: ${confidence}%`;

  const reasoningLines = Array.isArray(input.reasoning)
    ? input.reasoning
        .map((x) => cleanText(x))
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => (x.length > 82 ? `${x.slice(0, 79).trim()}…` : x))
    : [];

  const reasoning = reasoningLines.length
    ? reasoningLines.join(' • ')
    : 'Form edge • Momentum signal • Big-match mentality';

  const criteria = [
    ['FORM', input.criteria.form],
    ['ATTACK', input.criteria.attack],
    ['DEFENSE', input.criteria.defense],
    ['MOMENTUM', input.criteria.momentum],
    ['FANS', input.criteria.fans],
    ['CONF', confidence],
  ] as const;

await drawTeamBoxWithFlag(ctx, home, scaleRect(layout.homeTeamBox, layout), layout.teamStyle, canvas.width);
await drawTeamBoxWithFlag(ctx, away, scaleRect(layout.awayTeamBox, layout), layout.teamStyle, canvas.width);
  drawTextBox(ctx, date, scaleRect(layout.dateBox, layout), layout.dateStyle, canvas.width);

  drawTextBox(
    ctx,
    summary,
    scaleRect(layout.summaryBox, layout),
    layout.summaryStyle,
    canvas.width,
  );

  // Line between summary and prophecy
  drawGoldDivider(ctx, 640, {
    x: 170,
    w: 782,
    centerDiamond: true,
    alpha: 0.68,
  });

  drawTextBox(
    ctx,
    input.prophecy,
    scaleRect(layout.prophecyBox, layout),
    layout.prophecyStyle,
    canvas.width,
  );

  // Line between prophecy and reasoning
  drawGoldDivider(ctx, 875, {
    x: 170,
    w: 782,
    centerDiamond: true,
    alpha: 0.68,
  });

  if (reasoning) {
    drawTextBox(
      ctx,
      reasoning,
      scaleRect(layout.reasoningBox, layout),
      layout.reasoningStyle,
      canvas.width,
    );
  }

  layout.criteria.forEach((box, index) => {
    const item = criteria[index];
    if (!item) return;

    drawTextBox(
    ctx,
    `${Math.round(Number(item[1]) || 0)}`,
    box.valueBox,
    layout.criteriaValueStyle,
    canvas.width,
    );

    drawTextBox(
      ctx,
      item[0],
      box.labelBox,
      layout.criteriaLabelStyle,
      canvas.width,
    );
  });

  const footer = input.mintedBy
    ? `COOKIEVERSE WORLD CUP PROPHECY • ${shortAddress(input.mintedBy)}`
    : 'COOKIEVERSE WORLD CUP PROPHECY';

  drawTextBox(ctx, footer, scaleRect(layout.footerBox, layout), layout.footerStyle, canvas.width);

  drawDebugBox(ctx, layout.homeTeamBox, 'homeTeam');
  drawDebugBox(ctx, layout.awayTeamBox, 'awayTeam');
  drawDebugBox(ctx, layout.dateBox, 'date');
  drawDebugBox(ctx, layout.summaryBox, 'summary');
  drawDebugBox(ctx, layout.prophecyBox, 'prophecy');
  drawDebugBox(ctx, layout.reasoningBox, 'reasoning');
  drawDebugBox(ctx, layout.footerBox, 'footer');

  layout.criteria.forEach((c, i) => {
    drawDebugBox(ctx, c.valueBox, `c${i} value`);
    drawDebugBox(ctx, c.labelBox, `c${i} label`);
  });

  return canvas.toBuffer('image/png');
}