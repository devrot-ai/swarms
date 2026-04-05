import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("mission_events")
      .select("*")
      .eq("mission_id", id)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      missionId: id,
      events: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch mission events.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
