import type { Classification, WalletRoastAnalysis } from "./types";

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function topScore(scores: Record<string, number>) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
}

export function classifyArchetype(
  x: Omit<WalletRoastAnalysis, "classification" | "roast_inputs" | "roast_text">
): Classification {
  const walletScore = x.metrics.wallet_score;
  const degen = x.metrics.degeneracy_score;
  const portfolioUsd = x.portfolio.total_usd;
  const dustRatio = x.portfolio.dust_ratio;
  const defiRatio = x.portfolio.defi_ratio;
  const nftCount = x.metrics.nft_holdings_count ?? x.chains.base.nft_holdings_count;
  const bridgeTxCount = x.metrics.bridge_tx_count ?? x.chains.base.bridge_tx_count;
  const protocolCount = x.metrics.protocol_count_total;
  const spamTokenCount = x.metrics.spam_token_count ?? x.chains.base.spam_token_count ?? 0;
  const txCount = x.metrics.tx_count_total;
  const breakdown = x.metrics.score_breakdown;

  const nftScore = breakdown?.nft_score ?? clamp(Math.log10(nftCount + 1) * 38);
  const bridgeScore = breakdown?.bridge_score ?? clamp(bridgeTxCount * 2.5);
  const protocolScore = breakdown?.protocol_score ?? clamp(Math.log10(protocolCount + 1) * 40);
  const spamScore = breakdown?.spam_score ?? clamp(spamTokenCount * 2);

  const hasStrongArchetypeSignal =
    portfolioUsd >= 5_000 ||
    nftCount >= 100 ||
    bridgeTxCount >= 25 ||
    dustRatio >= 35 ||
    spamTokenCount >= 25 ||
    defiRatio >= 45 ||
    protocolCount >= 8 ||
    txCount >= 500;

  const scores: Record<string, number> = {
    "Silent Whale": portfolioUsd >= 25_000 ? clamp(walletScore * 0.65 + (100 - degen) * 0.35) : 0,
    "NFT Addict": clamp(nftScore * 0.72 + degen * 0.18 + Math.min(100, txCount / 20) * 0.10),
    "Bridge Tourist": clamp(bridgeScore * 0.72 + protocolScore * 0.14 + degen * 0.14),
    "Dust Farmer": clamp(Math.max(dustRatio, spamScore) * 0.65 + degen * 0.25 + Math.min(100, spamTokenCount) * 0.10),
    "DeFi Goblin": clamp(defiRatio * 0.50 + protocolScore * 0.25 + degen * 0.25),

    // This was not removed. It is the explicit low-signal fallback.
    // It wins when the wallet does not have enough NFT, bridge, DeFi, whale, or dust/spam signal.
    "Onchain Civilian": hasStrongArchetypeSignal
      ? clamp(25 - degen * 0.12 + Math.max(0, 15 - protocolCount) * 0.4)
      : 100,
  };

  let archetype =  hasStrongArchetypeSignal ? topScore(scores)[0] : "Onchain Civilian";

  // Hard overrides prevent high-signal wallets from falling back to Civilian just because USD prices are missing.
  if (walletScore >= 80 && portfolioUsd >= 5_000 && degen < 45) {
    archetype = "Silent Whale";
  } else if (nftCount >= 100) {
    archetype = "NFT Addict";
  } else if (bridgeTxCount >= 25) {
    archetype = "Bridge Tourist";
  } else if (nftCount >= 100 && nftScore >= 65) {
    archetype = "NFT Addict";
  } else if (bridgeTxCount >= 25 && bridgeScore >= 60) {
    archetype = "Bridge Tourist";
  } else if ((dustRatio >= 35 || spamTokenCount >= 25) && portfolioUsd < 5_000) {
    archetype = "Dust Farmer";
  } else if (defiRatio >= 45 && protocolCount >= 4) {
    archetype = "DeFi Goblin";
  } else if (!hasStrongArchetypeSignal) {
    archetype = "Onchain Civilian";
  }

  const reasons: string[] = [];
  if (archetype === "Onchain Civilian") reasons.push("low-signal Base activity profile");
  if (nftCount >= 20) reasons.push(`${nftCount} NFTs held`);
  if (bridgeTxCount >= 3) reasons.push(`${bridgeTxCount} bridge-like transactions`);
  if (protocolCount >= 10) reasons.push(`${protocolCount} contracts/protocols touched`);
  if (spamTokenCount >= 10) reasons.push(`${spamTokenCount} spam or scam-looking tokens filtered`);
  if (txCount >= 500) reasons.push(`${txCount} normal transactions`);
  if (!reasons.length) reasons.push("low-signal Base activity profile");

  return {
    archetype,
    tags: [],
    confidence: round(scores[archetype] ?? 50),
    reasons: reasons.slice(0, 4),
    scores: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, round(value)])),
  };
}
