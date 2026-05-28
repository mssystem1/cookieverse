import { NextRequest, NextResponse } from "next/server";
import { buildPaidWalletRoastResponse } from "../../../../../../lib/wallet-roast/buildPaidWalletRoastResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers(req: NextRequest) {
  const origin = req.headers.get("origin") || "http://127.0.0.1:3000";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
"Access-Control-Allow-Headers":
  "Content-Type, X-PAYMENT, x-payment, PAYMENT-SIGNATURE, payment-signature, Access-Control-Expose-Headers, access-control-expose-headers",
    "Access-Control-Expose-Headers":
      "x-payment-response, X-PAYMENT-RESPONSE, payment-response, PAYMENT-RESPONSE",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: headers(req) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string;
    address?: string;
  };

  const walletInput = String(body.wallet || body.address || "").trim();

  const result = await buildPaidWalletRoastResponse({
    walletInput,
    product: "identity-roast",
    provider: "coinbase",
    includeImage: true,
    includeMintMetadata: true,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: headers(req),
  });
}