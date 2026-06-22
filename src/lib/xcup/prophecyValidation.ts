import type {
  WorldCupCandidateType,
  WorldCupCandidateGenerationResult,
  WorldCupProphecyInput,
  WorldCupProphecyResult,
  WorldCupScorelineCandidate,
} from './types';

export type ProphecyValidationIssue = {
  code: string;
  message: string;
  severity: 'hard' | 'soft';
};

export const WORLD_CUP_CANDIDATE_TYPES: WorldCupCandidateType[] = [
  'baseline',
  'low_event',
  'high_event',
  'draw_path',
  'alternative_or_disruption',
];

const MAX_CANDIDATE_GOALS = 10;

function cleanText(value: unknown, max = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanList(value: unknown, maxItems = 8, maxLength = 240) {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);

  return items.length ? items : undefined;
}

function optionalScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeScoringVolume(value: unknown) {
  const text = cleanText(value, 32);
  const normalized = text.toLowerCase();

  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'high') return 'High';
  return text;
}

function normalizeCandidateType(value: unknown) {
  return cleanText(value, 64).toLowerCase() as WorldCupCandidateType;
}

function isValidGoal(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_CANDIDATE_GOALS
  );
}

export function deriveCandidateOutcome(
  homeGoals: unknown,
  awayGoals: unknown,
  input: WorldCupProphecyInput,
) {
  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals)) return null;

  return {
    scoreline: `${homeGoals}-${awayGoals}`,
    pick:
      homeGoals === awayGoals
        ? 'Draw'
        : homeGoals > awayGoals
          ? input.homeTeam
          : input.awayTeam,
  };
}

function validSources(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item, 500))
    .filter((item) => /^https?:\/\//i.test(item))
    .slice(0, 8);
}

export function parseWorldCupScoreline(value: unknown) {
  const text = cleanText(value, 80);
  const match = text.match(/(\d{1,2})\s*[-–—:]\s*(\d{1,2})/);

  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2]),
    key: `${Number(match[1])}-${Number(match[2])}`,
  };
}

function normalizedPick(value: unknown) {
  return cleanText(value, 80).toLocaleLowerCase('en');
}

function expectedPick(
  scoreline: ReturnType<typeof parseWorldCupScoreline>,
  input: WorldCupProphecyInput,
) {
  if (!scoreline) return '';
  if (scoreline.home === scoreline.away) return 'draw';
  return normalizedPick(scoreline.home > scoreline.away ? input.homeTeam : input.awayTeam);
}

function pickIsAllowed(value: unknown, input: WorldCupProphecyInput) {
  const pick = normalizedPick(value);
  return (
    pick === 'draw' ||
    pick === normalizedPick(input.homeTeam) ||
    pick === normalizedPick(input.awayTeam)
  );
}

function candidateKey(candidate: WorldCupScorelineCandidate) {
  return `${candidate.homeGoals}-${candidate.awayGoals}`;
}

export function normalizeCandidateGeneration(
  raw: any,
  input: WorldCupProphecyInput,
  detectedSources: string[],
): WorldCupCandidateGenerationResult {
  const rawCandidates = Array.isArray(raw?.candidates) ? raw.candidates : [];
  const candidates = rawCandidates.slice(0, 12).map((candidate: any) => {
    const outcome = deriveCandidateOutcome(
      candidate?.homeGoals,
      candidate?.awayGoals,
      input,
    );

    return {
      candidateType: normalizeCandidateType(candidate?.candidateType),
      homeGoals: candidate?.homeGoals as number,
      awayGoals: candidate?.awayGoals as number,
      pick: outcome?.pick || '',
      scoreline: outcome?.scoreline || '',
      dominantScenario: cleanText(candidate?.dominantScenario, 80),
      scoringVolume: normalizeScoringVolume(candidate?.scoringVolume),
      exactScoreConfidence: optionalScore(candidate?.exactScoreConfidence),
      viabilityScore: optionalScore(candidate?.viabilityScore),
      evidenceFit: cleanText(candidate?.evidenceFit, 480),
      contradiction: cleanText(candidate?.contradiction, 480),
      shortReason: cleanText(candidate?.shortReason, 240),
      strengths: cleanText(candidate?.strengths, 320) || undefined,
      weaknesses: cleanText(candidate?.weaknesses, 320) || undefined,
    };
  });

  const parsedSources = validSources(raw?.sources);

  return {
    matchDate: cleanText(raw?.matchDate || input.matchDate, 80),
    homeTeam: cleanText(raw?.homeTeam || input.homeTeam, 80),
    awayTeam: cleanText(raw?.awayTeam || input.awayTeam, 80),
    location: cleanText(raw?.location, 160) || undefined,
    researchSummary: cleanText(raw?.researchSummary, 1200),
    mainSignals: {
      favoriteSignals: cleanList(raw?.mainSignals?.favoriteSignals),
      underdogSignals: cleanList(raw?.mainSignals?.underdogSignals),
      drawTrapSignals: cleanList(raw?.mainSignals?.drawTrapSignals),
      breakoutSignals: cleanList(raw?.mainSignals?.breakoutSignals),
      lowEventSignals: cleanList(raw?.mainSignals?.lowEventSignals),
    },
    candidates,
    sources: [...new Set([...parsedSources, ...detectedSources])].slice(0, 8),
  };
}

export function validateCandidateGeneration(
  result: WorldCupCandidateGenerationResult,
  input: WorldCupProphecyInput,
): ProphecyValidationIssue[] {
  const issues: ProphecyValidationIssue[] = [];
  const candidates = result.candidates;

  if (
    normalizedPick(result.homeTeam) !== normalizedPick(input.homeTeam) ||
    normalizedPick(result.awayTeam) !== normalizedPick(input.awayTeam) ||
    cleanText(result.matchDate, 80) !== cleanText(input.matchDate, 80)
  ) {
    issues.push({
      code: 'CANDIDATE_MATCH_INPUT',
      message: 'Candidate match identity differs from the request.',
      severity: 'hard',
    });
  }

  if (candidates.length !== 5) {
    issues.push({
      code: 'CANDIDATE_COUNT',
      message: `Expected exactly 5 candidates; received ${candidates.length}.`,
      severity: 'hard',
    });
  }

  const candidateTypes = new Set<WorldCupCandidateType>();

  for (const [index, candidate] of candidates.entries()) {
    if (
      !candidate.candidateType ||
      !candidate.dominantScenario ||
      !candidate.scoringVolume ||
      candidate.exactScoreConfidence === undefined ||
      candidate.viabilityScore === undefined ||
      !candidate.evidenceFit ||
      !candidate.contradiction ||
      !candidate.shortReason
    ) {
      issues.push({
        code: 'CANDIDATE_SCHEMA',
        message: `Candidate ${index + 1} is missing a required field.`,
        severity: 'hard',
      });
    }

    if (!WORLD_CUP_CANDIDATE_TYPES.includes(candidate.candidateType)) {
      issues.push({
        code: 'CANDIDATE_TYPE',
        message: `Candidate ${index + 1} has an unknown candidateType.`,
        severity: 'hard',
      });
    } else if (candidateTypes.has(candidate.candidateType)) {
      issues.push({
        code: 'CANDIDATE_TYPE_DUPLICATE',
        message: `Candidate type ${candidate.candidateType} appears more than once.`,
        severity: 'hard',
      });
    } else {
      candidateTypes.add(candidate.candidateType);
    }

    if (!isValidGoal(candidate.homeGoals) || !isValidGoal(candidate.awayGoals)) {
      issues.push({
        code: 'CANDIDATE_GOALS',
        message: `Candidate ${index + 1} goals must be integer numbers from 0 to ${MAX_CANDIDATE_GOALS}.`,
        severity: 'hard',
      });
    } else if (
      candidate.candidateType === 'draw_path' &&
      candidate.homeGoals !== candidate.awayGoals
    ) {
      issues.push({
        code: 'CANDIDATE_SLOT_SEMANTICS',
        message: 'The draw_path candidate must have equal home and away goals.',
        severity: 'soft',
      });
    }
  }

  const missingTypes = WORLD_CUP_CANDIDATE_TYPES.filter(
    (candidateType) => !candidateTypes.has(candidateType),
  );
  if (missingTypes.length > 0) {
    issues.push({
      code: 'CANDIDATE_TYPE_MISSING',
      message: `Missing candidate types: ${missingTypes.join(', ')}.`,
      severity: 'hard',
    });
  }

  const validCandidates = candidates.filter(
    (candidate) =>
      isValidGoal(candidate.homeGoals) && isValidGoal(candidate.awayGoals),
  );
  const distinctScorelines = new Set(validCandidates.map(candidateKey));
  const distinctScenarios = new Set(
    candidates.map((candidate) => candidate.dominantScenario.toLowerCase()).filter(Boolean),
  );
  const distinctCandidates = new Set(candidates.map(candidateKey));
  const twoOneCount = validCandidates.filter(
    (candidate) =>
      (candidate.homeGoals === 2 && candidate.awayGoals === 1) ||
      (candidate.homeGoals === 1 && candidate.awayGoals === 2),
  ).length;

  if (distinctScorelines.size < 3 || distinctScenarios.size < 2) {
    issues.push({
      code: 'CANDIDATE_DIVERSITY',
      message: 'Candidates need at least 3 scorelines and 2 scenarios.',
      severity: 'soft',
    });
  }

  if (distinctCandidates.size !== candidates.length) {
    issues.push({
      code: 'CANDIDATE_DUPLICATE',
      message: 'Duplicate candidates are not allowed.',
      severity: 'soft',
    });
  }

  if (twoOneCount > 2) {
    issues.push({
      code: 'CANDIDATE_REPETITIVE_2_1',
      message: '2-1 or 1-2 appears more than twice.',
      severity: 'soft',
    });
  }

  const narrowWinnerPicks = candidates.map((candidate) => {
    if (!isValidGoal(candidate.homeGoals) || !isValidGoal(candidate.awayGoals)) {
      return '';
    }
    if (candidate.homeGoals === candidate.awayGoals) return '';
    if (Math.abs(candidate.homeGoals - candidate.awayGoals) !== 1) return '';
    return normalizedPick(candidate.pick);
  });

  if (
    narrowWinnerPicks.length === 5 &&
    narrowWinnerPicks.every(
      (pick) => pick && pick === narrowWinnerPicks[0],
    )
  ) {
    issues.push({
      code: 'CANDIDATE_REPETITIVE_NARROW_WIN',
      message: 'All candidates are narrow wins for the same team.',
      severity: 'soft',
    });
  }

  return issues;
}

function findCandidatesByScoreline(
  scoreline: string,
  candidates: WorldCupScorelineCandidate[],
) {
  const parsed = parseWorldCupScoreline(scoreline);
  if (!parsed) return [];

  return candidates.filter(
    (candidate) => parseWorldCupScoreline(candidate.scoreline)?.key === parsed.key,
  );
}

export function validateFinalProphecy(
  result: WorldCupProphecyResult,
  candidates: WorldCupScorelineCandidate[],
  input: WorldCupProphecyInput,
): ProphecyValidationIssue[] {
  const issues: ProphecyValidationIssue[] = [];
  const finalScoreline = parseWorldCupScoreline(result.scoreline);
  const topScorelines = result.research.topScorelines || [];
  const rankOne = topScorelines.find((item) => item.rank === 1);
  const ranks = new Set(topScorelines.map((item) => item.rank));
  const topScorelineKeys = new Set(
    topScorelines
      .map((item) => parseWorldCupScoreline(item.scoreline)?.key)
      .filter(Boolean),
  );

  if (
    normalizedPick(result.homeTeam) !== normalizedPick(input.homeTeam) ||
    normalizedPick(result.awayTeam) !== normalizedPick(input.awayTeam) ||
    cleanText(result.matchDate, 80) !== cleanText(input.matchDate, 80)
  ) {
    issues.push({
      code: 'FINAL_MATCH_INPUT',
      message: 'Final match identity differs from the request.',
      severity: 'hard',
    });
  }

  if (!pickIsAllowed(result.pick, input)) {
    issues.push({
      code: 'FINAL_PICK',
      message: 'Final pick is invalid.',
      severity: 'hard',
    });
  } else if (
    !finalScoreline ||
    normalizedPick(result.pick) !== expectedPick(finalScoreline, input)
  ) {
    issues.push({
      code: 'FINAL_PICK_MISMATCH',
      message: 'Final pick conflicts with the final scoreline.',
      severity: 'hard',
    });
  }

  if (!finalScoreline) {
    issues.push({
      code: 'FINAL_SCORELINE',
      message: 'Final scoreline is invalid.',
      severity: 'hard',
    });
  }

  if (
    result.prophecyProbability === undefined ||
    result.prophecyProbability !== result.confidence
  ) {
    issues.push({
      code: 'FINAL_CONFIDENCE',
      message: 'confidence must equal prophecyProbability.',
      severity: 'hard',
    });
  }

  if (
    result.exactScoreConfidence === undefined ||
    result.exactScoreConfidence > result.confidence
  ) {
    issues.push({
      code: 'FINAL_EXACT_SCORE_CONFIDENCE',
      message: 'exactScoreConfidence must exist and not exceed confidence.',
      severity: 'hard',
    });
  }

  if (
    topScorelines.length !== 3 ||
    ranks.size !== 3 ||
    topScorelineKeys.size !== 3 ||
    !ranks.has(1) ||
    !ranks.has(2) ||
    !ranks.has(3)
  ) {
    issues.push({
      code: 'FINAL_TOP_THREE',
      message: 'Top scorelines must contain unique ranks 1, 2, and 3.',
      severity: 'hard',
    });
  }

  for (const topScoreline of topScorelines) {
    if (findCandidatesByScoreline(topScoreline.scoreline, candidates).length === 0) {
      issues.push({
        code: 'FINAL_NOT_FROM_CANDIDATES',
        message: `Rank ${topScoreline.rank} is not from the candidate set.`,
        severity: 'hard',
      });
    }
  }

  const rankOneScoreline = parseWorldCupScoreline(rankOne?.scoreline);
  if (!finalScoreline || !rankOneScoreline || finalScoreline.key !== rankOneScoreline.key) {
    issues.push({
      code: 'FINAL_RANK_ONE_MISMATCH',
      message: 'Final scoreline must match topScorelines rank 1.',
      severity: 'hard',
    });
  }

  const rankOneCandidates = rankOne
    ? findCandidatesByScoreline(rankOne.scoreline, candidates)
    : [];

  if (
    rankOneCandidates.length > 0 &&
    !rankOneCandidates.some(
      (candidate) => normalizedPick(candidate.pick) === normalizedPick(result.pick),
    )
  ) {
    issues.push({
      code: 'FINAL_RANK_ONE_PICK_MISMATCH',
      message: 'Final pick must match the rank-1 candidate pick.',
      severity: 'hard',
    });
  }

  if (
    !result.research.dominantScenario ||
    !result.research.scoringVolume ||
    !result.research.confidenceGovernor ||
    !result.research.exactScoreVolatility ||
    !result.research.candidateGenerationSummary
  ) {
    issues.push({
      code: 'FINAL_PROOF_FIELDS',
      message: 'Final comparison proof fields are incomplete.',
      severity: 'hard',
    });
  }

  return issues;
}

export function diagnoseFinalProphecyShape(
  raw: unknown,
): ProphecyValidationIssue[] {
  const issues: ProphecyValidationIssue[] = [];
  const value = raw as any;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [
      {
        code: 'FINAL_JSON_OBJECT',
        message: 'Final Judge output must be a JSON object.',
        severity: 'hard',
      },
    ];
  }

  const requiredText = [
    ['pick', value.pick],
    ['scoreline', value.scoreline],
    ['prophecy', value.prophecy],
  ] as const;

  for (const [field, fieldValue] of requiredText) {
    if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
      issues.push({
        code: `FINAL_FIELD_${field.toUpperCase()}`,
        message: `${field} must be a non-empty string.`,
        severity: 'hard',
      });
    }
  }

  for (const field of [
    'confidence',
    'prophecyProbability',
    'exactScoreConfidence',
  ] as const) {
    const fieldValue = value[field];
    if (
      typeof fieldValue !== 'number' ||
      !Number.isFinite(fieldValue) ||
      !Number.isInteger(fieldValue)
    ) {
      issues.push({
        code: `FINAL_FIELD_${field.toUpperCase()}`,
        message: `${field} must be an integer number.`,
        severity: 'hard',
      });
    }
  }

  if (
    !Array.isArray(value.reasoning) ||
    value.reasoning.length !== 2 ||
    value.reasoning.some(
      (line: unknown) => typeof line !== 'string' || !line.trim(),
    )
  ) {
    issues.push({
      code: 'FINAL_FIELD_REASONING',
      message: 'reasoning must contain exactly two non-empty strings.',
      severity: 'hard',
    });
  }

  if (!value.research || typeof value.research !== 'object') {
    issues.push({
      code: 'FINAL_FIELD_RESEARCH',
      message: 'research must be an object.',
      severity: 'hard',
    });
  } else {
    for (const field of [
      'dominantScenario',
      'scoringVolume',
      'confidenceGovernor',
      'exactScoreVolatility',
      'candidateGenerationSummary',
    ] as const) {
      if (
        typeof value.research[field] !== 'string' ||
        !value.research[field].trim()
      ) {
        issues.push({
          code: `FINAL_RESEARCH_${field.toUpperCase()}`,
          message: `research.${field} must be a non-empty string.`,
          severity: 'hard',
        });
      }
    }

    if (
      !Array.isArray(value.research.topScorelines) ||
      value.research.topScorelines.length !== 3
    ) {
      issues.push({
        code: 'FINAL_RESEARCH_TOPSCORELINES',
        message: 'research.topScorelines must contain exactly three items.',
        severity: 'hard',
      });
    }
  }

  if (!value.criteria || typeof value.criteria !== 'object') {
    issues.push({
      code: 'FINAL_FIELD_CRITERIA',
      message: 'criteria must be an object.',
      severity: 'hard',
    });
  }

  return issues;
}

export function validateFinalAntiTemplate(
  result: WorldCupProphecyResult,
): ProphecyValidationIssue[] {
  const isRepeatedTemplate =
    parseWorldCupScoreline(result.scoreline)?.key === '2-0' &&
    result.confidence === 86 &&
    result.research.dominantScenario?.toLowerCase() === 'favorite control' &&
    result.research.scoringVolume?.toLowerCase() === 'medium';

  return isRepeatedTemplate
    ? [
        {
          code: 'FINAL_TEMPLATE_FINGERPRINT',
          message:
            'The result repeats the known Favorite control / Medium / 2-0 / 86 template. Re-evaluate every candidate using evidence fit and contradictions.',
          severity: 'soft',
        },
      ]
    : [];
}
