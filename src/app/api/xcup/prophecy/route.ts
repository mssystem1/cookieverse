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

const MAX_MAIN_PROPHECY = 260;
const MAX_REASONING_LINE = 70;

const PROPHECY_CARD_RULES = `

Cookieverse public card readability rules:
- Keep prophecy concise: 180-220 characters.
- The prophecy should be one vivid football paragraph about the highly likely match flow and outcome.
- Return risk levels as JSON fields using full words only: Low, Medium, High, Low-Medium, Medium-High.
- Do not use risk abbreviations like L, M, H, LM, or MH.
- Include these optional top-level JSON fields when relevant: drawRisk, upsetRisk, counterAttackRisk, setPieceRisk, cleanSheetRisk, lateGoalRisk, heatFatigueRisk, travelDisruptionRisk.
- Reasoning must contain exactly 2 short lines, each under 70 characters.
- Keep confidence visible and outcome-focused.
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

function normalizeReasoning(raw: any, fallback: string[]): [string, string] {
  const arr = Array.isArray(raw) ? raw : [];

  const first = cleanShortLine(
    arr[0],
    fallback[0] || 'Historical signals shape the prophecy.',
    68,
  );

  const second = cleanShortLine(
    arr[1],
    fallback[1] || 'Momentum and pressure decide the edge.',
    68,
  );

  return [first, second];
}

function clampScore(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
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

function normalizeProphecyConfidence(params: {
  rawConfidence: unknown;
  criteria: WorldCupProphecyCriteria;
  pick: unknown;
}): number {
  const { rawConfidence, criteria, pick } = params;

  const raw = clampScore(rawConfidence, 90);

  const criteriaAvg = Math.round(
    (
      criteria.form +
      criteria.attack +
      criteria.defense +
      criteria.momentum +
      criteria.fans +
      criteria.confidenceSignal
    ) / 6,
  );

  const pickText = cleanText(pick, '').toLowerCase();

  const maxConfidence = pickText === 'draw' ? 91 : 94;
  const minConfidence = pickText === 'draw' ? 86 : 89;

  const blended = Math.round(raw * 0.55 + criteriaAvg * 0.45);

  return Math.max(minConfidence, Math.min(maxConfidence, blended));
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

function fallbackResult(input: WorldCupProphecyInput): WorldCupProphecyResult {
  const criteria: WorldCupProphecyCriteria = {
    form: 84,
    attack: 86,
    defense: 82,
    momentum: 88,
    fans: 84,
    confidenceSignal: 89,
  };

  return {
    title: 'World Cup Match Prophecy',
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    matchDate: input.matchDate,
    location: '',
    pick: 'Too close to call',
    scoreline: '1-1',
    confidence: 89,
    prophecy:
      `${input.homeTeam} and ${input.awayTeam} enter a pressure match where one momentum swing can change the story. Expect a tight game, emotional turns, and a late moment that decides the prophecy.`,
    reasoning: [
      'Historical signal is incomplete.',
      'Momentum and pressure keep it tight.',
    ],
    research: {
      matchDate: input.matchDate,
      competition: 'World Cup',
      recentForm: 'Fallback mode: OpenAI web research unavailable or failed.',
      keyPlayers: '',
      injuriesOrSuspensions: '',
      fanSentiment: '',
      tacticalContext: '',
      sources: [],
    },
    criteria,
    drawRisk: 'Medium',
    upsetRisk: 'Medium',
    counterAttackRisk: 'Medium',
    setPieceRisk: 'Medium',
    cleanSheetRisk: 'Medium',
  };
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

  const fallback = fallbackResult(input);

  const KEY_NAME = (
    process.env['MFC_OPENAI_KEY_NAME'] || 'OPENAI_API_KEY_MFC_NEW'
  ).trim();

  const raw = (process.env[KEY_NAME] as string | undefined) ?? '';
  const apiKey = sanitizeKey(raw);

  if (!apiKey) {
    return NextResponse.json(fallback);
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
      return NextResponse.json(fallback);
    }

    const detectedSources = normalizeSources(response);
    const parsedSources = Array.isArray(parsed?.research?.sources)
      ? parsed.research.sources
          .map((x: unknown) => String(x || '').trim())
          .filter((x: string) => x.startsWith('http'))
      : [];

    const criteria = normalizeCriteria(parsed.criteria || {});
    const confidence = normalizeProphecyConfidence({
      rawConfidence: parsed.confidence,
      criteria,
      pick: parsed.pick,
    });

    criteria.confidenceSignal = Math.max(criteria.confidenceSignal, confidence);

    const result: WorldCupProphecyResult = {
      title: cleanText(parsed.title, 'World Cup Match Prophecy'),
      homeTeam: cleanText(parsed.homeTeam, input.homeTeam),
      awayTeam: cleanText(parsed.awayTeam, input.awayTeam),
      matchDate: cleanText(parsed.matchDate, input.matchDate),
      location: cleanText(parsed.location || parsed.research?.location, ''),
      pick: cleanShortLine(parsed.pick, fallback.pick, 24),
      scoreline: cleanShortLine(parsed.scoreline, fallback.scoreline, 32),
      confidence,
      prophecy: smartTruncate(
        stripInlineRiskSection(parsed.prophecy, fallback.prophecy),
        MAX_MAIN_PROPHECY,
        fallback.prophecy,
      ),
      reasoning: normalizeReasoning(parsed.reasoning, fallback.reasoning),
      research: {
        matchDate: input.matchDate,
        location: cleanText(parsed.research?.location || parsed.location, ''),
        competition: cleanText(parsed.research?.competition, 'World Cup'),
        recentForm: cleanText(parsed.research?.recentForm, ''),
        keyPlayers: cleanText(parsed.research?.keyPlayers, ''),
        injuriesOrSuspensions: cleanText(parsed.research?.injuriesOrSuspensions, ''),
        fanSentiment: cleanText(parsed.research?.fanSentiment, ''),
        tacticalContext: cleanText(parsed.research?.tacticalContext, ''),
        sources: [...new Set([...parsedSources, ...detectedSources])].slice(0, 8),
      },
      criteria,
      drawRisk: normalizeRiskLevel(getRiskField(parsed, 'drawRisk')) ?? fallback.drawRisk,
      upsetRisk: normalizeRiskLevel(getRiskField(parsed, 'upsetRisk')) ?? fallback.upsetRisk,
      counterAttackRisk:
        normalizeRiskLevel(getRiskField(parsed, 'counterAttackRisk')) ??
        fallback.counterAttackRisk,
      setPieceRisk:
        normalizeRiskLevel(getRiskField(parsed, 'setPieceRisk')) ?? fallback.setPieceRisk,
      cleanSheetRisk:
        normalizeRiskLevel(getRiskField(parsed, 'cleanSheetRisk')) ??
        fallback.cleanSheetRisk,
      lateGoalRisk: normalizeRiskLevel(getRiskField(parsed, 'lateGoalRisk')),
      heatFatigueRisk: normalizeRiskLevel(getRiskField(parsed, 'heatFatigueRisk')),
      travelDisruptionRisk: normalizeRiskLevel(getRiskField(parsed, 'travelDisruptionRisk')),
    };

    result.reasoning = normalizeReasoning(
      result.reasoning,
      fallback.reasoning,
    ).map((line) => smartTruncate(line, MAX_REASONING_LINE)) as [string, string];

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

    return NextResponse.json(fallback);
  }
}
