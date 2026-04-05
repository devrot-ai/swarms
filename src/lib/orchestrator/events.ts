import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function logMissionEvent(input: {
  missionId: string;
  stepId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("mission_events").insert({
    mission_id: input.missionId,
    step_id: input.stepId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
  });

  if (error) {
    throw new Error(`Failed to log mission event: ${error.message}`);
  }
}
