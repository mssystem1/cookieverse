export const walletRoastConfig = {
  provider: process.env.WALLET_ROAST_PROVIDER || "openai",
  openaiModel: process.env.WALLET_ROAST_OPENAI_MODEL || "gpt-5-mini",

  ogPrivateKey: process.env.OG_PRIVATE_KEY || "",
  ogRpcUrl: process.env.OG_EVM_RPC_URL || "https://evmrpc-testnet.0g.ai",
  ogProviderAddress: process.env.OG_PROVIDER_ADDRESS || "",
  ogModel: process.env.OG_MODEL || "openai/gpt-oss-20b",
  ogLedgerFundAmount: Number(process.env.OG_LEDGER_FUND_AMOUNT || "3"),
  ogAutoTopUpLedger: process.env.OG_AUTO_TOP_UP_LEDGER !== "false",
  ogLedgerTopUpTargetAmount: Number(process.env.OG_LEDGER_TOP_UP_TARGET_AMOUNT || "3"),
  ogRequestTimeoutMs: Number(process.env.OG_REQUEST_TIMEOUT_MS || "60000"),

  basescanApiKey: process.env.ETHERSCAN_API_KEY || "",
  dustThresholdUsd: Number(process.env.WALLET_ROAST_DUST_THRESHOLD_USD || "5"),

  ogProviderFundAmount: Number(process.env.OG_PROVIDER_FUND_AMOUNT || "2"),
};

export function assertWalletRoastConfig(
  chain: "base" | "mantle" | "xlayer" | "arbitrum" = "base"
) {
  const missing: string[] = [];

  if (
    (chain === "base" || chain === "mantle" || chain === "arbitrum") &&
    !walletRoastConfig.basescanApiKey
  ) {
    missing.push("ETHERSCAN_API_KEY");
  }

  if (chain === "xlayer") {
    if (!process.env.OKX_XLAYER_API_KEY) missing.push("OKX_XLAYER_API_KEY");
    if (!process.env.OKX_XLAYER_API_SECRET) missing.push("OKX_XLAYER_API_SECRET");
    if (!process.env.OKX_XLAYER_API_PASSPHRASE) missing.push("OKX_XLAYER_API_PASSPHRASE");
  }

  if (walletRoastConfig.provider === "openai" && !process.env.OPENAI_API_KEY_MFC_NEW) {
    missing.push("OPENAI_API_KEY");
  }

  if (walletRoastConfig.provider === "og") {
    if (!walletRoastConfig.ogPrivateKey) missing.push("OG_PRIVATE_KEY");
    if (!walletRoastConfig.ogRpcUrl) missing.push("OG_EVM_RPC_URL");
    if (!walletRoastConfig.ogProviderAddress) missing.push("OG_PROVIDER_ADDRESS");
    if (!walletRoastConfig.ogModel) missing.push("OG_MODEL");
  }

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

