import { NextRequest, NextResponse } from "next/server";
import { buildPaidWorldCupProphecyResponse } from "../../../../../../lib/xcup/buildPaidWorldCupProphecyResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const result = await buildPaidWorldCupProphecyResponse({
    input: {
      homeTeam: String(body.homeTeam || ""),
      awayTeam: String(body.awayTeam || ""),
      matchDate: String(body.matchDate || body.kickoff || ""),
    },
    payerWallet: String(body.wallet || body.address || ""),
    provider: "questflow",
    chain: "mantle",
    includeImage: true,
    includeMintMetadata: true,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
