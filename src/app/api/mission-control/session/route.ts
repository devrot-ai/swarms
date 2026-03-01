import { NextRequest, NextResponse } from "next/server";
import { startMissionSession } from "@/lib/mission-control/missionControl";
import { StartSessionRequest } from "@/lib/mission-control/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartSessionRequest;

    if (!body?.mission?.projectName || !body?.mission?.objective) {
      return NextResponse.json(
        { error: "Invalid mission input. 'projectName' and 'objective' are required." },
        { status: 400 },
      );
    }

    const result = startMissionSession(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to initialize mission control session.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
