import { MODELS } from "@/lib/ai/models";
import type { AgentResult, AgentStepParams } from "@/lib/ai/schemas";
import { agentChat } from "@/lib/mission-control/llm";

interface SharedAgentOptions {
  agentId: string;
  systemPrompt: string;
}

function safeToJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildContextText(context: Record<string, unknown>): string {
  return [
    "Mission context:",
    safeToJson(context),
    "",
    "Return an actionable response with:",
    "1) concise summary",
    "2) detailed markdown deliverable",
    "3) structured checkpoints as JSON",
  ].join("\n");
}

export async function runGenericAgentStep(
  params: AgentStepParams,
  options: SharedAgentOptions,
): Promise<AgentResult> {
  const contextText = buildContextText(params.context);

  try {
    const result = await agentChat(
      options.agentId,
      `${options.systemPrompt}\n\nTask:\n${params.prompt}`,
      contextText,
      MODELS.fast,
    );

    const markdown = result.content.trim();
    const summary = markdown.split("\n")[0]?.slice(0, 180) ?? "Step completed";

    return {
      summary,
      markdown,
      structured: {
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
      },
      confidence: 0.78,
      needsRevision: false,
    };
  } catch {
    const markdown = [
      `## ${options.agentId} output`,
      "",
      "No external model provider was reachable. Generated deterministic fallback deliverable.",
      "",
      "### Task",
      params.prompt,
      "",
      "### Context snapshot",
      "```json",
      safeToJson(params.context),
      "```",
    ].join("\n");

    return {
      summary: `${options.agentId} fallback output generated`,
      markdown,
      structured: {
        provider: "none",
        model: "deterministic-fallback",
      },
      confidence: 0.64,
      needsRevision: false,
    };
  }
}
