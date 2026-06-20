// src/lib/xcup/types.ts

export type WorldCupProphecyCriteria = {
  form: number;
  attack: number;
  defense: number;
  momentum: number;
  fans: number;
  confidenceSignal: number;
};

export type WorldCupRiskLevel =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Low-Medium'
  | 'Medium-High';

export type WorldCupProphecyRisks = {
  drawRisk?: WorldCupRiskLevel;
  upsetRisk?: WorldCupRiskLevel;
  counterAttackRisk?: WorldCupRiskLevel;
  setPieceRisk?: WorldCupRiskLevel;
  cleanSheetRisk?: WorldCupRiskLevel;
  lateGoalRisk?: WorldCupRiskLevel;
  heatFatigueRisk?: WorldCupRiskLevel;
  travelDisruptionRisk?: WorldCupRiskLevel;
  goalkeeperHeroRisk?: WorldCupRiskLevel;
  physicalMismatchRisk?: WorldCupRiskLevel;
  drawRiskReason?: string;
  upsetRiskReason?: string;
  counterAttackRiskReason?: string;
  setPieceRiskReason?: string;
  cleanSheetRiskReason?: string;
  lateGoalRiskReason?: string;
  heatFatigueRiskReason?: string;
  travelDisruptionRiskReason?: string;
  goalkeeperHeroRiskReason?: string;
  physicalMismatchRiskReason?: string;
};

export type WorldCupTopScoreline = {
  rank: number;
  scoreline: string;
  shortReason: string;
};

export type WorldCupProphecyInput = {
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
};

export type WorldCupResearchContext = {
  matchDate: string;
  location?: string;
  competition?: string;
  recentForm?: string;
  keyPlayers?: string;
  injuriesOrSuspensions?: string;
  fanSentiment?: string;
  tacticalContext?: string;
  dominantScenario?: string;
  scoringVolume?: 'Low' | 'Medium' | 'High' | string;
  topScorelines?: WorldCupTopScoreline[];
  confidenceGovernor?: string;
  exactScoreVolatility?: string;
  marketAngle?: string;
  playerHealthContext?: string;
  matchFitness?: string;
  publicMarketContext?: string;
  marketCloseness?: string;
  earlyGoalAvalancheRisk?: string;
  strikerConversionCeiling?: string;
  opponentCollapseRisk?: string;
  gameStateVolatility?: string;
  cleanSheetFragility?: string;
  goalkeeperResistance?: string;
  defensiveBlockDurability?: string;
  sterilePossessionRisk?: string;
  goalkeeperHeroGameRisk?: string;
  physicalMismatchRisk?: string;
  shotQualityVsShotVolume?: string;
  lateSubImpactRisk?: string;
  setPieceThreat?: string;
  sources?: string[];
};

export type WorldCupProphecyResult = {
  title: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  location?: string;

  pick: string;
  scoreline: string;
  confidence: number;
  prophecyProbability?: number;
  trueMarketProbability?: number;
  exactScoreConfidence?: number;
  marketAngle?: string;
  prophecy: string;
  reasoning: string[];

  research: WorldCupResearchContext;
  criteria: WorldCupProphecyCriteria;
} & WorldCupProphecyRisks;

export type WorldCupProphecyCardInput = WorldCupProphecyResult & {
  mintedBy?: string;
};
