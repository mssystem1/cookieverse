import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type X402Network = `${string}:${string}`;
type ProxyHandler = (req: NextRequest) => Response | Promise<Response>;

const COINBASE_X402_PATHS = new Set([
  "/api/x402/coinbase/wallet-roast/json",
  "/api/x402/coinbase/wallet-roast/identity",
]);

let cachedProxy: ProxyHandler | null = null;

function allowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (
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
      "Content-Type, X-PAYMENT, x-payment, PAYMENT-SIGNATURE, payment-signature, Access-Control-Expose-Headers, access-control-expose-headers",
    "Access-Control-Expose-Headers":
      "payment-required, PAYMENT-REQUIRED, x-payment-response, X-PAYMENT-RESPONSE, payment-response, PAYMENT-RESPONSE",
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

  const facilitatorClient = new coreServer.HTTPFacilitatorClient(
    coinbaseX402.facilitator
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
  if (!COINBASE_X402_PATHS.has(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }

  try {
    const handler = await getProxy();
    const res = await handler(req);
    return withCors(req, res);
  } catch (error) {
    console.error("[cookieverse:coinbase-x402-proxy-failed]", error);

    return json(
      req,
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Cookieverse Coinbase x402 proxy failed.",
      },
      500
    );
  }
}

export const config = {
  matcher: [
    "/api/x402/coinbase/wallet-roast/json",
    "/api/x402/coinbase/wallet-roast/identity",
  ],
};