import { agentChat } from "@/lib/mission-control/llm";
import { MODELS } from "@/lib/ai/models";
import {
  AgentKey,
  MissionPlan,
  MissionPlanSchema,
} from "@/lib/ai/schemas";
import { PLANNER_SYSTEM_PROMPT } from "@/lib/ai/prompts";

function fallbackPlan(prompt: string): MissionPlan {
  const title = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;

  return {
    title,
    summary: "Structured company-style mission plan generated with deterministic fallback.",
    steps: [
      {
        agent_key: "analyst",
        title: "Market and competitor research",
        description:
          "Map customer segments, alternatives, pricing patterns, and differentiation opportunities.",
        step_order: 1,
        depends_on_orders: [],
      },
      {
        agent_key: "product",
        title: "Draft product requirements",
        description:
          "Define target users, MVP scope, user journeys, success metrics, and rollout milestones.",
        step_order: 2,
        depends_on_orders: [1],
      },
      {
        agent_key: "engineer",
        title: "Design technical architecture",
        description:
          "Provide core architecture, service boundaries, data model, and delivery phases for implementation.",
        step_order: 3,
        depends_on_orders: [2],
      },
      {
        agent_key: "finance",
        title: "Estimate build and run budget",
        description:
          "Estimate development, infrastructure, AI usage, and operating costs with assumptions.",
        step_order: 4,
        depends_on_orders: [2],
      },
      {
        agent_key: "marketing",
        title: "Build launch and GTM plan",
        description:
          "Define positioning, channels, content plan, and phased acquisition strategy for launch.",
        step_order: 5,
        depends_on_orders: [2],
      },
      {
        agent_key: "observer",
        title: "Review final mission package",
        description:
          "Review all outputs for gaps, contradictions, and missing decisions, then request revisions if needed.",
        step_order: 6,
        depends_on_orders: [3, 4, 5],
      },
    ],
  };
}

function extractJsonPayload(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Planner did not return JSON.");
  }

  const jsonText = cleaned.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function sortAndNormalize(plan: MissionPlan): MissionPlan {
  const normalizedSteps = [...plan.steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((step, index) => ({
      ...step,
      step_order: index + 1,
      depends_on_orders:
        step.depends_on_orders?.filter((dep) => dep > 0 && dep <= plan.steps.length) ?? [],
    }));

  return {
    ...plan,
    steps: normalizedSteps,
  };
}

function isAgentKey(value: string): value is AgentKey {
  return [
    "coordinator",
    "analyst",
    "product",
    "engineer",
    "finance",
    "marketing",
    "observer",
  ].includes(value);
}

function coerceAgentNames(plan: MissionPlan): MissionPlan {
  const aliasMap: Record<string, AgentKey> = {
    ceo: "coordinator",
    coordinator: "coordinator",
    scout: "analyst",
    analyst: "analyst",
    sage: "product",
    product: "product",
    minion: "engineer",
    engineer: "engineer",
    budgeter: "finance",
    finance: "finance",
    quill: "marketing",
    xalt: "marketing",
    marketing: "marketing",
    observer: "observer",
    qa: "observer",
  };

  return {
    ...plan,
    steps: plan.steps.map((step) => {
      const raw = String(step.agent_key).toLowerCase();
      const normalized = aliasMap[raw] ?? step.agent_key;
      return {
        ...step,
        agent_key: isAgentKey(normalized) ? normalized : "coordinator",
      };
    }),
  };
}

export async function generateMissionPlan(prompt: string): Promise<MissionPlan> {
  try {
    const result = await agentChat(
      "planner_agent",
      `User request: ${prompt}\n\nReturn JSON only.`,
      PLANNER_SYSTEM_PROMPT,
      MODELS.fast,
    );

    const parsed = extractJsonPayload(result.content);
    const validated = MissionPlanSchema.parse(parsed);
    return sortAndNormalize(coerceAgentNames(validated));
  } catch {
    return fallbackPlan(prompt);
  }
}
