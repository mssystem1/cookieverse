import { NextRequest, NextResponse } from "next/server";
import { buildPaidWalletRoastResponse } from "../../../../../../lib/wallet-roast/buildPaidWalletRoastResponse";
import {
  okxX402CorsHeaders,
  requireOkxX402Payment,
  settleOkxX402JsonResponse,
} from "../../../../../../lib/server/okxX402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: okxX402CorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  try {
    const payment = await requireOkxX402Payment(req);

    if (payment instanceof Response) {
      return payment;
    }

    const body = (await req.json().catch(() => ({}))) as {
      wallet?: string;
      address?: string;
    };

    const result = await buildPaidWalletRoastResponse({
      walletInput: String(body.wallet || body.address || "").trim(),
      product: "identity-roast",
      provider: "okx",
      chain: "xlayer",
      includeImage: true,
      includeMintMetadata: true,
    });

    return settleOkxX402JsonResponse(req, payment, result.body, result.status);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "X Layer wallet roast failed.",
      },
      { status: 500, headers: okxX402CorsHeaders(req) }
    );
  }
}
