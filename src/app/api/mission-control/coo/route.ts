import { NextRequest, NextResponse } from "next/server";
import { buildCooTasks } from "@/lib/mission-control/cooAgent";
import { CooAgentRequest } from "@/lib/mission-control/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CooAgentRequest;

    if (!body?.mission || body.mission.trim().length < 12) {
      return NextResponse.json(
        {
          error: "Invalid input. 'mission' is required and must be descriptive.",
        },
        { status: 400 },
      );
    }

    const result = buildCooTasks(body);
    return NextResponse.json(result.tasks, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to build COO task plan.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
