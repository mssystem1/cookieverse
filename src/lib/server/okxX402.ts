import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type X402Network = `${string}:${string}`;

const OKX_NETWORK = "eip155:196" as const;
const DEFAULT_ORIGIN = "http://127.0.0.1:3000";

let cachedOkxHttpServer: Promise<any> | null = null;

function allowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (
    (origin && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) ||
    origin === "https://cookieverse.tech" ||
    origin === "https://www.cookieverse.tech"
  ) {
    return origin;
  }

  return DEFAULT_ORIGIN;
}

export function okxX402CorsHeaders(req: NextRequest) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-PAYMENT, x-payment, PAYMENT-SIGNATURE, payment-signature, X-402-Transaction-Hash, x-402-transaction-hash, X-402-Timestamp, x-402-timestamp, Access-Control-Expose-Headers, access-control-expose-headers",
    "Access-Control-Expose-Headers":
      "payment-required, PAYMENT-REQUIRED, x-payment-response, X-PAYMENT-RESPONSE, payment-response, PAYMENT-RESPONSE, X-402-Amount, X-402-Token, X-402-Network, X-402-Chain-Id, X-402-Recipient",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(req: NextRequest, body: unknown, status = 500) {
  return NextResponse.json(body, {
    status,
    headers: okxX402CorsHeaders(req),
  });
}

function decodePaymentRequiredHeader(value: string | null) {
  if (!value) return null;

  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function responseFromInstructions(req: NextRequest, instructions: any) {
  const headers = new Headers(instructions.headers || {});

  for (const [key, value] of Object.entries(okxX402CorsHeaders(req))) {
    headers.set(key, value);
  }

  const decodedPaymentRequired =
    instructions.status === 402
      ? decodePaymentRequiredHeader(
          headers.get("payment-required") || headers.get("PAYMENT-REQUIRED")
        )
      : null;
  const hasInstructionBody =
    typeof instructions.body === "string"
      ? instructions.body.length > 0
      : instructions.body &&
        (!decodedPaymentRequired ||
          Object.keys(instructions.body).length > 0);

  const body =
    typeof instructions.body === "string" && hasInstructionBody
      ? instructions.body
      : hasInstructionBody
        ? JSON.stringify(instructions.body)
        : decodedPaymentRequired
          ? JSON.stringify({
              ok: false,
              error: decodedPaymentRequired.error || "Payment required",
              paymentRequired: decodedPaymentRequired,
            })
          : null;

  if ((hasInstructionBody || decodedPaymentRequired) && !headers.has("content-type")) {
    headers.set(
      "content-type",
      instructions.isHtml ? "text/html; charset=utf-8" : "application/json"
    );
  }

  return new Response(body, {
    status: instructions.status,
    headers,
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
  network: X402Network
): T {
  const timeoutMs = Number(process.env.X402_SUPPORTED_KINDS_TIMEOUT_MS || "2500");

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
                () => reject(new Error("OKX facilitator supported-kind discovery timed out")),
                timeoutMs
              )
            ),
          ]);
        } catch (error) {
          console.warn(
            "[cookieverse:okx-x402-supported-fallback]",
            error instanceof Error ? error.message : error
          );

          return supportedFallback(network);
        }
      };
    },
  }) as T;
}

class OkxNextRequestAdapter {
  constructor(private req: NextRequest) {}

  getHeader(name: string) {
    return this.req.headers.get(name) || undefined;
  }

  getMethod() {
    return this.req.method;
  }

  getPath() {
    return this.req.nextUrl.pathname;
  }

  getUrl() {
    return this.req.url;
  }

  getAcceptHeader() {
    return this.req.headers.get("accept") || "";
  }

  getUserAgent() {
    return this.req.headers.get("user-agent") || "";
  }

  getQueryParams() {
    return Object.fromEntries(this.req.nextUrl.searchParams.entries());
  }

  getQueryParam(name: string) {
    return this.req.nextUrl.searchParams.get(name) || undefined;
  }
}

async function buildOkxHttpServer() {
  const enabled =
    process.env.NEXT_PUBLIC_X402_XLAYER_ENABLED !== "false" &&
    process.env.X402_XLAYER_SERVER_PROVIDER === "okx";

  if (!enabled) {
    throw new Error("X Layer OKX x402 is disabled.");
  }

  const apiKey = process.env.OKX_X402_API_KEY || process.env.OKX_XLAYER_API_KEY || "";
  const secret =
    process.env.OKX_X402_API_SECRET || process.env.OKX_XLAYER_API_SECRET || "";
  const passphrase =
    process.env.OKX_X402_API_PASSPHRASE ||
    process.env.OKX_XLAYER_API_PASSPHRASE ||
    "";
  const payTo = process.env.OKX_X402_PAY_TO || "";

  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("Missing or invalid OKX_X402_PAY_TO");
  }

  if (!apiKey || !secret || !passphrase) {
    throw new Error(
      "Missing OKX x402 API auth envs: OKX_X402_API_KEY, OKX_X402_API_SECRET, OKX_X402_API_PASSPHRASE"
    );
  }

  const [okxCore, coreServer, evmServer] = await Promise.all([
    import("@okxweb3/x402-core"),
    import("@okxweb3/x402-core/server"),
    import("@okxweb3/x402-evm/exact/server"),
  ]);

  const facilitatorClient = withSupportedKindsFallback(
    new okxCore.OKXFacilitatorClient({
      apiKey,
      secretKey: secret,
      passphrase,
      baseUrl: process.env.OKX_X402_BASE_URL || "https://web3.okx.com",
      syncSettle: process.env.OKX_X402_SYNC_SETTLE !== "false",
    }),
    OKX_NETWORK
  );

  const server = new coreServer.x402ResourceServer(facilitatorClient);
  evmServer.registerExactEvmScheme(server, { networks: [OKX_NETWORK] });

  const routes = {
    "POST /api/x402/okx/wallet-roast/identity": {
      accepts: {
        scheme: "exact",
        price: process.env.X402_XLAYER_WALLET_ROAST_PRICE || "$0.07",
        network: OKX_NETWORK,
        payTo,
      },
      description: "Cookieverse Wallet Roast on X Layer.",
      mimeType: "application/json",
    },
    "POST /api/x402/okx/xcup/prophecy": {
      accepts: {
        scheme: "exact",
        price: process.env.X402_XLAYER_XCUP_PROPHECY_PRICE || "$0.09",
        network: OKX_NETWORK,
        payTo,
      },
      description: "Cookieverse World Cup Prophecy on X Layer.",
      mimeType: "application/json",
    },
  };

  const httpServer = new coreServer.x402HTTPResourceServer(server, routes);
  httpServer.setPollDeadline(
    Number(process.env.OKX_X402_SETTLE_POLL_DEADLINE_MS || "15000")
  );
  await httpServer.initialize();
  return httpServer;
}

async function getOkxHttpServer() {
  if (!cachedOkxHttpServer || process.env.NODE_ENV !== "production") {
    cachedOkxHttpServer = buildOkxHttpServer();
  }

  return cachedOkxHttpServer;
}

export type OkxX402PaymentGuard = {
  httpServer: any;
  context: any;
  payment?: {
    paymentPayload: any;
    paymentRequirements: any;
    declaredExtensions?: Record<string, unknown>;
  };
};

export async function requireOkxX402Payment(
  req: NextRequest
): Promise<OkxX402PaymentGuard | Response> {
  try {
    const httpServer = await getOkxHttpServer();
    const adapter = new OkxNextRequestAdapter(req);
    const context = {
      adapter,
      path: req.nextUrl.pathname,
      method: req.method,
      paymentHeader:
        adapter.getHeader("payment-signature") ||
        adapter.getHeader("PAYMENT-SIGNATURE") ||
        adapter.getHeader("x-payment") ||
        adapter.getHeader("X-PAYMENT"),
    };

    if (!httpServer.requiresPayment(context)) {
      return { httpServer, context };
    }

    const result = await httpServer.processHTTPRequest(context);

    if (result.type === "payment-error") {
      return responseFromInstructions(req, result.response);
    }

    if (result.type === "no-payment-required") {
      return { httpServer, context };
    }

    return {
      httpServer,
      context,
      payment: {
        paymentPayload: result.paymentPayload,
        paymentRequirements: result.paymentRequirements,
        declaredExtensions: result.declaredExtensions,
      },
    };
  } catch (error) {
    console.error("[cookieverse:okx-x402-payment-failed]", error);
    return json(
      req,
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Cookieverse OKX x402 payment failed.",
      },
      500
    );
  }
}

export async function settleOkxX402JsonResponse(
  req: NextRequest,
  guard: OkxX402PaymentGuard,
  body: unknown,
  status = 200
) {
  if (!guard.payment || status >= 400) {
    return NextResponse.json(body, {
      status,
      headers: okxX402CorsHeaders(req),
    });
  }

  const responseText = JSON.stringify(body ?? {});
  const responseHeaders = {
    "content-type": "application/json",
    "cache-control": "no-store",
  };

  const settleResult = await guard.httpServer.processSettlement(
    guard.payment.paymentPayload,
    guard.payment.paymentRequirements,
    guard.payment.declaredExtensions,
    {
      request: guard.context,
      responseBody: Buffer.from(responseText),
      responseHeaders,
    }
  );

  if (!settleResult.success) {
    console.error("[cookieverse:okx-x402-settle-failed]", {
      errorReason: settleResult.errorReason,
      errorMessage: settleResult.errorMessage,
      transaction: settleResult.transaction,
      network: settleResult.network,
    });
    return responseFromInstructions(req, settleResult.response);
  }

  console.info("[cookieverse:okx-x402-settled]", {
    transaction: settleResult.transaction,
    status: settleResult.status,
    network: settleResult.network,
    amount: settleResult.amount,
  });

  return NextResponse.json(body, {
    status,
    headers: {
      ...okxX402CorsHeaders(req),
      ...settleResult.headers,
      "Cache-Control": "no-store",
    },
  });
}
