import {
  concat,
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  namehash,
  stringToBytes,
  toCoinType,
  type Address,
  type Hex,
} from "viem";
import { base, mainnet } from "viem/chains";
import { walletRoastConfig } from "./config";

const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const BASE_CHAIN_ID = 8453;

const ETHERSCAN_TIMEOUT_MS = 12_000;
const ETHERSCAN_MAX_CONCURRENT = Number(process.env.ETHERSCAN_MAX_CONCURRENT ?? "2");
const ETHERSCAN_RETRIES = Number(process.env.ETHERSCAN_RETRIES ?? "2");
const ETHERSCAN_PAGE_SIZE = Number(process.env.ETHERSCAN_PAGE_SIZE ?? "10000");
const ETHERSCAN_MAX_PAGES = Number(process.env.ETHERSCAN_MAX_PAGES ?? "10");
const CACHE_TTL_MS = 30_000;

const BASENAME_TIMEOUT_MS = 4_500;
const BASENAME_L2_RESOLVER_ADDRESS = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as const;
const BASE_RPC_URL =
  process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
const ETHEREUM_RPC_URL =
  process.env.ETHEREUM_RPC_URL ??
  process.env.MAINNET_RPC_URL ??
  process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL;
const ENABLE_BASENAME_ENSIP19_FALLBACK = process.env.ENABLE_BASENAME_ENSIP19_FALLBACK === "true";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const L2_RESOLVER_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const BASE_BRIDGE_ADDRESSES = new Set([
  "0x4200000000000000000000000000000000000010", // L2StandardBridge
  "0x4200000000000000000000000000000000000014", // L2ERC721Bridge
  "0x4200000000000000000000000000000000000016", // L2ToL1MessagePasser
]);

const BRIDGE_METHOD_HINTS = [
  "bridge",
  "swapandbridge",
  "callbridgecall",
  "startbridgetokensvia",
  "sendfrom",
  "lzsend",
  "depositeth(bytes32",
  "depositerc20(bytes32",
  "depositerc20tobridge",
  "relay",
];

const BRIDGE_METHOD_IDS = new Set([
  "0xc2288147", // bridge(...)
  "0x5f58d0d3", // swapAndBridge(...)
  "0x846a1bc6", // callBridgeCall(...)
  "0x51905636", // sendFrom(...), common LayerZero/OFT style
  "0x7648ce45", // depositETH(bytes32...), common zkLink style
]);

type EtherscanResponse<T = any> = {
  status?: string;
  message?: string;
  result?: T;
  warning?: string;
};

type Erc20Transfer = {
  hash?: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  value?: string;
  from?: string;
  to?: string;
  methodId?: string;
  functionName?: string;
};

type NftTransfer = {
  hash?: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenID?: string;
  tokenValue?: string;
  from?: string;
  to?: string;
  methodId?: string;
  functionName?: string;
};

const responseCache = new Map<string, { expiresAt: number; value: any }>();
const inFlight = new Map<string, Promise<any>>();

let activeCount = 0;
const queue: Array<() => void> = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLimited<T>(fn: () => Promise<T>): Promise<T> {
  if (activeCount >= ETHERSCAN_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }

  activeCount++;
  try {
    return await fn();
  } finally {
    activeCount--;
    const next = queue.shift();
    if (next) next();
  }
}

function buildEtherscanV2Url(params: Record<string, string>) {
  const apiKey = walletRoastConfig.basescanApiKey;
  if (!apiKey) {
    throw new Error("Missing walletRoastConfig.basescanApiKey. Use your Etherscan V2 API key here.");
  }

  const url = new URL(ETHERSCAN_V2_API);

  Object.entries({
    chainid: String(BASE_CHAIN_ID),
    apikey: apiKey,
    ...params,
  }).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function isRateLimited(payload: EtherscanResponse | null | undefined) {
  if (!payload) return false;

  const message = String(payload.message ?? "").toLowerCase();
  const result = String(payload.result ?? "").toLowerCase();

  return (
    message.includes("rate limit") ||
    result.includes("rate limit") ||
    result.includes("max rate limit") ||
    result.includes("too many requests")
  );
}

function isNoRows(payload: EtherscanResponse | null | undefined) {
  if (!payload) return false;
  const message = String(payload.message ?? "").toLowerCase();
  const result = String(payload.result ?? "").toLowerCase();
  return (
    payload.status === "0" &&
    (message.includes("no transactions") ||
      message.includes("no records") ||
      result.includes("no transactions found") ||
      result.includes("no records found"))
  );
}

function isProEndpointError(payload: EtherscanResponse | null | undefined) {
  if (!payload) return false;
  const result = String(payload.result ?? "").toLowerCase();
  return result.includes("pro endpoint") || result.includes("upgrade to api pro");
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Etherscan V2 request failed: ${res.status} ${res.statusText}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Etherscan V2 returned non-JSON response: ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function callEtherscanV2<T = any>(
  params: Record<string, string>,
  opts?: {
    timeoutMs?: number;
    retries?: number;
    cacheTtlMs?: number;
  }
): Promise<EtherscanResponse<T>> {
  const timeoutMs = opts?.timeoutMs ?? ETHERSCAN_TIMEOUT_MS;
  const retries = opts?.retries ?? ETHERSCAN_RETRIES;
  const cacheTtlMs = opts?.cacheTtlMs ?? CACHE_TTL_MS;

  const url = buildEtherscanV2Url(params);
  const now = Date.now();

  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const existing = inFlight.get(url);
  if (existing) return existing;

  const requestPromise = runLimited(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const payload = (await fetchJsonWithTimeout(url, timeoutMs)) as EtherscanResponse<T>;

        if (isRateLimited(payload)) {
          throw new Error(`Etherscan V2 rate limited: ${JSON.stringify(payload).slice(0, 200)}`);
        }

        if (isProEndpointError(payload)) {
          throw new Error(`Etherscan V2 Pro endpoint blocked on Lite plan: ${JSON.stringify(payload)}`);
        }

        responseCache.set(url, {
          expiresAt: Date.now() + cacheTtlMs,
          value: payload,
        });

        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await sleep(500 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError;
  });

  inFlight.set(url, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlight.delete(url);
  }
}

async function callEtherscanV2Paged(
  params: Record<string, string>,
  opts?: { pageSize?: number; maxPages?: number }
): Promise<EtherscanResponse<any[]>> {
  const pageSize = opts?.pageSize ?? ETHERSCAN_PAGE_SIZE;
  const maxPages = opts?.maxPages ?? ETHERSCAN_MAX_PAGES;
  const result: any[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const payload = await callEtherscanV2<any[]>({
      ...params,
      page: String(page),
      offset: String(pageSize),
      sort: params.sort ?? "asc",
    });

    if (isNoRows(payload)) {
      return { status: "1", message: "OK", result };
    }

    if (!Array.isArray(payload.result)) {
      return {
        status: payload.status ?? "0",
        message: payload.message ?? "NOTOK",
        result,
        warning: `Expected array result for ${params.action}, got ${typeof payload.result}`,
      };
    }

    result.push(...payload.result);

    if (payload.result.length < pageSize) {
      return { status: "1", message: "OK", result };
    }
  }

  return {
    status: "1",
    message: "OK",
    result,
    warning: `Pagination stopped at ${maxPages} pages. Increase ETHERSCAN_MAX_PAGES if you need deeper history.`,
  };
}

function normalizeAddr(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function toBigIntSafe(value: unknown): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    return 0n;
  }
  return 0n;
}

function getValidAddress(value: string) {
  try {
    return getAddress(value);
  } catch {
    return value;
  }
}

function createEmptyListResponse(): EtherscanResponse<any[]> {
  return { status: "1", message: "OK", result: [] };
}

function timeoutPromise<T>(ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(fallback), ms));
}

function chainIdToReverseCoinTypeHex(chainId: number) {
  if (chainId === mainnet.id) return "addr";
  return ((0x80000000 | chainId) >>> 0).toString(16).toUpperCase();
}

function addressToBasenameReverseNode(address: Address): Hex {
  const addressLabelHash = keccak256(stringToBytes(address.toLowerCase().slice(2)));
  const reverseNamespaceNode = namehash(`${chainIdToReverseCoinTypeHex(base.id)}.reverse`);
  return keccak256(concat([reverseNamespaceNode, addressLabelHash]));
}

async function ethCallJsonRpc({
  rpcUrl,
  to,
  data,
  timeoutMs,
}: {
  rpcUrl: string;
  to: Address;
  data: Hex;
  timeoutMs: number;
}): Promise<Hex | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to, data }, "latest"],
      }),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok || payload?.error) {
      return null;
    }

    const result = payload?.result;
    return typeof result === "string" && result !== "0x" ? (result as Hex) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveBasenameFromBaseL2(address: Address): Promise<string | null> {
  try {
    const node = addressToBasenameReverseNode(address);

    const data = encodeFunctionData({
      abi: L2_RESOLVER_ABI,
      functionName: "name",
      args: [node],
    });

    const result = await Promise.race([
      ethCallJsonRpc({
        rpcUrl: BASE_RPC_URL,
        to: BASENAME_L2_RESOLVER_ADDRESS,
        data,
        timeoutMs: BASENAME_TIMEOUT_MS,
      }),
      timeoutPromise<Hex | null>(BASENAME_TIMEOUT_MS + 500, null),
    ]);

    if (!result) return null;

    const decoded = decodeFunctionResult({
      abi: L2_RESOLVER_ABI,
      functionName: "name",
      data: result,
    });

    return typeof decoded === "string" && decoded.trim() ? decoded : null;
  } catch (error) {
    console.warn("resolveBasenameFromBaseL2 failed:", error);
    return null;
  }
}

async function resolveBasenameViaEnsip19(address: Address): Promise<string | null> {
  if (!ENABLE_BASENAME_ENSIP19_FALLBACK || !ETHEREUM_RPC_URL) return null;

  const client = createPublicClient({
    chain: mainnet,
    transport: http(ETHEREUM_RPC_URL, { timeout: BASENAME_TIMEOUT_MS }),
  });

  try {
    const name = await Promise.race([
      client.getEnsName({
        address,
        coinType: toCoinType(base.id),
      }),
      timeoutPromise(BASENAME_TIMEOUT_MS + 500, null),
    ]);

    return typeof name === "string" && name.trim() ? name : null;
  } catch (error) {
    // Do not fail the whole roast because ENSIP-19 reverse resolution is still flaky for some names/RPCs.
    console.warn("resolveBasenameViaEnsip19 failed:", error);
    return null;
  }
}

async function resolveBasename(address: string): Promise<string | null> {
  if (!isAddress(address)) return null;
  const checksum = getAddress(address);

  const l2Name = await resolveBasenameFromBaseL2(checksum);
  if (l2Name) return l2Name;

  return resolveBasenameViaEnsip19(checksum);
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.warn("Request failed:", result.reason);
  return fallback;
}

function normalizeFunctionName(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "");
}

function isBridgeLikeRecord(tx: any): boolean {
  const to = normalizeAddr(tx?.to);
  const from = normalizeAddr(tx?.from);
  const contract = normalizeAddr(tx?.contractAddress);
  const methodId = String(tx?.methodId ?? "").toLowerCase();
  const functionName = normalizeFunctionName(tx?.functionName);

  const addressHit =
    BASE_BRIDGE_ADDRESSES.has(to) ||
    BASE_BRIDGE_ADDRESSES.has(from) ||
    BASE_BRIDGE_ADDRESSES.has(contract);

  const methodIdHit = BRIDGE_METHOD_IDS.has(methodId);
  const functionNameHit = BRIDGE_METHOD_HINTS.some((hint) => functionName.includes(hint));

  return addressHit || methodIdHit || functionNameHit;
}

function countBridgeTransactions(inputs: {
  txs?: any[];
  internalTxs?: any[];
  tokenTransfers?: any[];
  erc721Transfers?: any[];
  erc1155Transfers?: any[];
}): number {
  const hashes = new Set<string>();

  for (const list of [
    inputs.txs ?? [],
    inputs.internalTxs ?? [],
    inputs.tokenTransfers ?? [],
    inputs.erc721Transfers ?? [],
    inputs.erc1155Transfers ?? [],
  ]) {
    for (const tx of list) {
      if (!isBridgeLikeRecord(tx)) continue;

      const hash = String(tx?.hash ?? "").toLowerCase();
      if (hash) hashes.add(hash);
    }
  }

  return hashes.size;
}

function buildErc20BalancesFromTransfers(
  tokenTransfers: Erc20Transfer[],
  wallet: string
): EtherscanResponse<any[]> {
  const walletLower = normalizeAddr(wallet);
  const byContract = new Map<
    string,
    {
      raw: bigint;
      tokenName: string;
      tokenSymbol: string;
      tokenDecimal: string;
      contractAddress: string;
    }
  >();

  for (const tx of tokenTransfers) {
    const contractAddress = normalizeAddr(tx.contractAddress);
    if (!contractAddress) continue;

    const current = byContract.get(contractAddress) ?? {
      raw: 0n,
      tokenName: tx.tokenName ?? "",
      tokenSymbol: tx.tokenSymbol ?? "",
      tokenDecimal: tx.tokenDecimal ?? "18",
      contractAddress: getValidAddress(tx.contractAddress ?? contractAddress),
    };

    const value = toBigIntSafe(tx.value);
    if (normalizeAddr(tx.to) === walletLower) current.raw += value;
    if (normalizeAddr(tx.from) === walletLower) current.raw -= value;

    current.tokenName = tx.tokenName || current.tokenName;
    current.tokenSymbol = tx.tokenSymbol || current.tokenSymbol;
    current.tokenDecimal = tx.tokenDecimal || current.tokenDecimal;

    byContract.set(contractAddress, current);
  }

  const result = [...byContract.values()]
    .filter((item) => item.raw > 0n)
    .map((item) => ({
      TokenAddress: item.contractAddress,
      TokenName: item.tokenName,
      TokenSymbol: item.tokenSymbol,
      TokenQuantity: item.raw.toString(),
      TokenDivisor: item.tokenDecimal,
      // Etherscan Lite/community transfer endpoints do not include live token prices.
      TokenPriceUSD: "0",
    }));

  return { status: "1", message: "OK", result };
}

function buildNftBalancesFromTransfers(
  erc721Transfers: NftTransfer[],
  erc1155Transfers: NftTransfer[],
  wallet: string
): EtherscanResponse<any[]> {
  const walletLower = normalizeAddr(wallet);
  const erc721Owned = new Map<string, any>();
  const erc1155Balances = new Map<string, { balance: bigint; item: any }>();

  for (const tx of erc721Transfers) {
    const contract = normalizeAddr(tx.contractAddress);
    const tokenId = String(tx.tokenID ?? "");
    if (!contract || !tokenId) continue;

    const key = `${contract}:${tokenId}`;
    if (normalizeAddr(tx.to) === walletLower) {
      erc721Owned.set(key, {
        TokenAddress: getValidAddress(tx.contractAddress ?? contract),
        TokenName: tx.tokenName ?? "",
        TokenSymbol: tx.tokenSymbol ?? "",
        TokenID: tokenId,
        TokenQuantity: "1",
        TokenType: "ERC721",
      });
    }

    if (normalizeAddr(tx.from) === walletLower && normalizeAddr(tx.to) !== walletLower) {
      erc721Owned.delete(key);
    }
  }

  for (const tx of erc1155Transfers) {
    const contract = normalizeAddr(tx.contractAddress);
    const tokenId = String(tx.tokenID ?? "");
    if (!contract || !tokenId) continue;

    const key = `${contract}:${tokenId}`;
    const value = toBigIntSafe(tx.tokenValue || "1");
    const existing = erc1155Balances.get(key) ?? {
      balance: 0n,
      item: {
        TokenAddress: getValidAddress(tx.contractAddress ?? contract),
        TokenName: tx.tokenName ?? "",
        TokenSymbol: tx.tokenSymbol ?? "",
        TokenID: tokenId,
        TokenQuantity: "0",
        TokenType: "ERC1155",
      },
    };

    if (normalizeAddr(tx.to) === walletLower) existing.balance += value;
    if (normalizeAddr(tx.from) === walletLower) existing.balance -= value;

    existing.item.TokenQuantity = existing.balance.toString();
    erc1155Balances.set(key, existing);
  }

  const erc1155Owned = [...erc1155Balances.values()]
    .filter((entry) => entry.balance > 0n)
    .map((entry) => entry.item);

  return {
    status: "1",
    message: "OK",
    result: [...erc721Owned.values(), ...erc1155Owned],
  };
}

export async function fetchBaseWalletData(wallet: string) {
  if (!isAddress(wallet)) {
    throw new Error(`Invalid wallet address: ${wallet}`);
  }

  const normalizedWallet = getAddress(wallet);

  const [
    basenameResult,
    balanceResult,
    ethPriceResult,
    txlistResult,
    txlistInternalResult,
    tokenTxResult,
    tokenNftTxResult,
    token1155TxResult,
  ] = await Promise.allSettled([
    resolveBasename(normalizedWallet),
    callEtherscanV2({
      module: "account",
      action: "balance",
      address: normalizedWallet,
      tag: "latest",
    }),
    callEtherscanV2({
      module: "stats",
      action: "ethprice",
    }),
    callEtherscanV2Paged({
      module: "account",
      action: "txlist",
      address: normalizedWallet,
      startblock: "0",
      endblock: "999999999",
      sort: "asc",
    }),
    callEtherscanV2Paged({
      module: "account",
      action: "txlistinternal",
      address: normalizedWallet,
      startblock: "0",
      endblock: "999999999",
      sort: "asc",
    }),
    callEtherscanV2Paged({
      module: "account",
      action: "tokentx",
      address: normalizedWallet,
      startblock: "0",
      endblock: "999999999",
      sort: "asc",
    }),
    callEtherscanV2Paged({
      module: "account",
      action: "tokennfttx",
      address: normalizedWallet,
      startblock: "0",
      endblock: "999999999",
      sort: "asc",
    }),
    callEtherscanV2Paged({
      module: "account",
      action: "token1155tx",
      address: normalizedWallet,
      startblock: "0",
      endblock: "999999999",
      sort: "asc",
    }),
  ]);

  const txlist = settledValue<EtherscanResponse<any[]>>(txlistResult, createEmptyListResponse());
  const txlistinternal = settledValue<EtherscanResponse<any[]>>(txlistInternalResult, createEmptyListResponse());
  const tokentx = settledValue<EtherscanResponse<any[]>>(tokenTxResult, createEmptyListResponse());
  const tokennfttx = settledValue<EtherscanResponse<any[]>>(tokenNftTxResult, createEmptyListResponse());
  const token1155tx = settledValue<EtherscanResponse<any[]>>(token1155TxResult, createEmptyListResponse());

  const txs = Array.isArray(txlist.result) ? txlist.result : [];
  const internalTxs = Array.isArray(txlistinternal.result) ? txlistinternal.result : [];
  const tokenTransfers = Array.isArray(tokentx.result) ? tokentx.result : [];
  const erc721Transfers = Array.isArray(tokennfttx.result) ? tokennfttx.result : [];
  const erc1155Transfers = Array.isArray(token1155tx.result) ? token1155tx.result : [];

  const bridgeTxCount = countBridgeTransactions({
    txs,
    internalTxs,
    tokenTransfers,
    erc721Transfers,
    erc1155Transfers,
  });

  return {
    basename: settledValue<string | null>(basenameResult, null),
    balance: settledValue<EtherscanResponse<string>>(balanceResult, {
      status: "0",
      message: "NOTOK",
      result: "0",
    }),
    ethprice: settledValue<EtherscanResponse<any>>(ethPriceResult, {
      status: "0",
      message: "NOTOK",
      result: { ethusd: "0" },
    }),
    txlist,
    txlistinternal,
    tokentx,
    tokennfttx,
    token1155tx,

    // Lite-plan-safe replacements for Pro addresstokenbalance / addresstokennftbalance.
    // They are reconstructed from transfer history, so token USD prices are handled later by heuristics.
    tokenbalance: buildErc20BalancesFromTransfers(tokenTransfers, normalizedWallet),
    nftbalance: buildNftBalancesFromTransfers(erc721Transfers, erc1155Transfers, normalizedWallet),

    bridgeTxCount,
    meta: {
      source: "etherscan-v2-lite",
      chainid: BASE_CHAIN_ID,
      warnings: [txlist.warning, txlistinternal.warning, tokentx.warning, tokennfttx.warning, token1155tx.warning].filter(Boolean),
    },
  };
}
