export type WalletRoastChainKey = "base" | "mantle" | "xlayer";

export type WalletRoastChainConfig = {
  key: WalletRoastChainKey;
  chainId: number;
  label: string;
  nativeSymbol: string;
  nativePriceSymbol: "ETH" | "MNT" | "OKB";
  dataSource: "etherscan-v2" | "okx-xlayer";
};

export const WALLET_ROAST_CHAINS: Record<
  WalletRoastChainKey,
  WalletRoastChainConfig
> = {
  base: {
    key: "base",
    chainId: 8453,
    label: "Base",
    nativeSymbol: "ETH",
    nativePriceSymbol: "ETH",
    dataSource: "etherscan-v2",
  },
  mantle: {
    key: "mantle",
    chainId: 5000,
    label: "Mantle",
    nativeSymbol: "MNT",
    nativePriceSymbol: "MNT",
    dataSource: "etherscan-v2",
  },
  xlayer: {
    key: "xlayer",
    chainId: 196,
    label: "X Layer",
    nativeSymbol: "OKB",
    nativePriceSymbol: "OKB",
    dataSource: "okx-xlayer",
  },
};

export function normalizeWalletRoastChain(
  value: unknown
): WalletRoastChainKey {
  const raw = String(value || "base").trim().toLowerCase();

  if (raw === "mantle") return "mantle";
  if (raw === "xlayer" || raw === "x-layer" || raw === "x_layer") {
    return "xlayer";
  }

  return "base";
}

export function getWalletRoastChainConfig(value: unknown) {
  return WALLET_ROAST_CHAINS[normalizeWalletRoastChain(value)];
}

export function getPrimaryChainMetrics<T>(
  chains: Record<string, T>,
  chain?: WalletRoastChainKey
): T {
  const preferred = chain ? chains[chain] : undefined;
  if (preferred) return preferred;

  return chains.base ?? Object.values(chains)[0];
}
