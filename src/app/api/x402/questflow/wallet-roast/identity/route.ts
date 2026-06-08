import { NextRequest, NextResponse } from "next/server";
import { buildPaidWalletRoastResponse } from "../../../../../../lib/wallet-roast/buildPaidWalletRoastResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string;
    address?: string;
  };

  const result = await buildPaidWalletRoastResponse({
    walletInput: String(body.wallet || body.address || "").trim(),
    product: "identity-roast",
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
