import { NextResponse } from "next/server";
import { createOgOpenAIClient } from "../../../lib/wallet-roast/ogRoastClient";
import { walletRoastConfig } from "../../../lib/wallet-roast/config";

export async function GET() {
  try {
    const prompt = "Reply with the single word: ok";
    const { broker, openai, model } = await createOgOpenAIClient(prompt);

    const completion = await openai.chat.completions.create({
      model: walletRoastConfig.ogModel || model,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices?.[0]?.message?.content || "";

    const isValid = await broker.inference.processResponse(
      walletRoastConfig.ogProviderAddress,
      completion.id,
      content
    );

    return NextResponse.json({
      ok: true,
      provider: "og",
      model: walletRoastConfig.ogModel || model,
      providerAddress: walletRoastConfig.ogProviderAddress,
      output: content,
      isValid,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "og",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}