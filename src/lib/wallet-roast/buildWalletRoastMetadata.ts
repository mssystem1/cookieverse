import type { WalletRoastAnalysis } from "./types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function attribute(trait_type: string, value: string | number) {
  return { trait_type, value };
}

export function buildWalletRoastNftMetadata(
  analysis: WalletRoastAnalysis,
  imageUri?: string
) {
  const archetype = analysis.classification?.archetype || "Onchain Civilian";
  const headline = analysis.roast_text?.headline || "Cookieverse Wallet Roast";
  const wallet = analysis.wallet;

  const label =
    analysis.identity?.basename ||
    analysis.identity?.label ||
    analysis.identity?.name_tag ||
    shortAddress(wallet);

  return {
    name: `Cookieverse Wallet Roast: ${label}`,
    description:
      `${headline}\n\n` +
      `A Cookieverse AI wallet roast generated from Base onchain activity. ` +
      `Includes archetype, scores, traits, and roast verdict.`,
    image: imageUri,
    external_url: "https://www.cookieverse.tech/app",
    attributes: [
      attribute("Chain", "Base"),
      attribute("Archetype", archetype),
      attribute("Wallet Score", analysis.metrics.wallet_score),
      attribute("Degeneracy Score", analysis.metrics.degeneracy_score),
      attribute("TX Count", analysis.metrics.tx_count_total),
      attribute("NFT Holdings", analysis.metrics.nft_holdings_count),
      attribute("Bridge TX Count", analysis.metrics.bridge_tx_count),
      attribute("Unique Tokens", analysis.metrics.unique_tokens),
      attribute("Portfolio USD", Number(analysis.portfolio.total_usd.toFixed(2)))
    ],
    cookieverse: {
      version: "1.0",
      product: "wallet-roast-identity",
      wallet,
      basename: analysis.identity?.basename || null,
      tags: analysis.classification?.tags || [],
      traits: analysis.roast_inputs?.derived_traits || [],
      roast_text: analysis.roast_text
    }
  };
}