// src/app/api/xcup/prophecy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import type {
  WorldCupProphecyCriteria,
  WorldCupProphecyInput,
  WorldCupProphecyResult,
} from '../../../../lib/xcup/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    form: clampScore(raw?.form, 66),
    attack: clampScore(raw?.attack, 70),
    defense: clampScore(raw?.defense, 64),
    momentum: clampScore(raw?.momentum, 68),
    fans: clampScore(raw?.fans, 62),
    confidenceSignal: clampScore(raw?.confidenceSignal, 61),
  };
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
    form: 66,
    attack: 70,
    defense: 64,
    momentum: 68,
    fans: 62,
    confidenceSignal: 61,
  };

  return {
    title: 'World Cup Match Prophecy',
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    matchDate: input.matchDate,
    location: '',
    pick: 'Too close to call',
    scoreline: '1-1',
    confidence: 61,
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));

  const input: WorldCupProphecyInput = {
    homeTeam: cleanText(body.homeTeam, 'Spain'),
    awayTeam: cleanText(body.awayTeam, 'France'),
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

const prompt = `
You are the Cookieverse World Cup AI prophecy agent.

Task:
Research and analyze the historical football context for:
${input.homeTeam} vs ${input.awayTeam}
Match date: ${input.matchDate}

Use web search to investigate:
- previous head-to-head matches
- World Cup and major tournament history
- recent public performance trends
- attacking and defensive patterns
- key players and team identity
- likely venue/location context if available
- fan narratives and public sentiment
- pressure, rivalry, and tournament stakes

Important:
- Try to make very close match prediction.
- try to give very close betting odds.
- try to give gambling advice.
- Use historical and public football signals, not pure fantasy.
- If current match data is incomplete, say so inside research fields, but still create a strong collectible prophecy.
- Make the output cinematic, punchy and card-ready.
- Return valid JSON only.
- No markdown.
- "reasoning" must be exactly 2 short lines.
- Each reasoning line must be under 68 characters.
- Reasoning must explain the prophecy in compact card text.
- Do not include long statistics in reasoning.
- Do not include URLs in reasoning.
- Put URLs only inside research.sources.
- Scoreline must be concise, like "Argentina 2-1 Spain".
- Pick must be concise, like "Argentina", "Spain", or "Draw".

Return JSON:
{
  "title": "World Cup Match Prophecy",
  "homeTeam": "${input.homeTeam}",
  "awayTeam": "${input.awayTeam}",
  "matchDate": "${input.matchDate}",
  "location": "",
  "pick": "",
  "scoreline": "",
  "confidence": 0,
  "prophecy": "",
  "reasoning": [
    "Short reason under 68 characters.",
    "Short reason under 68 characters."
    ],
  "research": {
    "matchDate": "${input.matchDate}",
    "location": "",
    "competition": "World Cup",
    "recentForm": "",
    "keyPlayers": "",
    "injuriesOrSuspensions": "",
    "fanSentiment": "",
    "tacticalContext": "",
    "sources": []
  },
  "criteria": {
    "form": 0,
    "attack": 0,
    "defense": 0,
    "momentum": 0,
    "fans": 0,
    "confidenceSignal": 0
  }
}
`.trim();

    const response = await client.responses.create({
      // Use a search-capable Responses model. OpenAI docs recommend Responses API + web_search for new web search integrations.
      model: process.env.XCUP_OPENAI_MODEL || 'gpt-5.5',
      tools: [
        {
          type: 'web_search',
          search_context_size: 'medium',
        },
      ],
      // Make search mandatory for this endpoint, otherwise model may skip it.
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

    const result: WorldCupProphecyResult = {
      title: cleanText(parsed.title, 'World Cup Match Prophecy'),
      homeTeam: cleanText(parsed.homeTeam, input.homeTeam),
      awayTeam: cleanText(parsed.awayTeam, input.awayTeam),
      matchDate: cleanText(parsed.matchDate, input.matchDate),
      location: cleanText(parsed.location || parsed.research?.location, ''),
      pick: cleanShortLine(parsed.pick, fallback.pick, 24),
      scoreline: cleanShortLine(parsed.scoreline, fallback.scoreline, 32),
      confidence: clampScore(parsed.confidence, fallback.confidence),
      prophecy: cleanText(parsed.prophecy, fallback.prophecy).slice(0, 360),
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
      criteria: normalizeCriteria(parsed.criteria || {}),
    };

    // Keep reasoning exactly 2 short lines for renderer/UI stability.
    result.reasoning = normalizeReasoning(result.reasoning, fallback.reasoning);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[xcup prophecy] OpenAI web research failed', error);
    return NextResponse.json(fallback);
  }
}