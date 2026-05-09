import type { WalletRoastAnalysis, RoastText } from "./types";

export function fallbackRoast(x: WalletRoastAnalysis): RoastText {
  const score = Math.round(x.metrics.wallet_score);
  const degen = Math.round(x.metrics.degeneracy_score);
  const archetype = x.classification.archetype;

  return {
    headline: `${archetype}. Conviction still buffering.`,
    light_roast: `You move like a whale but your wallet forgot the whale part.`,
    savage_roast: `This wallet has full-time activity and part-time capital.`,
    verdict: `Wallet score ${score}, degen ${degen}, discipline under review.`,
  };
}