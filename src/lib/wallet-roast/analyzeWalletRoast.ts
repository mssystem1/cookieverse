import { assertWalletRoastConfig } from "./config";
import { fetchBaseWalletData } from "./fetchBaseWalletData";
import { normalizeWalletData } from "./normalizeWalletData";
import { computeMetrics } from "./computeMetrics";
import { classifyArchetype } from "./classifyArchetype";
import { buildTags } from "./buildTags";
import { buildTraits } from "./buildTraits";
import { generateRoast } from "./generateRoast";
import { fallbackRoast } from "./fallbackRoast";
import type { TokenHolding, WalletRoastAnalysis } from "./types";

const RESPONSE_TOKEN_LIMIT = Number(process.env.WALLET_ROAST_RESPONSE_TOKEN_LIMIT ?? "25");

function tokenSortScore(token: TokenHolding) {
  if (token.is_spam) return -1;
  if (token.usd_value > 0) return token.usd_value + 1_000_000;
  if (token.is_defi_position_token) return 100_000;
  if (token.price_usd > 0) return 50_000;
  return Number(token.amount) || 0;
}

function compactForResponse(analysis: WalletRoastAnalysis): WalletRoastAnalysis {
  const base = analysis.chains.base;
  const compactHoldings = [...base.erc20_holdings]
    .sort((a, b) => tokenSortScore(b) - tokenSortScore(a))
    .slice(0, RESPONSE_TOKEN_LIMIT);

  return {
    ...analysis,
    chains: {
      ...analysis.chains,
      base: {
        ...base,
        erc20_holdings: compactHoldings,
      },
    },
  };
}

export async function analyzeWalletRoast(wallet: string): Promise<WalletRoastAnalysis> {
  assertWalletRoastConfig();

  const raw = await fetchBaseWalletData(wallet);
  const normalized = await normalizeWalletData(wallet, raw);
  const withMetrics = computeMetrics(normalized);

  const classified = classifyArchetype(withMetrics);
  const classification = {
    ...classified,
    tags: buildTags(withMetrics, classified.archetype),
  };

  const baseAnalysis: WalletRoastAnalysis = {
    ...withMetrics,
    classification,
    roast_inputs: {
      derived_traits: [],
    },
  };

  const derivedTraits = buildTraits(baseAnalysis);

  const analysis: WalletRoastAnalysis = {
    ...baseAnalysis,
    roast_inputs: { derived_traits: derivedTraits },
  };

  if (process.env.WALLET_ROAST_DEBUG === "true") {
    console.log("wallet roast summary", {
      wallet,
      basename: analysis.identity.basename,
      total_usd: analysis.portfolio.total_usd,
      tx_count: analysis.metrics.tx_count_total,
      nft_holdings_count: analysis.metrics.nft_holdings_count,
      bridge_tx_count: analysis.metrics.bridge_tx_count,
      unique_tokens: analysis.metrics.unique_tokens,
      raw_unique_tokens: analysis.metrics.raw_unique_tokens,
      spam_token_count: analysis.metrics.spam_token_count,
      archetype: analysis.classification.archetype,
    });
  }

  try {
    const roastText = await generateRoast(analysis);
    return compactForResponse({ ...analysis, roast_text: roastText });
  } catch (error) {
    console.error("generateRoast failed, using fallback:", error);
    return compactForResponse({ ...analysis, roast_text: fallbackRoast(analysis) });
  }
}
