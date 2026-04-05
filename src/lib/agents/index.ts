import type { AgentKey, AgentResult, AgentStepParams } from "@/lib/ai/schemas";
import { runAgentStep as runCoordinator } from "@/lib/agents/coordinator";
import { runAgentStep as runAnalyst } from "@/lib/agents/analyst";
import { runAgentStep as runProduct } from "@/lib/agents/product";
import { runAgentStep as runEngineer } from "@/lib/agents/engineer";
import { runAgentStep as runFinance } from "@/lib/agents/finance";
import { runAgentStep as runMarketing } from "@/lib/agents/marketing";
import { runAgentStep as runObserver } from "@/lib/agents/observer";

type AgentRunner = (params: AgentStepParams) => Promise<AgentResult>;

const AGENT_RUNNERS: Record<AgentKey, AgentRunner> = {
  coordinator: runCoordinator,
  analyst: runAnalyst,
  product: runProduct,
  engineer: runEngineer,
  finance: runFinance,
  marketing: runMarketing,
  observer: runObserver,
};

export async function runAgentByKey(
  agentKey: AgentKey,
  params: AgentStepParams,
): Promise<AgentResult> {
  const runner = AGENT_RUNNERS[agentKey];
  return runner(params);
}
