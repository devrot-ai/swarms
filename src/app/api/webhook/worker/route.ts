import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startMissionRun } from "@/lib/orchestrator/runner";
import { logMissionEvent } from "@/lib/orchestrator/events";

const WorkerWebhookSchema = z.object({
  missionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.WORKER_SECRET;
    const provided = request.headers.get("x-worker-secret");

    if (!expected || provided !== expected) {
      return NextResponse.json({ error: "Unauthorized worker webhook." }, { status: 401 });
    }

    const body = await request.json();
    const { missionId } = WorkerWebhookSchema.parse(body);
    const result = startMissionRun(missionId);

    await logMissionEvent({
      missionId,
      eventType: result.accepted ? "worker_dispatch_accepted" : "worker_dispatch_rejected",
      payload: {
        accepted: result.accepted,
        reason: result.reason ?? null,
      },
    });

    return NextResponse.json(
      {
        missionId,
        accepted: result.accepted,
        reason: result.reason ?? null,
      },
      { status: result.accepted ? 202 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to dispatch worker mission run.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
