// src/app/api/xcup/prophecy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import type {
  WorldCupProphecyCriteria,
  WorldCupProphecyInput,
  WorldCupRiskLevel,
  WorldCupProphecyResult,
} from '../../../../lib/xcup/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REASONING_LINE = 70;

const PROPHECY_CARD_RULES = `

Cookieverse public card readability rules:
- Keep the main prophecy concise: up to 260 characters.
- The prophecy should be one vivid football paragraph about the likely match flow and outcome.
- Do not include sportsbook-style fields in public card text.
- Confidence means pick confidence / prophecy conviction, not exact-score probability.
- exactScoreConfidence is separate and should usually be much lower than confidence.
- Do not display trueMarketProbability, implied odds, or exactScoreConfidence in public card text.
- Preserve research.dominantScenario, research.scoringVolume, research.topScorelines, research.confidenceGovernor, and research.exactScoreVolatility when returned.
- Risk levels must use full words only: Low, Medium, High, Low-Medium, Medium-High.
- Do not use risk abbreviations like L, M, H, LM, or MH.
- Include only relevant risk fields. Do not default every risk to Medium.
- Include optional top-level JSON risk fields only when relevant: drawRisk, upsetRisk, counterAttackRisk, setPieceRisk, cleanSheetRisk, lateGoalRisk, heatFatigueRisk, travelDisruptionRisk, goalkeeperHeroRisk, physicalMismatchRisk.
- Include matching optional top-level reason fields when they add match-specific context.
- Risk reasons must be short public-card phrases, not full sentences.
- Reasoning must contain exactly 2 short lines, each under 70 characters.
`;

function sanitizeKey(raw: string) {
  return (raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function cleanShortLine(value: unknown, fallback = '', max = 68) {
  const text = cleanText(value, fallback)
    .replace(/[•|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fallback;
  if (text.length <= max) return text;

  const sliced = text.slice(0, max - 1).trim();
  const lastSpace = sliced.lastIndexOf(' ');

  if (lastSpace > 35) {
    return `${sliced.slice(0, lastSpace).trim()}…`;
  }

  return `${sliced}…`;
}

function smartTruncate(value: unknown, max: number, fallback = '') {
  const text = cleanText(value, fallback);
  if (text.length <= max) return text;

  const sliced = text.slice(0, max - 3).trim();
  const lastSpace = sliced.lastIndexOf(' ');

  if (lastSpace > Math.floor(max * 0.7)) {
    return `${sliced.slice(0, lastSpace).trim()}...`;
  }

  return `${sliced}...`;
}

function stripInlineRiskSection(value: unknown, fallback = '') {
  const text = cleanText(value, fallback);
  const index = text.toLowerCase().indexOf('risks:');

  return index >= 0 ? text.slice(0, index).trim() : text;
}

function normalizeReasoning(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];

  return arr
    .map((line) => cleanShortLine(line, '', 68))
    .filter(Boolean)
    .slice(0, 2);
}

function clampScore(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeOptionalScore(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeScoringVolume(value: unknown): string | undefined {
  const text = cleanText(value, '');
  if (!text) return undefined;

  const lower = text.toLowerCase();
  if (lower === 'low') return 'Low';
  if (lower === 'medium') return 'Medium';
  if (lower === 'high') return 'High';

  return smartTruncate(text, 32);
}

function normalizeTopScorelines(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;

  const rows = raw
    .map((item, index) => {
      const n = Number((item as any)?.rank);
      const rank = Number.isFinite(n)
        ? Math.max(1, Math.min(3, Math.round(n)))
        : index + 1;

      return {
        rank,
        scoreline: cleanShortLine((item as any)?.scoreline, '', 32),
        shortReason: cleanShortLine((item as any)?.shortReason, '', 96),
      };
    })
    .filter((item) => item.scoreline)
    .slice(0, 3);

  return rows.length ? rows : undefined;
}

function normalizeCriteria(raw: any): WorldCupProphecyCriteria {
  return {
    form: clampScore(raw?.form, 84),
    attack: clampScore(raw?.attack, 86),
    defense: clampScore(raw?.defense, 82),
    momentum: clampScore(raw?.momentum, 88),
    fans: clampScore(raw?.fans, 84),
    confidenceSignal: clampScore(raw?.confidenceSignal, 90),
  };
}

function normalizeRiskLevel(value: unknown): WorldCupRiskLevel | undefined {
  const text = cleanText(value, '').toLowerCase();

  if (text === 'low' || text === 'l') return 'Low';
  if (text === 'medium' || text === 'm') return 'Medium';
  if (text === 'high' || text === 'h') return 'High';
  if (
    text === 'low-medium' ||
    text === 'low/medium' ||
    text === 'low medium' ||
    text === 'lm'
  ) {
    return 'Low-Medium';
  }
  if (
    text === 'medium-high' ||
    text === 'medium/high' ||
    text === 'medium high' ||
    text === 'mh'
  ) {
    return 'Medium-High';
  }

  return undefined;
}

function getRiskField(raw: any, key: string) {
  return raw?.[key] ?? raw?.risks?.[key];
}

function normalizeRiskReason(value: unknown): string | undefined {
  const text = cleanShortLine(value, '', 64).replace(/[.!?]+$/g, '').trim();
  return text || undefined;
}

function extractJson(text: string): any | null {
  const raw = text.trim();

  try {
    return JSON.parse(raw);
  } catch {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeSources(response: any): string[] {
  const output = Array.isArray(response?.output) ? response.output : [];
  const urls = new Set<string>();

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      const annotations = Array.isArray(part?.annotations) ? part.annotations : [];

      for (const ann of annotations) {
        const url = ann?.url || ann?.uri;
        if (typeof url === 'string' && url.startsWith('http')) {
          urls.add(url);
        }
      }
    }
  }

  const sources = Array.isArray(response?.sources) ? response.sources : [];

  for (const source of sources) {
    const url = source?.url || source?.uri;
    if (typeof url === 'string' && url.startsWith('http')) {
      urls.add(url);
    }
  }

  return [...urls].slice(0, 8);
}

function stripInvisibleEnvChars(value: string) {
  return (value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function getPrivateProphecyPromptTemplate() {
  const raw = stripInvisibleEnvChars(process.env.XCUP_PROPHECY_PROMPT_SECRET || '');

  return raw.replace(/\\n/g, '\n').trim();
}

function replacePromptPlaceholders(template: string, input: WorldCupProphecyInput) {
  return template
    .replaceAll('{{HOME_TEAM}}', input.homeTeam)
    .replaceAll('{{AWAY_TEAM}}', input.awayTeam)
    .replaceAll('{{MATCH_DATE}}', input.matchDate);
}

function buildProphecyPrompt(input: WorldCupProphecyInput) {
  const template = getPrivateProphecyPromptTemplate().trim();

  if (!template) {
    throw new Error('Missing XCUP_PROPHECY_PROMPT_SECRET');
  }

  return `${replacePromptPlaceholders(template, input).trim()}${PROPHECY_CARD_RULES}`.trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));

  const input: WorldCupProphecyInput = {
    homeTeam: cleanText(body.homeTeam, ''),
    awayTeam: cleanText(body.awayTeam, ''),
    matchDate: cleanText(body.matchDate || body.kickoff, ''),
  };

  if (!input.homeTeam || !input.awayTeam) {
    return NextResponse.json(
      { error: 'Team 1 and Team 2 are required.' },
      { status: 400 },
    );
  }

  if (!input.matchDate) {
    return NextResponse.json(
      { error: 'Match date is required.' },
      { status: 400 },
    );
  }

  const KEY_NAME = (
    process.env['MFC_OPENAI_KEY_NAME'] || 'OPENAI_API_KEY_MFC_NEW'
  ).trim();

  const raw = (process.env[KEY_NAME] as string | undefined) ?? '';
  const apiKey = sanitizeKey(raw);

  if (!apiKey) {
    return NextResponse.json(
      { error: `OpenAI API key is not configured (${KEY_NAME}).` },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey });

    const prompt = buildProphecyPrompt(input);

    const response = await client.responses.create({
      model: process.env.XCUP_OPENAI_MODEL || 'gpt-5.5',
      tools: [
        {
          type: 'web_search',
          search_context_size: 'medium',
        },
      ],
      tool_choice: 'required',
      input: prompt,
    } as any);

    const parsed = extractJson(response.output_text || '');

    if (!parsed) {
      console.warn('[xcup prophecy] OpenAI returned non-json', response.output_text);
      return NextResponse.json(
        { error: 'OpenAI returned an invalid prophecy response.' },
        { status: 502 },
      );
    }

    const detectedSources = normalizeSources(response);
    const parsedSources = Array.isArray(parsed?.research?.sources)
      ? parsed.research.sources
          .map((x: unknown) => String(x || '').trim())
          .filter((x: string) => x.startsWith('http'))
      : [];

    const criteria = normalizeCriteria(parsed.criteria || {});
    const confidence = normalizeOptionalScore(parsed.confidence);
    const pick = cleanShortLine(parsed.pick, '', 24);
    const scoreline = cleanShortLine(parsed.scoreline, '', 32);
    const prophecy = cleanText(stripInlineRiskSection(parsed.prophecy, ''), '');
    const reasoning = normalizeReasoning(parsed.reasoning);

    if (
      confidence === undefined ||
      !pick ||
      !scoreline ||
      !prophecy ||
      reasoning.length !== 2
    ) {
      return NextResponse.json(
        {
          error:
            'OpenAI prophecy response is missing pick, scoreline, confidence, prophecy, or two reasoning lines.',
        },
        { status: 502 },
      );
    }

    const result: WorldCupProphecyResult = {
      title: cleanText(parsed.title, 'World Cup Match Prophecy'),
      homeTeam: cleanText(parsed.homeTeam, input.homeTeam),
      awayTeam: cleanText(parsed.awayTeam, input.awayTeam),
      matchDate: cleanText(parsed.matchDate, input.matchDate),
      location: cleanText(parsed.location || parsed.research?.location, ''),
      pick,
      scoreline,
      confidence,
      prophecyProbability: normalizeOptionalScore(parsed.prophecyProbability) ?? confidence,
      trueMarketProbability: normalizeOptionalScore(parsed.trueMarketProbability),
      exactScoreConfidence: normalizeOptionalScore(parsed.exactScoreConfidence),
      marketAngle: cleanText(parsed.marketAngle, ''),
      prophecy,
      reasoning,
      research: {
        matchDate: input.matchDate,
        location: cleanText(parsed.research?.location || parsed.location, ''),
        competition: cleanText(parsed.research?.competition, 'World Cup'),
        recentForm: cleanText(parsed.research?.recentForm, ''),
        keyPlayers: cleanText(parsed.research?.keyPlayers, ''),
        injuriesOrSuspensions: cleanText(parsed.research?.injuriesOrSuspensions, ''),
        fanSentiment: cleanText(parsed.research?.fanSentiment, ''),
        tacticalContext: cleanText(parsed.research?.tacticalContext, ''),
        playerHealthContext: cleanText(parsed.research?.playerHealthContext, ''),
        matchFitness: cleanText(parsed.research?.matchFitness, ''),
        publicMarketContext: cleanText(parsed.research?.publicMarketContext, ''),
        marketCloseness: cleanText(parsed.research?.marketCloseness, ''),
        earlyGoalAvalancheRisk: cleanText(parsed.research?.earlyGoalAvalancheRisk, ''),
        strikerConversionCeiling: cleanText(parsed.research?.strikerConversionCeiling, ''),
        opponentCollapseRisk: cleanText(parsed.research?.opponentCollapseRisk, ''),
        gameStateVolatility: cleanText(parsed.research?.gameStateVolatility, ''),
        cleanSheetFragility: cleanText(parsed.research?.cleanSheetFragility, ''),
        goalkeeperResistance: cleanText(parsed.research?.goalkeeperResistance, ''),
        defensiveBlockDurability: cleanText(
          parsed.research?.defensiveBlockDurability,
          '',
        ),
        sterilePossessionRisk: cleanText(parsed.research?.sterilePossessionRisk, ''),
        goalkeeperHeroGameRisk: cleanText(
          parsed.research?.goalkeeperHeroGameRisk,
          '',
        ),
        physicalMismatchRisk: cleanText(parsed.research?.physicalMismatchRisk, ''),
        shotQualityVsShotVolume: cleanText(
          parsed.research?.shotQualityVsShotVolume,
          '',
        ),
        lateSubImpactRisk: cleanText(parsed.research?.lateSubImpactRisk, ''),
        setPieceThreat: cleanText(parsed.research?.setPieceThreat, ''),
        dominantScenario: cleanShortLine(parsed.research?.dominantScenario, '', 64),
        scoringVolume: normalizeScoringVolume(parsed.research?.scoringVolume),
        topScorelines: normalizeTopScorelines(parsed.research?.topScorelines),
        confidenceGovernor: cleanText(parsed.research?.confidenceGovernor, ''),
        exactScoreVolatility: cleanText(parsed.research?.exactScoreVolatility, ''),
        marketAngle: cleanText(parsed.research?.marketAngle || parsed.marketAngle, ''),
        sources: [...new Set([...parsedSources, ...detectedSources])].slice(0, 8),
      },
      criteria,
      drawRisk: normalizeRiskLevel(getRiskField(parsed, 'drawRisk')),
      upsetRisk: normalizeRiskLevel(getRiskField(parsed, 'upsetRisk')),
      counterAttackRisk: normalizeRiskLevel(getRiskField(parsed, 'counterAttackRisk')),
      setPieceRisk: normalizeRiskLevel(getRiskField(parsed, 'setPieceRisk')),
      cleanSheetRisk: normalizeRiskLevel(getRiskField(parsed, 'cleanSheetRisk')),
      lateGoalRisk: normalizeRiskLevel(getRiskField(parsed, 'lateGoalRisk')),
      heatFatigueRisk: normalizeRiskLevel(getRiskField(parsed, 'heatFatigueRisk')),
      travelDisruptionRisk: normalizeRiskLevel(getRiskField(parsed, 'travelDisruptionRisk')),
      goalkeeperHeroRisk: normalizeRiskLevel(getRiskField(parsed, 'goalkeeperHeroRisk')),
      physicalMismatchRisk: normalizeRiskLevel(
        getRiskField(parsed, 'physicalMismatchRisk'),
      ),
      drawRiskReason: normalizeRiskReason(getRiskField(parsed, 'drawRiskReason')),
      upsetRiskReason: normalizeRiskReason(getRiskField(parsed, 'upsetRiskReason')),
      counterAttackRiskReason: normalizeRiskReason(
        getRiskField(parsed, 'counterAttackRiskReason'),
      ),
      setPieceRiskReason: normalizeRiskReason(getRiskField(parsed, 'setPieceRiskReason')),
      cleanSheetRiskReason: normalizeRiskReason(
        getRiskField(parsed, 'cleanSheetRiskReason'),
      ),
      lateGoalRiskReason: normalizeRiskReason(getRiskField(parsed, 'lateGoalRiskReason')),
      heatFatigueRiskReason: normalizeRiskReason(
        getRiskField(parsed, 'heatFatigueRiskReason'),
      ),
      travelDisruptionRiskReason: normalizeRiskReason(
        getRiskField(parsed, 'travelDisruptionRiskReason'),
      ),
      goalkeeperHeroRiskReason: normalizeRiskReason(
        getRiskField(parsed, 'goalkeeperHeroRiskReason'),
      ),
      physicalMismatchRiskReason: normalizeRiskReason(
        getRiskField(parsed, 'physicalMismatchRiskReason'),
      ),
    };

    result.reasoning = result.reasoning.map((line) =>
      smartTruncate(line, MAX_REASONING_LINE),
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[xcup prophecy] OpenAI web research failed', error);

    if (message.includes('Missing XCUP_PROPHECY_PROMPT_SECRET')) {
      return NextResponse.json(
        { error: 'World Cup prophecy prompt is not configured.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: `OpenAI prophecy failed: ${message}` },
      { status: 502 },
    );
  }
}
