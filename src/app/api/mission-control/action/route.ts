import { NextRequest, NextResponse } from "next/server";
import { executeActionWithGate } from "@/lib/mission-control/missionControl";
import { ActionRisk } from "@/lib/mission-control/types";

interface ActionInput {
  sessionId: string;
  actorId: string;
  actionType: string;
  actionRisk: ActionRisk;
  payload?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ActionInput;

    if (!body.sessionId || !body.actorId || !body.actionType || !body.actionRisk) {
      return NextResponse.json(
        { error: "Missing required fields for action execution." },
        { status: 400 },
      );
    }

    const result = executeActionWithGate(
      body.sessionId,
      body.actorId,
      body.actionType,
      body.actionRisk,
      body.payload ?? {},
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process action.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
