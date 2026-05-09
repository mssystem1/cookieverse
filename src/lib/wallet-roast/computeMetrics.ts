import type { ScoreBreakdown, WalletRoastAnalysis } from "./types";

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function longestDateStreak(dateKeys: string[]) {
  const uniqueSortedDates = [...new Set(dateKeys)].sort();
  if (!uniqueSortedDates.length) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < uniqueSortedDates.length; i++) {
    const prev = new Date(`${uniqueSortedDates[i - 1]}T00:00:00.000Z`);
    const next = new Date(`${uniqueSortedDates[i]}T00:00:00.000Z`);
    const diff = (next.getTime() - prev.getTime()) / 86_400_000;

    if (diff === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (diff > 1) {
      current = 1;
    }
  }

  return best;
}

function portfolioScore(usd: number) {
  return clamp(Math.log10(Math.max(0, usd) + 1) * 25);
}

function activityScore(txCount: number) {
  return clamp(Math.log10(Math.max(0, txCount) + 1) * 25);
}

function consistencyScore(activeDays: number, longestStreak: number) {
  return clamp(activeDays * 0.35 + longestStreak * 2.2);
}

function protocolScore(protocolCount: number) {
  return clamp(Math.log10(Math.max(0, protocolCount) + 1) * 40);
}

function bridgeScore(bridgeTxCount: number) {
  return clamp(bridgeTxCount * 2.5);
}

function nftScore(nftCount: number) {
  return clamp(Math.log10(Math.max(0, nftCount) + 1) * 38);
}

function spamScore(spamTokenCount: number) {
  return clamp(spamTokenCount * 2);
}

function estimatedChainsUsedFromBridgeTxs(bridgeTxCount: number) {
  if (bridgeTxCount <= 0) return 1;
  return Math.max(2, Math.min(25, Math.round(Math.sqrt(bridgeTxCount)) + 1));
}

export function computeMetrics(
  input: Omit<WalletRoastAnalysis, "metrics" | "classification" | "roast_inputs" | "roast_text"> & {
    __activeDateKeys: string[];
  }
): Omit<WalletRoastAnalysis, "classification" | "roast_inputs" | "roast_text"> {
  const base = input.chains.base;
  const longestStreak = longestDateStreak(input.__activeDateKeys);

  const nonSpamHoldings = base.erc20_holdings.filter((t) => !t.is_spam);
  const pricedNonSpamHoldings = nonSpamHoldings.filter((t) => t.price_usd > 0);

  const dustUsd = pricedNonSpamHoldings
    .filter((t) => t.is_dust)
    .reduce((sum, t) => sum + t.usd_value, 0);

  const walletUsd =
    base.native_balance.usd_value + pricedNonSpamHoldings.reduce((sum, t) => sum + t.usd_value, 0);

  const defiUsd = pricedNonSpamHoldings
    .filter((t) => t.is_defi_position_token)
    .reduce((sum, t) => sum + t.usd_value, 0);

  const totalUsd = walletUsd;
  const dustRatio = totalUsd > 0 ? (dustUsd / totalUsd) * 100 : 0;
  const defiRatio = totalUsd > 0 ? (defiUsd / totalUsd) * 100 : 0;

  const txCountTotal = base.tx_count;
  const protocolCountTotal = base.protocol_count;
  const bridgeTxCount = base.bridge_tx_count;
  const nftCount = base.nft_holdings_count;
  const activeDays = base.active_days;
  const estimatedChainsUsed = estimatedChainsUsedFromBridgeTxs(bridgeTxCount);
  const spamTokenCount = base.spam_token_count ?? base.erc20_holdings.filter((t) => t.is_spam).length;
  const unpricedTokenCount = base.unpriced_token_count ?? nonSpamHoldings.filter((t) => t.price_usd <= 0).length;

  const activityIntensity = activeDays > 0 ? txCountTotal / activeDays : txCountTotal;
  const activityIntensityScore = clamp(activityIntensity * 12);

  const breakdown: ScoreBreakdown = {
    portfolio_score: round(portfolioScore(totalUsd)),
    activity_score: round(activityScore(txCountTotal)),
    consistency_score: round(consistencyScore(activeDays, longestStreak)),
    protocol_score: round(protocolScore(protocolCountTotal)),
    bridge_score: round(bridgeScore(bridgeTxCount)),
    nft_score: round(nftScore(nftCount)),
    spam_score: round(spamScore(spamTokenCount)),
    activity_intensity_score: round(activityIntensityScore),
  };

  const walletScore = clamp(
    0.15 * breakdown.portfolio_score +
      0.25 * breakdown.activity_score +
      0.20 * breakdown.consistency_score +
      0.20 * breakdown.protocol_score +
      0.10 * breakdown.bridge_score +
      0.10 * breakdown.nft_score
  );

  const degeneracyScore = clamp(
    0.20 * breakdown.activity_intensity_score +
      0.20 * breakdown.spam_score +
      0.20 * breakdown.bridge_score +
      0.20 * breakdown.nft_score +
      0.10 * clamp(dustRatio) +
      0.10 * clamp(defiRatio)
  );

  const dustTokens = pricedNonSpamHoldings.filter((t) => t.is_dust).length;

  return {
    wallet: input.wallet,
    identity: input.identity,
    portfolio: {
      total_usd: round(totalUsd, 4),
      defi_usd: round(defiUsd, 4),
      wallet_usd: round(walletUsd, 4),
      nft_usd: 0,
      dust_usd: round(dustUsd, 4),
      defi_ratio: round(defiRatio, 2),
      dust_ratio: round(dustRatio, 2),
    },
    chains: {
      ...input.chains,
      base: {
        ...base,
        longest_streak: longestStreak,
        dust_usd: round(dustUsd, 4),
        defi_usd: round(defiUsd, 4),
      },
    },
    metrics: {
      chains_used: estimatedChainsUsed,
      estimated_chains_used: estimatedChainsUsed,
      unique_tokens: nonSpamHoldings.length,
      raw_unique_tokens: base.erc20_holdings.length,
      spam_token_count: spamTokenCount,
      unpriced_token_count: unpricedTokenCount,
      dust_tokens: dustTokens,
      tx_count_total: txCountTotal,
      protocol_count_total: protocolCountTotal,
      bridge_tx_count: bridgeTxCount,
      nft_holdings_count: nftCount,
      wallet_score: round(walletScore, 2),
      degeneracy_score: round(degeneracyScore, 2),
      score_breakdown: breakdown,
    },
  };
}
