import { walletRoastConfig } from "./config";
import {
  getWalletRoastChainConfig,
  type WalletRoastChainKey,
} from "./chains";
import type { WalletRoastAnalysis, ChainMetrics, TokenCategory, TokenHolding, TokenPriceSource } from "./types";

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

function normalizeAddr(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSymbol(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function rawField(obj: any, ...keys: string[]) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  }
  return undefined;
}

function parseUnitsToNumber(raw: unknown, decimals: number): number {
  const value = String(raw ?? "0");
  if (!/^\d+$/.test(value)) return 0;

  const safeDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.min(decimals, 36) : 18;
  if (safeDecimals === 0) return Number(value);

  const padded = value.padStart(safeDecimals + 1, "0");
  const whole = padded.slice(0, -safeDecimals) || "0";
  const fraction = padded.slice(-safeDecimals).replace(/0+$/, "");
  return Number(fraction ? `${whole}.${fraction}` : whole);
}

function getEthUsd(raw: any): number {
  return toNum(raw?.ethprice?.result?.ethusd, 0);
}

const STABLECOIN_ADDRESSES = new Set([
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", // USDbC on Base
  "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9", // USDC on Mantle
  "0x74b7f16337b8972027f6196a17a631ac6de26d22", // USDC on X Layer
  "0x779ded0c9e1022225f8e0630b35a9b54be713736", // USDt0 on X Layer
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // native USDC on Arbitrum
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // legacy USDC.e on Arbitrum
]);

const WETH_LIKE_ADDRESSES = new Set([
  "0x4200000000000000000000000000000000000006", // WETH on Base
  "0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7", // Aave Base WETH
  "0x48bf8fcd44e2977c8a9a744658431a8e6c0d866c", // Seamless WETH
  "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a", // weETH.base
  "0x7c307e128efa31f540f2e2d976c995e0b65f51f6", // Aave Base weETH
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111", // WETH on Mantle
  "0x5a77f1443d16ee5761d310e38b62f77f726bc71c", // X Layer bridged WETH
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH on Arbitrum
]);

function looksLikeSpamToken(name: string, symbol: string): boolean {
  const text = `${name} ${symbol}`.toLowerCase();

  return (
    /https?:\/\//.test(text) ||
    /\bwww\./.test(text) ||
    /\.(com|org|xyz|vip|pro|cash|cc|net)\b/.test(text) ||
    /\b(claim|airdrop|rewards?|collect|visit|get\s|gift|drop|voucher|bonus)\b/.test(text) ||
    /\[(.*?)\]/.test(text) ||
    text.includes("stbot") ||
    text.includes("web3eth") ||
    text.includes("liquidsteth")
  );
}

function isStableSymbol(symbol: string): boolean {
  const normalized = symbol.trim().replace("₮", "t");
  return /^(usdc|usdbc|usdt|usdt0|usd0|dai|lusd|eusd|usds|usd\+|crvusd)$/i.test(normalized);
}

function isWrappedEthLike(name: string, symbol: string): boolean {
  const text = `${name} ${symbol}`.toLowerCase();
  return /(^|\b)(weth|a?basweth|sweth|weeth|wrapped eth|wrapped eeth|seamless weth)(\b|$)/i.test(text);
}

function isDefiPositionToken(name: string, symbol: string): boolean {
  const text = `${name} ${symbol}`.toLowerCase();
  return (
    text.includes("aave") ||
    text.includes("compound") ||
    text.includes("wrapped cusdc") ||
    text.includes("wcusdc") ||
    text.includes("vault") ||
    text.includes("lp token") ||
    text.includes("staked okb") ||
    /^aBas/i.test(symbol) ||
    /^c(USDC|DAI|USDT|ETH|WBTC)/i.test(symbol) ||
    /^stOKB$/i.test(symbol) ||
    /^sWETH$/i.test(symbol) ||
    /\b(lp|vault|receipt)\b/i.test(symbol)
  );
}

const MEME_TOKEN_HINTS: Record<WalletRoastChainKey, RegExp> = {
  // Researched from current CoinGecko ecosystem/category pages and kept conservative.
  // Do not include infra/yield symbols like AERO, MNT, mETH, cmETH, or WETH.
  base: /\b(brett|toshi|degen|keycat|doginme|higher|tybg|mfer|benji|miggles|based\s*bunny|bunny|normie|mochi)\b/i,
  mantle: /\b(mantle\s*inu|minu|beardy|beardy\s*dragon|puff|puff\s*the\s*dragon)\b/i,
  xlayer: /\b(xdog|x-dog|niuma|niu\s*ma)\b/i,
  arbitrum: /\b(arbinu|aidoge|boop|arb doge)\b/i,
};

function isKnownMemeToken(
  chain: WalletRoastChainKey,
  name: string,
  symbol: string
) {
  return MEME_TOKEN_HINTS[chain].test(`${name} ${symbol}`);
}

function classifyToken(
  chain: WalletRoastChainKey,
  name: string,
  symbol: string,
  address: string,
  isSpam: boolean
): TokenCategory {
  if (isSpam) return "spam_or_scam";
  if (STABLECOIN_ADDRESSES.has(address) || isStableSymbol(symbol)) return "stablecoin";
  if (WETH_LIKE_ADDRESSES.has(address) || isWrappedEthLike(name, symbol)) return "wrapped_eth";
  if (isDefiPositionToken(name, symbol)) return "defi_position";
  if (isKnownMemeToken(chain, name, symbol)) return "meme";
  return "unknown";
}

function inferTokenPriceUsd(input: {
  address: string;
  name: string;
  symbol: string;
  explorerPrice: number;
  ethUsd: number;
  isSpam: boolean;
}): { price: number; source: TokenPriceSource } {
  if (input.isSpam) return { price: 0, source: "unknown" };
  if (input.explorerPrice > 0) return { price: input.explorerPrice, source: "etherscan" };
  if (STABLECOIN_ADDRESSES.has(input.address) || isStableSymbol(input.symbol)) {
    return { price: 1, source: "stablecoin_heuristic" };
  }
  if ((WETH_LIKE_ADDRESSES.has(input.address) || isWrappedEthLike(input.name, input.symbol)) && input.ethUsd > 0) {
    return { price: input.ethUsd, source: "wrapped_eth_heuristic" };
  }
  return { price: 0, source: "unknown" };
}

function getUniqueProtocolCount(wallet: string, lists: any[][]): number {
  const walletLower = normalizeAddr(wallet);
  const contracts = new Set<string>();

  for (const list of lists) {
    for (const item of list) {
      const to = normalizeAddr(item?.to);
      const contract = normalizeAddr(item?.contractAddress);
      const input = String(item?.input ?? "").toLowerCase();

      if (contract && contract !== ZERO_ADDRESS) contracts.add(contract);

      if (to && to !== walletLower && to !== ZERO_ADDRESS && input && input !== "0x" && input !== "deprecated") {
        contracts.add(to);
      }
    }
  }

  return contracts.size;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function normalizeWalletData(
  wallet: string,
  raw: any,
  chainKey: WalletRoastChainKey = "base"
): Promise<
  Omit<WalletRoastAnalysis, "metrics" | "classification" | "roast_inputs" | "roast_text"> & {
    __activeDateKeys: string[];
  }
> {
  const chainConfig = getWalletRoastChainConfig(chainKey);
  const ethUsd = getEthUsd(raw);

  const nativeWeiRaw = raw?.balance?.result;
  const nativeWei = typeof nativeWeiRaw === "string" && /^\d+$/.test(nativeWeiRaw) ? nativeWeiRaw : "0";
  const nativeAmount = parseUnitsToNumber(nativeWei, 18);
  const nativeUsdValue = nativeAmount * ethUsd;

  const tokenBalanceResult = asArray<any>(raw?.tokenbalance?.result);
  const txs = asArray<any>(raw?.txlist?.result);
  const internalTxs = asArray<any>(raw?.txlistinternal?.result);
  const tokenTxs = asArray<any>(raw?.tokentx?.result);
  const erc721Txs = asArray<any>(raw?.tokennfttx?.result);
  const erc1155Txs = asArray<any>(raw?.token1155tx?.result);
  const nftBalanceResult = asArray<any>(raw?.nftbalance?.result);

  const erc20Holdings: TokenHolding[] = tokenBalanceResult.map((t: any) => {
    const tokenAddress = normalizeAddr(rawField(t, "TokenAddress", "contractAddress", "tokenAddress"));
    const symbol = normalizeSymbol(rawField(t, "TokenSymbol", "tokenSymbol", "symbol"));
    const name = normalizeText(rawField(t, "TokenName", "tokenName", "name"));
    const decimals = Math.max(0, Math.min(36, toNum(rawField(t, "TokenDivisor", "tokenDecimal", "decimals"), 18)));
    const rawAmount = String(rawField(t, "TokenQuantity", "value", "balance", "amount") ?? "0");
    const amount = parseUnitsToNumber(rawAmount, decimals);
    const explorerPrice = toNum(rawField(t, "TokenPriceUSD", "price_usd", "priceUsd"), 0);
    const isSpam = looksLikeSpamToken(name, symbol);
    const { price, source } = inferTokenPriceUsd({
      address: tokenAddress,
      name,
      symbol,
      explorerPrice,
      ethUsd,
      isSpam,
    });
    const usdValue = amount * price;
    const category = classifyToken(chainConfig.key, name, symbol, tokenAddress, isSpam);
    const isDefiPosition = !isSpam && (category === "defi_position" || isDefiPositionToken(name, symbol));
    const isDust = !isSpam && price > 0 && usdValue > 0 && usdValue < walletRoastConfig.dustThresholdUsd;

    return {
      token_address: tokenAddress,
      symbol,
      name,
      amount: String(amount),
      raw_amount: rawAmount,
      decimals,
      price_usd: price,
      price_source: source,
      usd_value: usdValue,
      is_dust: isDust,
      is_spam: isSpam,
      is_defi_position_token: isDefiPosition,
      category,
    };
  });

  const allTimestampSources = [...txs, ...internalTxs, ...tokenTxs, ...erc721Txs, ...erc1155Txs];
  const timestamps = allTimestampSources
    .map((t: any) => Number(t?.timeStamp))
    .filter((x: number) => Number.isFinite(x) && x > 0);

  const firstTs = timestamps.length ? Math.min(...timestamps) : null;
  const lastTs = timestamps.length ? Math.max(...timestamps) : null;

  const activeDateKeys: string[] = uniqStrings(
    timestamps.map((ts: number) => new Date(ts * 1000).toISOString().slice(0, 10))
  );

  const spamTokenCount = erc20Holdings.filter((t) => t.is_spam).length;
  const unpricedTokenCount = erc20Holdings.filter((t) => !t.is_spam && t.price_usd <= 0).length;
  const pricedTokenCount = erc20Holdings.filter((t) => !t.is_spam && t.price_usd > 0).length;
  const defiPositionCount = erc20Holdings.filter((t) => t.is_defi_position_token).length;

  const chain: ChainMetrics = {
    chain_id: chainConfig.chainId,
    native_balance: {
      symbol: chainConfig.nativeSymbol,
      amount: nativeAmount.toFixed(6),
      usd_value: nativeUsdValue,
      price_usd: ethUsd,
    },
    erc20_holdings: erc20Holdings,
    erc20_holdings_count: erc20Holdings.length,
    priced_erc20_holdings_count: pricedTokenCount,
    spam_token_count: spamTokenCount,
    unpriced_token_count: unpricedTokenCount,
    defi_position_count: defiPositionCount,
    nft_holdings_count: nftBalanceResult.length,
    tx_count: txs.length,
    internal_tx_count: internalTxs.length,
    erc20_transfer_count: tokenTxs.length,
    erc721_transfer_count: erc721Txs.length,
    erc1155_transfer_count: erc1155Txs.length,
    first_tx_timestamp: firstTs,
    last_tx_timestamp: lastTs,
    active_days: activeDateKeys.length,
    longest_streak: 0,
    protocol_count: getUniqueProtocolCount(wallet, [txs, internalTxs, tokenTxs, erc721Txs, erc1155Txs]),
    bridge_tx_count: toNum(raw?.bridgeTxCount, 0),
    defi_usd: 0,
    dust_usd: 0,
  };

  return {
    wallet,
    chain: chainConfig.key,
    chain_label: chainConfig.label,
    identity: {
      label: raw?.basename || null,
      name_tag: raw?.basename || null,
      basename: raw?.basename || null,
    },
    portfolio: {
      total_usd: 0,
      defi_usd: 0,
      wallet_usd: 0,
      nft_usd: 0,
      dust_usd: 0,
      defi_ratio: 0,
      dust_ratio: 0,
    },
    chains: {
      [chainConfig.key]: chain,
    },
    __activeDateKeys: activeDateKeys,
  };
}
