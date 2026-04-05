import { NextRequest, NextResponse } from "next/server";
import { createMission } from "@/lib/orchestrator/createMission";
import { generateMissionPlan } from "@/lib/ai/planner";
import { saveMissionPlan } from "@/lib/orchestrator/planner";
import { logMissionEvent } from "@/lib/orchestrator/events";

interface CreateMissionRequest {
  userId?: string;
  prompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateMissionRequest;
    const prompt = body.prompt?.trim();
    const userId = body.userId?.trim() ?? null;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt." },
        { status: 400 },
      );
    }

    const mission = await createMission(userId, prompt);
    const plan = await generateMissionPlan(prompt);
    await saveMissionPlan(mission.id, plan);

    await logMissionEvent({
      missionId: mission.id,
      eventType: "mission_planned",
      payload: {
        steps: plan.steps.length,
      },
    });

    return NextResponse.json({
      missionId: mission.id,
      mission,
      plan,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create mission.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
