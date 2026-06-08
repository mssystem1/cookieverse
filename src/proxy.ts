import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type X402Network = `${string}:${string}`;
type ProxyHandler = (req: NextRequest) => Response | Promise<Response>;

const COINBASE_X402_PATHS = new Set([
  "/api/x402/coinbase/wallet-roast/json",
  "/api/x402/coinbase/wallet-roast/identity",
  "/api/x402/coinbase/xcup/prophecy",
]);

const QUESTFLOW_X402_PATHS = new Set([
  "/api/x402/questflow/wallet-roast/identity",
  "/api/x402/questflow/xcup/prophecy",
]);

let cachedProxy: ProxyHandler | null = null;
let cachedQuestflowProxy: ProxyHandler | null = null;

const SUPPORTED_KINDS_TIMEOUT_MS = Number(
  process.env.X402_SUPPORTED_KINDS_TIMEOUT_MS || "2500"
);

function allowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (
    (origin && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) ||
    origin === "http://127.0.0.1:3000" ||
    origin === "http://localhost:3000" ||
    origin === "https://cookieverse.tech" ||
    origin === "https://www.cookieverse.tech"
  ) {
    return origin;
  }

  return "http://127.0.0.1:3000";
}

function corsHeaders(req: NextRequest) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-PAYMENT, x-payment, PAYMENT-SIGNATURE, payment-signature, X-402-Transaction-Hash, x-402-transaction-hash, X-402-Timestamp, x-402-timestamp, Access-Control-Expose-Headers, access-control-expose-headers",
    "Access-Control-Expose-Headers":
      "payment-required, PAYMENT-REQUIRED, x-payment-response, X-PAYMENT-RESPONSE, payment-response, PAYMENT-RESPONSE, X-402-Amount, X-402-Token, X-402-Network, X-402-Chain-Id, X-402-Recipient",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withCors(req: NextRequest, res: Response) {
  const headers = new Headers(res.headers);

  for (const [key, value] of Object.entries(corsHeaders(req))) {
    headers.set(key, value);
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function json(req: NextRequest, payload: unknown, status = 500) {
  return NextResponse.json(payload, {
    status,
    headers: {
      ...corsHeaders(req),
      "Cache-Control": "no-store",
    },
  });
}

function supportedFallback(network: X402Network) {
  return {
    kinds: [
      {
        x402Version: 2,
        scheme: "exact",
        network,
      },
    ],
    extensions: [],
    signers: {},
  };
}

function withSupportedKindsFallback<T extends { getSupported: () => Promise<any> }>(
  client: T,
  network: X402Network,
  label: string
): T {
  return new Proxy(client as any, {
    get(target, prop, receiver) {
      if (prop !== "getSupported") {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }

      return async () => {
        try {
          return await Promise.race([
            target.getSupported(),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `${label} facilitator supported-kind discovery timed out`
                    )
                  ),
                SUPPORTED_KINDS_TIMEOUT_MS
              )
            ),
          ]);
        } catch (error) {
          console.warn(
            `[cookieverse:x402-supported-fallback:${label}]`,
            error instanceof Error ? error.message : error
          );

          return supportedFallback(network);
        }
      };
    },
  }) as T;
}

function getNetwork(): X402Network {
  const value = process.env.X402_NETWORK || "eip155:8453";

  if (!/^[a-zA-Z0-9]+:[a-zA-Z0-9]+$/.test(value)) {
    throw new Error(`Invalid X402_NETWORK="${value}". Use eip155:8453.`);
  }

  return value as X402Network;
}

function getPayTo() {
  const payTo = process.env.X402_PAY_TO || "";

  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("Missing or invalid X402_PAY_TO");
  }

  return payTo;
}

async function buildPaymentProxy(): Promise<ProxyHandler> {
  const provider = process.env.X402_SERVER_PROVIDER || "disabled";

  if (provider !== "coinbase") {
    return (req) =>
      json(
        req,
        {
          ok: false,
          error: "Coinbase x402 server provider is disabled.",
        },
        503
      );
  }

  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    return (req) =>
      json(
        req,
        {
          ok: false,
          error: "Missing CDP_API_KEY_ID or CDP_API_KEY_SECRET.",
          hasCdpKeyId: Boolean(process.env.CDP_API_KEY_ID),
          hasCdpSecret: Boolean(process.env.CDP_API_KEY_SECRET),
        },
        500
      );
  }

  const [nextX402, evmServer, coreServer, coinbaseX402] = await Promise.all([
    import("@x402/next"),
    import("@x402/evm/exact/server"),
    import("@x402/core/server"),
    import("@coinbase/x402"),
  ]);

  const network = getNetwork();
  const payTo = getPayTo();

  const facilitatorClient = withSupportedKindsFallback(
    new coreServer.HTTPFacilitatorClient(coinbaseX402.facilitator),
    network,
    "coinbase"
  );

  const server = new nextX402.x402ResourceServer(facilitatorClient).register(
    network,
    new evmServer.ExactEvmScheme()
  );

  const handler = nextX402.paymentProxy(
    {
      "/api/x402/coinbase/wallet-roast/json": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.02",
            network,
            payTo,
          },
        ],
        description:
          "Fast Cookieverse Wallet Roast. Returns Base wallet archetype, scores, traits, and roast text.",
        mimeType: "application/json",
      },

      "/api/x402/coinbase/wallet-roast/identity": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.07",
            network,
            payTo,
          },
        ],
        description:
          "Cookieverse Onchain Identity Roast. Returns roast JSON, rendered image, and NFT metadata.",
        mimeType: "application/json",
      },

      "/api/x402/coinbase/xcup/prophecy": {
        accepts: [
          {
            scheme: "exact",
            price: process.env.X402_XCUP_PROPHECY_PRICE || "$0.1",
            network,
            payTo,
          },
        ],
        description:
          "Cookieverse World Cup Match Prophecy. Generates research-backed prophecy JSON, renders a PNG card, and returns NFT-ready metadata.",
        mimeType: "application/json",
      },
    },
    server
  );

  return handler as unknown as ProxyHandler;
}

async function buildQuestflowPaymentProxy(): Promise<ProxyHandler> {
  const enabled =
    process.env.NEXT_PUBLIC_X402_MANTLE_ENABLED === "true" &&
    process.env.X402_MANTLE_SERVER_PROVIDER === "questflow";

  if (!enabled) {
    return (req) =>
      json(
        req,
        {
          ok: false,
          error: "Mantle Questflow x402 is disabled.",
        },
        503
      );
  }

  const facilitatorUrl =
    process.env.QUESTFLOW_FACILITATOR_URL || "https://facilitator.questflow.ai";
  const apiKey = process.env.QUESTFLOW_FACILITATOR_API_KEY || "";
  const payTo = process.env.QUESTFLOW_X402_PAY_TO || "";

  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("Missing or invalid QUESTFLOW_X402_PAY_TO");
  }

  const [nextX402, evmServer, coreServer] = await Promise.all([
    import("@x402/next"),
    import("@x402/evm/exact/server"),
    import("@x402/core/server"),
  ]);

  const network = "eip155:5000" as `${string}:${string}`;
  const authHeaders = apiKey
    ? async () => {
        const value = `Bearer ${apiKey}`;
        return {
          verify: { authorization: value },
          settle: { authorization: value },
          supported: { authorization: value },
        };
      }
    : undefined;

  const facilitatorClient = withSupportedKindsFallback(
    new coreServer.HTTPFacilitatorClient({
      url: facilitatorUrl,
      createAuthHeaders: authHeaders,
    }),
    network,
    "questflow"
  );

  const server = new nextX402.x402ResourceServer(facilitatorClient).register(
    network,
    new evmServer.ExactEvmScheme()
  );

  const handler = nextX402.paymentProxy(
    {
      "/api/x402/questflow/wallet-roast/identity": {
        accepts: [
          {
            scheme: "exact",
            price: process.env.X402_MANTLE_WALLET_ROAST_PRICE || "$0.07",
            network,
            payTo,
          },
        ],
        description: "Cookieverse Wallet Roast on Mantle.",
        mimeType: "application/json",
      },

      "/api/x402/questflow/xcup/prophecy": {
        accepts: [
          {
            scheme: "exact",
            price: process.env.X402_MANTLE_XCUP_PROPHECY_PRICE || "$0.09",
            network,
            payTo,
          },
        ],
        description: "Cookieverse World Cup Prophecy on Mantle.",
        mimeType: "application/json",
      },
    },
    server
  );

  return handler as unknown as ProxyHandler;
}

async function getProxy() {
  if (process.env.NODE_ENV !== "production") {
    return buildPaymentProxy();
  }

  if (!cachedProxy) {
    cachedProxy = await buildPaymentProxy();
  }

  return cachedProxy;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isCoinbase = COINBASE_X402_PATHS.has(path);
  const isQuestflow = QUESTFLOW_X402_PATHS.has(path);

  if (!isCoinbase && !isQuestflow) {
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }

  try {
    if (isCoinbase) {
      const handler = await getProxy();
      const res = await handler(req);
      return withCors(req, res);
    }

    if (isQuestflow) {
      const handler =
        cachedQuestflowProxy ||
        (cachedQuestflowProxy = await buildQuestflowPaymentProxy());
      const res = await handler(req);
      return withCors(req, res);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[cookieverse:x402-proxy-failed]", error);

    return json(
      req,
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Cookieverse x402 proxy failed.",
      },
      500
    );
  }
}

export const config = {
  matcher: [
    "/api/x402/coinbase/wallet-roast/json",
    "/api/x402/coinbase/wallet-roast/identity",
    "/api/x402/coinbase/xcup/prophecy",
    "/api/x402/questflow/wallet-roast/identity",
    "/api/x402/questflow/xcup/prophecy",
  ],
};
