import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const nullableText = z.string().nullable();
const score = z.number().int().min(0).max(100);
const nullableScore = score.nullable();
const riskLevel = z
  .enum(['Low', 'Medium', 'High', 'Low-Medium', 'Medium-High'])
  .nullable();

const rankedCandidate = z.object({
  rank: z.number().int().min(1).max(3),
  candidateId: z.string(),
  shortReason: z.string(),
});

export const finalProphecyOutputSchema = z.object({
  title: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  matchDate: z.string(),
  location: nullableText,
  selectedCandidateId: z.string(),
  topCandidates: z.array(rankedCandidate).length(3),
  confidence: score,
  prophecyProbability: score,
  trueMarketProbability: nullableScore,
  marketAngle: nullableText,
  prophecy: z.string(),
  reasoning: z.array(z.string()).length(2),
  drawRisk: riskLevel,
  upsetRisk: riskLevel,
  counterAttackRisk: riskLevel,
  setPieceRisk: riskLevel,
  cleanSheetRisk: riskLevel,
  lateGoalRisk: riskLevel,
  heatFatigueRisk: riskLevel,
  travelDisruptionRisk: riskLevel,
  goalkeeperHeroRisk: riskLevel,
  physicalMismatchRisk: riskLevel,
  drawRiskReason: nullableText,
  upsetRiskReason: nullableText,
  counterAttackRiskReason: nullableText,
  setPieceRiskReason: nullableText,
  cleanSheetRiskReason: nullableText,
  lateGoalRiskReason: nullableText,
  heatFatigueRiskReason: nullableText,
  travelDisruptionRiskReason: nullableText,
  goalkeeperHeroRiskReason: nullableText,
  physicalMismatchRiskReason: nullableText,
  research: z.object({
    matchDate: z.string(),
    location: nullableText,
    competition: nullableText,
    recentForm: nullableText,
    keyPlayers: nullableText,
    injuriesOrSuspensions: nullableText,
    fanSentiment: nullableText,
    tacticalContext: nullableText,
    confidenceGovernor: z.string(),
    exactScoreVolatility: z.string(),
    candidateGenerationSummary: z.string(),
    marketAngle: nullableText,
    sources: z.array(z.string()).max(8),
  }),
  criteria: z.object({
    form: score,
    attack: score,
    defense: score,
    momentum: score,
    fans: score,
    confidenceSignal: score,
  }),
});

export const FINAL_PROPHECY_TEXT_FORMAT = zodTextFormat(
  finalProphecyOutputSchema,
  'xcup_final_prophecy',
);
