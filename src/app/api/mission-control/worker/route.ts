import { NextRequest, NextResponse } from "next/server";
import { runWorkerTask } from "@/lib/mission-control/workerAgent";
import { WorkerAgentRequest } from "@/lib/mission-control/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WorkerAgentRequest;

    if (!body?.workerType || !body?.task || !Array.isArray(body.allowed_tool_uris)) {
      return NextResponse.json(
        {
          error:
            "Invalid input. 'workerType', 'task', and 'allowed_tool_uris' are required.",
        },
        { status: 400 },
      );
    }

    const result = runWorkerTask(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to execute Worker-Agent task.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
