import { NextRequest, NextResponse } from "next/server";
import { buildPaidWalletRoastResponse } from "../../../../../../lib/wallet-roast/buildPaidWalletRoastResponse";
import {
  mantleDevkitCorsHeaders,
  requireMantleDevkitPayment,
} from "../../../../../../lib/server/mantleDevkitX402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: mantleDevkitCorsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  try {
    const paymentResponse = await requireMantleDevkitPayment(req, "wallet-roast");

    if (paymentResponse) {
      return paymentResponse;
    }

    const body = (await req.json().catch(() => ({}))) as {
      wallet?: string;
      address?: string;
    };

    const result = await buildPaidWalletRoastResponse({
      walletInput: String(body.wallet || body.address || "").trim(),
      product: "identity-roast",
      provider: "mantle-devkit",
      chain: "mantle",
      includeImage: true,
      includeMintMetadata: true,
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: { ...mantleDevkitCorsHeaders(req), "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Mantle wallet roast failed.",
      },
      {
        status: 500,
        headers: { ...mantleDevkitCorsHeaders(req), "Cache-Control": "no-store" },
      }
    );
  }
}
