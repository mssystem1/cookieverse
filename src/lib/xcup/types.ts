// src/lib/xcup/types.ts

export type WorldCupProphecyCriteria = {
  form: number;
  attack: number;
  defense: number;
  momentum: number;
  fans: number;
  confidenceSignal: number;
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
  prophecy: string;
  reasoning: string[];

  research: WorldCupResearchContext;
  criteria: WorldCupProphecyCriteria;
};

export type WorldCupProphecyCardInput = WorldCupProphecyResult & {
  mintedBy?: string;
};