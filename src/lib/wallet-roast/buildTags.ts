import type { WalletRoastAnalysis } from "./types";
import { getPrimaryChainMetrics } from "./chains";

function addUnique(tags: string[], tag: string) {
  if (!tags.includes(tag)) tags.push(tag);
}

export function buildTags(
  x: Omit<WalletRoastAnalysis, "classification" | "roast_inputs" | "roast_text">,
  archetype: string
): string[] {
  const tags: string[] = [];
  const primaryChain = getPrimaryChainMetrics(x.chains, x.chain);
  const nftCount = x.metrics.nft_holdings_count ?? primaryChain.nft_holdings_count;
  const bridgeTxCount = x.metrics.bridge_tx_count ?? primaryChain.bridge_tx_count;
  const spamTokenCount = x.metrics.spam_token_count ?? primaryChain.spam_token_count ?? 0;

  if (nftCount >= 100) addUnique(tags, "NFT addict");
  else if (nftCount >= 10) addUnique(tags, "NFT minter");

  if (bridgeTxCount >= 10) addUnique(tags, "bridge tourist");
  else if (bridgeTxCount >= 3) addUnique(tags, "bridge enjoyer");

  if (x.metrics.tx_count_total >= 1000) addUnique(tags, "tx machine");
  else if (x.metrics.tx_count_total >= 500) addUnique(tags, "tx spammer");

  if (spamTokenCount >= 25) addUnique(tags, "airdrop magnet");
  else if (x.portfolio.dust_ratio >= 30) addUnique(tags, "dust farmer");

  if (x.portfolio.defi_ratio >= 35 || (primaryChain.defi_position_count ?? 0) >= 2) {
    addUnique(tags, "DeFi user");
  }

  if (!tags.length) addUnique(tags, archetype.toLowerCase());

  return tags.slice(0, 4);
}
