import { NextRequest, NextResponse } from "next/server";

type NumberParamOptions = {
  min?: number;
  max?: number;
};

const DEFAULT_GALXE_ORIGIN =
  "https://dashboard.galxe.com/6aAjqQrtdHGKpt8MqL5Voc";

const ALLOWED_ORIGINS = new Set([
  DEFAULT_GALXE_ORIGIN,
  "https://dashboard.galxe.com",
  "https://galxe.com",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://cookieverse.tech",
  "https://www.cookieverse.tech",
]);

function allowedOrigin(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }

  return DEFAULT_GALXE_ORIGIN;
}

export function galxeCorsHeaders(req?: NextRequest) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": [
      "Content-Type",
      "access-token",
      "Access-Token",
      "Authorization",
      "X-Galxe-Secret",
      "X-Cookieverse-Galxe-Secret",
    ].join(", "),
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export function galxeOptions(req?: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: galxeCorsHeaders(req),
  });
}

export function galxeJson(payload: unknown, status = 200, req?: NextRequest) {
  return NextResponse.json(payload, {
    status,
    headers: galxeCorsHeaders(req),
  });
}

export function normalizeEvmAddress(value: string | null | undefined) {
  const address = String(value || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }

  return address.toLowerCase() as `0x${string}`;
}

export function numberParam(
  req: NextRequest,
  name: string,
  fallback: number,
  options: NumberParamOptions = {},
) {
  const raw = req.nextUrl.searchParams.get(name);

  if (raw === null || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  const int = Math.floor(value);

  if (typeof options.min === "number" && int < options.min) {
    return options.min;
  }

  if (typeof options.max === "number" && int > options.max) {
    return options.max;
  }

  return int;
}

export function stringParam(req: NextRequest, name: string, fallback: string) {
  const value = req.nextUrl.searchParams.get(name);

  if (!value) {
    return fallback;
  }

  return value.trim() || fallback;
}

function expectedGalxeTokens() {
  return [
    process.env.GALXE_ACCESS_TOKEN,
    process.env.GALXE_REST_SECRET,
    process.env.COOKIEVERSE_GALXE_SECRET,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function bearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice("bearer ".length).trim();
}

export function requireGalxeSecret(req: NextRequest) {
  const expectedTokens = expectedGalxeTokens();

  if (expectedTokens.length === 0) {
    const error = new Error(
      "Missing GALXE_ACCESS_TOKEN / GALXE_REST_SECRET / COOKIEVERSE_GALXE_SECRET",
    ) as Error & { status?: number };

    error.status = 500;
    throw error;
  }

  const candidates = [
    req.headers.get("access-token"),
    req.headers.get("Access-Token"),
    req.headers.get("x-galxe-secret"),
    req.headers.get("x-cookieverse-galxe-secret"),
    bearerToken(req),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const ok = candidates.some((candidate) => expectedTokens.includes(candidate));

  if (!ok) {
    const error = new Error("Unauthorized Galxe REST request") as Error & {
      status?: number;
    };

    error.status = 401;
    throw error;
  }
}