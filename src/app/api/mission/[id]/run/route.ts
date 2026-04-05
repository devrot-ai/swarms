import { NextRequest, NextResponse } from "next/server";
import { startMissionRun } from "@/lib/orchestrator/runner";
import { logMissionEvent } from "@/lib/orchestrator/events";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Optional guard: when provided, secret must match, but local/dev UI can call without it.
    const workerSecret = process.env.WORKER_SECRET;
    const provided = request.headers.get("x-worker-secret");
    if (workerSecret && provided && provided !== workerSecret) {
      return NextResponse.json({ error: "Unauthorized worker trigger." }, { status: 401 });
    }

    const result = startMissionRun(id);

    await logMissionEvent({
      missionId: id,
      eventType: result.accepted ? "mission_run_requested" : "mission_run_rejected",
      payload: {
        accepted: result.accepted,
        reason: result.reason ?? null,
      },
    });

    return NextResponse.json(
      {
        missionId: id,
        accepted: result.accepted,
        reason: result.reason ?? null,
      },
      { status: result.accepted ? 202 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to start mission run.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
