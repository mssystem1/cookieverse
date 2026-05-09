import { NextRequest, NextResponse } from "next/server";
import type { WalletRoastAnalysis } from "../../../../lib/wallet-roast/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: WalletRoastAnalysis | null = null;

  try {
    body = (await req.json()) as WalletRoastAnalysis;

    if (!body?.wallet || !body?.classification?.archetype) {
      return NextResponse.json(
        { error: "Invalid wallet roast payload" },
        { status: 400 }
      );
    }

    const mod = await import("../../../../lib/wallet-roast/renderCard");
    const png = await mod.renderCard(body);

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";

    console.error("wallet roast render failed", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      wallet: body?.wallet,
      archetype: body?.classification?.archetype,
    });

    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}