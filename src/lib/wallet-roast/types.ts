export type WalletRoastRequest = {
  wallet: string;
};

export type WalletIdentity = {
  label: string | null;
  name_tag: string | null;
  basename?: string | null;
};

export type TokenPriceSource =
  | "native_eth_price"
  | "stablecoin_heuristic"
  | "wrapped_eth_heuristic"
  | "etherscan"
  | "unknown";

export type TokenCategory =
  | "native"
  | "stablecoin"
  | "wrapped_eth"
  | "defi_position"
  | "meme"
  | "spam_or_scam"
  | "unknown";

export type TokenHolding = {
  token_address: string;
  symbol: string;
  name: string;
  amount: string;
  raw_amount?: string;
  decimals?: number;
  price_usd: number;
  price_source?: TokenPriceSource;
  usd_value: number;
  is_dust: boolean;
  is_spam?: boolean;
  is_defi_position_token: boolean;
  category?: TokenCategory;
};

export type ChainMetrics = {
  chain_id: number;
  native_balance: {
    symbol: string;
    amount: string;
    usd_value: number;
    price_usd?: number;
  };
  erc20_holdings: TokenHolding[];
  erc20_holdings_count?: number;
  priced_erc20_holdings_count?: number;
  spam_token_count?: number;
  unpriced_token_count?: number;
  defi_position_count?: number;
  nft_holdings_count: number;
  tx_count: number;
  internal_tx_count: number;
  erc20_transfer_count: number;
  erc721_transfer_count: number;
  erc1155_transfer_count: number;
  first_tx_timestamp: number | null;
  last_tx_timestamp: number | null;
  active_days: number;
  longest_streak: number;
  protocol_count: number;
  bridge_tx_count: number;
  defi_usd: number;
  dust_usd: number;
};

export type WalletPortfolio = {
  total_usd: number;
  defi_usd: number;
  wallet_usd: number;
  nft_usd: number;
  dust_usd: number;
  defi_ratio: number;
  dust_ratio: number;
};

export type ScoreBreakdown = {
  portfolio_score: number;
  activity_score: number;
  consistency_score: number;
  protocol_score: number;
  bridge_score: number;
  nft_score: number;
  spam_score: number;
  activity_intensity_score: number;
};

export type DerivedMetrics = {
  chains_used: number;
  estimated_chains_used?: number;
  unique_tokens: number;
  raw_unique_tokens?: number;
  spam_token_count?: number;
  unpriced_token_count?: number;
  dust_tokens: number;
  tx_count_total: number;
  protocol_count_total: number;
  bridge_tx_count: number;
  nft_holdings_count: number;
  wallet_score: number;
  degeneracy_score: number;
  score_breakdown?: ScoreBreakdown;
};

export type Classification = {
  archetype: string;
  tags: string[];
  confidence?: number;
  reasons?: string[];
  scores?: Record<string, number>;
};

export type RoastText = {
  headline: string;
  light_roast: string;
  savage_roast: string;
  verdict: string;
};

export type WalletRoastAnalysis = {
  wallet: string;
  identity: WalletIdentity;
  portfolio: WalletPortfolio;
  chains: Record<string, ChainMetrics>;
  metrics: DerivedMetrics;
  classification: Classification;
  roast_inputs: {
    derived_traits: string[];
  };
  roast_text?: RoastText;
};
