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

export type WorldCupScoringVolume = 'Low' | 'Medium' | 'High';

export type WorldCupCandidateType =
  | 'baseline'
  | 'low_event'
  | 'high_event'
  | 'draw_path'
  | 'alternative_or_disruption';

export type WorldCupDominantScenario =
  | 'Favorite control'
  | 'Favorite pressure with concession'
  | 'Favorite attacking breakout'
  | 'Draw trap'
  | 'Chaotic transition game'
  | 'Underdog disruption'
  | 'Low-event stalemate'
  | 'Set-piece swing game';

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

export type WorldCupScorelineCandidate = {
  rank?: number;
  candidateType: WorldCupCandidateType;
  homeGoals: number;
  awayGoals: number;
  pick: string;
  scoreline: string;
  dominantScenario: WorldCupDominantScenario | string;
  scoringVolume: WorldCupScoringVolume | string;
  exactScoreConfidence?: number;
  viabilityScore?: number;
  evidenceFit: string;
  contradiction: string;
  shortReason: string;
  strengths?: string;
  weaknesses?: string;
};

export type WorldCupRawScorelineCandidate = Omit<
  WorldCupScorelineCandidate,
  'pick' | 'scoreline'
>;

export type WorldCupCandidateGenerationResult = {
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  location?: string;
  researchSummary: string;
  mainSignals: {
    favoriteSignals?: string[];
    underdogSignals?: string[];
    drawTrapSignals?: string[];
    breakoutSignals?: string[];
    lowEventSignals?: string[];
  };
  candidates: WorldCupScorelineCandidate[];
  sources?: string[];
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
  scoringVolume?: WorldCupScoringVolume | string;
  topScorelines?: WorldCupTopScoreline[];
  confidenceGovernor?: string;
  exactScoreVolatility?: string;
  candidateGenerationSummary?: string;
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
