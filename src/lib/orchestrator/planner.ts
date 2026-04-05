import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MissionPlan } from "@/lib/ai/schemas";

interface StepInsertRow {
  id: string;
  mission_id: string;
  agent_key: string;
  title: string;
  description: string;
  step_order: number;
  depends_on: string[];
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: "pending";
}

export async function saveMissionPlan(missionId: string, plan: MissionPlan): Promise<void> {
  const supabase = getSupabaseAdmin();
  const ordered = [...plan.steps].sort((a, b) => a.step_order - b.step_order);

  const orderToId = new Map<number, string>();
  for (const step of ordered) {
    orderToId.set(step.step_order, crypto.randomUUID());
  }

  const rows: StepInsertRow[] = ordered.map((step) => {
    const stepId = orderToId.get(step.step_order);
    if (!stepId) {
      throw new Error("Failed to create mission step id.");
    }

    const dependsOn = (step.depends_on_orders ?? [])
      .map((depOrder) => orderToId.get(depOrder))
      .filter((depId): depId is string => Boolean(depId));

    return {
      id: stepId,
      mission_id: missionId,
      agent_key: step.agent_key,
      title: step.title,
      description: step.description,
      step_order: step.step_order,
      depends_on: dependsOn,
      input_json: {},
      output_json: {},
      status: "pending",
    };
  });

  const { error } = await supabase.from("mission_steps").insert(rows);
  if (error) {
    throw new Error(`Failed to save mission plan: ${error.message}`);
  }
}
