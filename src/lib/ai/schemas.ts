import { z } from "zod";

export const AGENT_KEYS = [
  "coordinator",
  "analyst",
  "product",
  "engineer",
  "finance",
  "marketing",
  "observer",
] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export const AgentKeySchema = z.enum(AGENT_KEYS);

export const MissionPlanStepSchema = z.object({
  agent_key: AgentKeySchema,
  title: z.string().min(3),
  description: z.string().min(8),
  step_order: z.number().int().positive(),
  depends_on_orders: z.array(z.number().int().positive()).optional().default([]),
});

export const MissionPlanSchema = z.object({
  title: z.string().min(3),
  summary: z.string().min(8),
  steps: z.array(MissionPlanStepSchema).min(5).max(8),
});

export type MissionPlanStep = z.infer<typeof MissionPlanStepSchema>;

export type MissionPlan = z.infer<typeof MissionPlanSchema>;

export interface AgentStepParams {
  missionId: string;
  stepId: string;
  prompt: string;
  context: Record<string, unknown>;
}

export interface AgentResult {
  summary: string;
  markdown: string;
  structured: Record<string, unknown>;
  confidence: number;
  needsRevision: boolean;
}
