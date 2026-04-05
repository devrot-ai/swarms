import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logMissionEvent } from "@/lib/orchestrator/events";
import { startMissionRun } from "@/lib/orchestrator/runner";

interface RouteContext {
  params: Promise<{ id: string; stepId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id, stepId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("mission_steps")
      .update({
        status: "pending",
        started_at: null,
        completed_at: null,
      })
      .eq("mission_id", id)
      .eq("id", stepId);

    if (error) {
      throw new Error(error.message);
    }

    await logMissionEvent({
      missionId: id,
      stepId,
      eventType: "step_retry_requested",
      payload: {
        stepId,
      },
    });

    const run = startMissionRun(id);

    return NextResponse.json({
      missionId: id,
      stepId,
      runAccepted: run.accepted,
      runReason: run.reason ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to retry mission step.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
