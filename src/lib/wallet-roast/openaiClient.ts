import OpenAI from "openai";

let client: OpenAI | null = null;

export function getWalletRoastOpenAIClient() {
  if (client) return client;

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY_MFC_NEW,
  });

  return client;
}