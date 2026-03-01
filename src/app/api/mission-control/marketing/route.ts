import { NextRequest, NextResponse } from "next/server";
import { buildMarketingCampaign } from "@/lib/mission-control/marketingAgent";
import { MarketingAgentRequest } from "@/lib/mission-control/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MarketingAgentRequest;

    if (!body?.brief || body.brief.trim().length < 12) {
      return NextResponse.json(
        {
          error: "Invalid input. 'brief' is required and must be descriptive.",
        },
        { status: 400 },
      );
    }

    const result = await buildMarketingCampaign(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate Marketing-Dept-Agent output.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
