import assert from 'node:assert/strict';

import {
  diagnoseFinalProphecyShape,
  deriveCandidateOutcome,
  parseWorldCupScoreline,
  validateCandidateGeneration,
  validateFinalAntiTemplate,
  validateFinalProphecy,
} from '../src/lib/xcup/prophecyValidation';
import { materializeFinalCandidateSelection } from '../src/lib/xcup/finalCandidateSelection';
import type {
  WorldCupCandidateGenerationResult,
  WorldCupProphecyInput,
  WorldCupProphecyResult,
} from '../src/lib/xcup/types';

const input: WorldCupProphecyInput = {
  homeTeam: 'Japan',
  awayTeam: 'Tunisia',
  matchDate: '2026-06-30',
};

const candidates: WorldCupCandidateGenerationResult = {
  ...input,
  researchSummary: 'Japan carries the stronger attacking and control signals.',
  mainSignals: {
    favoriteSignals: ['Japan creates the stronger chance volume.'],
    underdogSignals: ['Tunisia can threaten from set pieces.'],
  },
  candidates: [
    {
      candidateType: 'high_event',
      homeGoals: 3,
      awayGoals: 0,
      pick: 'Japan',
      scoreline: '3-0',
      dominantScenario: 'Favorite attacking breakout',
      scoringVolume: 'High',
      exactScoreConfidence: 14,
      viabilityScore: 84,
      evidenceFit: 'Japan creates repeated high-quality chances.',
      contradiction: 'Tunisia may keep the first half compact.',
      shortReason: 'Pressure converts repeatedly.',
    },
    {
      candidateType: 'baseline',
      homeGoals: 2,
      awayGoals: 0,
      pick: 'Japan',
      scoreline: '2-0',
      dominantScenario: 'Favorite control',
      scoringVolume: 'Medium',
      exactScoreConfidence: 13,
      viabilityScore: 78,
      evidenceFit: 'Japan can control territory and suppress transitions.',
      contradiction: 'Finishing variance may prevent a clean sheet win.',
      shortReason: 'Control and a clean sheet.',
    },
    {
      candidateType: 'draw_path',
      homeGoals: 1,
      awayGoals: 1,
      pick: 'Draw',
      scoreline: '1-1',
      dominantScenario: 'Draw trap',
      scoringVolume: 'Low',
      exactScoreConfidence: 10,
      viabilityScore: 60,
      evidenceFit: 'Tunisia can slow the game with a compact block.',
      contradiction: 'Japan has the stronger chance-creation profile.',
      shortReason: 'Tunisia slows the match.',
    },
    {
      candidateType: 'alternative_or_disruption',
      homeGoals: 3,
      awayGoals: 1,
      pick: 'Japan',
      scoreline: '3-1',
      dominantScenario: 'Favorite pressure with concession',
      scoringVolume: 'High',
      exactScoreConfidence: 11,
      viabilityScore: 70,
      evidenceFit: 'Both teams have credible transition routes.',
      contradiction: 'Tunisia may not sustain enough attacking pressure.',
      shortReason: 'Japan wins despite one concession.',
    },
    {
      candidateType: 'low_event',
      homeGoals: 2,
      awayGoals: 1,
      pick: 'Japan',
      scoreline: '2-1',
      dominantScenario: 'Set-piece swing game',
      scoringVolume: 'Medium',
      exactScoreConfidence: 9,
      viabilityScore: 64,
      evidenceFit: 'Set pieces give Tunisia a route to keep it close.',
      contradiction: 'Japan may create enough volume to pull away.',
      shortReason: 'A set piece keeps it close.',
    },
  ],
  sources: ['https://example.com/research'],
};

const finalResult: WorldCupProphecyResult = {
  title: 'World Cup Match Prophecy',
  ...input,
  pick: 'Japan',
  scoreline: '3-0',
  confidence: 82,
  prophecyProbability: 82,
  exactScoreConfidence: 14,
  prophecy: 'Japan controls the match and turns sustained pressure into goals.',
  reasoning: ['Japan owns the stronger chance profile.', 'Tunisia struggles to escape pressure.'],
  research: {
    matchDate: input.matchDate,
    competition: 'World Cup',
    dominantScenario: 'Favorite attacking breakout',
    scoringVolume: 'High',
    topScorelines: [
      { rank: 1, scoreline: '3-0', shortReason: 'Pressure converts repeatedly.' },
      { rank: 2, scoreline: '2-0', shortReason: 'Control and a clean sheet.' },
      { rank: 3, scoreline: '1-1', shortReason: 'Tunisia slows the match.' },
    ],
    confidenceGovernor: 'Japan has the clearer route to sustained chances.',
    exactScoreVolatility: 'Finishing variance can shift the winning margin.',
    candidateGenerationSummary: 'Five distinct match paths were compared.',
    sources: candidates.sources,
  },
  criteria: {
    form: 84,
    attack: 88,
    defense: 82,
    momentum: 85,
    fans: 80,
    confidenceSignal: 82,
  },
};

assert.deepEqual(parseWorldCupScoreline('Japan 3-0 Tunisia'), {
  home: 3,
  away: 0,
  key: '3-0',
});
assert.deepEqual(deriveCandidateOutcome(2, 0, input), {
  pick: 'Japan',
  scoreline: '2-0',
});
assert.deepEqual(deriveCandidateOutcome(0, 2, input), {
  pick: 'Tunisia',
  scoreline: '0-2',
});
assert.deepEqual(deriveCandidateOutcome(1, 1, input), {
  pick: 'Draw',
  scoreline: '1-1',
});
assert.equal(deriveCandidateOutcome('2', 0, input), null);
assert.equal(deriveCandidateOutcome(1.5, 0, input), null);
assert.equal(deriveCandidateOutcome(-1, 0, input), null);
assert.deepEqual(validateCandidateGeneration(candidates, input), []);
assert.deepEqual(
  validateFinalProphecy(finalResult, candidates.candidates, input),
  [],
);

const repetitive = structuredClone(candidates);
repetitive.candidates = repetitive.candidates.map((candidate) => ({
  ...candidate,
  homeGoals: 2,
  awayGoals: 1,
  pick: 'Japan',
  scoreline: '2-1',
  dominantScenario: 'Favorite pressure with concession',
}));

const repetitiveCodes = validateCandidateGeneration(repetitive, input).map(
  (issue) => issue.code,
);
assert(repetitiveCodes.includes('CANDIDATE_DIVERSITY'));
assert(repetitiveCodes.includes('CANDIDATE_REPETITIVE_2_1'));
assert(repetitiveCodes.includes('CANDIDATE_REPETITIVE_NARROW_WIN'));

const invalidGoals = structuredClone(candidates);
(invalidGoals.candidates[0] as any).homeGoals = '3';
invalidGoals.candidates[0].pick = '';
invalidGoals.candidates[0].scoreline = '';
assert(
  validateCandidateGeneration(invalidGoals, input)
    .map((issue) => issue.code)
    .includes('CANDIDATE_GOALS'),
);

const duplicateSlot = structuredClone(candidates);
duplicateSlot.candidates[0].candidateType = 'baseline';
const duplicateSlotCodes = validateCandidateGeneration(
  duplicateSlot,
  input,
).map((issue) => issue.code);
assert(duplicateSlotCodes.includes('CANDIDATE_TYPE_DUPLICATE'));
assert(duplicateSlotCodes.includes('CANDIDATE_TYPE_MISSING'));

const missingEvidence = structuredClone(candidates);
missingEvidence.candidates[0].evidenceFit = '';
missingEvidence.candidates[0].contradiction = '';
missingEvidence.candidates[0].viabilityScore = undefined;
assert(
  validateCandidateGeneration(missingEvidence, input)
    .map((issue) => issue.code)
    .includes('CANDIDATE_SCHEMA'),
);

const inconsistentFinal = structuredClone(finalResult);
inconsistentFinal.scoreline = '2-0';

const finalCodes = validateFinalProphecy(
  inconsistentFinal,
  candidates.candidates,
  input,
).map((issue) => issue.code);
assert(finalCodes.includes('FINAL_RANK_ONE_MISMATCH'));

const templatedFinal = structuredClone(finalResult);
templatedFinal.scoreline = '2-0';
templatedFinal.confidence = 86;
templatedFinal.prophecyProbability = 86;
templatedFinal.exactScoreConfidence = 12;
templatedFinal.research.dominantScenario = 'Favorite control';
templatedFinal.research.scoringVolume = 'Medium';
assert.deepEqual(
  validateFinalAntiTemplate(templatedFinal).map((issue) => issue.code),
  ['FINAL_TEMPLATE_FINGERPRINT'],
);

const candidatePool = {
  candidatePool: Object.fromEntries(
    candidates.candidates.map((candidate, index) => [
      `candidate_${index + 1}`,
      candidate,
    ]),
  ),
};
const materialized = materializeFinalCandidateSelection(
  {
    ...finalResult,
    selectedCandidateId: 'candidate_1',
    topCandidates: [
      {
        rank: 1,
        candidateId: 'candidate_1',
        shortReason: 'Best evidence fit.',
      },
      {
        rank: 2,
        candidateId: 'candidate_2',
        shortReason: 'Strong control alternative.',
      },
      {
        rank: 3,
        candidateId: 'candidate_3',
        shortReason: 'Draw remains possible.',
      },
    ],
    pick: 'Wrong repeated value',
    scoreline: '9-9',
    exactScoreConfidence: 99,
    research: {
      ...finalResult.research,
      dominantScenario: 'Wrong repeated value',
      scoringVolume: 'Wrong repeated value',
      topScorelines: [],
    },
  },
  candidatePool,
);
assert.deepEqual(materialized.issues, []);
assert.equal(materialized.value.pick, 'Japan');
assert.equal(materialized.value.scoreline, '3-0');
assert.equal(materialized.value.exactScoreConfidence, 14);
assert.equal(
  materialized.value.research.dominantScenario,
  'Favorite attacking breakout',
);
assert.equal(materialized.value.research.scoringVolume, 'High');
assert.deepEqual(
  materialized.value.research.topScorelines.map(
    (item: { scoreline: string }) => item.scoreline,
  ),
  ['3-0', '2-0', '1-1'],
);

const invalidSelection = materializeFinalCandidateSelection(
  {
    selectedCandidateId: 'missing',
    topCandidates: [],
  },
  candidatePool,
);
assert(
  invalidSelection.issues.some(
    (issue) => issue.code === 'FINAL_SELECTED_CANDIDATE',
  ),
);

const missingFinalFields = structuredClone(finalResult) as any;
delete missingFinalFields.confidence;
missingFinalFields.reasoning = ['Only one line'];
assert.deepEqual(
  diagnoseFinalProphecyShape(missingFinalFields).map((issue) => issue.code),
  ['FINAL_FIELD_CONFIDENCE', 'FINAL_FIELD_REASONING'],
);

console.log('XCup prophecy validation tests passed.');
