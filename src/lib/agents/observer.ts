import { AGENT_PROMPTS } from "@/lib/ai/prompts";
import type { AgentResult, AgentStepParams } from "@/lib/ai/schemas";
import { runGenericAgentStep } from "@/lib/agents/shared";

export async function runAgentStep(params: AgentStepParams): Promise<AgentResult> {
  const result = await runGenericAgentStep(params, {
    agentId: "observer",
    systemPrompt: AGENT_PROMPTS.observer,
  });

  const outputCount = Number(params.context.outputCount ?? 0);
  const needsRevision = outputCount < 5;

  if (!needsRevision) {
    return result;
  }

  return {
    ...result,
    needsRevision: true,
    summary: "Observer flagged missing outputs and requested revision",
    markdown: `${result.markdown}\n\n## Observer Review\nInsufficient prior outputs were found for a full package. Request a step retry after adding missing artifacts.`,
    structured: {
      ...result.structured,
      review: {
        missingOutputs: Math.max(0, 5 - outputCount),
      },
    },
  };
}
