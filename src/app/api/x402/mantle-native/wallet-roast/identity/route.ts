import { NextRequest, NextResponse } from "next/server";
import {
  mantleNativeCorsHeaders,
  requireMantleNativePayment,
} from "../../../../../../lib/server/mantleNative402";
import { buildPaidWalletRoastResponse } from "../../../../../../lib/wallet-roast/buildPaidWalletRoastResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: mantleNativeCorsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const paymentResponse = await requireMantleNativePayment(
      req,
      "wallet-roast",
      body
    );

    if (paymentResponse) return paymentResponse;

    const result = await buildPaidWalletRoastResponse({
      walletInput: String(body.wallet || body.address || "").trim(),
      product: "identity-roast",
      provider: "cookieverse-mantle",
      chain: "mantle",
      includeImage: true,
      includeMintMetadata: true,
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: { ...mantleNativeCorsHeaders(req), "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Mantle-native wallet roast failed.",
      },
      {
        status: 500,
        headers: { ...mantleNativeCorsHeaders(req), "Cache-Control": "no-store" },
      }
    );
  }
}

