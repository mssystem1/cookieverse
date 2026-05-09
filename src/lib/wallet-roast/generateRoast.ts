import { walletRoastConfig } from "./config";
import { generateOpenAIRoast } from "./generateOpenAIRoast";
import { generateOgRoast } from "./generateOgRoast";
import type { WalletRoastAnalysis, RoastText } from "./types";

export async function generateRoast(
  analysis: WalletRoastAnalysis
): Promise<RoastText> {
  if (walletRoastConfig.provider === "og") {
    return generateOgRoast(analysis);
  }

  return generateOpenAIRoast(analysis);
}