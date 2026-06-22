import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parse } from 'dotenv';

const env = parse(fs.readFileSync('.env.local'));
const candidatePrompt =
  env.XCUP_PROPHECY_CANDIDATES_PROMPT_SECRET || '';
const finalPrompt = env.XCUP_PROPHECY_FINAL_PROMPT_SECRET || '';

assert(candidatePrompt, 'Missing XCUP_PROPHECY_CANDIDATES_PROMPT_SECRET');
assert(finalPrompt, 'Missing XCUP_PROPHECY_FINAL_PROMPT_SECRET');

const concreteScores = candidatePrompt.match(/\b\d+\s*[-:]\s*\d+\b/g) || [];

assert.deepEqual(
  concreteScores,
  [],
  `Candidate prompt contains concrete score examples: ${[
    ...new Set(concreteScores),
  ].join(', ')}`,
);
assert(
  !/"(?:homeGoals|awayGoals)"\s*:\s*\d/.test(candidatePrompt),
  'Candidate prompt contains concrete numeric goal JSON defaults.',
);
assert(
  !/"(?:confidence|exactScoreConfidence)"\s*:\s*\d/.test(candidatePrompt),
  'Candidate prompt contains concrete confidence JSON defaults.',
);

for (const required of [
  'unranked',
  'viabilityScore',
  'evidenceFit',
  'contradiction',
]) {
  assert(
    candidatePrompt.includes(required),
    `Candidate prompt is missing ${required}.`,
  );
  assert(finalPrompt.includes(required), `Final prompt is missing ${required}.`);
}

for (const required of ['selectedCandidateId', 'topCandidates', 'candidateId']) {
  assert(finalPrompt.includes(required), `Final prompt is missing ${required}.`);
}

assert(
  finalPrompt.includes('must not be returned again'),
  'Final prompt must not request repeated immutable candidate fields.',
);

for (const seededValue of ['86', '14']) {
  assert(
    !new RegExp(`\\b${seededValue}\\b`).test(finalPrompt),
    `Final prompt contains seeded confidence value ${seededValue}.`,
  );
}

console.log('XCup prompt seeding checks passed.');
