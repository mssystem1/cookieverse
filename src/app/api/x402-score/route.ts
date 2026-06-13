import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type X402ScoreChain = "base" | "mantle" | "xlayer";

type X402ScoreEvent = {
  chain: X402ScoreChain;
  paymentKey: string;
  txHash: string;
  logIndex?: string;
  from: string;
  to: string;
  token?: string;
  tokenSymbol?: string;
  value?: string;
  timeStamp?: string;
  source: "etherscan-token" | "etherscan-native" | "okx-xlayer-token-transaction-list";
};

type ChainResult = {
  count: number;
  score: number;
  ok: boolean;
  source: X402ScoreEvent["source"] | "none";
  events: X402ScoreEvent[];
  error?: string;
};

const ZERO_RESULT: ChainResult = {
  count: 0,
  score: 0,
  ok: false,
  source: "none",
  events: [],
};

const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY_ENV ||
  process.env.ETHERSCAN_API_KEY ||
  process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
  "";

const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const FETCH_TIMEOUT_MS = Number(process.env.X402_SCORE_FETCH_TIMEOUT_MS || "15000");
const ETHERSCAN_PAGE_SIZE = Number(process.env.X402_SCORE_ETHERSCAN_PAGE_SIZE || "10000");

const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const XLAYER_USDT0 = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

function isHexAddress(value: string | null): value is `0x${string}` {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function lower(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTokenSymbol(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\u20ae/gi, "T");
}

function getPayTo(chain: X402ScoreChain): Address | null {
  const raw =
    chain === "base"
      ? process.env.X402_PAY_TO
      : chain === "mantle"
        ? process.env.MANTLE_PAY_TO ||
          process.env.MANTLE_NATIVE_PAY_TO ||
          process.env.X402_MANTLE_PAY_TO ||
          process.env.MANTLE_DEVKIT_X402_PAY_TO ||
          process.env.QUESTFLOW_X402_PAY_TO ||
          process.env.X402_PAY_TO
        : process.env.OKX_X402_PAY_TO || process.env.X402_PAY_TO;

  return raw && isAddress(raw) ? getAddress(raw) : null;
}

function splitAddresses(value: string | undefined, fallback: string[] = []) {
  const raw = value || "";
  const items = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const source = items.length ? items : fallback;

  return Array.from(
    new Set(
      source
        .filter((x) => isAddress(x))
        .map((x) => getAddress(x).toLowerCase()),
    ),
  );
}

function splitValues(value: string | undefined, fallback: string[] = []) {
  const raw = value || "";
  const items = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return Array.from(new Set(items.length ? items : fallback));
}

function decimalToUnits(value: string | undefined, decimals: number) {
  const raw = String(value || "").trim();
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) return "";

  const [whole, fraction = ""] = raw.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
}

function configuredBaseAllowedAmounts() {
  const fallback = [
    decimalToUnits(process.env.X402_BASE_WALLET_ROAST_PRICE_USD || "0.07", 6),
    decimalToUnits(process.env.X402_BASE_XCUP_PROPHECY_PRICE_USD || "0.10", 6),
    decimalToUnits(process.env.X402_BASE_ROAST_JSON_PRICE_USD || "0.02", 6),
    "70000",
    "100000",
    "20000",
  ].filter(Boolean);

  return new Set(
    splitValues(
      process.env.X402_BASE_ALLOWED_AMOUNTS ||
        process.env.X402_BASE_ALLOWED_RAW_AMOUNTS,
      fallback,
    ),
  );
}

function configuredMantleNativeAllowedWei() {
  const fallback = [
    process.env.MANTLE_WALLET_ROAST_PRICE_WEI || "",
    process.env.MANTLE_XCUP_PROPHECY_PRICE_WEI || "",
    decimalToUnits(process.env.MANTLE_DEVKIT_WALLET_ROAST_PRICE || "0.07", 18),
    decimalToUnits(process.env.MANTLE_DEVKIT_XCUP_PROPHECY_PRICE || "0.1", 18),
    "70000000000000000",
    "100000000000000000",
  ].filter(Boolean);

  return new Set(
    splitValues(
      process.env.X402_MANTLE_ALLOWED_NATIVE_WEI ||
        process.env.X402_MANTLE_ALLOWED_AMOUNTS_WEI,
      fallback,
    ),
  );
}

function configuredMantleTokenAllowedAmounts() {
  return new Set(
    splitValues(
      process.env.X402_MANTLE_ALLOWED_TOKEN_AMOUNTS ||
        process.env.X402_MANTLE_ALLOWED_RAW_AMOUNTS,
    ),
  );
}

function configuredXLayerAllowedAmounts() {
  const fallback = [
    process.env.X402_XLAYER_WALLET_ROAST_PRICE || "$0.07",
    process.env.X402_XLAYER_XCUP_PROPHECY_PRICE || "$0.09",
    "0.07",
    "0.09",
    "0.1",
    "70000",
    "90000",
    "100000",
  ]
    .map((x) => x.replace(/^\$/, "").trim())
    .filter(Boolean);

  return new Set(
    splitValues(
      process.env.X402_XLAYER_ALLOWED_AMOUNTS ||
        process.env.OKX_X402_ALLOWED_AMOUNTS ||
        process.env.X402_XLAYER_ALLOWED_RAW_AMOUNTS ||
        process.env.OKX_X402_ALLOWED_RAW_AMOUNTS,
      fallback,
    ).map((x) => x.replace(/^\$/, "").trim()),
  );
}

function amountIsAllowed(value: unknown, allowedAmounts: Set<string>) {
  if (!allowedAmounts.size) return true;
  return allowedAmounts.has(String(value ?? "").trim());
}

function xlayerSymbols() {
  const raw =
    process.env.X402_XLAYER_TOKEN_SYMBOLS ||
    process.env.OKX_X402_TOKEN_SYMBOLS ||
    "USDT0,USDC";

  return new Set(
    raw
      .split(",")
      .map((x) => normalizeTokenSymbol(x))
      .filter(Boolean),
  );
}

async function fetchJsonWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchEtherscan(params: Record<string, string>) {
  const url = new URL(ETHERSCAN_V2_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);

  const json = await fetchJsonWithTimeout(url.toString());

  if (json?.status === "0") {
    const result = typeof json.result === "string" ? json.result : "";
    if (/no transactions found/i.test(result)) return [];
    throw new Error(`${json.message || "Etherscan error"} ${result}`.trim());
  }

  if (!Array.isArray(json?.result)) {
    throw new Error("Unexpected Etherscan response.");
  }

  return json.result as any[];
}

function txLogKey(chain: X402ScoreChain, tx: any) {
  const hash = lower(tx.hash || tx.transactionHash || tx.txHash);
  const logIndex = String(tx.logIndex ?? tx.transactionIndex ?? "");

  if (hash && logIndex) return `${chain}:log:${hash}:${logIndex}`;
  if (hash) return `${chain}:tx:${hash}`;

  return `${chain}:fallback:${tx.blockNumber ?? ""}:${logIndex}:${tx.value ?? ""}`;
}

function uniqueEvents(events: X402ScoreEvent[]) {
  const byKey = new Map<string, X402ScoreEvent>();

  for (const event of events) {
    if (!event.paymentKey) continue;
    byKey.set(event.paymentKey, event);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const at = Number(a.timeStamp || 0);
    const bt = Number(b.timeStamp || 0);
    return at - bt;
  });
}

async function fetchEtherscanTokenPayments(params: {
  chain: "base" | "mantle";
  chainid: "8453" | "5000";
  user: Address;
  payTo: Address;
  tokenAddresses: string[];
  allowedAmounts?: Set<string>;
}): Promise<X402ScoreEvent[]> {
  if (!ETHERSCAN_API_KEY || !params.tokenAddresses.length) return [];

  const events: X402ScoreEvent[] = [];
  const user = params.user.toLowerCase();
  const payTo = params.payTo.toLowerCase();

  await Promise.all(
    params.tokenAddresses.map(async (token) => {
      const rows = await fetchEtherscan({
        chainid: params.chainid,
        module: "account",
        action: "tokentx",
        contractaddress: token,
        address: params.user,
        page: "1",
        offset: String(ETHERSCAN_PAGE_SIZE),
        sort: "asc",
      });

      for (const tx of rows) {
        const from = lower(tx.from);
        const to = lower(tx.to);
        const hash = lower(tx.hash || tx.transactionHash);

        if (
          !hash ||
          from !== user ||
          to !== payTo ||
          !amountIsAllowed(tx.value, params.allowedAmounts || new Set())
        ) {
          continue;
        }

        events.push({
          chain: params.chain,
          paymentKey: txLogKey(params.chain, tx),
          txHash: hash,
          logIndex: String(tx.logIndex ?? tx.transactionIndex ?? ""),
          from,
          to,
          token: lower(tx.contractAddress || token),
          tokenSymbol: String(tx.tokenSymbol || ""),
          value: String(tx.value ?? ""),
          timeStamp: String(tx.timeStamp ?? ""),
          source: "etherscan-token",
        });
      }
    }),
  );

  return uniqueEvents(events);
}

async function fetchMantleNativePayments(user: Address, payTo: Address): Promise<X402ScoreEvent[]> {
  if (!ETHERSCAN_API_KEY) return [];

  const allowedWei = configuredMantleNativeAllowedWei();
  const rows = await fetchEtherscan({
    chainid: "5000",
    module: "account",
    action: "txlist",
    address: user,
    page: "1",
    offset: String(ETHERSCAN_PAGE_SIZE),
    sort: "asc",
  });

  const fromUser = user.toLowerCase();
  const toPayTo = payTo.toLowerCase();
  const events: X402ScoreEvent[] = [];

  for (const tx of rows) {
    const from = lower(tx.from);
    const to = lower(tx.to);
    const hash = lower(tx.hash);
    const failed =
      String(tx.isError ?? "0") === "1" ||
      String(tx.txreceipt_status ?? "1") === "0";

    if (
      !hash ||
      failed ||
      from !== fromUser ||
      to !== toPayTo ||
      !amountIsAllowed(tx.value, allowedWei)
    ) {
      continue;
    }

    events.push({
      chain: "mantle",
      paymentKey: `mantle:tx:${hash}`,
      txHash: hash,
      from,
      to,
      token: "MNT",
      tokenSymbol: "MNT",
      value: String(tx.value ?? ""),
      timeStamp: String(tx.timeStamp ?? ""),
      source: "etherscan-native",
    });
  }

  return uniqueEvents(events);
}

const OKX_XLAYER_API_BASE_URL = (
  process.env.OKX_XLAYER_API_BASE_URL || "https://www.okx.com"
).replace(/\/+$/, "");
const OKX_XLAYER_API_KEY = process.env.OKX_XLAYER_API_KEY || "";
const OKX_XLAYER_API_SECRET = process.env.OKX_XLAYER_API_SECRET || "";
const OKX_XLAYER_API_PASSPHRASE = process.env.OKX_XLAYER_API_PASSPHRASE || "";

function buildOkxSignedHeaders(params: {
  method: "GET";
  requestPathWithQuery: string;
}): HeadersInit {
  if (!OKX_XLAYER_API_KEY || !OKX_XLAYER_API_SECRET || !OKX_XLAYER_API_PASSPHRASE) {
    throw new Error("Missing OKX X Layer API auth envs.");
  }

  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${params.method}${params.requestPathWithQuery}`;
  const sign = createHmac("sha256", OKX_XLAYER_API_SECRET)
    .update(prehash)
    .digest("base64");

  return {
    accept: "application/json, text/plain, */*",
    "user-agent": "Cookieverse/1.0",
    "OK-ACCESS-KEY": OKX_XLAYER_API_KEY,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": OKX_XLAYER_API_PASSPHRASE,
    "OK-ACCESS-SIGN": sign,
  };
}

async function fetchOkxXLayerGet(pathname: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }

  const requestPathWithQuery = `${pathname}?${searchParams.toString()}`;
  const url = `${OKX_XLAYER_API_BASE_URL}${requestPathWithQuery}`;

  return fetchJsonWithTimeout(url, {
    method: "GET",
    headers: buildOkxSignedHeaders({
      method: "GET",
      requestPathWithQuery,
    }),
  });
}

function rawOkxField(item: any, ...keys: string[]) {
  for (const key of keys) {
    const parts = key.split(".");
    let cur = item;

    for (const part of parts) {
      cur = cur?.[part];
    }

    if (cur !== null && typeof cur !== "undefined" && cur !== "") return cur;
  }

  return undefined;
}

function okxDataPage(json: any) {
  return Array.isArray(json?.data) ? json.data[0] : null;
}

function okxTotalPage(json: any) {
  const n = Number(okxDataPage(json)?.totalPage ?? "1");
  return Number.isFinite(n) && n > 0
    ? Math.min(n, Number(process.env.X402_SCORE_OKX_MAX_PAGES || "10"))
    : 1;
}

function okxTransactionList(json: any): any[] {
  const page = okxDataPage(json);
  if (Array.isArray(page?.transactionList)) return page.transactionList;
  if (Array.isArray(page?.transactionLists)) return page.transactionLists;
  return [];
}

function okxAddressLike(item: any, ...keys: string[]) {
  return lower(rawOkxField(item, ...keys));
}

function okxTokenAddress(item: any) {
  return lower(
    rawOkxField(
      item,
      "tokenContractAddress",
      "tokenAddress",
      "contractAddress",
      "token.tokenContractAddress",
      "token.address",
      "token.hash",
    ),
  );
}

function okxTxHash(item: any) {
  return lower(rawOkxField(item, "txId", "hash", "txHash", "transactionHash", "transaction_hash"));
}

async function fetchXLayerPayments(user: Address, payTo: Address): Promise<X402ScoreEvent[]> {
  const tokenAddresses = splitAddresses(
    process.env.X402_XLAYER_TOKEN_ADDRESSES ||
      process.env.OKX_X402_TOKEN_ADDRESSES ||
      process.env.X402_XLAYER_TOKEN_ADDRESS ||
      process.env.OKX_X402_TOKEN_ADDRESS,
    [XLAYER_USDT0],
  );
  const symbols = xlayerSymbols();
  const allowedAmounts = configuredXLayerAllowedAmounts();
  const events: X402ScoreEvent[] = [];

  let page = 1;
  let totalPage = 1;

  do {
    const json = await fetchOkxXLayerGet("/api/v5/xlayer/address/token-transaction-list", {
      chainShortName: "xlayer",
      address: user,
      protocolType: "token_20",
      isFromOrTo: "from",
      page: String(page),
      limit: process.env.X402_SCORE_OKX_PAGE_LIMIT || "50",
    });

    totalPage = okxTotalPage(json);

    for (const item of okxTransactionList(json)) {
      const from = okxAddressLike(item, "from", "fromAddress", "from_address", "from.address");
      const to = okxAddressLike(item, "to", "toAddress", "to_address", "to.address");
      const txHash = okxTxHash(item);
      const token = okxTokenAddress(item);
      const tokenSymbol = String(
        rawOkxField(item, "tokenSymbol", "symbol", "token.symbol") || "",
      );
      const normalizedSymbol = normalizeTokenSymbol(tokenSymbol);
      const rawValue = String(rawOkxField(item, "value", "rawAmount") || "").trim();
      const decimalValue = String(rawOkxField(item, "amount", "tokenAmount") || "").trim();

      const tokenAllowed =
        tokenAddresses.length > 0 ? tokenAddresses.includes(token) : symbols.has(normalizedSymbol);

      if (
        !txHash ||
        from !== user.toLowerCase() ||
        to !== payTo.toLowerCase() ||
        !tokenAllowed ||
        (!amountIsAllowed(rawValue, allowedAmounts) &&
          !amountIsAllowed(decimalValue, allowedAmounts))
      ) {
        continue;
      }

      const logIndex = String(
        rawOkxField(item, "logIndex", "log_index", "transactionIndex", "eventIndex") || "",
      );

      events.push({
        chain: "xlayer",
        paymentKey: logIndex ? `xlayer:log:${txHash}:${logIndex}` : `xlayer:tx:${txHash}`,
        txHash,
        logIndex,
        from,
        to,
        token,
        tokenSymbol,
        value: rawValue || decimalValue,
        timeStamp: String(
          rawOkxField(item, "timeStamp", "timestamp", "transactionTime", "txTime", "blockTime") ||
            "",
        ),
        source: "okx-xlayer-token-transaction-list",
      });
    }

    page += 1;
  } while (page <= totalPage);

  return uniqueEvents(events);
}

function resultFromEvents(
  events: X402ScoreEvent[],
  source: ChainResult["source"],
): ChainResult {
  const unique = uniqueEvents(events);
  return {
    count: unique.length,
    score: unique.length,
    ok: true,
    source,
    events: unique,
  };
}

function maybeStripEvents(result: ChainResult, includeEvents: boolean): ChainResult {
  return includeEvents ? result : { ...result, events: [] };
}

async function safeChainResult(
  fn: () => Promise<ChainResult>,
): Promise<ChainResult> {
  try {
    return await fn();
  } catch (error) {
    return {
      ...ZERO_RESULT,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchBaseResult(user: Address): Promise<ChainResult> {
  const payTo = getPayTo("base");
  const tokens = splitAddresses(process.env.X402_BASE_TOKEN_ADDRESSES, [BASE_USDC]);

  if (!payTo || !ETHERSCAN_API_KEY || !tokens.length) {
    return {
      ...ZERO_RESULT,
      error: "Missing Base x402 score config.",
    };
  }

  const events = await fetchEtherscanTokenPayments({
    chain: "base",
    chainid: "8453",
    user,
    payTo,
    tokenAddresses: tokens,
    allowedAmounts: configuredBaseAllowedAmounts(),
  });

  return resultFromEvents(events, "etherscan-token");
}

async function fetchMantleResult(user: Address): Promise<ChainResult> {
  const payTo = getPayTo("mantle");
  if (!payTo || !ETHERSCAN_API_KEY) {
    return {
      ...ZERO_RESULT,
      error: "Missing Mantle x402 score config.",
    };
  }

  const tokenAddresses = splitAddresses(
    process.env.X402_MANTLE_TOKEN_ADDRESSES ||
      process.env.X402_MANTLE_TOKEN_ADDRESS ||
      process.env.MANTLE_DEVKIT_X402_TOKEN_ADDRESS,
  );

  const [nativeEvents, tokenEvents] = await Promise.all([
    fetchMantleNativePayments(user, payTo),
    tokenAddresses.length
      ? fetchEtherscanTokenPayments({
          chain: "mantle",
          chainid: "5000",
          user,
          payTo,
          tokenAddresses,
          allowedAmounts: configuredMantleTokenAllowedAmounts(),
        })
      : Promise.resolve([]),
  ]);

  const events = uniqueEvents([...nativeEvents, ...tokenEvents]);
  return resultFromEvents(
    events,
    tokenEvents.length && !nativeEvents.length ? "etherscan-token" : "etherscan-native",
  );
}

async function fetchXLayerResult(user: Address): Promise<ChainResult> {
  const payTo = getPayTo("xlayer");
  if (!payTo) {
    return {
      ...ZERO_RESULT,
      error: "Missing X Layer x402 payTo config.",
    };
  }

  const events = await fetchXLayerPayments(user, payTo);
  return resultFromEvents(events, "okx-xlayer-token-transaction-list");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const includeEvents =
    searchParams.get("events") === "1" || searchParams.get("includeEvents") === "1";

  if (!isHexAddress(address)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing address" }, { status: 400 });
  }

  const user = getAddress(address);
  const [base, mantle, xlayer] = await Promise.all([
    safeChainResult(() => fetchBaseResult(user)),
    safeChainResult(() => fetchMantleResult(user)),
    safeChainResult(() => fetchXLayerResult(user)),
  ]);

  const totalCount = base.count + mantle.count + xlayer.count;
  const totalScore = base.score + mantle.score + xlayer.score;

  return NextResponse.json({
    ok: base.ok || mantle.ok || xlayer.ok,
    wallet: user.toLowerCase(),
    payoutWallet: {
      base: getPayTo("base")?.toLowerCase() || null,
      mantle: getPayTo("mantle")?.toLowerCase() || null,
      xlayer: getPayTo("xlayer")?.toLowerCase() || null,
    },
    byChain: {
      base: maybeStripEvents(base, includeEvents),
      mantle: maybeStripEvents(mantle, includeEvents),
      xlayer: maybeStripEvents(xlayer, includeEvents),
    },
    totalCount,
    totalScore,
  });
}
