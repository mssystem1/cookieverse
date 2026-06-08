import { NextRequest, NextResponse } from "next/server";
import {
  mantleNativeCorsHeaders,
  requireMantleNativePayment,
} from "../../../../../../lib/server/mantleNative402";
import { buildPaidWorldCupProphecyResponse } from "../../../../../../lib/xcup/buildPaidWorldCupProphecyResponse";

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
      "xcup-prophecy",
      body
    );

    if (paymentResponse) return paymentResponse;

    const result = await buildPaidWorldCupProphecyResponse({
      input: {
        homeTeam: String(body.homeTeam || ""),
        awayTeam: String(body.awayTeam || body.visitorTeam || ""),
        matchDate: String(body.matchDate || body.kickoff || ""),
      },
      payerWallet: String(body.wallet || body.address || ""),
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
            : "Mantle-native World Cup prophecy failed.",
      },
      {
        status: 500,
        headers: { ...mantleNativeCorsHeaders(req), "Cache-Control": "no-store" },
      }
    );
  }
}

