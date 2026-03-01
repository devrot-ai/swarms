import { NextResponse } from "next/server";
import { listSessionArtifacts } from "@/lib/mission-control/missionControl";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const artifacts = listSessionArtifacts(sessionId);
  return NextResponse.json({ sessionId, artifacts }, { status: 200 });
}
