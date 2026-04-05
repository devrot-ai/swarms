import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MissionRow } from "@/types/mission";
import { logMissionEvent } from "@/lib/orchestrator/events";

export async function createMission(userId: string | null, prompt: string): Promise<MissionRow> {
  const supabase = getSupabaseAdmin();
  const title = prompt.slice(0, 80);

  const { data, error } = await supabase
    .from("missions")
    .insert({
      user_id: userId,
      title,
      original_prompt: prompt,
      status: "planning",
      company_mode: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create mission: ${error?.message ?? "Unknown error"}`);
  }

  await logMissionEvent({
    missionId: data.id,
    eventType: "mission_created",
    payload: { prompt },
  });

  return data as MissionRow;
}
