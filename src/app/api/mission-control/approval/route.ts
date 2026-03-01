import { NextRequest, NextResponse } from "next/server";
import { recordApproval } from "@/lib/mission-control/missionControl";

interface ApprovalInput {
  sessionId: string;
  requestedByAgentId: string;
  actionType: string;
  approvedBy: string;
  approved: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ApprovalInput;

    if (!body.sessionId || !body.requestedByAgentId || !body.actionType || !body.approvedBy) {
      return NextResponse.json(
        { error: "Missing required fields for approval record." },
        { status: 400 },
      );
    }

    const approval = recordApproval(
      body.sessionId,
      body.requestedByAgentId,
      body.actionType,
      body.approvedBy,
      body.approved,
    );

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to record approval.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
