import type { WalletClient } from "viem";
import { mantle } from "viem/chains";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  x402Client as okxX402Client,
  x402HTTPClient as OkxX402HTTPClient,
} from "@okxweb3/x402-core/client";
import { registerExactEvmScheme as registerOkxExactEvmScheme } from "@okxweb3/x402-evm/exact/client";
import {
  getX402Endpoint,
  getX402ProviderForChain,
  type CookieverseX402Chain,
  type CookieverseX402Product,
} from "./config";

export type { CookieverseX402Chain, CookieverseX402Product } from "./config";

type PaidProvider =
  | "coinbase"
  | "bankr"
  | "questflow"
  | "mantle-devkit"
  | "cookieverse-mantle"
  | "okx";
type X402Network = `eip155:${number}`;
type PaidRequestCallback = () => void;

const x402NetworkByChain: Record<CookieverseX402Chain, X402Network> = {
  base: "eip155:8453",
  mantle: "eip155:5000",
  xlayer: "eip155:196",
  arbitrum: "eip155:42161",
};

export type CookieverseX402Response = {
  ok: boolean;
  product: CookieverseX402Product;
  provider?: PaidProvider;
  wallet: string;
  chain: CookieverseX402Chain;
  archetype?: string;
  tags?: string[];
  walletScore?: number;
  degeneracyScore?: number;
  headline?: string;
  lightRoast?: string;
  savageRoast?: string;
  verdict?: string;
  traits?: string[];
  image?: {
    cid: string;
    ipfsUri: string;
    gatewayUrl: string;
  };
  metadata?: unknown;
  raw?: any;
  error?: string;
};

export type CookieverseX402ProphecyResponse = {
  ok: boolean;
  product: "xcup-prophecy";
  provider?: Exclude<PaidProvider, "bankr">;
  chain: CookieverseX402Chain;
  payerWallet: string;
  prophecy?: any;
  image?: {
    cid: string;
    ipfsUri: string;
    gatewayUrl: string;
  };
  metadata?: unknown;
  metadataPin?: {
    cid: string;
    ipfsUri: string;
    gatewayUrl: string;
  };
  error?: string;
};

function createBrowserSigner(walletClient: WalletClient) {
  const account = walletClient.account;

  if (!account?.address) {
    throw new Error("Wallet client has no connected account.");
  }

  return {
    address: account.address,
    signTypedData: async (typedData: any) => {
      return walletClient.signTypedData({
        account,
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      } as any);
    },
  };
}

function sanitizeRequestHeaders(headersInit?: HeadersInit) {
  const headers = new Headers(headersInit);

  // These are RESPONSE headers. If they are sent as request headers,
  // browser CORS preflight can fail with "Failed to fetch".
  headers.delete("Access-Control-Expose-Headers");
  headers.delete("access-control-expose-headers");
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("access-control-allow-origin");
  headers.delete("Access-Control-Allow-Headers");
  headers.delete("access-control-allow-headers");
  headers.delete("Access-Control-Allow-Methods");
  headers.delete("access-control-allow-methods");

  return headers;
}

function decodePaymentRequiredHeader(headers: Headers) {
  const encoded =
    headers.get("payment-required") || headers.get("PAYMENT-REQUIRED");

  if (!encoded) return null;

  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function x402ResponseErrorMessage(
  response: Response,
  data: { error?: string } | null,
  fallback: string
) {
  const paymentRequired = decodePaymentRequiredHeader(response.headers);
  const paymentError =
    typeof paymentRequired?.error === "string"
      ? paymentRequired.error
      : "";

  return data?.error || paymentError || fallback;
}

const safeBrowserFetch: typeof fetch = async (input, init) => {
  const inheritedHeaders =
    init?.headers ||
    (input instanceof Request ? input.headers : undefined);

  const cleanInit: RequestInit = {
    ...init,
    headers: sanitizeRequestHeaders(inheritedHeaders),
  };

  return fetch(input as any, cleanInit);
};

function hasPaymentSignature(headersInit?: HeadersInit) {
  if (!headersInit) return false;

  const headers = new Headers(headersInit);

  return (
    headers.has("payment-signature") ||
    headers.has("x-payment") ||
    headers.has("x-payment-signature") ||
    headers.has("x-402-transaction-hash")
  );
}

function createPaidRequestAwareFetch(onPaidRequest?: PaidRequestCallback): typeof fetch {
  let notified = false;

  return async (input, init) => {
    const inheritedHeaders =
      init?.headers ||
      (input instanceof Request ? input.headers : undefined);

    if (!notified && hasPaymentSignature(inheritedHeaders)) {
      notified = true;
      onPaidRequest?.();
    }

    return safeBrowserFetch(input as any, init);
  };
}

function chainLabel(chain: CookieverseX402Chain) {
  if (chain === "base") return "Base";
  if (chain === "arbitrum") return "Arbitrum";
  if (chain === "mantle") return "Mantle";
  return "X Layer";
}

async function assertPaymentAssetBalance(
  walletClient: WalletClient,
  response: Response,
  chain: CookieverseX402Chain,
) {
  const paymentRequired = decodePaymentRequiredHeader(response.headers);
  const requirement = Array.isArray(paymentRequired?.accepts)
    ? paymentRequired.accepts[0]
    : null;
  const account = walletClient.account?.address;

  if (
    !requirement ||
    !account ||
    !/^0x[a-fA-F0-9]{40}$/.test(String(requirement.asset || "")) ||
    !/^[0-9]+$/.test(String(requirement.amount || ""))
  ) {
    return;
  }

  const data = `0x70a08231${account.slice(2).padStart(64, "0")}` as `0x${string}`;
  let result: unknown;
  try {
    result = await walletClient.request({
      method: "eth_call",
      params: [
        {
          to: requirement.asset as `0x${string}`,
          data,
        },
        "latest",
      ],
    } as any);
  } catch (error) {
    console.warn(
      "[cookieverse:x402-balance-preflight]",
      error instanceof Error ? error.message : error,
    );
    return;
  }
  const balance = BigInt(String(result || "0x0"));
  const required = BigInt(requirement.amount);

  if (balance < required) {
    const decimals = 6n;
    const format = (value: bigint) => {
      const whole = value / 10n ** decimals;
      const fraction = (value % 10n ** decimals)
        .toString()
        .padStart(Number(decimals), "0")
        .replace(/0+$/, "");
      return fraction ? `${whole}.${fraction}` : whole.toString();
    };

    throw new Error(
      `Insufficient USDC on ${chainLabel(chain)}. ` +
        `Required ${format(required)} USDC; available ${format(balance)} USDC.`,
    );
  }
}

function createCoinbasePaymentFetch(params: {
  walletClient: WalletClient;
  chain: CookieverseX402Chain;
  onPaidRequest?: PaidRequestCallback;
}): typeof fetch {
  const paidAwareFetch = createPaidRequestAwareFetch(params.onPaidRequest);

  return async (input, init) => {
    const inheritedHeaders =
      init?.headers ||
      (input instanceof Request ? input.headers : undefined);
    const response = await paidAwareFetch(input, init);

    if (response.status === 402 && !hasPaymentSignature(inheritedHeaders)) {
      await assertPaymentAssetBalance(
        params.walletClient,
        response,
        params.chain,
      );
    }

    return response;
  };
}

async function okxFetchWithPayment(params: {
  walletClient: WalletClient;
  endpoint: string;
  chain: CookieverseX402Chain;
  init: RequestInit;
  onPaidRequest?: PaidRequestCallback;
}) {
  const client = new okxX402Client();

  registerOkxExactEvmScheme(client, {
    signer: createBrowserSigner(params.walletClient) as any,
    networks: [x402NetworkByChain[params.chain]],
  });

  const httpClient = new OkxX402HTTPClient(client);
  const firstResponse = await safeBrowserFetch(params.endpoint, params.init);

  if (firstResponse.status !== 402) {
    return firstResponse;
  }

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstResponse.headers.get(name)
  );
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const headers = sanitizeRequestHeaders(params.init.headers);

  for (const [key, value] of Object.entries(paymentHeaders)) {
    headers.set(key, value);
  }

  params.onPaidRequest?.();

  const paidResponse = await safeBrowserFetch(params.endpoint, {
    ...params.init,
    headers,
  });

  if (paidResponse.ok) {
    let settlement: any = null;

    try {
      settlement = httpClient.getPaymentSettleResponse((name) =>
        paidResponse.headers.get(name)
      );
    } catch (error) {
      console.warn(
        "[cookieverse:okx-x402-settlement-missing]",
        error instanceof Error ? error.message : error
      );
    }

    if (!settlement?.transaction) {
      throw new Error(
        "OKX x402 settlement response missing; USDT0 transfer was not confirmed."
      );
    }

    console.info("[cookieverse:okx-x402-settlement]", {
      transaction: settlement.transaction,
      status: settlement.status,
      network: settlement.network,
      amount: settlement.amount,
    });
  }

  return paidResponse;
}

async function mantleDevkitFetchWithPayment(params: {
  endpoint: string;
  init: RequestInit;
}) {
  const { x402Fetch } = await import("x402-mantle-sdk/client");

  return x402Fetch(params.endpoint, params.init, {
    autoRetry: true,
    testnet: false,
  });
}

function parseJsonBody(init: RequestInit) {
  if (typeof init.body !== "string") return {};

  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

async function readJsonResponse<T>(response: Response, fallback: string) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    throw new Error(
      `${fallback} HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }
}

function mantleNativePaymentRequirement(data: any) {
  const requirement = Array.isArray(data?.accepts) ? data.accepts[0] : null;

  if (
    !requirement ||
    requirement.scheme !== "mantle-native-exact" ||
    requirement.network !== "eip155:5000" ||
    requirement.asset !== "MNT" ||
    !/^0x[a-fA-F0-9]{40}$/.test(String(requirement.payTo || "")) ||
    !/^[0-9]+$/.test(String(requirement.amount || ""))
  ) {
    throw new Error("Invalid Mantle payment requirement from Cookieverse.");
  }

  return {
    payTo: requirement.payTo as `0x${string}`,
    amount: BigInt(requirement.amount),
  };
}

async function ensureMantleChain(walletClient: WalletClient) {
  if (walletClient.chain?.id === mantle.id) return;

  if (typeof (walletClient as any).switchChain === "function") {
    await (walletClient as any).switchChain({ id: mantle.id });
    return;
  }

  throw new Error("Switch wallet to Mantle before paying with MNT.");
}

async function mantleNativeFetchWithPayment(params: {
  walletClient: WalletClient;
  endpoint: string;
  init: RequestInit;
  onPaidRequest?: PaidRequestCallback;
}) {
  const firstResponse = await safeBrowserFetch(params.endpoint, params.init);

  if (firstResponse.status !== 402) {
    return firstResponse;
  }

  const firstData = await readJsonResponse<any>(
    firstResponse,
    "Mantle payment challenge is not JSON."
  );
  const requirement = mantleNativePaymentRequirement(firstData);

  await ensureMantleChain(params.walletClient);

  const account = params.walletClient.account;

  if (!account?.address) {
    throw new Error("Wallet client has no connected account.");
  }

  const hash = await params.walletClient.sendTransaction({
    account,
    chain: mantle,
    to: requirement.payTo,
    value: requirement.amount,
  } as any);

  const body = {
    ...parseJsonBody(params.init),
    paymentTxHash: hash,
  };

  const headers = sanitizeRequestHeaders(params.init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-402-transaction-hash", hash);

  params.onPaidRequest?.();

  let paidResponse: Response = firstResponse;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    paidResponse = await safeBrowserFetch(params.endpoint, {
      ...params.init,
      headers,
      body: JSON.stringify(body),
    });

    if (paidResponse.status !== 402) {
      return paidResponse;
    }

    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 1250));
    }
  }

  return paidResponse;
}

export async function callCookieverseX402Roast(params: {
  walletClient: WalletClient;
  wallet: string;
  product: CookieverseX402Product;
  chain?: CookieverseX402Chain;
  onPaidRequest?: PaidRequestCallback;
}): Promise<CookieverseX402Response> {
  const chain = params.chain || "base";
  if (chain === "arbitrum" && params.product !== "identity-roast") {
    throw new Error(
      "Arbitrum supports only the paid identity Wallet Roast product."
    );
  }

  if (params.walletClient.chain?.id !== Number(x402NetworkByChain[chain].split(":")[1])) {
    throw new Error(`Switch wallet to ${chain === "arbitrum" ? "Arbitrum" : chain} before paying.`);
  }
  const endpoint = getX402Endpoint(params.product, chain);
  const provider = getX402ProviderForChain(chain);

  if (!endpoint) {
    throw new Error("x402 is disabled or endpoint is missing.");
  }

  const init: RequestInit = {
    method: "POST",
    headers: sanitizeRequestHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      wallet: params.wallet,
      chain,
    }),
  };

  if (provider === "okx") {
    const response = await okxFetchWithPayment({
      walletClient: params.walletClient,
      endpoint,
      chain,
      init,
      onPaidRequest: params.onPaidRequest,
    });
    const text = await response.text();
    let data: CookieverseX402Response | null = null;

    try {
      data = text ? (JSON.parse(text) as CookieverseX402Response) : null;
    } catch {
      throw new Error(
        `x402 response is not JSON. HTTP ${response.status}: ${text.slice(0, 300)}`
      );
    }

    if (!response.ok || !data?.ok) {
      throw new Error(
        x402ResponseErrorMessage(
          response,
          data,
          `x402 request failed: HTTP ${response.status}`
        )
      );
    }

    return data;
  }

  if (provider === "mantle-devkit" || provider === "cookieverse-mantle") {
    const response =
      provider === "cookieverse-mantle"
        ? await mantleNativeFetchWithPayment({
            walletClient: params.walletClient,
            endpoint,
            init,
            onPaidRequest: params.onPaidRequest,
          })
        : await mantleDevkitFetchWithPayment({
            endpoint,
            init,
          });
    const data = await readJsonResponse<CookieverseX402Response>(
      response,
      "x402 response is not JSON."
    );

    if (!response.ok || !data?.ok) {
      throw new Error(
        x402ResponseErrorMessage(
          response,
          data,
          `x402 request failed: HTTP ${response.status}`
        )
      );
    }

    return data;
  }

  const client = new x402Client();

  registerExactEvmScheme(client, {
    signer: createBrowserSigner(params.walletClient) as any,
    networks: [x402NetworkByChain[chain]],
  });

  const fetchWithPayment = wrapFetchWithPayment(
    createCoinbasePaymentFetch({
      walletClient: params.walletClient,
      chain,
      onPaidRequest: params.onPaidRequest,
    }),
    client
  );

  const response = await fetchWithPayment(endpoint, init);

  const text = await response.text();

  let data: CookieverseX402Response | null = null;

  try {
    data = text ? (JSON.parse(text) as CookieverseX402Response) : null;
  } catch {
    throw new Error(
      `x402 response is not JSON. HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok || !data?.ok) {
    throw new Error(
      x402ResponseErrorMessage(
        response,
        data,
        `x402 request failed: HTTP ${response.status}`
      )
    );
  }

  return data;
}

export async function callCookieverseX402Prophecy(params: {
  walletClient: WalletClient;
  wallet: string;
  chain: CookieverseX402Chain;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  onPaidRequest?: () => void;
}): Promise<CookieverseX402ProphecyResponse> {
  if (
    params.walletClient.chain?.id !==
    Number(x402NetworkByChain[params.chain].split(":")[1])
  ) {
    throw new Error(
      `Switch wallet to ${
        params.chain === "arbitrum" ? "Arbitrum" : params.chain
      } before paying.`
    );
  }

  const endpoint = getX402Endpoint("xcup-prophecy", params.chain);

  if (!endpoint) {
    throw new Error("x402 is disabled or endpoint is missing.");
  }

  const provider = getX402ProviderForChain(params.chain);
  const init: RequestInit = {
    method: "POST",
    headers: sanitizeRequestHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      wallet: params.wallet,
      address: params.wallet,
      chain: params.chain,
      homeTeam: params.homeTeam,
      awayTeam: params.awayTeam,
      matchDate: params.matchDate,
    }),
  };

  if (provider === "okx") {
    const response = await okxFetchWithPayment({
      walletClient: params.walletClient,
      endpoint,
      chain: params.chain,
      init,
      onPaidRequest: params.onPaidRequest,
    });
    const text = await response.text();
    let data: CookieverseX402ProphecyResponse | null = null;

    try {
      data = text ? (JSON.parse(text) as CookieverseX402ProphecyResponse) : null;
    } catch {
      throw new Error(
        `x402 response is not JSON. HTTP ${response.status}: ${text.slice(0, 300)}`
      );
    }

    if (!response.ok || !data?.ok) {
      throw new Error(
        x402ResponseErrorMessage(
          response,
          data,
          `x402 ${provider} prophecy request failed: HTTP ${response.status}`
        )
      );
    }

    return data;
  }

  if (provider === "mantle-devkit" || provider === "cookieverse-mantle") {
    const response =
      provider === "cookieverse-mantle"
        ? await mantleNativeFetchWithPayment({
            walletClient: params.walletClient,
            endpoint,
            init,
            onPaidRequest: params.onPaidRequest,
          })
        : await mantleDevkitFetchWithPayment({
            endpoint,
            init,
          });
    const data = await readJsonResponse<CookieverseX402ProphecyResponse>(
      response,
      "x402 response is not JSON."
    );

    if (!response.ok || !data?.ok) {
      throw new Error(
        x402ResponseErrorMessage(
          response,
          data,
          `x402 ${provider} prophecy request failed: HTTP ${response.status}`
        )
      );
    }

    return data;
  }

  const client = new x402Client();

  registerExactEvmScheme(client, {
    signer: createBrowserSigner(params.walletClient) as any,
    networks: [x402NetworkByChain[params.chain]],
  });

  const fetchWithPayment = wrapFetchWithPayment(
    createCoinbasePaymentFetch({
      walletClient: params.walletClient,
      chain: params.chain,
      onPaidRequest: params.onPaidRequest,
    }),
    client,
  );

  const response = await fetchWithPayment(endpoint, init);

  const text = await response.text();

  let data: CookieverseX402ProphecyResponse | null = null;

  try {
    data = text ? (JSON.parse(text) as CookieverseX402ProphecyResponse) : null;
  } catch {
    throw new Error(
      `x402 response is not JSON. HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok || !data?.ok) {
    throw new Error(
      x402ResponseErrorMessage(
        response,
        data,
        `x402 ${provider} prophecy request failed: HTTP ${response.status}`
      )
    );
  }

  return data;
}
