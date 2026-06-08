import { NextRequest, NextResponse } from "next/server";
import { analyzeWalletRoast } from "../../../../lib/wallet-roast/analyzeWalletRoast";
import { normalizeWalletRoastChain } from "../../../../lib/wallet-roast/chains";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = body?.wallet;

    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const chain = normalizeWalletRoastChain(body?.chain);
    const analysis = await analyzeWalletRoast(wallet, chain);
    return NextResponse.json(analysis);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analyze failed";

    if (
      message.includes("fetch failed") ||
      message.includes("Connect Timeout") ||
      message.includes("aborted")
    ) {
      return NextResponse.json(
        {
          error: "Explorer request timed out. Please try again in a moment.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
