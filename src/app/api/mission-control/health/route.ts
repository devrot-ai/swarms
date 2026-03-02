import { NextResponse } from "next/server";
import { isOllamaReachable, listModels } from "@/lib/mission-control/llm";

/**
 * GET /api/mission-control/health
 * Quick check whether Ollama is reachable and which models are available.
 */
export async function GET() {
  const reachable = await isOllamaReachable();
  const models = reachable ? await listModels() : [];
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const selectedModel = process.env.OLLAMA_MODEL || "llama3";

  return NextResponse.json({
    ollama: {
      reachable,
      url: ollamaUrl,
      selectedModel,
      availableModels: models,
    },
    help: reachable
      ? "Ollama is running. You're good to go."
      : `Ollama is not reachable at ${ollamaUrl}. Run: ollama serve`,
  });
}
