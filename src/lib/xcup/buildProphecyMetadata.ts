import type { WorldCupProphecyResult } from './types';

type Params = {
  prophecy: WorldCupProphecyResult;
  imageUri?: string;
  chain?: string;
  payerWallet?: string;
};

export function buildWorldCupProphecyMetadata({
  prophecy,
  imageUri,
  chain,
  payerWallet,
}: Params) {
  return {
    name: `Cookieverse World Cup Prophecy: ${prophecy.homeTeam} vs ${prophecy.awayTeam}`,
    description: prophecy.prophecy,
    image: imageUri,
    external_url: 'https://www.cookieverse.tech/app',
    attributes: [
      { trait_type: 'Product', value: 'World Cup Prophecy' },
      ...(chain ? [{ trait_type: 'Chain', value: chain }] : []),
      { trait_type: 'Home Team', value: prophecy.homeTeam },
      { trait_type: 'Away Team', value: prophecy.awayTeam },
      { trait_type: 'Match Date', value: prophecy.matchDate },
      { trait_type: 'Pick', value: prophecy.pick },
      { trait_type: 'Scoreline', value: prophecy.scoreline },
      { trait_type: 'Pick Confidence', value: prophecy.confidence },
      ...(prophecy.exactScoreConfidence !== undefined
        ? [{ trait_type: 'Exact Score Confidence', value: prophecy.exactScoreConfidence }]
        : []),
      ...(prophecy.trueMarketProbability !== undefined
        ? [{ trait_type: 'True Market Probability', value: prophecy.trueMarketProbability }]
        : []),
      ...(prophecy.research.dominantScenario
        ? [{ trait_type: 'Dominant Scenario', value: prophecy.research.dominantScenario }]
        : []),
      ...(prophecy.research.scoringVolume
        ? [{ trait_type: 'Scoring Volume', value: prophecy.research.scoringVolume }]
        : []),
    ],
    cookieverse: {
      version: '1.1',
      product: 'xcup-prophecy',
      ...(chain ? { chain } : {}),
      ...(payerWallet ? { payerWallet } : {}),
      pick: prophecy.pick,
      scoreline: prophecy.scoreline,
      pickConfidence: prophecy.confidence,
      prophecyProbability: prophecy.prophecyProbability,
      exactScoreConfidence: prophecy.exactScoreConfidence,
      trueMarketProbability: prophecy.trueMarketProbability,
      dominantScenario: prophecy.research.dominantScenario,
      scoringVolume: prophecy.research.scoringVolume,
      topScorelines: prophecy.research.topScorelines,
      confidenceGovernor: prophecy.research.confidenceGovernor,
      exactScoreVolatility: prophecy.research.exactScoreVolatility,
      prophecy,
    },
  };
}
