import { getWalletRoastOpenAIClient } from "./openaiClient";
import { walletRoastConfig } from "./config";
import { buildRoastPrompt } from "./buildRoastPrompt";
import type { WalletRoastAnalysis, RoastText } from "./types";

function parseJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const fenced =
      content.match(/```json\s*([\s\S]*?)```/i)?.[1] ||
      content.match(/```([\s\S]*?)```/i)?.[1] ||
      content;
    return JSON.parse(fenced);
  }
}

function isValidRoast(x: any): x is RoastText {
  return (
    x &&
    typeof x.headline === "string" &&
    typeof x.light_roast === "string" &&
    typeof x.savage_roast === "string" &&
    typeof x.verdict === "string"
  );
}

export async function generateOpenAIRoast(
  analysis: WalletRoastAnalysis
): Promise<RoastText> {
  const client = getWalletRoastOpenAIClient();

  const response = await client.responses.create({
    model: walletRoastConfig.openaiModel,
    instructions:
      "You are Cookieverse Wallet Roast writer. Output strict JSON only.",
    input: buildRoastPrompt(analysis),
  });

  const parsed = parseJson(response.output_text || "{}");

  if (!isValidRoast(parsed)) {
    throw new Error("Invalid OpenAI roast response shape");
  }

  return parsed;
}