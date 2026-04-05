import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const [missionResp, stepsResp, outputsResp] = await Promise.all([
      supabase.from("missions").select("*").eq("id", id).single(),
      supabase.from("mission_steps").select("*").eq("mission_id", id).order("step_order", { ascending: true }),
      supabase.from("agent_outputs").select("*").eq("mission_id", id).order("created_at", { ascending: true }),
    ]);

    if (missionResp.error || !missionResp.data) {
      return NextResponse.json(
        { error: missionResp.error?.message ?? "Mission not found." },
        { status: 404 },
      );
    }

    if (stepsResp.error) {
      throw new Error(stepsResp.error.message);
    }

    if (outputsResp.error) {
      throw new Error(outputsResp.error.message);
    }

    return NextResponse.json({
      mission: missionResp.data,
      steps: stepsResp.data ?? [],
      outputs: outputsResp.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch mission.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
