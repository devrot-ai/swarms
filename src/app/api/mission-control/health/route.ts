import { NextResponse } from "next/server";
import {
  listAvailableModels,
  isOllamaReachable,
  isOpenAIConfigured,
  isGeminiConfigured,
} from "@/lib/mission-control/llm";

export async function GET() {
  const [models, ollamaUp] = await Promise.all([
    listAvailableModels(),
    isOllamaReachable(),
  ]);

  // Default to first free demo model
  const defaultModel = models.find(m => m.isFree)?.model ?? models[0]?.model ?? "";

  return NextResponse.json({
    status: "ok",
    providers: {
      openai: isOpenAIConfigured(),
      google: isGeminiConfigured(),
      ollama: ollamaUp,
      demo: true, // Always available via Vercel AI Gateway
    },
    models,
    selectedModel: defaultModel,
  });
}
