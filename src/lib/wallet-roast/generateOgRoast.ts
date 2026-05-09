/*
import { buildRoastPrompt } from "./buildRoastPrompt";
import { walletRoastConfig } from "./config";
import { createOgOpenAIClient } from "./ogRoastClient";
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

export async function generateOgRoast(
  analysis: WalletRoastAnalysis
): Promise<RoastText> {
  const prompt = buildRoastPrompt(analysis);
  const { broker, openai, model } = await createOgOpenAIClient(prompt);

  const completion = await openai.chat.completions.create({
    model: walletRoastConfig.ogModel || model,
    messages: [
      {
        role: "system",
        content: "You are Cookieverse Wallet Roast writer. Return strict JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.8,
  });

  const content = completion.choices?.[0]?.message?.content || "{}";

  await broker.inference.processResponse(
    walletRoastConfig.ogProviderAddress,
    completion.id,
    content
  );

  const parsed = parseJson(content);

  if (!isValidRoast(parsed)) {
    throw new Error("Invalid 0G roast response shape");
  }

  return parsed;
}
*/


import { buildRoastPrompt } from "./buildRoastPrompt";
import { createOgOpenAIClient } from "./ogRoastClient";
import type { WalletRoastAnalysis, RoastText } from "./types";

function parseJson(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue below
  }

  const fenced =
    trimmed.match(/```json\s*([\s\S]*?)```/i)?.[1] ||
    trimmed.match(/```\s*([\s\S]*?)```/i)?.[1];

  if (fenced) {
    return JSON.parse(fenced.trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("0G response did not contain valid JSON");
}

function isValidRoast(value: unknown): value is RoastText {
  if (!value || typeof value !== "object") return false;

  const roast = value as Partial<RoastText>;

  return (
    typeof roast.headline === "string" &&
    roast.headline.trim().length > 0 &&
    typeof roast.light_roast === "string" &&
    roast.light_roast.trim().length > 0 &&
    typeof roast.savage_roast === "string" &&
    roast.savage_roast.trim().length > 0 &&
    typeof roast.verdict === "string" &&
    roast.verdict.trim().length > 0
  );
}

function normalizeRoast(roast: RoastText): RoastText {
  return {
    headline: roast.headline.trim(),
    light_roast: roast.light_roast.trim(),
    savage_roast: roast.savage_roast.trim(),
    verdict: roast.verdict.trim(),
  };
}

export async function generateOgRoast(
  analysis: WalletRoastAnalysis
): Promise<RoastText> {
  const prompt = buildRoastPrompt(analysis);

  const { broker, openai, model, providerAddress } =
    await createOgOpenAIClient(prompt);

  const { data: completion, response } =
    await openai.chat.completions
      .create({
        /**
         * Use model from 0G provider metadata.
         * Do not override it with walletRoastConfig.ogModel here.
         */
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Cookieverse Wallet Roast writer. Return strict JSON only. Do not use markdown. Do not add explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
      })
      .withResponse();

  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty 0G roast response");
  }

  const chatId =
    response.headers.get("ZG-Res-Key") ||
    response.headers.get("zg-res-key") ||
    completion.id;

  if (!chatId) {
    throw new Error("Missing 0G chat response id");
  }

  /**
   * Your current SDK pattern uses:
   * getRequestHeaders(providerAddress, prompt)
   * processResponse(providerAddress, chatId, content)
   */
  await broker.inference.processResponse(providerAddress, chatId, content);

  const parsed = parseJson(content);

  if (!isValidRoast(parsed)) {
    throw new Error(`Invalid 0G roast response shape. Raw response: ${content}`);
  }

  return normalizeRoast(parsed);
}