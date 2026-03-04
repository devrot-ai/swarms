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

  return NextResponse.json({
    status: "ok",
    providers: {
      openai: isOpenAIConfigured(),
      google: isGeminiConfigured(),
      ollama: ollamaUp,
    },
    models,
    selectedModel: models[0]?.model ?? "",
  });
}
