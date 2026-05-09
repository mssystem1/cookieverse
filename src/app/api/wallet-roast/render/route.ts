import { NextRequest, NextResponse } from "next/server";
import type { WalletRoastAnalysis } from "../../../../lib/wallet-roast/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WalletRoastAnalysis;

    const mod = await import("../../../../lib/wallet-roast/renderCard");
    const png = await mod.renderCard(body);

    const bytes = new Uint8Array(png);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("wallet roast render failed", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Render failed",
      },
      { status: 500 }
    );
  }
}