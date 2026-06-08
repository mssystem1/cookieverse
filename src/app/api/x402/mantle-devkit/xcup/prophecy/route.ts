import { NextRequest, NextResponse } from "next/server";
import { buildPaidWorldCupProphecyResponse } from "../../../../../../lib/xcup/buildPaidWorldCupProphecyResponse";
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
    const paymentResponse = await requireMantleDevkitPayment(req, "xcup-prophecy");

    if (paymentResponse) {
      return paymentResponse;
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const result = await buildPaidWorldCupProphecyResponse({
      input: {
        homeTeam: String(body.homeTeam || ""),
        awayTeam: String(body.awayTeam || body.visitorTeam || ""),
        matchDate: String(body.matchDate || body.kickoff || ""),
      },
      payerWallet: String(body.wallet || body.address || ""),
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
            : "Mantle World Cup prophecy failed.",
      },
      {
        status: 500,
        headers: { ...mantleDevkitCorsHeaders(req), "Cache-Control": "no-store" },
      }
    );
  }
}
