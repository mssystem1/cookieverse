export const walletRoastConfig = {
  provider: process.env.WALLET_ROAST_PROVIDER || "openai",
  openaiModel: process.env.WALLET_ROAST_OPENAI_MODEL || "gpt-5-mini",

  ogPrivateKey: process.env.OG_PRIVATE_KEY || "",
  ogRpcUrl: process.env.OG_EVM_RPC_URL || "https://evmrpc-testnet.0g.ai",
  ogProviderAddress: process.env.OG_PROVIDER_ADDRESS || "",
  ogModel: process.env.OG_MODEL || "openai/gpt-oss-20b",
  ogLedgerFundAmount: Number(process.env.OG_LEDGER_FUND_AMOUNT || "3"),

  basescanApiKey: process.env.ETHERSCAN_API_KEY || "",
  dustThresholdUsd: Number(process.env.WALLET_ROAST_DUST_THRESHOLD_USD || "1.5"),

  ogProviderFundAmount: Number(process.env.OG_PROVIDER_FUND_AMOUNT || "2"),
};

export function assertWalletRoastConfig() {
  const missing: string[] = [];

  if (!walletRoastConfig.basescanApiKey) {
    missing.push("BASESCAN_API_KEY");
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

