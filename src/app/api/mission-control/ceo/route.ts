import { NextRequest, NextResponse } from "next/server";
import { buildCeoPlan } from "@/lib/mission-control/ceoAgent";
import { CeoAgentRequest } from "@/lib/mission-control/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CeoAgentRequest;

    if (!body?.userBrief || body.userBrief.trim().length < 12) {
      return NextResponse.json(
        {
          error: "Invalid input. 'userBrief' is required and must be descriptive.",
        },
        { status: 400 },
      );
    }

    const plan = buildCeoPlan(body);
    return NextResponse.json(plan, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate CEO plan.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
