import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MissionStepRow, StepStatus } from "@/types/mission";

function nowIso() {
  return new Date().toISOString();
}

export async function listMissionSteps(missionId: string): Promise<MissionStepRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mission_steps")
    .select("*")
    .eq("mission_id", missionId)
    .order("step_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load mission steps: ${error.message}`);
  }

  return (data ?? []) as MissionStepRow[];
}

export async function getNextRunnableStep(missionId: string): Promise<MissionStepRow | null> {
  const steps = await listMissionSteps(missionId);
  const completedIds = new Set(
    steps.filter((step) => step.status === "completed").map((step) => step.id),
  );

  const next = steps.find((step) => {
    if (step.status !== "pending") {
      return false;
    }

    const dependencies = step.depends_on ?? [];
    return dependencies.every((depId) => completedIds.has(depId));
  });

  return next ?? null;
}

export async function setMissionStepStatus(
  missionId: string,
  stepId: string,
  status: StepStatus,
  extra: Record<string, unknown> = {},
) {
  const supabase = getSupabaseAdmin();

  const payload: Record<string, unknown> = {
    status,
    ...extra,
  };

  if (status === "running") {
    payload.started_at = nowIso();
  }

  if (status === "completed" || status === "failed" || status === "needs_review") {
    payload.completed_at = nowIso();
  }

  const { error } = await supabase
    .from("mission_steps")
    .update(payload)
    .eq("id", stepId)
    .eq("mission_id", missionId);

  if (error) {
    throw new Error(`Failed to update mission step status: ${error.message}`);
  }
}

export async function getMissionStepSummary(missionId: string) {
  const steps = await listMissionSteps(missionId);

  return {
    total: steps.length,
    pending: steps.filter((step) => step.status === "pending").length,
    running: steps.filter((step) => step.status === "running").length,
    completed: steps.filter((step) => step.status === "completed").length,
    failed: steps.filter((step) => step.status === "failed").length,
    needs_review: steps.filter((step) => step.status === "needs_review").length,
  };
}
