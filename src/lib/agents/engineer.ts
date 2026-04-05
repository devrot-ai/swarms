import { AGENT_PROMPTS } from "@/lib/ai/prompts";
import type { AgentResult, AgentStepParams } from "@/lib/ai/schemas";
import { runGenericAgentStep } from "@/lib/agents/shared";

export async function runAgentStep(params: AgentStepParams): Promise<AgentResult> {
  return runGenericAgentStep(params, {
    agentId: "engineer",
    systemPrompt: AGENT_PROMPTS.engineer,
  });
}
