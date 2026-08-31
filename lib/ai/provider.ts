import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getGeminiApiKey } from "@/lib/ai/gemini-key";

/** Provider Gemini działający na kluczu osoby, która zadaje pytanie. */
export async function getGoogleProvider(userId: string) {
  return createGoogleGenerativeAI({ apiKey: await getGeminiApiKey(userId) });
}
