import { NextRequest, NextResponse } from "next/server";
import { request as httpsRequest } from "node:https";

type MantleDevkitProduct = "wallet-roast" | "xcup-prophecy";

const DEFAULT_MANTLE_DEVKIT_ORIGIN = "https://mantle-devkit.vercel.app";

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

export function mantleDevkitCorsHeaders(req: NextRequest) {
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

export function withMantleDevkitCors(req: NextRequest, res: Response) {
  const headers = new Headers(res.headers);

  for (const [key, value] of Object.entries(mantleDevkitCorsHeaders(req))) {
    headers.set(key, value);
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function payTo() {
  return (
    process.env.MANTLE_DEVKIT_X402_PAY_TO ||
    process.env.X402_MANTLE_PAY_TO ||
    process.env.QUESTFLOW_X402_PAY_TO ||
    process.env.X402_PAY_TO ||
    ""
  );
}

function apiEndpoint() {
  const explicit = (
    process.env.MANTLE_DEVKIT_API_ENDPOINT ||
    process.env.MANTLE_DEVKIT_VALIDATE_ENDPOINT ||
    ""
  ).trim();

  if (explicit) return explicit;

  const appId = (process.env.MANTLE_DEVKIT_APP_ID || "").trim();

  if (!appId) {
    throw new Error(
      "Missing MANTLE_DEVKIT_API_ENDPOINT or MANTLE_DEVKIT_APP_ID from the Mantle DevKit dashboard."
    );
  }

  return `${DEFAULT_MANTLE_DEVKIT_ORIGIN}/api/v1/validate?appId=${encodeURIComponent(
    appId
  )}`;
}

function sdkAppId() {
  const explicit = (
    process.env.X402_APP_ID ||
    process.env.NEXT_PUBLIC_X402_APP_ID ||
    process.env.MANTLE_DEVKIT_X402_APP_ID ||
    ""
  ).trim();

  if (explicit) return explicit;

  try {
    const endpointAppId = new URL(apiEndpoint()).searchParams.get("appId") || "";
    if (endpointAppId.trim()) return endpointAppId.trim();
  } catch {}

  return (process.env.MANTLE_DEVKIT_APP_ID || "").trim();
}

function shouldUseDevkitTlsFallback(error: unknown) {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.MANTLE_DEVKIT_INSECURE_TLS_FALLBACK === "false") return false;
  if (process.env.MANTLE_DEVKIT_INSECURE_TLS_FALLBACK === "true") return true;

  const message =
    error instanceof Error ? `${error.message} ${(error as any).cause || ""}` : String(error);

  return /fetch failed|self.?signed|certificate|tls/i.test(message);
}

function insecureDevkitFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  );

  if (url.origin !== DEFAULT_MANTLE_DEVKIT_ORIGIN) {
    return fetch(input, init);
  }

  return new Promise<Response>((resolve, reject) => {
    const headers = new Headers(init?.headers);
    const req = httpsRequest(
      url,
      {
        method: init?.method || "GET",
        headers: Object.fromEntries(headers.entries()),
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const responseHeaders = new Headers();

          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) responseHeaders.append(key, item);
            } else if (typeof value === "string") {
              responseHeaders.set(key, value);
            }
          }

          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode || 200,
              statusText: res.statusMessage,
              headers: responseHeaders,
            })
          );
        });
      }
    );

    req.on("error", reject);

    if (init?.body) {
      req.write(init.body as any);
    }

    req.end();
  });
}

function paymentOptions(product: MantleDevkitProduct) {
  const seller = payTo();
  const validateEndpoint = apiEndpoint();
  const network = process.env.MANTLE_DEVKIT_NETWORK || "mantle-sepolia";
  const testnet =
    network !== "mantle" && process.env.MANTLE_DEVKIT_TESTNET !== "false";

  if (!/^0x[a-fA-F0-9]{40}$/.test(seller)) {
    throw new Error(
      "Missing or invalid MANTLE_DEVKIT_X402_PAY_TO. Use the Mantle DevKit dashboard payout wallet."
    );
  }

  const price =
    product === "xcup-prophecy"
      ? process.env.MANTLE_DEVKIT_XCUP_PROPHECY_PRICE ||
        process.env.X402_MANTLE_XCUP_PROPHECY_PRICE ||
        "0.09"
      : process.env.MANTLE_DEVKIT_WALLET_ROAST_PRICE ||
        process.env.X402_MANTLE_WALLET_ROAST_PRICE ||
        "0.07";

  return {
    price,
    token: process.env.MANTLE_DEVKIT_X402_TOKEN || "USDC",
    testnet,
    network,
    payTo: seller,
    apiEndpoint: validateEndpoint,
    validateEndpoint,
    validationEndpoint: validateEndpoint,
  };
}

async function importServerSdk() {
  return (0, eval)('import("x402-mantle-sdk/server")') as Promise<any>;
}

function isPaymentSuccess(result: any) {
  return (
    result === true ||
    result?.success === true ||
    result?.verified === true ||
    result?.paid === true ||
    result?.type === "payment-verified" ||
    result?.type === "no-payment-required" ||
    result?.status === 200
  );
}

function responseFromResult(result: any) {
  if (!result || isPaymentSuccess(result)) return null;

  if (result.paymentRequired) {
    const paymentRequired = result.paymentRequired;
    const headers = new Headers(paymentRequired.headers || {});

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return new Response(JSON.stringify(paymentRequired.body || {}), {
      status: paymentRequired.status || 402,
      headers,
    });
  }

  if (result.error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: result.error.message || "Mantle DevKit payment failed.",
      }),
      {
        status: result.error.status || 500,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const rawResponse = result.response || result;

  if (rawResponse instanceof Response) {
    return rawResponse;
  }

  const body =
    typeof rawResponse.body === "string"
      ? rawResponse.body
      : JSON.stringify(
          rawResponse.body ||
            rawResponse.paymentRequest ||
            rawResponse.paymentRequirements ||
            rawResponse
        );

  return new Response(body, {
    status: rawResponse.status || result.status || 402,
    headers: {
      "content-type": "application/json",
      ...(rawResponse.headers || {}),
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasMantlePaymentProof(headers: Headers) {
  return Boolean(
    headers.get("x-402-transaction-hash") ||
      headers.get("X-402-Transaction-Hash") ||
      headers.get("payment-signature") ||
      headers.get("PAYMENT-SIGNATURE") ||
      headers.get("x-payment") ||
      headers.get("X-PAYMENT")
  );
}

function resultStatus(result: any) {
  return (
    result?.paymentRequired?.status ||
    result?.error?.status ||
    result?.response?.status ||
    result?.status ||
    0
  );
}

export async function requireMantleDevkitPayment(
  req: NextRequest,
  product: MantleDevkitProduct
) {
  const enabled =
    process.env.NEXT_PUBLIC_X402_MANTLE_ENABLED === "true" &&
    process.env.X402_MANTLE_SERVER_PROVIDER === "mantle-devkit";

  if (!enabled) {
    return NextResponse.json(
      { ok: false, error: "Mantle DevKit x402 is disabled." },
      { status: 503, headers: mantleDevkitCorsHeaders(req) }
    );
  }

  let sdk: any;

  try {
    sdk = await importServerSdk();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mantle DevKit x402 SDK is not installed. Run npm install so x402-mantle-sdk is present in node_modules.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503, headers: mantleDevkitCorsHeaders(req) }
    );
  }

  const processPaymentMiddleware = sdk.processPaymentMiddleware;

  if (typeof processPaymentMiddleware !== "function") {
    return NextResponse.json(
      {
        ok: false,
        error: "x402-mantle-sdk/server does not export processPaymentMiddleware.",
        exports: Object.keys(sdk).sort(),
      },
      { status: 500, headers: mantleDevkitCorsHeaders(req) }
    );
  }

  if (typeof sdk.initializePlatform === "function") {
    const appId = sdkAppId();

    if (appId && !process.env.X402_APP_ID) {
      process.env.X402_APP_ID = appId;
    }

    if (
      process.env.MANTLE_DEVKIT_PLATFORM_URL &&
      !process.env.X402_PLATFORM_URL
    ) {
      process.env.X402_PLATFORM_URL = process.env.MANTLE_DEVKIT_PLATFORM_URL;
    }

    try {
      await sdk.initializePlatform();
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Mantle DevKit platform initialization failed.",
          tlsFallbackDisabled: shouldUseDevkitTlsFallback(error),
        },
        { status: 503, headers: mantleDevkitCorsHeaders(req) }
      );
    }
  }

  let result: any;
  const options = paymentOptions(product);
  const retryDelays = hasMantlePaymentProof(req.headers)
    ? [1400, 2600, 4200, 6500]
    : [];

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      result = await processPaymentMiddleware(
        options,
        req.headers,
        req.nextUrl.pathname,
        req.method
      );
    } catch (error) {
      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Mantle DevKit payment middleware failed.",
        },
        { status: 500, headers: mantleDevkitCorsHeaders(req) }
      );
    }

    if (
      isPaymentSuccess(result) ||
      resultStatus(result) !== 402 ||
      attempt >= retryDelays.length
    ) {
      break;
    }

    await sleep(retryDelays[attempt]);
  }

  const response = responseFromResult(result);
  return response ? withMantleDevkitCors(req, response) : null;
}
