import { AGENT_PROMPTS } from "@/lib/ai/prompts";
import type { AgentResult, AgentStepParams } from "@/lib/ai/schemas";
import { runGenericAgentStep } from "@/lib/agents/shared";
import { estimateBudget } from "@/lib/services/budget";

function inferComplexity(prompt: string): "low" | "medium" | "high" {
  const text = prompt.toLowerCase();
  if (text.includes("enterprise") || text.includes("marketplace") || text.includes("platform")) {
    return "high";
  }
  if (text.includes("mvp") || text.includes("prototype")) {
    return "low";
  }
  return "medium";
}

function inferAiUsage(prompt: string): "low" | "medium" | "high" {
  const text = prompt.toLowerCase();
  if (text.includes("agent") || text.includes("ai-first") || text.includes("copilot")) {
    return "high";
  }
  if (text.includes("automation")) {
    return "medium";
  }
  return "low";
}

export async function runAgentStep(params: AgentStepParams): Promise<AgentResult> {
  const budget = estimateBudget({
    appComplexity: inferComplexity(params.prompt),
    users: 1000,
    aiUsage: inferAiUsage(params.prompt),
  });

  const enrichedParams: AgentStepParams = {
    ...params,
    prompt: `${params.prompt}\n\nBase deterministic estimate: ${JSON.stringify(budget)}`,
    context: {
      ...params.context,
      deterministicBudget: budget,
    },
  };

  const result = await runGenericAgentStep(enrichedParams, {
    agentId: "finance",
    systemPrompt: AGENT_PROMPTS.finance,
  });

  return {
    ...result,
    structured: {
      ...result.structured,
      deterministicBudget: budget,
    },
  };
}
