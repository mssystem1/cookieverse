import { NextResponse } from "next/server";
import { getWalletRoastOpenAIClient } from "../../../lib/wallet-roast/openaiClient";
import { walletRoastConfig } from "../../../lib/wallet-roast/config";

export async function GET() {
  try {
    const client = getWalletRoastOpenAIClient();

    const response = await client.responses.create({
      model: walletRoastConfig.openaiModel,
      input: "Reply with the single word: ok",
    });

    return NextResponse.json({
      ok: true,
      provider: "openai",
      model: walletRoastConfig.openaiModel,
      output: response.output_text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "openai",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}