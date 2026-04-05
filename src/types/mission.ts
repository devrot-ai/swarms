import type { AgentKey } from "@/lib/ai/schemas";

export type MissionStatus = "draft" | "planning" | "running" | "completed" | "failed";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "needs_review";

export interface MissionRow {
  id: string;
  user_id: string | null;
  title: string;
  original_prompt: string;
  status: MissionStatus;
  company_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface MissionStepRow {
  id: string;
  mission_id: string;
  agent_key: AgentKey;
  title: string;
  description: string;
  status: StepStatus;
  step_order: number;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  depends_on: string[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentOutputRow {
  id: string;
  mission_id: string;
  step_id: string;
  agent_key: AgentKey;
  kind: string;
  content_md: string | null;
  content_json: Record<string, unknown>;
  version: number;
  created_at: string;
}

export interface MissionEventRow {
  id: string;
  mission_id: string;
  step_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
