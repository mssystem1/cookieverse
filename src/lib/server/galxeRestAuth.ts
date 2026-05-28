import { NextRequest, NextResponse } from "next/server";

function envTokens() {
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

export function isAuthorizedGalxeRestRequest(req: NextRequest) {
  const expectedTokens = envTokens();

  if (expectedTokens.length === 0) {
    console.error("[galxe-auth] Missing GALXE_ACCESS_TOKEN / GALXE_REST_SECRET / COOKIEVERSE_GALXE_SECRET");
    return false;
  }

  const candidates = [
    req.headers.get("access-token"),
    req.headers.get("x-galxe-secret"),
    req.headers.get("x-cookieverse-galxe-secret"),
    bearerToken(req),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return candidates.some((candidate) => expectedTokens.includes(candidate));
}

export function galxeCorsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") || "";

  const allowedOrigins = new Set([
    "https://dashboard.galxe.com",
    "https://galxe.com",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://cookieverse.tech",
    "https://www.cookieverse.tech",
  ]);

  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://dashboard.galxe.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
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

export function unauthorizedGalxeResponse(req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "Unauthorized Galxe REST request",
    },
    {
      status: 401,
      headers: galxeCorsHeaders(req),
    }
  );
}