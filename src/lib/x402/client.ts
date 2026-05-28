import type { WalletClient } from "viem";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  getX402Endpoint,
  type CookieverseX402Product,
} from "./config";

export type { CookieverseX402Product } from "./config";

export type CookieverseX402Response = {
  ok: boolean;
  product: CookieverseX402Product;
  provider?: "coinbase" | "bankr";
  wallet: string;
  chain: "base";
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

export async function callCookieverseX402Roast(params: {
  walletClient: WalletClient;
  wallet: string;
  product: CookieverseX402Product;
}): Promise<CookieverseX402Response> {
  const endpoint = getX402Endpoint(params.product);

  if (!endpoint) {
    throw new Error("x402 is disabled or endpoint is missing.");
  }

  const client = new x402Client();

  registerExactEvmScheme(client, {
    signer: createBrowserSigner(params.walletClient) as any,
  });

  const fetchWithPayment = wrapFetchWithPayment(safeBrowserFetch, client);

  const response = await fetchWithPayment(endpoint, {
    method: "POST",
    headers: sanitizeRequestHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      wallet: params.wallet,
    }),
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
    throw new Error(data?.error || `x402 request failed: HTTP ${response.status}`);
  }

  return data;
}