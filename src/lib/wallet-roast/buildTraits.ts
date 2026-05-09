import type { WalletRoastAnalysis } from "./types";

export function buildTraits(
  x: Omit<WalletRoastAnalysis, "roast_text"> & {
    classification: { archetype: string; tags: string[] };
  }
): string[] {
  const traits: string[] = [];

  if (x.metrics.tx_count_total >= 500 && x.portfolio.total_usd < 1000) {
    traits.push("high activity low capital");
  }

  if (x.portfolio.dust_ratio >= 40) {
    traits.push("dust collector");
  }

  if (x.portfolio.defi_ratio >= 50) {
    traits.push("defi heavy allocation");
  }

  if (x.metrics.chains_used >= 3) {
    traits.push("bridge enjoyer");
  }

  if (x.metrics.unique_tokens >= 20 && x.portfolio.total_usd < 5000) {
    traits.push("over-diversified small wallet");
  }

  if (!traits.length) {
    traits.push("ordinary onchain behavior");
  }

  return traits;
}